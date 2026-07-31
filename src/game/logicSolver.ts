import type { Level, SolutionRect } from './types';

// Human-technique Shikaku solver.
//
// solver.ts answers "does this puzzle have exactly one solution?" by brute-force
// backtracking. That is a correctness gate, but its `nodes` count is a poor difficulty
// signal: it measures how much *search* a machine does, not how much *deduction* a person
// does. This module instead solves the way a player does — enumerate each clue's legal
// rectangles, then repeatedly apply named deduction rules until the board resolves.
//
// The rules are ordered by how hard they are for a human to spot. The hardest rule a level
// forces you to reach is a real, monotone difficulty scale, and a level that stalls before
// every rule is exhausted is one that can only be finished by guessing — which we can now
// detect and reject.

export const TECHNIQUE_NAMES = ['forcedShape', 'soleCoverage', 'sharedCell', 'contradiction'] as const;
export type TechniqueName = (typeof TECHNIQUE_NAMES)[number];

/** 0 = solved with no deduction at all, 1..4 = hardest technique index, 5 = guessing required. */
export const GUESS_REQUIRED = 5;

export interface LogicGrade {
  /** True when the level resolves completely through the rules below — never needs a guess. */
  solvedByLogic: boolean;
  /** Rules ran dry with cells still unresolved. Such a level is unfair and should be rejected. */
  needsGuess: boolean;
  /** Hardest technique the level forced. 0..4, or GUESS_REQUIRED. */
  deepest: number;
  /** How many times each technique fired, indexed to TECHNIQUE_NAMES. */
  steps: [number, number, number, number];
  /** Legal rectangles across all clues before any deduction — the level's raw ambiguity. */
  candidateTotal: number;
  /** Mean legal rectangles per clue. Board-size independent, unlike candidateTotal. */
  candidatesPerClue: number;
  /** Single number combining the above; see SCORE_WEIGHTS. */
  score: number;
}

// Deeper techniques dominate: reaching a rule at all matters more than how often the
// easier rules fired. Within one tier, step counts break the tie — a level needing thirty
// sharedCell deductions is a longer solve than one needing three.
const SCORE_WEIGHTS = { depth: 10_000, contradiction: 60, sharedCell: 12, soleCoverage: 4, forcedShape: 1 };

/** Hypotheses the contradiction rule may test per level before giving up on it. */
const LOOKAHEAD_BUDGET = 600;

interface Candidate {
  r1: number;
  c1: number;
  r2: number;
  c2: number;
  mask: Uint32Array;
}

interface State {
  cand: Candidate[][];
  /** Cells proven to belong to each clue, whether or not its rectangle is pinned down yet. */
  owned: Uint32Array[];
  ownedAny: Uint32Array;
  placed: boolean[];
  placedCount: number;
}

// Cell sets are bitmasks so overlap tests are a handful of word ANDs instead of a nested
// loop over up to 16 cells — this solver runs hundreds of times per generated level.
function wordCount(size: number): number {
  return Math.ceil((size * size) / 32);
}

function rectMask(size: number, words: number, r1: number, c1: number, r2: number, c2: number): Uint32Array {
  const mask = new Uint32Array(words);
  for (let r = r1; r < r2; r++) {
    for (let c = c1; c < c2; c++) {
      const bit = r * size + c;
      mask[bit >>> 5] |= 1 << (bit & 31);
    }
  }
  return mask;
}

/** True when `a` and `b` share no cell. */
function disjoint(a: Uint32Array, b: Uint32Array): boolean {
  for (let i = 0; i < a.length; i++) {
    if ((a[i] & b[i]) !== 0) return false;
  }
  return true;
}

/** True when every cell of `sub` is also in `sup`. */
function contains(sup: Uint32Array, sub: Uint32Array): boolean {
  for (let i = 0; i < sub.length; i++) {
    if ((sub[i] & ~sup[i]) !== 0) return false;
  }
  return true;
}

function orInto(target: Uint32Array, add: Uint32Array): boolean {
  let changed = false;
  for (let i = 0; i < target.length; i++) {
    const next = target[i] | add[i];
    if (next !== target[i]) {
      target[i] = next;
      changed = true;
    }
  }
  return changed;
}

function hasBit(mask: Uint32Array, bit: number): boolean {
  return (mask[bit >>> 5] & (1 << (bit & 31))) !== 0;
}

/**
 * Every rectangle of the clue's area that covers the clue cell, fits the board, and swallows
 * no other clue. This is exactly the set of shapes a player would consider for that number.
 */
function enumerateCandidates(level: Level): Candidate[][] {
  const { size, clues } = level;
  const words = wordCount(size);

  return clues.map(clue => {
    const out: Candidate[] = [];
    for (let w = 1; w <= clue.v; w++) {
      if (clue.v % w !== 0) continue;
      const h = clue.v / w;
      if (w > size || h > size) continue;

      const r1min = Math.max(0, clue.r - h + 1);
      const r1max = Math.min(size - h, clue.r);
      const c1min = Math.max(0, clue.c - w + 1);
      const c1max = Math.min(size - w, clue.c);

      for (let r1 = r1min; r1 <= r1max; r1++) {
        for (let c1 = c1min; c1 <= c1max; c1++) {
          const r2 = r1 + h;
          const c2 = c1 + w;
          const swallowsOtherClue = clues.some(
            other => other !== clue && other.r >= r1 && other.r < r2 && other.c >= c1 && other.c < c2,
          );
          if (swallowsOtherClue) continue;
          out.push({ r1, c1, r2, c2, mask: rectMask(size, words, r1, c1, r2, c2) });
        }
      }
    }
    return out;
  });
}

function initialState(level: Level, cand: Candidate[][]): State {
  const words = wordCount(level.size);
  return {
    cand: cand.map(list => list.slice()),
    owned: cand.map(() => new Uint32Array(words)),
    ownedAny: new Uint32Array(words),
    placed: cand.map(() => false),
    placedCount: 0,
  };
}

function cloneState(state: State): State {
  return {
    cand: state.cand.map(list => list.slice()),
    owned: state.owned.map(mask => mask.slice()),
    ownedAny: state.ownedAny.slice(),
    placed: state.placed.slice(),
    placedCount: state.placedCount,
  };
}

/**
 * Drop candidates that are no longer legal: ones covering a cell another clue has claimed,
 * and ones failing to cover a cell this clue has already been proven to own.
 * Returns false on contradiction (a clue left with nowhere to go).
 */
function prune(state: State): boolean {
  const words = state.ownedAny.length;
  const blocked = new Uint32Array(words);

  for (let ci = 0; ci < state.cand.length; ci++) {
    if (state.placed[ci]) continue;
    const owned = state.owned[ci];
    for (let i = 0; i < words; i++) blocked[i] = state.ownedAny[i] & ~owned[i];

    const kept = state.cand[ci].filter(c => disjoint(c.mask, blocked) && contains(c.mask, owned));
    if (kept.length === 0) return false;
    state.cand[ci] = kept;
  }
  return true;
}

function place(state: State, ci: number, candidate: Candidate): void {
  state.cand[ci] = [candidate];
  orInto(state.owned[ci], candidate.mask);
  orInto(state.ownedAny, candidate.mask);
  state.placed[ci] = true;
  state.placedCount++;
}

/** T1 — a clue has exactly one legal rectangle left. Places every such clue found. */
function sweepForcedShape(state: State): number {
  let applied = 0;
  for (let ci = 0; ci < state.cand.length; ci++) {
    if (state.placed[ci] || state.cand[ci].length !== 1) continue;
    place(state, ci, state.cand[ci][0]);
    applied++;
  }
  return applied;
}

/**
 * T2 — an unclaimed cell that only one clue can possibly reach must belong to that clue.
 * Returns -1 on contradiction (a cell no clue can reach).
 */
function sweepSoleCoverage(state: State, size: number): number {
  const words = state.ownedAny.length;
  const reach = state.cand.map((list, ci) => {
    const mask = new Uint32Array(words);
    if (state.placed[ci]) return mask;
    for (const c of list) orInto(mask, c.mask);
    return mask;
  });

  let applied = 0;
  for (let bit = 0; bit < size * size; bit++) {
    if (hasBit(state.ownedAny, bit)) continue;

    let only = -1;
    for (let ci = 0; ci < reach.length; ci++) {
      if (state.placed[ci] || !hasBit(reach[ci], bit)) continue;
      if (only !== -1) {
        only = -2;
        break;
      }
      only = ci;
    }

    if (only === -1) return -1; // cell unreachable — the board cannot be completed
    if (only < 0) continue;

    const cellMask = new Uint32Array(words);
    cellMask[bit >>> 5] |= 1 << (bit & 31);
    if (orInto(state.owned[only], cellMask)) {
      orInto(state.ownedAny, cellMask);
      applied++;
    }
  }
  return applied;
}

/**
 * T3 — cells shared by *every* remaining candidate of a clue belong to that clue no matter
 * which shape wins. Because candidates are rectangles, their common area is just the
 * intersection rectangle, so this is cheap to compute.
 */
function sweepSharedCell(state: State, size: number): number {
  const words = state.ownedAny.length;
  let applied = 0;

  for (let ci = 0; ci < state.cand.length; ci++) {
    if (state.placed[ci]) continue;
    const list = state.cand[ci];
    if (list.length < 2) continue;

    let r1 = 0;
    let c1 = 0;
    let r2 = size;
    let c2 = size;
    for (const c of list) {
      if (c.r1 > r1) r1 = c.r1;
      if (c.c1 > c1) c1 = c.c1;
      if (c.r2 < r2) r2 = c.r2;
      if (c.c2 < c2) c2 = c.c2;
    }
    if (r1 >= r2 || c1 >= c2) continue;

    const shared = rectMask(size, words, r1, c1, r2, c2);
    if (contains(state.owned[ci], shared)) continue;
    orInto(state.owned[ci], shared);
    orInto(state.ownedAny, shared);
    applied++;
  }
  return applied;
}

type PropagateResult = 'solved' | 'stalled' | 'contradiction';

/** Runs T1–T3 to exhaustion, tallying each application into `steps`. */
function propagate(state: State, size: number, steps: [number, number, number, number]): PropagateResult {
  const total = state.cand.length;

  for (;;) {
    if (!prune(state)) return 'contradiction';
    if (state.placedCount === total) return 'solved';

    const forced = sweepForcedShape(state);
    if (forced > 0) {
      steps[0] += forced;
      continue;
    }

    const sole = sweepSoleCoverage(state, size);
    if (sole === -1) return 'contradiction';
    if (sole > 0) {
      steps[1] += sole;
      continue;
    }

    const shared = sweepSharedCell(state, size);
    if (shared > 0) {
      steps[2] += shared;
      continue;
    }

    return 'stalled';
  }
}

/**
 * T4 — assume one candidate, run T1–T3, and if that collapses into a contradiction the
 * candidate can be struck permanently. This is the "if this, then it breaks" reasoning a
 * strong player does by hand, and it is the last rule before genuine guessing.
 * Returns true if at least one candidate was eliminated.
 */
function sweepContradiction(state: State, size: number, budget: { left: number }): boolean {
  const order = state.cand
    .map((list, ci) => ({ ci, n: list.length }))
    .filter(({ ci, n }) => !state.placed[ci] && n > 1)
    .sort((a, b) => a.n - b.n);

  for (const { ci } of order) {
    for (const candidate of state.cand[ci]) {
      if (budget.left <= 0) return false;
      budget.left--;

      const trial = cloneState(state);
      place(trial, ci, candidate);
      const throwaway: [number, number, number, number] = [0, 0, 0, 0];
      if (propagate(trial, size, throwaway) !== 'contradiction') continue;

      state.cand[ci] = state.cand[ci].filter(other => other !== candidate);
      return true;
    }
  }
  return false;
}

export function gradeLevel(level: Level, options: { lookahead?: boolean } = {}): LogicGrade {
  const useLookahead = options.lookahead ?? true;
  const candidates = enumerateCandidates(level);
  const candidateTotal = candidates.reduce((sum, list) => sum + list.length, 0);
  const candidatesPerClue = candidates.length > 0 ? candidateTotal / candidates.length : 0;

  const state = initialState(level, candidates);
  const steps: [number, number, number, number] = [0, 0, 0, 0];
  const budget = { left: LOOKAHEAD_BUDGET };

  let outcome = propagate(state, level.size, steps);
  while (outcome === 'stalled' && useLookahead) {
    if (!sweepContradiction(state, level.size, budget)) break;
    steps[3]++;
    outcome = propagate(state, level.size, steps);
  }

  const solvedByLogic = outcome === 'solved';
  const needsGuess = !solvedByLogic;

  let deepest = 0;
  if (needsGuess) {
    deepest = GUESS_REQUIRED;
  } else {
    for (let i = steps.length - 1; i >= 0; i--) {
      if (steps[i] > 0) {
        deepest = i + 1;
        break;
      }
    }
  }

  const score =
    deepest * SCORE_WEIGHTS.depth +
    steps[3] * SCORE_WEIGHTS.contradiction +
    steps[2] * SCORE_WEIGHTS.sharedCell +
    steps[1] * SCORE_WEIGHTS.soleCoverage +
    steps[0] * SCORE_WEIGHTS.forcedShape;

  return { solvedByLogic, needsGuess, deepest, steps, candidateTotal, candidatesPerClue, score };
}

/** The rectangles the rules derive, clue-indexed, or null when they stall. */
export function solveByLogic(level: Level): SolutionRect[] | null {
  const state = initialState(level, enumerateCandidates(level));
  const steps: [number, number, number, number] = [0, 0, 0, 0];
  const budget = { left: LOOKAHEAD_BUDGET };

  let outcome = propagate(state, level.size, steps);
  while (outcome === 'stalled') {
    if (!sweepContradiction(state, level.size, budget)) break;
    outcome = propagate(state, level.size, steps);
  }
  if (outcome !== 'solved') return null;

  return state.cand.map(list => {
    const { r1, c1, r2, c2 } = list[0];
    return { r1, c1, r2, c2 };
  });
}

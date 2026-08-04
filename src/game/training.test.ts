import { describe, expect, it } from 'vitest';
import { DIFFS } from './difficulty';
import { solveByLogic } from './logicSolver';
import { generateTrainingLevel, TRAINING_TIERS } from './training';

describe('training tiers', () => {
  it('offers each difficulty the campaign names, once', () => {
    const offered = TRAINING_TIERS.map(tier => tier.label);
    expect(offered).toEqual([...new Set(DIFFS.map(tier => tier.label))]);
  });

  it('takes the hardest board each name covers, which is what asking for it means', () => {
    for (const tier of TRAINING_TIERS) {
      const rows = DIFFS.filter(candidate => candidate.label === tier.label);
      expect(tier.size).toBe(rows[rows.length - 1].size);
    }
  });

  it('climbs: a board never shrinks and the pieces never thin out', () => {
    // Both matter. `master` and `legend` share a 12x12, and the design puts the difference in
    // piece density — so size alone would not tell them apart.
    for (let i = 1; i < TRAINING_TIERS.length; i++) {
      expect(TRAINING_TIERS[i].size).toBeGreaterThanOrEqual(TRAINING_TIERS[i - 1].size);
      expect(TRAINING_TIERS[i].clues[1]).toBeGreaterThan(TRAINING_TIERS[i - 1].clues[1]);
    }
  });
});

describe('training levels', () => {
  it('gives a different board each time, since nothing has to reproduce one', () => {
    const first = generateTrainingLevel(TRAINING_TIERS[2], 1);
    const second = generateTrainingLevel(TRAINING_TIERS[2], 2);
    expect(JSON.stringify(first.solution)).not.toBe(JSON.stringify(second.solution));
  });

  it('repeats exactly for a seed handed back, which is what makes it testable at all', () => {
    const a = generateTrainingLevel(TRAINING_TIERS[1], 77);
    const b = generateTrainingLevel(TRAINING_TIERS[1], 77);
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });

  it('is solvable by logic alone at every difficulty, never by guessing', () => {
    // The campaign's levels are checked at build time. These are made on the tap, so the
    // guarantee has to come from the generator every single time.
    for (const tier of TRAINING_TIERS) {
      const level = generateTrainingLevel(tier, 4242);
      expect(solveByLogic(level), tier.label).not.toBeNull();
    }
  });
});

import { beforeEach, describe, expect, it } from 'vitest';
import { TUTORIAL_LEVELS } from '../game/levels';
import { useGameStore } from './gameStore';

describe('game mistakes', () => {
  beforeEach(() => {
    useGameStore.setState({ level: null, placed: [], colorN: 0, won: false, startedAt: 0, hintsUsed: 0, mistakes: 0 });
    useGameStore.getState().loadLevel(TUTORIAL_LEVELS[0]);
  });

  it('counts and rejects a rectangle with an invalid clue or area', () => {
    expect(useGameStore.getState().placeRect({ r1: 0, c1: 0, r2: 1, c2: 1 })).toBe(false);
    expect(useGameStore.getState().mistakes).toBe(1);
    expect(useGameStore.getState().placed).toHaveLength(0);
  });

  it('counts and rejects a rectangle that overlaps an accepted rectangle', () => {
    // A level with room left after the first rectangle: on the one-piece level the first
    // placement solves the puzzle, and a solved board rejects everything on its own terms.
    useGameStore.getState().loadLevel(TUTORIAL_LEVELS[2]);

    expect(useGameStore.getState().placeRect({ r1: 0, c1: 0, r2: 1, c2: 2 })).toBe(true);
    expect(useGameStore.getState().placeRect({ r1: 0, c1: 0, r2: 1, c2: 2 })).toBe(false);
    expect(useGameStore.getState().mistakes).toBe(1);
  });

  it('reveals a solution rectangle when using a hint', () => {
    const revealed = useGameStore.getState().hint();

    expect(revealed).not.toBeNull();
    expect(useGameStore.getState().placed).toHaveLength(1);
    expect(useGameStore.getState().hintsUsed).toBe(1);
  });
});

describe('a solved board', () => {
  // The win sheet leaves the top of the board uncovered, so this used to be reachable with a
  // finger: dismantling the solve flipped `won` back to false and re-solving paid the goal
  // bonus a second time.
  beforeEach(() => {
    useGameStore.setState({ level: null, placed: [], colorN: 0, won: false, startedAt: 0, hintsUsed: 0, mistakes: 0 });
    useGameStore.getState().loadLevel(TUTORIAL_LEVELS[0]);
    useGameStore.getState().placeRect({ r1: 0, c1: 0, r2: 1, c2: 2 });
    expect(useGameStore.getState().won).toBe(true);
  });

  it('takes no new rectangle, and counts no mistake for trying', () => {
    expect(useGameStore.getState().placeRect({ r1: 0, c1: 0, r2: 1, c2: 1 })).toBe(false);
    expect(useGameStore.getState().placed).toHaveLength(1);
    expect(useGameStore.getState().mistakes).toBe(0);
    expect(useGameStore.getState().won).toBe(true);
  });

  it('holds the solve against a tap on a placed rectangle', () => {
    useGameStore.getState().removeRectAt(0);

    expect(useGameStore.getState().placed).toHaveLength(1);
    expect(useGameStore.getState().won).toBe(true);
  });

  it('ignores undo, clear and hint alike', () => {
    useGameStore.getState().undo();
    useGameStore.getState().clear();

    expect(useGameStore.getState().hint()).toBeNull();
    expect(useGameStore.getState().placed).toHaveLength(1);
    expect(useGameStore.getState().hintsUsed).toBe(0);
    expect(useGameStore.getState().won).toBe(true);
  });

  it('opens again for the next level', () => {
    useGameStore.getState().loadLevel(TUTORIAL_LEVELS[1]);

    expect(useGameStore.getState().won).toBe(false);
    expect(useGameStore.getState().placeRect({ r1: 0, c1: 0, r2: 2, c2: 2 })).toBe(true);
  });
});

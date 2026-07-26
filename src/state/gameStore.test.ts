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

import { describe, expect, it } from 'vitest';
import { DIFFS } from './difficulty';
import type { Medal } from './medals';
import { getUnlockStats, isThemeUnlocked, remainingFor, THEME_REQUIREMENTS } from './unlocks';

/** Solves every level of the first `count` islands, which is how islands are completed. */
function solveIslands(count: number): Record<number, true> {
  const solved: Record<number, true> = {};
  let index = 0;
  for (let island = 0; island < count; island++) {
    for (let i = 0; i < DIFFS[island].count; i++) solved[index++] = true;
  }
  return solved;
}

function stats(solvedMap: Record<number, true> = {}, levelMedals: Record<number, Medal> = {}) {
  return getUnlockStats({ solvedMap, solvedDateMap: {}, levelMedals, dailyStreak: 0 });
}

describe('theme unlocks', () => {
  it('leaves a brand new player exactly one theme', () => {
    const fresh = stats();
    const unlocked = Object.keys(THEME_REQUIREMENTS).filter(name => isThemeUnlocked(name as never, fresh));
    expect(unlocked).toEqual(['classic']);
  });

  it('opens the first island theme once that island is done', () => {
    expect(isThemeUnlocked('mint', stats(solveIslands(1)))).toBe(true);
    expect(isThemeUnlocked('navy', stats(solveIslands(1)))).toBe(false);
    expect(isThemeUnlocked('navy', stats(solveIslands(3)))).toBe(true);
  });

  it('is retroactive: progress made before unlocks existed still counts', () => {
    // Nothing is stored about unlocks, so a returning player is handed what they earned.
    const veteran = stats(solveIslands(6));
    expect(isThemeUnlocked('sun', veteran)).toBe(true);
  });

  it('gates one theme on medals rather than on reaching further', () => {
    const medals = Object.fromEntries(Array.from({ length: 25 }, (_, i) => [i, 'gold' as Medal]));
    expect(isThemeUnlocked('rose', stats({}, medals))).toBe(true);
    expect(isThemeUnlocked('rose', stats({}, { 0: 'gold' }))).toBe(false);
  });

  it('never rewards skill with hints, only with cosmetics', () => {
    // The whole point of the split: nothing here can hand out help.
    for (const requirement of Object.values(THEME_REQUIREMENTS)) {
      expect(Object.keys(requirement).every(key => ['islands', 'achievements', 'goldMedals'].includes(key))).toBe(true);
    }
  });

  it('reports what is still missing, and nothing once it is met', () => {
    expect(remainingFor({ islands: 3 }, stats(solveIslands(1))).islands).toBe(2);
    expect(remainingFor({ islands: 3 }, stats(solveIslands(3))).islands).toBeUndefined();
  });
});

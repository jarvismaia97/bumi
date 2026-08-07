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

function stats(solvedMap: Record<number, true> = {}, levelMedals: Record<number, Medal> = {}, dailyCompletionDates: string[] = []) {
  return getUnlockStats({ solvedMap, solvedDateMap: {}, levelMedals, dailyStreak: 0 }, dailyCompletionDates);
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
      expect(Object.keys(requirement).every(key => ['islands', 'achievements', 'goldMedals', 'dailyInMonth'].includes(key))).toBe(true);
    }
  });

  it('gives each season a month of its own, and leaves a gap between them', () => {
    // A seasonal theme is unreachable eleven months a year, so one per month would turn the
    // picker into a wall of locks and demote the ladder that rewards playing well.
    const months = Object.values(THEME_REQUIREMENTS)
      .map(requirement => requirement.dailyInMonth)
      .filter((month): month is number => month !== undefined)
      .sort((a, b) => a - b);

    expect(new Set(months).size).toBe(months.length);
    expect(months.every(month => month >= 1 && month <= 12)).toBe(true);
    // Never adjacent: two seasons back to back would read as one long season.
    expect(months.every((month, i) => i === 0 || month - months[i - 1] >= 2)).toBe(true);
  });

  it('opens a seasonal theme to the daily played in its own month', () => {
    expect(isThemeUnlocked('natal', stats({}, {}, ['20261224']))).toBe(true);
    expect(isThemeUnlocked('halloween', stats({}, {}, ['20261031']))).toBe(true);
    // Named for the season, so the rest of the calendar does not open it.
    expect(isThemeUnlocked('natal', stats({}, {}, ['20261130', '20270101']))).toBe(false);
  });

  it('keeps a season earned once, in every year after it', () => {
    // Any year satisfies the month, so December does not take the theme back in January.
    const played = stats({}, {}, ['20251215']);
    expect(isThemeUnlocked('natal', played)).toBe(true);
  });

  it('does not hand a season to raw skill, nor a ladder theme to the calendar', () => {
    const master = stats(solveIslands(6), Object.fromEntries(Array.from({ length: 60 }, (_, i) => [i, 'gold' as Medal])));
    expect(isThemeUnlocked('halloween', master)).toBe(false);
    expect(isThemeUnlocked('rose', stats({}, {}, ['20261031']))).toBe(false);
  });

  it('reports what is still missing, and nothing once it is met', () => {
    expect(remainingFor({ islands: 3 }, stats(solveIslands(1))).islands).toBe(2);
    expect(remainingFor({ islands: 3 }, stats(solveIslands(3))).islands).toBeUndefined();
    // Binary rather than a countdown: the month is named until it is behind the player.
    expect(remainingFor({ dailyInMonth: 12 }, stats()).dailyInMonth).toBe(12);
    expect(remainingFor({ dailyInMonth: 12 }, stats({}, {}, ['20261201'])).dailyInMonth).toBeUndefined();
  });
});

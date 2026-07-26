import { describe, expect, it } from 'vitest';
import { getAchievements, getCampaignStreak } from './achievements';

describe('achievements', () => {
  it('counts only the uninterrupted campaign path', () => {
    expect(getCampaignStreak({ 0: true, 1: true, 3: true })).toBe(2);
  });

  it('unlocks an island-day achievement only when every level shares a date', () => {
    const solvedMap = Object.fromEntries(Array.from({ length: 20 }, (_, index) => [index, true])) as Record<number, true>;
    const solvedDateMap = Object.fromEntries(Array.from({ length: 20 }, (_, index) => [index, '20260723'])) as Record<number, string>;
    const achievements = getAchievements({ solvedMap, solvedDateMap, levelMedals: {}, dailyStreak: 0 });

    expect(achievements.find(achievement => achievement.id === 'island-day')).toMatchObject({ current: 1, target: 1 });
  });
});

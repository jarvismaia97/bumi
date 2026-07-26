import { describe, expect, it } from 'vitest';
import { getDailyStreak, getWeeklyDailyCount } from './daily';

describe('getDailyStreak', () => {
  const today = new Date(2026, 6, 20, 12);

  it('counts consecutive days ending today', () => {
    expect(getDailyStreak(['20260718', '20260719', '20260720'], today)).toBe(3);
  });

  it('does not count a streak that was broken before today', () => {
    expect(getDailyStreak(['20260718', '20260720'], today)).toBe(1);
  });

  it('returns zero before today is completed', () => {
    expect(getDailyStreak(['20260719'], today)).toBe(0);
  });
});

describe('getWeeklyDailyCount', () => {
  const wednesday = new Date(2026, 6, 22, 12);

  it('counts only unique daily completions since Monday', () => {
    expect(getWeeklyDailyCount(['20260719', '20260720', '20260721', '20260722', '20260722'], wednesday)).toBe(3);
  });
});

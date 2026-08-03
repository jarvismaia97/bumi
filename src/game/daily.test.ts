import { describe, expect, it } from 'vitest';
import { getDailyStreak } from './daily';

describe('getDailyStreak', () => {
  const today = new Date(2026, 6, 20, 12);

  it('counts consecutive days ending today', () => {
    expect(getDailyStreak(['20260718', '20260719', '20260720'], today)).toBe(3);
  });

  it('does not count a streak that was broken before today', () => {
    expect(getDailyStreak(['20260718', '20260720'], today)).toBe(1);
  });

  it('keeps yesterday-s streak alive while today is still unplayed', () => {
    // The reminder promises the streak ends at midnight; counting from today alone broke it at
    // one minute past, and told a returning player to start over.
    expect(getDailyStreak(['20260718', '20260719'], today)).toBe(2);
  });

  it('counts today once it is played, without counting it twice', () => {
    expect(getDailyStreak(['20260718', '20260719', '20260720'], today)).toBe(3);
  });

  it('breaks when a day closed without it', () => {
    expect(getDailyStreak(['20260718'], today)).toBe(0);
  });

  it('has nothing to count for a player who has never played', () => {
    expect(getDailyStreak([], today)).toBe(0);
  });
});


import { describe, expect, it } from 'vitest';
import { getDailyStreak, hintsForBest, utcOffsetMinutes } from './daily';

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


describe('hintsForBest', () => {
  it('records the count when the day has none yet, timed or not', () => {
    expect(hintsForBest({}, {}, '20260811', 5000, 2)).toEqual({ '20260811': 2 });
    expect(hintsForBest({}, {}, '20260811', undefined, 0)).toEqual({ '20260811': 0 });
  });

  it('keeps the count that came with the record when a replay is slower', () => {
    const durations = { '20260811': 5000 };
    const hints = { '20260811': 3 };
    expect(hintsForBest(durations, hints, '20260811', 9000, 0)).toBe(hints);
  });

  it('takes the new count when the replay beat the time', () => {
    const durations = { '20260811': 5000 };
    expect(hintsForBest(durations, { '20260811': 3 }, '20260811', 4000, 1)).toEqual({ '20260811': 1 });
  });

  it('leaves the record alone when no count was given', () => {
    const hints = { '20260811': 3 };
    expect(hintsForBest({ '20260811': 5000 }, hints, '20260811', 4000, undefined)).toBe(hints);
  });
});

describe('utcOffsetMinutes', () => {
  it('reports minutes east of UTC, the opposite sign to getTimezoneOffset', () => {
    // Lisbon in summer is UTC+1, which getTimezoneOffset gives as -60.
    const lisbonSummer = { getTimezoneOffset: () => -60 } as Date;
    expect(utcOffsetMinutes(lisbonSummer)).toBe(60);
    // New York in summer is UTC-4, which it gives as 240.
    const newYorkSummer = { getTimezoneOffset: () => 240 } as Date;
    expect(utcOffsetMinutes(newYorkSummer)).toBe(-240);
  });
});

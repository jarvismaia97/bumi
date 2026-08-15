import { describe, expect, it } from 'vitest';
import { getDailyDateKey, getDailyLevel, getDailyStreak, hintsForBest, utcOffsetMinutes } from './daily';

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

describe('getDailyLevel', () => {
  // vitest.config.ts pins this file to Europe/Lisbon. Assert it rather than trust it: the whole
  // point of the cases below is that the clocks move, and inheriting a zone that never shifts
  // would let them pass without testing anything.
  it('runs in the pinned zone', () => {
    expect(Intl.DateTimeFormat().resolvedOptions().timeZone).toBe('Europe/Lisbon');
  });

  // Every caller reaches the same day differently — the archive and shared links rebuild local
  // midnight from a date key, today comes in as `new Date()` at whatever hour the app opened —
  // so a date key has to name one board no matter what hour it is read at.
  const hours = [0, 1, 6, 12, 18, 23];
  const boardAtEachHour = (y: number, m: number, day: number) =>
    hours.map(h => JSON.stringify(getDailyLevel(new Date(y, m - 1, day, h))));

  it('gives one board per date key inside DST, whatever the hour', () => {
    // 2026-04-01 is after Lisbon's spring-forward. The elapsed-milliseconds day count made this
    // 7x7 before 01:00 and 5x5 from 01:00 on, under the one key 20260401.
    const boards = boardAtEachHour(2026, 4, 1);
    expect(new Set(boards).size).toBe(1);
    expect(JSON.parse(boards[0]).size).toBe(5);
  });

  it('gives one board per date key on the fall-back day, whatever the hour', () => {
    // 2026-10-25 is the day the hour comes back, so its 24 wall-clock hours span 25 real ones.
    const boards = boardAtEachHour(2026, 10, 25);
    expect(new Set(boards).size).toBe(1);
    expect(JSON.parse(boards[0]).size).toBe(5);
  });

  it('agrees with itself across the spring-forward and fall-back weekends', () => {
    for (const [month, day] of [[3, 28], [3, 29], [3, 30], [10, 24], [10, 25], [10, 26]]) {
      const boards = boardAtEachHour(2026, month, day);
      expect(new Set(boards).size, `${month}/${day} differs by hour`).toBe(1);
    }
  });

  it('rotates size on the calendar day of the year', () => {
    // DAILY_SIZES is [5, 6, 6, 7, 5, 6, 7] indexed by day-of-year, 1 January being day 1.
    expect(getDailyLevel(new Date(2026, 0, 1, 9)).size).toBe(6); // doy 1
    expect(getDailyLevel(new Date(2026, 0, 6, 9)).size).toBe(7); // doy 6
    expect(getDailyLevel(new Date(2026, 0, 7, 9)).size).toBe(5); // doy 7, wraps
  });

  it('keeps the boards players already solved on days outside DST', () => {
    // Winter dates never diverged — elapsed days and calendar days agree there — so these are
    // the record of what the old code shipped, and the fix must not move them.
    expect(getDailyLevel(new Date(2026, 0, 15, 12)).size).toBe(6); // doy 15
    expect(getDailyLevel(new Date(2026, 1, 3, 12)).size).toBe(7); // doy 34
    expect(getDailyLevel(new Date(2025, 11, 25, 12)).size).toBe(6); // doy 359
  });

  it('seeds from the date key, so a different day is a different puzzle', () => {
    const first = getDailyLevel(new Date(2026, 3, 1, 12));
    const second = getDailyLevel(new Date(2026, 3, 8, 12));
    // Same size a week apart — the rotation has period 7 — but not the same board.
    expect(second.size).toBe(first.size);
    expect(second.clues).not.toEqual(first.clues);
  });

  it('gives the shared-link path the board the sender played', () => {
    // index.tsx rebuilds a shared day by slicing the key into local midnight; the sender was
    // playing at some ordinary hour of that same day.
    const played = new Date(2026, 6, 14, 21, 40);
    const key = getDailyDateKey(played);
    const rebuilt = new Date(Number(key.slice(0, 4)), Number(key.slice(4, 6)) - 1, Number(key.slice(6, 8)));
    expect(getDailyLevel(rebuilt)).toEqual(getDailyLevel(played));
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

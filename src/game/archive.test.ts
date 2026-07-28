import { describe, expect, it } from 'vitest';
import { countMissedDays, getArchiveMonth, leadingBlanks } from './archive';

// Wednesday 15 July 2026; July has 31 days and the 1st fell on a Wednesday.
const MID_JULY = new Date(2026, 6, 15);

describe('archive month', () => {
  it('covers every day of the calendar month, which is what the monthly goal counts', () => {
    expect(getArchiveMonth([], MID_JULY)).toHaveLength(31);
  });

  it('marks days already solved, whenever they were played', () => {
    const month = getArchiveMonth(['20260703'], MID_JULY);
    expect(month.find(day => day.day === 3)?.state).toBe('done');
  });

  it('leaves today open until it is solved', () => {
    expect(getArchiveMonth([], MID_JULY).find(day => day.day === 15)?.state).toBe('available');
    expect(getArchiveMonth(['20260715'], MID_JULY).find(day => day.day === 15)?.state).toBe('done');
  });

  it('never offers a puzzle that does not exist yet', () => {
    for (const day of getArchiveMonth([], MID_JULY).filter(day => day.day > 15)) {
      expect(day.state).toBe('future');
    }
  });

  it('counts only the days still worth opening the archive for', () => {
    // 1st to 15th is fifteen days; three solved leaves twelve open.
    expect(countMissedDays(['20260701', '20260702', '20260715'], MID_JULY)).toBe(12);
    expect(countMissedDays([], new Date(2026, 6, 1))).toBe(1);
  });

  it('lines the first day up under its weekday, counting weeks from Monday', () => {
    expect(leadingBlanks(MID_JULY)).toBe(2); // 1 July 2026 is a Wednesday
    expect(leadingBlanks(new Date(2026, 5, 10))).toBe(0); // 1 June 2026 is a Monday
  });
});

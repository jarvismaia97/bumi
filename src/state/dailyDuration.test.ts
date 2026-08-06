import { describe, expect, it } from 'vitest';
import { bestDuration } from '@/game/daily';

describe('recording how long a daily took', () => {
  it('keeps the first time there was none', () => {
    expect(bestDuration({}, '20260807', 42_000)).toEqual({ '20260807': 42_000 });
  });

  it('lowers a record but never raises one', () => {
    const kept = { '20260807': 40_000 };
    expect(bestDuration(kept, '20260807', 31_500)).toEqual({ '20260807': 31_500 });
    expect(bestDuration(kept, '20260807', 90_000)).toBe(kept);
  });

  it('leaves the record alone when no time is offered', () => {
    // A completion path that does not measure must not blank a time that exists.
    const kept = { '20260807': 40_000 };
    expect(bestDuration(kept, '20260807', undefined)).toBe(kept);
    expect(bestDuration(kept, '20260807', 0)).toBe(kept);
    expect(bestDuration(kept, '20260807', Number.NaN)).toBe(kept);
  });

  it('records whole milliseconds, since that is what the column holds', () => {
    expect(bestDuration({}, '20260807', 1234.6)).toEqual({ '20260807': 1235 });
  });

  it('does not touch the other days it is holding', () => {
    const kept = { '20260806': 10_000, '20260807': 40_000 };
    expect(bestDuration(kept, '20260807', 5_000)).toEqual({ '20260806': 10_000, '20260807': 5_000 });
  });
});

import { describe, expect, it } from 'vitest';
import { getCompletedIslandCount, getIslandIndexForLevel, getIslandRange, getNewlyCompletedIslandIndex } from './islands';

describe('island collection', () => {
  it('maps campaign levels to their island ranges', () => {
    expect(getIslandRange(0)).toEqual({ startIdx: 0, endIdx: 20 });
    expect(getIslandIndexForLevel(19)).toBe(0);
    expect(getIslandIndexForLevel(20)).toBe(1);
  });

  it('discovers an island only when its final missing level is solved', () => {
    const almostMato = Object.fromEntries(Array.from({ length: 19 }, (_, idx) => [idx, true])) as Record<number, true>;
    expect(getNewlyCompletedIslandIndex(19, almostMato)).toBe(0);
    expect(getCompletedIslandCount(almostMato)).toBe(0);
  });
});

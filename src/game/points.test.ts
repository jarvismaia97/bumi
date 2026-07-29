import { describe, expect, it } from 'vitest';
import { countMedals, pointsFromCounts, pointsFromMedals } from './points';

describe('leaderboard points', () => {
  it('pays five for gold, three for silver, one for bronze', () => {
    expect(pointsFromCounts({ gold: 1, silver: 0, bronze: 0 })).toBe(5);
    expect(pointsFromCounts({ gold: 0, silver: 1, bronze: 0 })).toBe(3);
    expect(pointsFromCounts({ gold: 0, silver: 0, bronze: 1 })).toBe(1);
    expect(pointsFromCounts({ gold: 2, silver: 3, bronze: 4 })).toBe(23);
  });

  it('scores nothing for a player who has solved nothing', () => {
    expect(pointsFromCounts({ gold: 0, silver: 0, bronze: 0 })).toBe(0);
    expect(pointsFromMedals({})).toBe(0);
  });

  it('counts the medal map the progress store keeps', () => {
    const medals = { 0: 'gold', 1: 'gold', 2: 'silver', 7: 'bronze' } as const;

    expect(countMedals(medals)).toEqual({ gold: 2, silver: 1, bronze: 1 });
    expect(pointsFromMedals(medals)).toBe(14);
  });
});

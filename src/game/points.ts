import type { Medal } from './medals';

/**
 * Leaderboard points. Gold is worth five bronzes rather than three, because gold now means a
 * hint-free solve inside the mistake budget: the gap between the medals is care, not speed,
 * and the scoring should say that plainly.
 */
export const MEDAL_POINTS: Record<Medal, number> = { gold: 5, silver: 3, bronze: 1 };

export interface MedalCounts {
  gold: number;
  silver: number;
  bronze: number;
}

export function pointsFromCounts({ gold, silver, bronze }: MedalCounts): number {
  return gold * MEDAL_POINTS.gold + silver * MEDAL_POINTS.silver + bronze * MEDAL_POINTS.bronze;
}

export function countMedals(medals: Record<number, Medal> | Medal[]): MedalCounts {
  const values = Array.isArray(medals) ? medals : Object.values(medals);
  return {
    gold: values.filter(medal => medal === 'gold').length,
    silver: values.filter(medal => medal === 'silver').length,
    bronze: values.filter(medal => medal === 'bronze').length,
  };
}

export function pointsFromMedals(medals: Record<number, Medal> | Medal[]): number {
  return pointsFromCounts(countMedals(medals));
}

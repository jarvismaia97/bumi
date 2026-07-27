import { getCompletedIslandCount, getIslandRange, ISLANDS } from './islands';
import type { Medal } from './medals';

export type AchievementCategory = 'campaign' | 'islands' | 'mastery';

// Title and description live in the message catalogue under `achievement.<id>.*`.
export interface AchievementProgress {
  id: string;
  category: AchievementCategory;
  icon: 'flag' | 'zap' | 'route' | 'mountain' | 'map' | 'trophy' | 'medal' | 'flame';
  current: number;
  target: number;
}

export interface AchievementStats {
  solvedMap: Readonly<Record<number, true>>;
  solvedDateMap: Readonly<Record<number, string>>;
  levelMedals: Readonly<Record<number, Medal>>;
  dailyStreak: number;
}

export function getCampaignStreak(solvedMap: Readonly<Record<number, true>>): number {
  let streak = 0;
  while (solvedMap[streak]) streak += 1;
  return streak;
}

function completedIslandInOneDay(solvedMap: Readonly<Record<number, true>>, solvedDateMap: Readonly<Record<number, string>>): boolean {
  return ISLANDS.some((_, islandIndex) => {
    const { startIdx, endIdx } = getIslandRange(islandIndex);
    const dates = new Set<string>();

    for (let index = startIdx; index < endIdx; index += 1) {
      if (!solvedMap[index] || !solvedDateMap[index]) return false;
      dates.add(solvedDateMap[index]);
    }

    return dates.size === 1;
  });
}

export function getAchievements({ solvedMap, solvedDateMap, levelMedals, dailyStreak }: AchievementStats): AchievementProgress[] {
  const campaignStreak = getCampaignStreak(solvedMap);
  const completedIslands = getCompletedIslandCount(solvedMap);
  const goldMedals = Object.values(levelMedals).filter(medal => medal === 'gold').length;
  const islandDayDone = completedIslandInOneDay(solvedMap, solvedDateMap);

  return [
    { id: 'first-step', category: 'campaign', icon: 'flag', current: campaignStreak, target: 1 },
    { id: 'campaign-10', category: 'campaign', icon: 'zap', current: campaignStreak, target: 10 },
    { id: 'campaign-50', category: 'campaign', icon: 'route', current: campaignStreak, target: 50 },
    { id: 'campaign-100', category: 'campaign', icon: 'mountain', current: campaignStreak, target: 100 },
    { id: 'campaign-250', category: 'campaign', icon: 'route', current: campaignStreak, target: 250 },
    { id: 'campaign-500', category: 'campaign', icon: 'trophy', current: campaignStreak, target: 500 },
    { id: 'first-island', category: 'islands', icon: 'map', current: completedIslands, target: 1 },
    { id: 'five-islands', category: 'islands', icon: 'map', current: completedIslands, target: 5 },
    { id: 'island-day', category: 'islands', icon: 'flame', current: islandDayDone ? 1 : 0, target: 1 },
    { id: 'gold-10', category: 'mastery', icon: 'medal', current: goldMedals, target: 10 },
    { id: 'gold-50', category: 'mastery', icon: 'medal', current: goldMedals, target: 50 },
    { id: 'daily-7', category: 'mastery', icon: 'flame', current: dailyStreak, target: 7 },
  ];
}

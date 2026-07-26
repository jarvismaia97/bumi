import { getCompletedIslandCount, getIslandRange, ISLANDS } from './islands';
import type { Medal } from './medals';

export type AchievementCategory = 'Campanha' | 'Ilhas' | 'Domínio';

export interface AchievementProgress {
  id: string;
  category: AchievementCategory;
  title: string;
  description: string;
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
    { id: 'first-step', category: 'Campanha', title: 'Primeiro passo', description: 'Resolve o teu primeiro nível.', icon: 'flag', current: campaignStreak, target: 1 },
    { id: 'campaign-10', category: 'Campanha', title: 'Em ritmo', description: 'Resolve 10 níveis da campanha seguidos.', icon: 'zap', current: campaignStreak, target: 10 },
    { id: 'campaign-50', category: 'Campanha', title: 'Caminho aberto', description: 'Resolve 50 níveis da campanha seguidos.', icon: 'route', current: campaignStreak, target: 50 },
    { id: 'campaign-100', category: 'Campanha', title: 'Centenário', description: 'Resolve 100 níveis da campanha seguidos.', icon: 'mountain', current: campaignStreak, target: 100 },
    { id: 'campaign-250', category: 'Campanha', title: 'Incansável', description: 'Resolve 250 níveis da campanha seguidos.', icon: 'route', current: campaignStreak, target: 250 },
    { id: 'campaign-500', category: 'Campanha', title: 'Mestre Bumi', description: 'Resolve os 500 níveis da campanha.', icon: 'trophy', current: campaignStreak, target: 500 },
    { id: 'first-island', category: 'Ilhas', title: 'Terra à vista', description: 'Conquista a tua primeira ilha.', icon: 'map', current: completedIslands, target: 1 },
    { id: 'five-islands', category: 'Ilhas', title: 'Explorador', description: 'Conquista 5 ilhas.', icon: 'map', current: completedIslands, target: 5 },
    { id: 'island-day', category: 'Ilhas', title: 'Expedição', description: 'Conquista uma ilha num único dia.', icon: 'flame', current: islandDayDone ? 1 : 0, target: 1 },
    { id: 'gold-10', category: 'Domínio', title: 'Ouro polido', description: 'Ganha 10 medalhas de ouro.', icon: 'medal', current: goldMedals, target: 10 },
    { id: 'gold-50', category: 'Domínio', title: 'Coleção dourada', description: 'Ganha 50 medalhas de ouro.', icon: 'medal', current: goldMedals, target: 50 },
    { id: 'daily-7', category: 'Domínio', title: 'Sete dias', description: 'Mantém uma sequência diária de 7 dias.', icon: 'flame', current: dailyStreak, target: 7 },
  ];
}

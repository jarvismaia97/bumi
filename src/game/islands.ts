import type { Island } from './types';
import { DIFFS } from './difficulty';

// One entry per DIFFS tier — the campaign path's 13 narrative chapters.
export const ISLANDS: Island[] = [
  { name: 'Mato', story: 'A jornada começa entre ervas e terra molhada. Respira fundo.', color: '#56a87a', bg: '#e8f8ee' },
  { name: 'Fonte', story: 'A água corre livre. Deixa-te guiar pelo som do riacho.', color: '#5a9fd4', bg: '#e5f2ff' },
  { name: 'Lago', story: 'A superfície calma reflete o céu. Cada reflexo esconde um enigma.', color: '#9b7bb8', bg: '#f3eaff' },
  { name: 'Patos', story: 'Os patos observam-te em silêncio. Terão mais paciência do que tu?', color: '#48a068', bg: '#e0f5e8' },
  { name: 'Ninho', story: 'Aqui os puzzles chocam como ovos. Cuidado — alguns mordem.', color: '#c8a030', bg: '#fff8e0' },
  { name: 'Duna', story: 'A areia quente anuncia o mar. A palmeira já se vê ao longe.', color: '#d4882a', bg: '#fff5d8' },
  { name: 'Palmeira', story: 'O horizonte azul convida. Mas a viagem não acabou.', color: '#2e9e6a', bg: '#d8f5e8' },
  { name: 'Recife', story: 'Sob a superfície há mundos escondidos. Mergulha fundo.', color: '#e05a78', bg: '#ffe8f0' },
  { name: 'Vulcão', story: 'O calor aumenta. Cada erro aqui queima um pouco mais.', color: '#c04020', bg: '#ffeae0' },
  { name: 'Névoa', story: 'A visibilidade é zero. Só a lógica te guia nesta escuridão.', color: '#7080a0', bg: '#eef0f8' },
  { name: 'Glaciar', story: 'Frio. Preciso. Nenhum movimento desperdiçado.', color: '#40a0c8', bg: '#e0f4ff' },
  { name: 'Tempestade', story: 'O vento uiva. Só os mais calmos sobrevivem à tormenta.', color: '#5050a0', bg: '#ebebff' },
  { name: 'Olimpo', story: 'O cume. Poucos chegam aqui. Mereces o raio dos deuses.', color: '#9060c0', bg: '#f0e8ff' },
];

export function getIslandRange(islandIndex: number): { startIdx: number; endIdx: number } {
  const startIdx = DIFFS.slice(0, islandIndex).reduce((total, tier) => total + tier.count, 0);
  return { startIdx, endIdx: startIdx + (DIFFS[islandIndex]?.count ?? 0) };
}

export function getIslandIndexForLevel(levelIndex: number): number | null {
  for (let islandIndex = 0; islandIndex < DIFFS.length; islandIndex++) {
    const { startIdx, endIdx } = getIslandRange(islandIndex);
    if (levelIndex >= startIdx && levelIndex < endIdx) return islandIndex;
  }
  return null;
}

export function isIslandComplete(islandIndex: number, solvedMap: Readonly<Record<number, true>>): boolean {
  const { startIdx, endIdx } = getIslandRange(islandIndex);
  return endIdx > startIdx && Array.from({ length: endIdx - startIdx }, (_, offset) => solvedMap[startIdx + offset]).every(Boolean);
}

export function getCompletedIslandCount(solvedMap: Readonly<Record<number, true>>): number {
  return DIFFS.filter((_, islandIndex) => isIslandComplete(islandIndex, solvedMap)).length;
}

export function getNewlyCompletedIslandIndex(levelIndex: number, solvedMap: Readonly<Record<number, true>>): number | null {
  if (solvedMap[levelIndex]) return null;
  const islandIndex = getIslandIndexForLevel(levelIndex);
  if (islandIndex == null) return null;

  const { startIdx, endIdx } = getIslandRange(islandIndex);
  for (let idx = startIdx; idx < endIdx; idx++) {
    if (idx !== levelIndex && !solvedMap[idx]) return null;
  }
  return islandIndex;
}

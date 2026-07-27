import type { Island } from './types';
import { DIFFS } from './difficulty';

// One entry per DIFFS tier — the campaign path's 13 narrative chapters.
// Name and story live in the message catalogue under `island.<id>.*`.
export const ISLANDS: Island[] = [
  { id: 'scrub', color: '#56a87a', bg: '#e8f8ee' },
  { id: 'spring', color: '#5a9fd4', bg: '#e5f2ff' },
  { id: 'lake', color: '#9b7bb8', bg: '#f3eaff' },
  { id: 'ducks', color: '#48a068', bg: '#e0f5e8' },
  { id: 'nest', color: '#c8a030', bg: '#fff8e0' },
  { id: 'dune', color: '#d4882a', bg: '#fff5d8' },
  { id: 'palm', color: '#2e9e6a', bg: '#d8f5e8' },
  { id: 'reef', color: '#e05a78', bg: '#ffe8f0' },
  { id: 'volcano', color: '#c04020', bg: '#ffeae0' },
  { id: 'mist', color: '#7080a0', bg: '#eef0f8' },
  { id: 'glacier', color: '#40a0c8', bg: '#e0f4ff' },
  { id: 'storm', color: '#5050a0', bg: '#ebebff' },
  { id: 'olympus', color: '#9060c0', bg: '#f0e8ff' },
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

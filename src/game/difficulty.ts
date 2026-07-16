import type { DifficultyTier } from './types';

export const DIFFS: DifficultyTier[] = [
  { label: 'Fácil', size: 4, maxArea: 8, count: 20, hard: 0 },
  { label: 'Fácil', size: 5, maxArea: 10, count: 25, hard: 0 },
  { label: 'Fácil', size: 6, maxArea: 12, count: 25, hard: 0 },
  { label: 'Médio', size: 7, maxArea: 10, count: 30, hard: 0 },
  { label: 'Médio', size: 8, maxArea: 9, count: 30, hard: 0 },
  { label: 'Difícil', size: 9, maxArea: 8, count: 35, hard: 1 },
  { label: 'Difícil', size: 10, maxArea: 8, count: 35, hard: 1 },
  { label: 'Expert', size: 10, maxArea: 9, count: 40, hard: 1 },
  { label: 'Expert', size: 11, maxArea: 9, count: 40, hard: 1 },
  { label: 'Mestre', size: 11, maxArea: 10, count: 45, hard: 2 },
  { label: 'Mestre', size: 12, maxArea: 12, count: 45, hard: 2 },
  { label: 'Lenda', size: 13, maxArea: 12, count: 65, hard: 2 },
  { label: 'Lenda', size: 14, maxArea: 14, count: 65, hard: 2 },
];

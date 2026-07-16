export type HardLevel = 0 | 1 | 2;

export interface Clue {
  r: number;
  c: number;
  v: number;
}

export interface SolutionRect {
  r1: number;
  c1: number;
  r2: number;
  c2: number;
}

export interface Level {
  size: number;
  clues: Clue[];
  solution: SolutionRect[];
}

export interface PlacedRect extends SolutionRect {
  ci: number;
}

export interface DifficultyTier {
  label: string;
  size: number;
  maxArea: number;
  count: number;
  hard: HardLevel;
}

export interface LevelMeta {
  label: string;
  size: number;
  maxArea: number;
  hard: HardLevel;
}

export interface Island {
  name: string;
  icon: string;
  story: string;
  color: string;
  bg: string;
}

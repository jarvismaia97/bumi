export type HardLevel = 0 | 1 | 2;
export type ChallengeProfile = 0 | 1 | 2 | 3;

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

export interface RectColors {
  fill: string;
  border: string;
}

export interface Level {
  size: number;
  rows?: number;
  columns?: number;
  clues: Clue[];
  solution: SolutionRect[];
  solutionColors?: RectColors[];
  emptyFillColor?: string;
  requiresExactSolution?: boolean;
  solutionOnlyWin?: boolean;
}

export interface PlacedRect extends SolutionRect {
  ci: number;
  colors?: RectColors;
}

export interface DifficultyTier {
  label: string;
  size: number;
  maxArea: number;
  count: number;
  hard: HardLevel;
  /** Piece-count band as [start, end], ramped across the tier's own levels. */
  clues: [number, number];
}

export interface LevelMeta {
  label: string;
  size: number;
  maxArea: number;
  hard: HardLevel;
  /** Piece count this level aims for, interpolated from its tier's band. */
  clueTarget: number;
  /** Acceptable piece counts; levels outside this are rejected during generation. */
  clueRange: [number, number];
  challenge: ChallengeProfile;
  milestone: boolean;
}

export interface Island {
  name: string;
  story: string;
  color: string;
  bg: string;
}

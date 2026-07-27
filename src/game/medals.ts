export type Medal = 'gold' | 'silver' | 'bronze';

export interface LevelResult {
  durationMs: number;
  hintsUsed: number;
  mistakes: number;
  size: number;
}

const MEDAL_RANK: Record<Medal, number> = { bronze: 1, silver: 2, gold: 3 };
const GOLD_BASE_SECONDS = 60;
const GOLD_SIZE_INCREMENT_SECONDS = 12;

export function getGoldTimeLimitMs(size: number): number {
  return (GOLD_BASE_SECONDS + Math.max(0, size - 4) * GOLD_SIZE_INCREMENT_SECONDS) * 1000;
}

export function getMedalForResult({ durationMs, hintsUsed, mistakes, size }: LevelResult): Medal {
  const goldLimit = getGoldTimeLimitMs(size);
  if (durationMs <= goldLimit && hintsUsed === 0 && mistakes === 0) return 'gold';
  if (durationMs <= goldLimit * 2 && hintsUsed <= 1 && mistakes <= 2) return 'silver';
  return 'bronze';
}

export function isBetterMedal(next: Medal, current?: Medal): boolean {
  return !current || MEDAL_RANK[next] > MEDAL_RANK[current];
}

export function formatResultDuration(durationMs: number): string {
  const totalSeconds = Math.max(0, Math.floor(durationMs / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return minutes ? `${minutes}m ${String(seconds).padStart(2, '0')}s` : `${seconds}s`;
}

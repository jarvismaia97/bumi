export const INITIAL_HINTS = 3;
export const MAX_HINTS = 5;
export const MILESTONE_INTERVAL = 10;

export function isMilestoneLevel(idx: number): boolean {
  return (idx + 1) % MILESTONE_INTERVAL === 0;
}

export function normalizeHintCount(hints: number): number {
  return Math.min(MAX_HINTS, Math.max(0, Math.floor(hints)));
}

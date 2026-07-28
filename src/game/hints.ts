export const INITIAL_HINTS = 3;
/**
 * Was 5, which the milestone drip reached by level 50 — from there the count sat at the cap
 * whatever the player did, so spending a hint cost nothing and saving one meant nothing.
 * A ceiling the daily goals can actually push against gives the number back its meaning.
 */
export const MAX_HINTS = 15;
export const MILESTONE_INTERVAL = 10;

export function isMilestoneLevel(idx: number): boolean {
  return (idx + 1) % MILESTONE_INTERVAL === 0;
}

export function normalizeHintCount(hints: number): number {
  return Math.min(MAX_HINTS, Math.max(0, Math.floor(hints)));
}

/**
 * Timings for the win celebration, shared by the animation that plays it and the screen that
 * decides when to cover the board with the win sheet. They live here so the sheet cannot drift
 * out of step with the board: the sheet used to arrive on a fixed 620ms timer, which on any
 * level with more than two rectangles landed while they were still lighting up.
 */

/** Each rectangle waits this much longer than the one before it. */
export const CELEBRATION_STAGGER_MS = 85;
export const CELEBRATION_IN_MS = 230;
export const CELEBRATION_OUT_MS = 280;

/** The glow starts late so it reads as a second beat rather than part of the first. */
export const GLOW_DELAY_MS = 180;
export const GLOW_IN_MS = 280;
export const GLOW_OUT_MS = 420;

/** No stagger under reduced motion — a wave crossing the grid is apparent motion. */
export const REDUCED_IN_MS = 260;
export const REDUCED_OUT_MS = 520;

/**
 * How long the whole celebration runs for `rectCount` rectangles. The board holds the moment
 * for this long before anything is allowed to cover it.
 */
export function celebrationDurationMs(rectCount: number, reduceMotion: boolean): number {
  if (reduceMotion) return REDUCED_IN_MS + REDUCED_OUT_MS;

  const lastRectEnds = Math.max(0, rectCount - 1) * CELEBRATION_STAGGER_MS + CELEBRATION_IN_MS + CELEBRATION_OUT_MS;
  const glowEnds = GLOW_DELAY_MS + GLOW_IN_MS + GLOW_OUT_MS;
  return Math.max(lastRectEnds, glowEnds);
}

/**
 * Timings for the win celebration, shared by the animation that plays it and the screen that
 * decides when to cover the board with the win sheet. They live here so the sheet cannot drift
 * out of step with the board: the sheet used to arrive on a fixed 620ms timer, which on any
 * level with more than two rectangles landed while they were still lighting up.
 */

/**
 * Every solve used to look identical, so after a few hundred levels the celebration stopped
 * meaning anything. The tiers exist so the big one stays rare: ordered least to most.
 *
 * Silver was not among them, which meant a clean solve that spent one hint looked exactly like
 * no achievement at all. It bursts now, smaller than gold. A milestone still outranks it: a
 * medal is won most times a level is played, and the levels the catalogue marks are fixed.
 *
 * Bronze has no tier on purpose. It is what a solve scores when nothing about it stood out, so
 * `normal` is the honest answer — and a tier that burst nothing would be a distinction this
 * file claimed without making.
 */
export type CelebrationTier = 'normal' | 'silver' | 'milestone' | 'gold' | 'island';

const TIER_RANK: Record<CelebrationTier, number> = { normal: 0, silver: 1, milestone: 2, gold: 3, island: 4 };

export function highestTier(...tiers: (CelebrationTier | null | undefined)[]): CelebrationTier {
  return tiers.reduce<CelebrationTier>(
    (best, tier) => (tier && TIER_RANK[tier] > TIER_RANK[best] ? tier : best),
    'normal',
  );
}

/** Each rectangle waits this much longer than the one before it. */
export const CELEBRATION_STAGGER_MS = 85;
export const CELEBRATION_IN_MS = 230;
export const CELEBRATION_OUT_MS = 280;

/** The glow starts late so it reads as a second beat rather than part of the first. */
export const GLOW_DELAY_MS = 180;
export const GLOW_IN_MS = 280;
export const GLOW_OUT_MS = 420;

/**
 * A milestone level repeats the glow instead of adding anything new to the screen. The second
 * beat is deliberately clipped: a full repeat pushed the win sheet past 1.7s on a small board,
 * and the hold is already the longest thing between solving and seeing the result.
 */
export const GLOW_REPEAT_GAP_MS = 90;
export const GLOW_REPEAT_OUT_MS = 210;

/** No stagger under reduced motion — a wave crossing the grid is apparent motion. */
export const REDUCED_IN_MS = 260;
export const REDUCED_OUT_MS = 520;

export const BURST_DELAY_MS = 140;
export const BURST_TRAVEL_MS = 620;
export const BURST_FADE_MS = 260;

/**
 * How much of a burst each tier is worth. The counts climb rather than repeat so the rarer
 * thing still reads as the bigger one from across the room: silver is a handful, gold is more
 * than half again, and an island — a 20-45 level arc — is nearly three times.
 *
 * None of this lengthens the wait before the win sheet. A burst is spent by
 * `BURST_DELAY_MS + BURST_TRAVEL_MS`, which is under the glow it plays over, so the hold below
 * is decided by the glow either way.
 */
export const BURST_PARTICLES: Record<'silver' | 'gold' | 'island', number> = {
  silver: 16,
  gold: 26,
  island: 44,
};

export function burstParticleCount(tier: CelebrationTier): number {
  return tier === 'normal' || tier === 'milestone' ? 0 : BURST_PARTICLES[tier];
}

/**
 * How long the whole celebration runs for `rectCount` rectangles. The board holds the moment
 * for this long before anything is allowed to cover it.
 */
export function celebrationDurationMs(rectCount: number, reduceMotion: boolean, tier: CelebrationTier = 'normal'): number {
  // The burst is pure movement, so reduced motion drops it and the hold shortens with it.
  if (reduceMotion) return REDUCED_IN_MS + REDUCED_OUT_MS;

  const lastRectEnds = Math.max(0, rectCount - 1) * CELEBRATION_STAGGER_MS + CELEBRATION_IN_MS + CELEBRATION_OUT_MS;
  const glowEnds = GLOW_DELAY_MS + GLOW_IN_MS + GLOW_OUT_MS;
  const milestoneGlowEnds = tier === 'milestone' ? glowEnds + GLOW_REPEAT_GAP_MS + GLOW_IN_MS + GLOW_REPEAT_OUT_MS : 0;
  const burstEnds = burstParticleCount(tier) > 0 ? BURST_DELAY_MS + BURST_TRAVEL_MS : 0;

  return Math.max(lastRectEnds, glowEnds, milestoneGlowEnds, burstEnds);
}

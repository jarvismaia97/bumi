import { describe, expect, it } from 'vitest';
import { BURST_DELAY_MS, BURST_TRAVEL_MS, burstParticleCount, celebrationDurationMs, GLOW_DELAY_MS, GLOW_IN_MS, GLOW_OUT_MS, highestTier } from './celebration';

const GLOW_TOTAL = GLOW_DELAY_MS + GLOW_IN_MS + GLOW_OUT_MS;

describe('celebrationDurationMs', () => {
  it('outlasts the fixed 620ms the win sheet used to wait, at every board size', () => {
    // The regression this exists for: the sheet covered the board mid-stagger.
    for (let rects = 1; rects <= 20; rects++) {
      expect(celebrationDurationMs(rects, false)).toBeGreaterThan(620);
    }
  });

  it('grows with the number of rectangles once the stagger outruns the glow', () => {
    expect(celebrationDurationMs(8, false)).toBeGreaterThan(celebrationDurationMs(6, false));
    expect(celebrationDurationMs(12, false)).toBeGreaterThan(celebrationDurationMs(8, false));
  });

  it('never finishes before the glow, however few rectangles there are', () => {
    for (const rects of [0, 1, 2, 3, 4]) {
      expect(celebrationDurationMs(rects, false)).toBe(GLOW_TOTAL);
    }
  });

  it('is a flat, shorter hold under reduced motion, since nothing is staggered', () => {
    const reduced = celebrationDurationMs(4, true);
    expect(celebrationDurationMs(20, true)).toBe(reduced);
    expect(reduced).toBeLessThan(celebrationDurationMs(20, false));
  });
});

describe('celebration tiers', () => {
  it('ranks a discovered island above a gold medal above a milestone above the common medals', () => {
    expect(highestTier('island', 'gold', 'milestone')).toBe('island');
    expect(highestTier('gold', 'milestone')).toBe('gold');
    expect(highestTier('milestone', 'silver')).toBe('milestone');
    expect(highestTier('silver', 'bronze')).toBe('silver');
    expect(highestTier('bronze')).toBe('bronze');
  });

  it('falls back to normal when nothing special happened', () => {
    expect(highestTier()).toBe('normal');
    expect(highestTier(null, undefined)).toBe('normal');
  });

  it('bursts for every medal, and harder the rarer the medal is', () => {
    // Bronze and silver used to sit at zero with `normal`, which is why earning one of them
    // looked like earning nothing at all.
    expect(burstParticleCount('normal')).toBe(0);
    expect(burstParticleCount('bronze')).toBeGreaterThan(0);
    expect(burstParticleCount('island')).toBeGreaterThan(burstParticleCount('gold'));
    expect(burstParticleCount('gold')).toBeGreaterThan(burstParticleCount('silver'));
    expect(burstParticleCount('silver')).toBeGreaterThan(burstParticleCount('bronze'));
  });

  it('leaves the milestone to its double glow rather than adding a burst', () => {
    expect(burstParticleCount('milestone')).toBe(0);
  });

  it('holds longer for the milestone double beat', () => {
    // Small board, so the tier rather than the stagger decides the hold.
    expect(celebrationDurationMs(3, false, 'milestone')).toBeGreaterThan(celebrationDurationMs(3, false, 'normal'));
  });

  it('never lets the win sheet cover a burst still in flight', () => {
    // The burst is shorter than the glow, so it does not extend the hold — but if either
    // timing is ever retuned, the sheet must not arrive first.
    const burstEnds = BURST_DELAY_MS + BURST_TRAVEL_MS;
    for (const tier of ['bronze', 'silver', 'gold', 'island'] as const) {
      for (const rects of [1, 3, 8, 20]) {
        expect(celebrationDurationMs(rects, false, tier)).toBeGreaterThanOrEqual(burstEnds);
      }
    }
  });

  it('drops the extra hold under reduced motion, where the burst does not play', () => {
    const reduced = celebrationDurationMs(3, true, 'normal');
    for (const tier of ['bronze', 'silver', 'milestone', 'gold', 'island'] as const) {
      expect(celebrationDurationMs(3, true, tier)).toBe(reduced);
    }
  });
});

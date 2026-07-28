import { describe, expect, it } from 'vitest';
import { celebrationDurationMs, GLOW_DELAY_MS, GLOW_IN_MS, GLOW_OUT_MS } from './celebration';

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

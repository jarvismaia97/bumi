import { describe, expect, it } from 'vitest';
import { hitSlopFor, MIN_TOUCH_TARGET } from './touchTarget';

describe('hitSlopFor', () => {
  it('pads each side of the boxes the app actually paints', () => {
    expect(hitSlopFor({ width: 36, height: 36 })).toEqual({ top: 4, right: 4, bottom: 4, left: 4 });
    expect(hitSlopFor({ width: 38, height: 38 })).toEqual({ top: 3, right: 3, bottom: 3, left: 3 });
    expect(hitSlopFor({ width: 34, height: 34 })).toEqual({ top: 5, right: 5, bottom: 5, left: 5 });
  });

  it('leaves an axis alone when the box has no fixed size on it', () => {
    // The header brand is flexed wide and only falls short vertically.
    expect(hitSlopFor({ height: 38 })).toEqual({ top: 3, right: 0, bottom: 3, left: 0 });
  });

  it('never shrinks a target that already clears the minimum', () => {
    expect(hitSlopFor({ width: MIN_TOUCH_TARGET, height: 60 })).toEqual({ top: 0, right: 0, bottom: 0, left: 0 });
  });

  // Rounding down would leave a 43pt target, which is the whole bug.
  it('reaches the minimum on every box size, including the odd ones', () => {
    for (let size = 1; size <= MIN_TOUCH_TARGET; size++) {
      const { top, left } = hitSlopFor({ width: size, height: size });
      expect(size + left * 2).toBeGreaterThanOrEqual(MIN_TOUCH_TARGET);
      expect(size + top * 2).toBeGreaterThanOrEqual(MIN_TOUCH_TARGET);
    }
  });
});

/** Apple's HIG floor for a tappable area, in points. */
export const MIN_TOUCH_TARGET = 44;

export interface TouchSlop {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

function slop(size: number | undefined) {
  if (size === undefined) return 0;
  return Math.max(0, Math.ceil((MIN_TOUCH_TARGET - size) / 2));
}

/**
 * The `hitSlop` that carries a painted box up to the 44pt minimum without repainting it —
 * a 36pt bordered square beside a 22pt title is a proportion, not an accident.
 *
 * Each axis is optional so a control that is already wide enough (a flexed row) only pads the
 * short one. Deriving the slop from the box means resizing the box moves its touch target with
 * it, instead of leaving a stale constant behind.
 */
export function hitSlopFor(box: { width?: number; height?: number }): TouchSlop {
  const horizontal = slop(box.width);
  const vertical = slop(box.height);
  return { top: vertical, right: horizontal, bottom: vertical, left: horizontal };
}

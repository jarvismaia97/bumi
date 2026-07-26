import { genUniqueLevel } from './generateUnique';
import type { Level } from './types';

const INFINITE_SIZES = [5, 6, 7, 8];

// Infinite levels used to be generated with maxArea 16. Swept across every setting at these
// board sizes, 16 graded worst at all four: a clue that large has only a couple of legal
// shapes on a small board, so it pins itself down instead of opening choices. Capping at 8
// and aiming for a piece density instead lifts the measured difficulty from 2.12 to 3.06,
// and levels needing more than routine deduction from 9% to 64%.
const INFINITE_MAX_AREA = 8;
/** Average cells per piece to aim for. Measured best of 2.9 / 3.4 / no target at these sizes. */
const INFINITE_AREA_PER_CLUE = 3.4;

export function getInfiniteLevel(count: number): Level {
  const seed = Date.now() ^ (count * 0x9e3779b9);
  const size = INFINITE_SIZES[count % INFINITE_SIZES.length];
  return genUniqueLevel(seed, size, INFINITE_MAX_AREA, 2, 0, {
    clueTarget: Math.round((size * size) / INFINITE_AREA_PER_CLUE),
    // Unlike the baked campaign this runs on the player's device, so the cost matters:
    // measured at ~5ms average and ~27ms worst case for these board sizes, against ~2ms
    // without. Worth it for +0.5 depth; flip to false if it ever shows up on a slow device.
    refine: true,
  });
}

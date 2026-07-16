import { genLevel } from './generator';
import type { Level } from './types';

const INFINITE_SIZES = [5, 6, 7, 8];

export function getInfiniteLevel(count: number): Level {
  const seed = Date.now() ^ (count * 0x9e3779b9);
  const size = INFINITE_SIZES[count % INFINITE_SIZES.length];
  return genLevel(seed, size, 14, 2);
}

import { BD_PAL, BG_PAL } from '@/theme/palette';
import { seedOf } from '@/lib/playerName';

// The nickname half of a player's identity lives in ./playerName so the API can import it
// without dragging the palette into a serverless bundle. Re-exported here because every caller
// asks identity for both halves.
export { ARTISTS, artistIndexFor, playerName } from '@/lib/playerName';

// Players are shown a painter's nickname and a square mosaic instead of the provider's
// name and email. Apple's "hide my email" relay addresses are unreadable, and nobody needs
// to see anyone's real address to play. Everything here is derived from the account id, so
// the same person gets the same identity on every device without storing an extra column.

export const AVATAR_GRID = 5;
/** Mirrored around the centre column, so only the left half carries information. */
const HALF_COLUMNS = Math.ceil(AVATAR_GRID / 2);

export interface PlayerAvatar {
  /** Row-major, `AVATAR_GRID * AVATAR_GRID` long. `null` is an empty square. */
  cells: (string | null)[];
  /** Tile background. */
  fill: string;
}

/**
 * Three inks per tile, not one. A single ink made every avatar a two-colour silhouette, so
 * two accounts landing on the same palette index looked like the same creature in the same
 * outfit. The inks are mirrored with the shape, so the tile stays symmetric.
 */
const INKS_PER_AVATAR = 3;

/** Hue in degrees. Only used to group the palette, so lightness and saturation are ignored. */
function hueOf(hex: string): number {
  const r = parseInt(hex.slice(1, 3), 16) / 255;
  const g = parseInt(hex.slice(3, 5), 16) / 255;
  const b = parseInt(hex.slice(5, 7), 16) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  if (max === min) return 0;
  const d = max - min;
  const h = max === r ? (g - b) / d + (g < b ? 6 : 0) : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return h * 60;
}

/**
 * Picking by a fixed stride kept landing on three blues, because the palette holds several
 * and is not ordered by hue. Grouping first and then taking one ink per group is what makes
 * a tile actually read as colourful rather than as one colour in three shades.
 */
const INK_FAMILIES: string[][] = (() => {
  const families = new Map<number, string[]>();
  for (const hex of BD_PAL) {
    const family = Math.floor(hueOf(hex) / 60);
    families.set(family, [...(families.get(family) ?? []), hex]);
  }
  return [...families.entries()].sort(([a], [b]) => a - b).map(([, hexes]) => hexes);
})();

/** mulberry32 — small, deterministic, good enough to scatter bits. */
function random(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function playerAvatar(userId: string | null | undefined): PlayerAvatar {
  const next = random(seedOf(userId) ^ 0x5bf03635);
  const backdrop = Math.floor(next() * BG_PAL.length);

  // One ink per hue family, walking the families from a seeded start so no two inks on a
  // tile are the same colour twice over.
  const familyStart = Math.floor(next() * INK_FAMILIES.length);
  const inks = Array.from({ length: Math.min(INKS_PER_AVATAR, INK_FAMILIES.length) }, (_, i) => {
    const family = INK_FAMILIES[(familyStart + i) % INK_FAMILIES.length];
    return family[Math.floor(next() * family.length)];
  });

  // Density varies per tile so some creatures are sparse and others solid, rather than every
  // one of them sitting at the same fill ratio.
  const density = 0.42 + next() * 0.28;

  const cells = Array<string | null>(AVATAR_GRID * AVATAR_GRID).fill(null);
  for (let row = 0; row < AVATAR_GRID; row++) {
    for (let col = 0; col < HALF_COLUMNS; col++) {
      if (next() >= density) continue;
      const ink = inks[Math.floor(next() * inks.length)];
      cells[row * AVATAR_GRID + col] = ink;
      cells[row * AVATAR_GRID + (AVATAR_GRID - 1 - col)] = ink;
    }
  }
  // A blank tile reads as a rendering bug, so guarantee at least the centre square.
  if (!cells.some(Boolean)) cells[Math.floor(cells.length / 2)] = inks[0];

  return { cells, fill: BG_PAL[backdrop] };
}

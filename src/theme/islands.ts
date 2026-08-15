import type { Appearance } from './themes';

/**
 * The campaign islands carry their own colours, defined next to the campaign itself in
 * `src/game/islands.ts` as an `{ id, color, bg }` triple. That file is the identity — which
 * island is green and which is violet — and it stays where it is. What it never carried is a
 * foreground: the level picker painted the island name, the grid label, the counter and the
 * progress figure in `island.color` directly on `island.bg`, and those two were picked to look
 * like a place, not to be read against each other. Eleven of the thirteen landed between 2.32
 * and 3.49:1 that way, under the 4.5 the rest of the app is held to, and seven did not even
 * clear the 3:1 floor that a progress bar or a border would need.
 *
 * It also never carried a night. `island.bg` is light art, and a light card on a near-black
 * sheet measured 14.91 to 17.79:1 against the ground it sat on — a white slab, thirteen of them
 * down a scrolling list, in the appearance chosen by someone playing in the dark. The same art
 * in a light theme sat at 1.00 to 1.13:1 against the page, which is a card that barely exists.
 * So the palette is completed here rather than corrected there, and it is completed twice.
 *
 * Five tokens, per appearance:
 *
 * - `bg`    the card ground. Light mirrors the campaign's own value, and `islands.test.ts`
 *           asserts the mirror so the two files cannot drift apart without a test saying so.
 *           Dark is the island's hue at the lightness that puts the card 1.26-1.36:1 off every
 *           dark sheet — a shade more present than the app's own `surface` step of 1.08-1.14,
 *           because this one is art and has an identity to carry, and nowhere near a slab.
 * - `well`  the ground for things set *into* the card: the resting level button, the progress
 *           track. Light is a white chip raised off the card, dark is a slot recessed into it,
 *           which is the honest inversion and gives both foregrounds more room, not less.
 * - `ink`   every word on the card, and every fill that has `onInk` on it. Held at 4.5:1
 *           against `bg` and against `well`, because words sit on both.
 * - `color` the identity hue, for things carried by shape — the progress bar fill, the card
 *           border, the map pin — and never for text. Held at 3:1 against `bg` and `well`, and
 *           in light also against the page: the light card is within 1.13:1 of the sheet it
 *           lies on, so this border is the only thing that makes it read as a card at all.
 * - `onInk` what goes on an `ink` fill — the chapter number, the level you are on. White in
 *           light, the card's own ground in dark, which is the same move `onAccent` makes and
 *           for the same reason: on a dark card `ink` is the light one of the pair.
 *
 * Measured ratios live in `islands.test.ts` rather than in this comment, because a comment
 * cannot fail.
 */
export interface IslandInk {
  /** The card ground. Light mirrors `ISLANDS[i].bg`; dark sits just off the sheet. */
  bg: string;
  /** Ground for the resting level button and the progress track: a chip in light, a slot in dark. */
  well: string;
  /** Shape-only: bar fill, border, pin. Clears the 3:1 non-text floor on `bg` and on `well`. */
  color: string;
  /** Every word on the card, and the fill under `onInk`. Clears 4.5:1 on `bg` and on `well`. */
  ink: string;
  /** The foreground for an `ink` fill. Clears 4.5:1 on `ink`. */
  onInk: string;
}

/** One island's art in both appearances. */
export type IslandPalette = Record<Appearance, IslandInk>;

/**
 * Keyed by `Island['id']`. The light `color` values for scrub, nest and dune are a hair darker
 * than the campaign's own — the only three that missed 3:1 against the palest page, which is
 * the one edge holding the card together in light.
 */
export const ISLAND_INK: Record<string, IslandPalette> = {
  scrub: {
    light: { bg: '#e8f8ee', well: '#f6fcf8', color: '#4f9a71', ink: '#3f7a59', onInk: '#ffffff' },
    dark: { bg: '#1a3124', well: '#132018', color: '#268f54', ink: '#40b673', onInk: '#1a3124' },
  },
  spring: {
    light: { bg: '#e5f2ff', well: '#f5faff', color: '#4190cd', ink: '#2b71a6', onInk: '#ffffff' },
    dark: { bg: '#1f2e39', well: '#151e24', color: '#3383c0', ink: '#73a7ce', onInk: '#1f2e39' },
  },
  lake: {
    light: { bg: '#f3eaff', well: '#faf7ff', color: '#9b7bb8', ink: '#8159a6', onInk: '#ffffff' },
    dark: { bg: '#352545', well: '#22192a', color: '#9e61d5', ink: '#b792d9', onInk: '#352545' },
  },
  ducks: {
    light: { bg: '#e0f5e8', well: '#f3fbf6', color: '#459a64', ink: '#36784e', onInk: '#ffffff' },
    dark: { bg: '#1a3122', well: '#132017', color: '#26904c', ink: '#40b76b', onInk: '#1a3122' },
  },
  nest: {
    light: { bg: '#fff8e0', well: '#fffcf3', color: '#aa8729', ink: '#896d21', onInk: '#ffffff' },
    dark: { bg: '#322c1b', well: '#201d13', color: '#987a28', ink: '#be9e45', onInk: '#322c1b' },
  },
  dune: {
    light: { bg: '#fff5d8', well: '#fffbef', color: '#c37c27', ink: '#9a631f', onInk: '#ffffff' },
    dark: { bg: '#352a1d', well: '#221c14', color: '#a9722d', ink: '#c7995f', onInk: '#352a1d' },
  },
  palm: {
    light: { bg: '#d8f5e8', well: '#effbf6', color: '#2d9b68', ink: '#237951', onInk: '#ffffff' },
    dark: { bg: '#1a3126', well: '#132019', color: '#268f5e', ink: '#40b67f', onInk: '#1a3126' },
  },
  reef: {
    light: { bg: '#ffe8f0', well: '#fff6f9', color: '#e05a78', ink: '#cb264b', onInk: '#ffffff' },
    dark: { bg: '#42232a', well: '#29181c', color: '#d1526e', ink: '#d78d9d', onInk: '#42232a' },
  },
  volcano: {
    light: { bg: '#ffeae0', well: '#fff7f3', color: '#c04020', ink: '#be3f20', onInk: '#ffffff' },
    dark: { bg: '#3d2721', well: '#261a16', color: '#cc5c3f', ink: '#d39281', onInk: '#3d2721' },
  },
  mist: {
    light: { bg: '#eef0f8', well: '#f8f9fc', color: '#7080a0', ink: '#5d6c8c', onInk: '#ffffff' },
    dark: { bg: '#222c3f', well: '#171d27', color: '#517bd1', ink: '#88a1d5', onInk: '#222c3f' },
  },
  glacier: {
    light: { bg: '#e0f4ff', well: '#f3fbff', color: '#3694bc', ink: '#2a7493', onInk: '#ffffff' },
    dark: { bg: '#1d2f36', well: '#141f23', color: '#2e87ac', ink: '#63abc8', onInk: '#1d2f36' },
  },
  storm: {
    light: { bg: '#ebebff', well: '#f7f7ff', color: '#5050a0', ink: '#5050a0', onInk: '#ffffff' },
    dark: { bg: '#29294b', well: '#1b1b2d', color: '#7373da', ink: '#9c9cdc', onInk: '#29294b' },
  },
  olympus: {
    light: { bg: '#f0e8ff', well: '#f9f6ff', color: '#9060c0', ink: '#844fb9', onInk: '#ffffff' },
    dark: { bg: '#352545', well: '#22192a', color: '#9c62d5', ink: '#b693d9', onInk: '#352545' },
  },
};

/**
 * The level picker walks `DIFFS`, not `ISLANDS`, so a tier added without an island to go with
 * it falls through to a neutral card. That fallback needs a foreground for the same reason
 * every real island does — it was `#718cc3` on `#edf1f8`, which is 2.97:1, failing even the
 * shape floor by a hair. It is deliberately the least coloured thing in this file: it stands in
 * for an island that does not exist, so it must not look like one that does.
 */
export const FALLBACK_ISLAND_INK: IslandPalette = {
  light: { bg: '#edf1f8', well: '#f8f9fc', color: '#6f8ac2', ink: '#4a6baf', onInk: '#ffffff' },
  dark: { bg: '#282c34', well: '#1a1d21', color: '#697ea7', ink: '#95a2bb', onInk: '#282c34' },
};

/** The palette for an island id, or the neutral card for a tier that has no island. */
export function islandPaletteFor(id: string): IslandPalette {
  return ISLAND_INK[id] ?? FALLBACK_ISLAND_INK;
}

/** The art an island is painted in right now, which is the only thing a call site wants. */
export function islandInkFor(id: string, appearance: Appearance): IslandInk {
  return islandPaletteFor(id)[appearance];
}

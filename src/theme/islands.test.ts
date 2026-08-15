import { describe, expect, it } from 'vitest';
import { ISLANDS } from '@/game/islands';
import { THEMES, type Appearance } from './themes';
import { FALLBACK_ISLAND_INK, ISLAND_INK, islandInkFor, islandPaletteFor, type IslandInk, type IslandPalette } from './islands';

/** WCAG relative luminance, repeated here so the test does not lean on the code it checks. */
function luminance(hex: string): number {
  const channel = (offset: number) => {
    const value = parseInt(hex.slice(offset, offset + 2), 16) / 255;
    return value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * channel(1) + 0.7152 * channel(3) + 0.0722 * channel(5);
}

function contrast(a: string, b: string): number {
  const [lighter, darker] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (lighter + 0.05) / (darker + 0.05);
}

const PALETTES: (readonly [string, IslandPalette])[] = [
  ...ISLANDS.map(island => [island.id, islandPaletteFor(island.id)] as const),
  ['fallback', FALLBACK_ISLAND_INK] as const,
];

/** Every island in one appearance, named so a failure says which card and which mode. */
function inks(appearance: Appearance): (readonly [string, IslandInk])[] {
  return PALETTES.map(([id, palette]) => [`${id}/${appearance}`, palette[appearance]] as const);
}

const ALL = [...inks('light'), ...inks('dark')];
const sheets = (appearance: Appearance) =>
  Object.entries(THEMES).map(([name, pair]) => [`${name}/${appearance}`, pair[appearance].bg] as const);

describe('island ink', () => {
  it('covers every island the campaign defines, and nothing it does not', () => {
    // A palette keyed by id goes quietly wrong when an island is renamed: the lookup misses,
    // the fallback answers, and the card is legible but the wrong colour. Listing both ways
    // round is what makes that loud.
    expect(Object.keys(ISLAND_INK).sort()).toEqual(ISLANDS.map(i => i.id).sort());
  });

  it('mirrors the card ground the campaign actually paints', () => {
    // `bg` is duplicated from `src/game/islands.ts` so the theme layer can be read on its own.
    // Duplication is fine; drift is not, and this is the only thing standing between them.
    // Light only: the campaign file has no night, which is the whole reason the dark set exists.
    for (const island of ISLANDS) {
      expect(ISLAND_INK[island.id].light.bg, island.id).toBe(island.bg);
    }
  });

  it('reads every word on an island card at AA, in both appearances', () => {
    // The card name, the grid label, the counter, the percentage and the "island found" banner
    // were all painted in `island.color` on `island.bg` — 2.32:1 at nest, 2.52 at spring, and
    // only storm and volcano anywhere near the bar. `ink` is what those become.
    for (const [id, tokens] of ALL) {
      expect(contrast(tokens.ink, tokens.bg), id).toBeGreaterThanOrEqual(4.5);
    }
  });

  it('reads them on the well too, which is where half of them actually sit', () => {
    // The resting level button and the progress track are set into the card rather than drawn
    // on it, so a token held only against `bg` is held against the wrong ground for the five
    // hundred numbers that matter most.
    for (const [id, tokens] of ALL) {
      expect(contrast(tokens.ink, tokens.well), id).toBeGreaterThanOrEqual(4.5);
    }
  });

  it('keeps the identity colour above the floor for the shapes it still paints', () => {
    // The progress bar, the card border and the map pin carry no text, so 3:1 is the bar —
    // but seven islands did not clear even that against their own card.
    for (const [id, tokens] of ALL) {
      expect(contrast(tokens.color, tokens.bg), id).toBeGreaterThanOrEqual(3);
      expect(contrast(tokens.color, tokens.well), id).toBeGreaterThanOrEqual(3);
    }
  });

  it('carries its own foreground on a filled swatch', () => {
    // The chapter badge and the level button for the current level are `onInk` on an `ink`
    // fill. That fill has to be `ink`, not `color`: white on `color` is the same failing pair
    // as before, 2.40 to 7.01 across the thirteen. And `onInk` cannot simply be white — on a
    // dark card `ink` is the light half of the pair, so white on it would fail worse.
    for (const [id, tokens] of ALL) {
      expect(contrast(tokens.onInk, tokens.ink), id).toBeGreaterThanOrEqual(4.5);
    }
  });

  it('sits the dark card on the sheet instead of glaring off it', () => {
    // The light art on a dark sheet measured 14.91 to 17.79:1 against the ground — a white slab
    // thirteen times down a scrolling list. The app's own card-on-sheet step is 1.08-1.14
    // (`bg` to `surface`); an island card is allowed a little more presence than that because
    // it is carrying an identity, and nothing like a slab.
    for (const [id, palette] of PALETTES) {
      for (const [theme, ground] of sheets('dark')) {
        expect(contrast(palette.dark.bg, ground), `${id} on ${theme}`).toBeLessThanOrEqual(1.6);
        expect(contrast(palette.dark.bg, ground), `${id} on ${theme}`).toBeGreaterThanOrEqual(1.15);
      }
    }
  });

  it('draws an edge the light card can be found by', () => {
    // In light the card ground is within 1.13:1 of the page it lies on, so the border is the
    // only thing that makes it a card. Three islands missed 3:1 against the palest page.
    for (const [id, palette] of PALETTES) {
      for (const [theme, ground] of sheets('light')) {
        expect(contrast(palette.light.color, ground), `${id} on ${theme}`).toBeGreaterThanOrEqual(3);
      }
    }
  });

  it('answers for a tier with no island of its own', () => {
    expect(islandPaletteFor('nest')).toBe(ISLAND_INK.nest);
    expect(islandPaletteFor('no-such-island')).toBe(FALLBACK_ISLAND_INK);
    expect(islandInkFor('nest', 'dark')).toBe(ISLAND_INK.nest.dark);
    expect(islandInkFor('no-such-island', 'light')).toBe(FALLBACK_ISLAND_INK.light);
  });
});

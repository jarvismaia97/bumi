import { execFileSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { Resvg } from '@resvg/resvg-js';

/**
 * Every icon the app ships, drawn from the one geometry that `Logo.tsx` documents: on a 32
 * canvas, a margin of 4, a gutter of 3, and units of 7 and 14 — the proportions of the Shikaku
 * the tutorial's last level asks the player to build. They used to be hand-made files that
 * drifted from the mark and from each other.
 *
 *   npm run generate-icons
 *
 * Which of them carries transparency is decided by the platform, not by taste:
 *
 * - the iOS app icon is flattened, because App Store Connect rejects an alpha channel outright
 * - anything a platform masks itself — the touch icon, the web icons, the Android background —
 *   is drawn full-bleed, since a rounded corner baked into the file would be cropped twice
 * - the Android foreground and monochrome layers are transparent by definition: the launcher
 *   composes them over the background layer and tints the monochrome one
 */

const BLUE = '#a8b9d8';
const YELLOW = '#f6ed94';
const GREEN = '#9fcf9b';

/** The three rectangles on the 32 grid, in the order the mark assembles them. */
const PIECES = [
  { x: 4, y: 4, w: 14, h: 7, fill: YELLOW, opacity: 1 },
  { x: 21, y: 4, w: 7, h: 24, fill: GREEN, opacity: 1 },
  { x: 4, y: 14, w: 14, h: 14, fill: '#ffffff', opacity: 0.85 },
];

function rects(fill?: string, opacity?: number): string {
  return PIECES.map(
    piece =>
      `<rect x="${piece.x}" y="${piece.y}" width="${piece.w}" height="${piece.h}" rx="2" ` +
      `fill="${fill ?? piece.fill}" fill-opacity="${opacity ?? piece.opacity}"/>`,
  ).join('');
}

function svg(body: string): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32">${body}</svg>`;
}

/** Full square, no rounding: iOS, Android and the browsers all apply their own mask. */
const fullBleed = svg(`<rect width="32" height="32" fill="${BLUE}"/>${rects()}`);
/** Rounded, for the one place that shows the file as-is. */
const rounded = svg(`<rect width="32" height="32" rx="9" fill="${BLUE}"/>${rects()}`);
const solid = svg(`<rect width="32" height="32" fill="${BLUE}"/>`);

/**
 * Adaptive layers live inside a 66% safe zone — the launcher crops the rest to whatever shape
 * it likes, so the mark is drawn at two thirds and centred.
 */
function adaptive(fill?: string): string {
  const scale = 0.62;
  const offset = (32 - 32 * scale) / 2;
  return svg(`<g transform="translate(${offset} ${offset}) scale(${scale})">${rects(fill, fill ? 1 : undefined)}</g>`);
}

const TARGETS: { file: string; size: number; source: string; flatten?: boolean }[] = [
  { file: 'assets/images/bumi-icon.png', size: 1024, source: fullBleed, flatten: true },
  { file: 'assets/images/android-icon-background.png', size: 512, source: solid },
  { file: 'assets/images/android-icon-foreground.png', size: 512, source: adaptive() },
  { file: 'assets/images/android-icon-monochrome.png', size: 432, source: adaptive('#000000') },
  { file: 'assets/images/favicon.png', size: 48, source: rounded },
  { file: 'public/icon-512.png', size: 512, source: fullBleed },
  { file: 'public/icon-192.png', size: 192, source: fullBleed },
  { file: 'public/apple-touch-icon.png', size: 180, source: fullBleed },
];

for (const target of TARGETS) {
  const path = resolve(target.file);
  const png = new Resvg(target.source, { fitTo: { mode: 'width', value: target.size } }).render().asPng();
  writeFileSync(path, png);

  if (target.flatten) {
    // resvg always writes RGBA. ImageMagick is the shortest way to drop the channel, and this
    // script runs by hand rather than in CI, so the dependency costs nothing at build time.
    execFileSync('magick', [path, '-background', BLUE, '-alpha', 'remove', '-alpha', 'off', path]);
  }

  console.log(`${target.file} ${target.size}px${target.flatten ? ' (flattened)' : ''}`);
}

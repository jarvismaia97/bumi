// Pastel fills and shaded edges inspired by the reference Shikaku board.
export const BG_PAL = [
  '#f6ed94', '#a8b9d8', '#9fcf9b', '#b3a3e4', '#d59bc6', '#82a4d4', '#8fd0d3', '#f0bb8b',
  '#9ebc9a', '#e6b2a6', '#c5b1e8', '#99c9e5', '#e7da90', '#c6a1be', '#a6c4dc', '#a9d7bd',
];

export const BD_PAL = [
  '#d7cb62', '#7894c7', '#6eaf6d', '#8872c6', '#b96da7', '#5e82be', '#55adb5', '#d58f5a',
  '#6da46c', '#c98277', '#9378c8', '#68a8ce', '#c6b85a', '#ad769e', '#789cbc', '#72af8d',
];

// A clue sits on the theme's surface until a rectangle covers it, and then it sits on one of
// the pastels above — which are light whichever appearance is on, so the accent it was painted
// in stopped separating from its own background. Against `BG_PAL` the accent reaches 1.90:1 at
// best and white only 2.56:1; both fail every fill in the palette. These two clear 6.9:1
// against all sixteen.
const INK_DARK = '#1a1817';
const INK_LIGHT = '#f2efec';

function relativeLuminance(hex: string): number {
  const channel = (offset: number) => {
    const value = parseInt(hex.slice(offset, offset + 2), 16) / 255;
    return value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * channel(1) + 0.7152 * channel(3) + 0.0722 * channel(5);
}

function contrast(a: string, b: string): number {
  const [lighter, darker] = [relativeLuminance(a), relativeLuminance(b)].sort((x, y) => y - x);
  return (lighter + 0.05) / (darker + 0.05);
}

/**
 * The ink a clue is legible in on a given fill. Measured rather than assumed, because levels may
 * bring colours of their own — the tutorial paints the logo out of them — so a value picked to
 * suit `BG_PAL` alone would not hold. Anything that is not a six-digit hex keeps the dark ink,
 * which is the safer half of the pair on the pastels this is reached with.
 */
export function clueInkOn(fill: string): string {
  if (!/^#[0-9a-fA-F]{6}$/.test(fill)) return INK_DARK;
  return contrast(INK_DARK, fill) >= contrast(INK_LIGHT, fill) ? INK_DARK : INK_LIGHT;
}

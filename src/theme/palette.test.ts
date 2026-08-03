import { describe, expect, it } from 'vitest';
import { BG_PAL, clueInkOn } from './palette';

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

describe('clueInkOn', () => {
  it('clears AA on every fill a rectangle can be painted in', () => {
    // The whole point: a clue used to keep the theme accent on top of these, which reaches
    // 1.90:1 at best. White is no better at 2.56:1 — the pastels are light, so they need
    // dark ink, and this is the guard against a future colour that does not.
    for (const fill of BG_PAL) {
      expect(contrast(clueInkOn(fill), fill), fill).toBeGreaterThanOrEqual(4.5);
    }
  });

  it('turns light on a fill dark enough to need it', () => {
    expect(clueInkOn('#101010')).toBe('#f2efec');
    expect(clueInkOn('#a8b9d8')).toBe('#1a1817');
  });

  it('keeps the dark ink for anything it cannot measure', () => {
    // Levels carry their own colours, and nothing stops one arriving as rgba() or a name.
    expect(clueInkOn('rgba(0,0,0,0.5)')).toBe('#1a1817');
    expect(clueInkOn('red')).toBe('#1a1817');
  });
});

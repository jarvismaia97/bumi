import { describe, expect, it } from 'vitest';
import { THEMES } from './themes';

const channel = (hex: string, at: number) => {
  const value = parseInt(hex.slice(at, at + 2), 16) / 255;
  return value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
};
const luminance = (hex: string) => 0.2126 * channel(hex, 1) + 0.7152 * channel(hex, 3) + 0.0722 * channel(hex, 5);
function contrast(a: string, b: string) {
  const [lighter, darker] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (lighter + 0.05) / (darker + 0.05);
}

describe('every theme is legible, in both appearances', () => {
  const themes = Object.entries(THEMES).flatMap(([name, pair]) =>
    (['light', 'dark'] as const).map(mode => [`${name}/${mode}`, pair[mode]] as const),
  );

  it('paints a clue on an empty cell above the large-text bar', () => {
    // The clue on an empty cell is `accent` on `surface`, which makes the accent the puzzle's
    // own numbers rather than decoration. 3.0 and not 4.5 because the clue is `fontWeight: 800`
    // — but mint, sun and rose sat at 1.9, 2.0 and 2.6, under either reading of the rule.
    for (const [name, tokens] of themes) {
      expect(contrast(tokens.accent, tokens.surface), name).toBeGreaterThanOrEqual(3);
    }
  });

  it('holds body text well clear, and the quieter text at AA', () => {
    for (const [name, tokens] of themes) {
      expect(contrast(tokens.text, tokens.bg), name).toBeGreaterThanOrEqual(7);
      expect(contrast(tokens.sub, tokens.bg), name).toBeGreaterThanOrEqual(4.5);
    }
  });

  it('reads the label on a filled accent, which is the button that starts the game', () => {
    // Every check above this one measures a token used as a foreground on `bg` or `surface`.
    // Nothing measured a token used as a *background*, which is where the app actually failed:
    // white was hardcoded on `accent` at thirteen of these twenty-two pairs, as low as 1.96:1
    // on sun dark. 4.5 and not 3.0 because the label is 15px at weight 700 and WCAG large text
    // starts at 18.66px bold, so it is ordinary text however heavy it looks.
    for (const [name, tokens] of themes) {
      expect(contrast(tokens.onAccent, tokens.accent), name).toBeGreaterThanOrEqual(4.5);
    }
  });
});

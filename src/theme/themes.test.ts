import { describe, expect, it } from 'vitest';
import { resolveAppearance, SEMANTIC, THEME_OPTIONS, THEMES, type SemanticTokens, type ThemeTokens } from './themes';

/** WCAG relative luminance, the only piece of the contrast formula worth spelling out. */
function luminance(hex: string): number {
  const channels = [hex.slice(1, 3), hex.slice(3, 5), hex.slice(5, 7)].map(pair => {
    const c = parseInt(pair, 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2];
}

function contrast(a: string, b: string): number {
  const [lighter, darker] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (lighter + 0.05) / (darker + 0.05);
}

const APPEARANCES = ['light', 'dark'] as const;
const TOKENS: (keyof ThemeTokens)[] = ['bg', 'surface', 'gridSep', 'text', 'sub', 'accent', 'onAccent'];
const FAMILIES = ['danger', 'warning', 'success', 'info'] as const;
/** Carried by shape alone (a medal dot, a progress bar), so the non-text floor applies. */
const GRAPHIC_TOKENS: (keyof SemanticTokens)[] = ['streak', 'gold', 'silver', 'bronze'];

describe('themes', () => {
  it('offers every theme it defines, in the order the picker shows them', () => {
    // Listing them rather than counting: a theme added to `THEMES` and forgotten in
    // `THEME_OPTIONS` exists everywhere except the one screen that would let anyone pick it.
    // Earned first, then the seasonal five in the order their months come round.
    expect(THEME_OPTIONS).toEqual([
      'classic', 'mint', 'violet', 'navy', 'rose', 'sun',
      'carnaval', 'primavera', 'verao', 'halloween', 'natal',
    ]);
    expect([...THEME_OPTIONS].sort()).toEqual(Object.keys(THEMES).sort());
  });

  it('has complete tokens for every selectable theme in both appearances', () => {
    THEME_OPTIONS.forEach(name => {
      APPEARANCES.forEach(appearance => {
        TOKENS.forEach(token => expect(THEMES[name][appearance][token]).toMatch(/^#[0-9a-f]{6}$/));
      });
    });
  });

  it('keeps both text tones legible in both appearances', () => {
    THEME_OPTIONS.forEach(name => {
      APPEARANCES.forEach(appearance => {
        const { bg, surface, text, sub } = THEMES[name][appearance];
        expect(contrast(text, bg)).toBeGreaterThanOrEqual(4.5);
        expect(contrast(text, surface)).toBeGreaterThanOrEqual(4.5);
        expect(contrast(sub, bg)).toBeGreaterThanOrEqual(4.5);
        expect(contrast(sub, surface)).toBeGreaterThanOrEqual(4.5);
      });
    });
  });

  it('has complete semantic tokens in both appearances', () => {
    APPEARANCES.forEach(appearance => {
      Object.values(SEMANTIC[appearance]).forEach(value => expect(value).toMatch(/^#[0-9a-f]{6}$/));
    });
  });

  it('reads every status foreground over any theme it can land on', () => {
    APPEARANCES.forEach(appearance => {
      THEME_OPTIONS.forEach(name => {
        const { bg, surface } = THEMES[name][appearance];
        FAMILIES.forEach(family => {
          expect(contrast(SEMANTIC[appearance][family], bg)).toBeGreaterThanOrEqual(4.5);
          expect(contrast(SEMANTIC[appearance][family], surface)).toBeGreaterThanOrEqual(4.5);
        });
        GRAPHIC_TOKENS.forEach(token => {
          expect(contrast(SEMANTIC[appearance][token], bg)).toBeGreaterThanOrEqual(3);
          expect(contrast(SEMANTIC[appearance][token], surface)).toBeGreaterThanOrEqual(3);
        });
      });
    });
  });

  it('reads every status foreground over its own tinted surface', () => {
    APPEARANCES.forEach(appearance => {
      FAMILIES.forEach(family => {
        const tokens = SEMANTIC[appearance];
        expect(contrast(tokens[family], tokens[`${family}Surface`])).toBeGreaterThanOrEqual(4.5);
        // The island unlock panel puts the theme's body text on a status surface.
        THEME_OPTIONS.forEach(name => {
          expect(contrast(THEMES[name][appearance].text, tokens[`${family}Surface`])).toBeGreaterThanOrEqual(4.5);
        });
      });
    });
  });

  it('lifts dark status surfaces above the theme surfaces they sit on', () => {
    FAMILIES.forEach(family => {
      THEME_OPTIONS.forEach(name => {
        expect(luminance(SEMANTIC.dark[`${family}Surface`])).toBeGreaterThan(luminance(THEMES[name].dark.surface));
      });
    });
  });

  it('lifts dark surfaces above the background instead of sinking them', () => {
    THEME_OPTIONS.forEach(name => {
      const { bg, surface, gridSep } = THEMES[name].dark;
      expect(luminance(surface)).toBeGreaterThan(luminance(bg));
      expect(luminance(gridSep)).toBeGreaterThan(luminance(surface));
    });
  });

  it('follows the device scheme only while the player has not chosen', () => {
    expect(resolveAppearance('auto', 'dark')).toBe('dark');
    expect(resolveAppearance('auto', 'light')).toBe('light');
    expect(resolveAppearance('auto', null)).toBe('light');
    expect(resolveAppearance('light', 'dark')).toBe('light');
    expect(resolveAppearance('dark', 'light')).toBe('dark');
  });
});

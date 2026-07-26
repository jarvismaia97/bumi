import { describe, expect, it } from 'vitest';
import { THEME_OPTIONS, THEMES } from './themes';

describe('themes', () => {
  it('exposes the six selectable colour themes', () => {
    expect(THEME_OPTIONS.map(theme => theme.name)).toEqual(['classic', 'mint', 'violet', 'navy', 'rose', 'sun']);
  });

  it('has complete tokens for every selectable theme', () => {
    THEME_OPTIONS.forEach(option => {
      expect(THEMES[option.name].accent).toMatch(/^#/);
      expect(THEMES[option.name].bg).toMatch(/^#/);
    });
  });
});

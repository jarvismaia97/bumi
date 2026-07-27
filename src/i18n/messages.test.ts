import { describe, expect, it } from 'vitest';
import { messageKeys, resolveLanguage, translate } from './messages';

describe('message catalogue', () => {
  it('has the same keys in both languages', () => {
    const portuguese = messageKeys('pt-PT');
    const english = messageKeys('en');
    expect([...english].sort()).toEqual([...portuguese].sort());
  });

  it('leaves no Portuguese string sitting in the English catalogue', () => {
    const untranslated = messageKeys('en').filter(key => {
      const value = translate('en', key);
      return value !== '' && value === translate('pt-PT', key) && /[çãõáéíóúâêô]/i.test(value);
    });
    expect(untranslated).toEqual([]);
  });

  it('keeps the same placeholders on both sides', () => {
    const placeholders = (value: string) => (value.match(/\{(\w+)\}/g) ?? []).sort();
    for (const key of messageKeys('pt-PT')) {
      expect(placeholders(translate('en', key)), key).toEqual(placeholders(translate('pt-PT', key)));
    }
  });

  it('falls back to Portuguese for an unknown key rather than throwing', () => {
    expect(translate('en', 'does.not.exist')).toBe('does.not.exist');
  });

  it('substitutes variables', () => {
    expect(translate('en', 'menu.continueLevel', { level: 42 })).toBe('Continue at level 42');
  });

  it('serves Portuguese speakers Portuguese and everyone else English', () => {
    expect(resolveLanguage('pt')).toBe('pt-PT');
    expect(resolveLanguage('pt-BR')).toBe('pt-PT');
    expect(resolveLanguage('en-US')).toBe('en');
    expect(resolveLanguage('fr')).toBe('en');
    expect(resolveLanguage('es-ES')).toBe('en');
  });

  it('falls back to Portuguese when the device reports no locale at all', () => {
    // Static web rendering has no locale, and the site is Portuguese-first.
    expect(resolveLanguage(null)).toBe('pt-PT');
    expect(resolveLanguage(undefined)).toBe('pt-PT');
  });
});

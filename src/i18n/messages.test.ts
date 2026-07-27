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

  it('treats anything that is not English as Portuguese', () => {
    expect(resolveLanguage('en-US')).toBe('en');
    expect(resolveLanguage('pt')).toBe('pt-PT');
    expect(resolveLanguage('fr')).toBe('pt-PT');
    expect(resolveLanguage(null)).toBe('pt-PT');
  });
});

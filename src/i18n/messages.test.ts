import { describe, expect, it } from 'vitest';
import {
  isSupportedLanguage,
  messageKeys,
  resolveLanguage,
  SUPPORTED_LANGUAGES,
  translate,
  type SupportedLanguage,
} from './messages';

/** Portuguese is the source catalogue; every other language is checked against it. */
const TRANSLATED: SupportedLanguage[] = ['en', 'es'];

describe('message catalogue', () => {
  it('has the same keys in every language', () => {
    const portuguese = [...messageKeys('pt-PT')].sort();
    for (const language of TRANSLATED) {
      expect([...messageKeys(language)].sort(), language).toEqual(portuguese);
    }
  });

  it('leaves no Portuguese string sitting in a translated catalogue', () => {
    // Letters Portuguese uses and neither English nor Spanish does, so a copy-paste from the
    // source catalogue is visible even where the two languages legitimately agree.
    const portugueseOnly = /[çãõâêô]/i;
    for (const language of TRANSLATED) {
      const untranslated = messageKeys(language).filter(key => {
        const value = translate(language, key);
        return value !== '' && value === translate('pt-PT', key) && portugueseOnly.test(value);
      });
      expect(untranslated, language).toEqual([]);
    }
  });

  it('keeps the same placeholders on every side', () => {
    const placeholders = (value: string) => (value.match(/\{(\w+)\}/g) ?? []).sort();
    for (const key of messageKeys('pt-PT')) {
      for (const language of TRANSLATED) {
        expect(placeholders(translate(language, key)), `${language} ${key}`).toEqual(placeholders(translate('pt-PT', key)));
      }
    }
  });

  it('falls back to Portuguese for an unknown key rather than throwing', () => {
    expect(translate('en', 'does.not.exist')).toBe('does.not.exist');
  });

  it('falls back to Portuguese for a language with no catalogue rather than throwing', () => {
    // Reached when a stored preference names a language the catalogue does not have — 'pt'
    // instead of 'pt-PT', say. This used to throw and blank the whole web app.
    const unknown = 'pt' as SupportedLanguage;
    expect(() => translate(unknown, 'menu.daily')).not.toThrow();
    expect(translate(unknown, 'menu.daily')).toBe(translate('pt-PT', 'menu.daily'));
  });

  it('knows which values name a catalogue', () => {
    expect(SUPPORTED_LANGUAGES).toEqual(['pt-PT', 'en', 'es']);
    for (const language of SUPPORTED_LANGUAGES) expect(isSupportedLanguage(language)).toBe(true);
    for (const value of ['pt', 'en-GB', 'auto', '', null, undefined, 7]) {
      expect(isSupportedLanguage(value), String(value)).toBe(false);
    }
  });

  it('substitutes variables', () => {
    expect(translate('en', 'menu.continueLevel', { level: 42 })).toBe('Continue at level 42');
    expect(translate('es', 'menu.continueLevel', { level: 42 })).toBe('Continuar en el nivel 42');
  });

  it('serves each language its own speakers and everyone else English', () => {
    expect(resolveLanguage('pt')).toBe('pt-PT');
    expect(resolveLanguage('pt-BR')).toBe('pt-PT');
    expect(resolveLanguage('es')).toBe('es');
    expect(resolveLanguage('es-ES')).toBe('es');
    expect(resolveLanguage('es-419')).toBe('es');
    expect(resolveLanguage('en-US')).toBe('en');
    expect(resolveLanguage('fr')).toBe('en');
  });

  it('falls back to Portuguese when the device reports no locale at all', () => {
    // Static web rendering has no locale, and the site is Portuguese-first.
    expect(resolveLanguage(null)).toBe('pt-PT');
    expect(resolveLanguage(undefined)).toBe('pt-PT');
  });
});

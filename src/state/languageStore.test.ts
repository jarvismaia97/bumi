import { describe, expect, it } from 'vitest';
import { isLanguagePreference, useLanguageStore, type LanguagePreference } from './languageStore';

/** What `persist` runs over whatever came back out of storage. */
function rehydrate(persisted: unknown): LanguagePreference {
  const { merge } = useLanguageStore.persist.getOptions();
  const state = merge!(persisted, useLanguageStore.getState()) as { preference: LanguagePreference };
  return state.preference;
}

describe('the stored language preference', () => {
  it('keeps a preference the catalogue can serve', () => {
    for (const preference of ['auto', 'pt-PT', 'en', 'es'] as const) {
      expect(rehydrate({ preference })).toBe(preference);
    }
  });

  it('drops one it cannot', () => {
    // 'pt' is the tempting wrong answer: the catalogue is keyed 'pt-PT', and handing 'pt' to
    // the renderer used to throw on every string and leave the web build blank.
    for (const preference of ['pt', 'en-GB', 'fr', '', 42, null, {}]) {
      expect(rehydrate({ preference }), JSON.stringify(preference)).toBe('auto');
    }
  });

  it('survives storage holding nothing useful at all', () => {
    expect(rehydrate(undefined)).toBe('auto');
    expect(rehydrate(null)).toBe('auto');
    expect(rehydrate({})).toBe('auto');
  });

  it('recognises the values a player can choose', () => {
    expect(isLanguagePreference('auto')).toBe(true);
    expect(isLanguagePreference('pt-PT')).toBe(true);
    expect(isLanguagePreference('pt')).toBe(false);
  });
});

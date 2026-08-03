import { useLocales } from 'expo-localization';
import { useHydrated } from '@/lib/hydration';
import { useLanguageStore } from '@/state/languageStore';
import { resolveLanguage, translate, type SupportedLanguage, type Translate } from './messages';

export { messageKeys, resolveLanguage, translate } from './messages';
export type { SupportedLanguage, Translate } from './messages';

/** What the static document was rendered in: no locale, which the catalogue answers with pt. */
const STATIC_LANGUAGE = resolveLanguage(null);

export function useI18n(): { language: SupportedLanguage; t: Translate } {
  const locales = useLocales();
  const preference = useLanguageStore(state => state.preference);
  const hydrated = useHydrated();
  // An explicit choice wins; `auto` keeps following the device. Before hydration neither is
  // consulted: the first client pass has to match the markup the server sent. See
  // @/lib/hydration.
  const language = !hydrated
    ? STATIC_LANGUAGE
    : preference === 'auto'
      ? resolveLanguage(locales[0]?.languageCode)
      : preference;

  return {
    language,
    t: (key: string, variables?: Record<string, number | string>) => translate(language, key, variables),
  };
}

import { useLocales } from 'expo-localization';
import { useLanguageStore } from '@/state/languageStore';
import { resolveLanguage, translate, type SupportedLanguage, type Translate } from './messages';

export { messageKeys, resolveLanguage, translate } from './messages';
export type { SupportedLanguage, Translate } from './messages';

export function useI18n(): { language: SupportedLanguage; t: Translate } {
  const locales = useLocales();
  const preference = useLanguageStore(state => state.preference);
  // An explicit choice wins; `auto` keeps following the device.
  const language = preference === 'auto' ? resolveLanguage(locales[0]?.languageCode) : preference;
  return {
    language,
    t: (key: string, variables?: Record<string, number | string>) => translate(language, key, variables),
  };
}

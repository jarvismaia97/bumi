import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { isSupportedLanguage, type SupportedLanguage } from '@/i18n/messages';

/** `auto` follows the device language, which is what every player gets until they choose. */
export type LanguagePreference = 'auto' | SupportedLanguage;

export function isLanguagePreference(value: unknown): value is LanguagePreference {
  return value === 'auto' || isSupportedLanguage(value);
}

interface LanguageState {
  preference: LanguagePreference;
  setPreference: (preference: LanguagePreference) => void;
}

export const useLanguageStore = create<LanguageState>()(
  persist(
    set => ({
      preference: 'auto',
      setPreference: preference => set({ preference }),
    }),
    {
      name: 'bumi-language-store-v1',
      storage: createJSONStorage(() => AsyncStorage),
      // On the web this key is plain localStorage, so it can hold anything an older build, a
      // devtools edit or a hand-written script left there. A preference naming no catalogue is
      // dropped here rather than handed to the renderer.
      merge: (persisted, current) => {
        const stored = (persisted as Partial<LanguageState> | null | undefined)?.preference;
        return { ...current, preference: isLanguagePreference(stored) ? stored : 'auto' };
      },
    },
  ),
);

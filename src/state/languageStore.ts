import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import type { SupportedLanguage } from '@/i18n/messages';

/** `auto` follows the device language, which is what every player gets until they choose. */
export type LanguagePreference = 'auto' | SupportedLanguage;

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
    },
  ),
);

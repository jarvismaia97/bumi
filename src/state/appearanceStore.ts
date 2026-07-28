import AsyncStorage from '@react-native-async-storage/async-storage';
import { useColorScheme } from 'react-native';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { resolveAppearance, type Appearance, type AppearancePreference } from '@/theme/themes';

interface AppearanceState {
  preference: AppearancePreference;
  setPreference: (preference: AppearancePreference) => void;
}

export const useAppearanceStore = create<AppearanceState>()(
  persist(
    set => ({
      preference: 'auto',
      setPreference: preference => set({ preference }),
    }),
    {
      name: 'bumi-appearance-store-v1',
      storage: createJSONStorage(() => AsyncStorage),
    },
  ),
);

/** What the app actually paints, which an override pulls away from the device appearance. */
export function useAppearance(): Appearance {
  const preference = useAppearanceStore(s => s.preference);
  const systemScheme = useColorScheme();
  return resolveAppearance(preference, systemScheme);
}

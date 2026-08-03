import AsyncStorage from '@react-native-async-storage/async-storage';
import { useColorScheme } from 'react-native';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { useHydrated } from '@/lib/hydration';
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

/** What the static document was painted in: no device to ask, which resolves to light. */
const STATIC_APPEARANCE = resolveAppearance('auto', null);

/** What the app actually paints, which an override pulls away from the device appearance. */
export function useAppearance(): Appearance {
  const preference = useAppearanceStore(s => s.preference);
  const systemScheme = useColorScheme();
  const hydrated = useHydrated();
  // Before hydration neither is consulted: the first client pass has to match the markup the
  // server sent, and a palette that disagrees with it is never repainted. See @/lib/hydration.
  return hydrated ? resolveAppearance(preference, systemScheme) : STATIC_APPEARANCE;
}

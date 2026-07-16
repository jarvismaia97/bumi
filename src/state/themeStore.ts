import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { THEMES, type ThemeName, type ThemeTokens } from '@/theme/themes';

interface ThemeState {
  themeName: ThemeName;
  colorblind: boolean;
  setTheme: (name: ThemeName) => void;
  toggleColorblind: () => void;
}

export const useThemeStore = create<ThemeState>()(
  persist(
    set => ({
      themeName: 'roxo',
      colorblind: false,
      setTheme: name => set({ themeName: name }),
      toggleColorblind: () => set(s => ({ colorblind: !s.colorblind })),
    }),
    {
      name: 'bumi-theme-store-v2',
      storage: createJSONStorage(() => AsyncStorage),
    },
  ),
);

export function useThemeTokens(): ThemeTokens {
  return useThemeStore(s => THEMES[s.themeName] ?? THEMES['roxo']);
}

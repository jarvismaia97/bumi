import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { useAppearance } from '@/state/appearanceStore';
import { SEMANTIC, THEMES, type SemanticTokens, type ThemeName, type ThemeTokens } from '@/theme/themes';

interface ThemeState {
  themeName: ThemeName;
  setThemeName: (themeName: ThemeName) => void;
}

export const useThemeStore = create<ThemeState>()(
  persist(
    set => ({
      themeName: 'classic',
      setThemeName: themeName => set({ themeName }),
    }),
    {
      name: 'bumi-theme-store-v2',
      storage: createJSONStorage(() => AsyncStorage),
    },
  ),
);

export function useThemeTokens(): ThemeTokens {
  const appearance = useAppearance();
  return useThemeStore(s => (THEMES[s.themeName] ?? THEMES.classic)[appearance]);
}

export function useSemanticTokens(): SemanticTokens {
  return SEMANTIC[useAppearance()];
}

export interface ThemeTokens {
  bg: string;
  surface: string;
  gridSep: string;
  text: string;
  sub: string;
  accent: string;
}

export type ThemeName = 'roxo' | 'agua' | 'azulescuro' | 'rosa' | 'amarelo';

export const THEMES: Record<ThemeName, ThemeTokens> = {
  roxo:       { bg: '#faf4fb', surface: '#ffffff', gridSep: '#e0d4e8', text: '#3a2d45', sub: '#b09abf', accent: '#9b7bb8' },
  agua:       { bg: '#f0fdf7', surface: '#ffffff', gridSep: '#b8e8d0', text: '#0d3520', sub: '#5aaa80', accent: '#72cfa0' },
  azulescuro: { bg: '#e8edf5', surface: '#ffffff', gridSep: '#b0bcd8', text: '#0d1a35', sub: '#5870a0', accent: '#1a3a6a' },
  rosa:       { bg: '#fdf0f4', surface: '#ffffff', gridSep: '#f0c8d8', text: '#45151f', sub: '#c07898', accent: '#f4b8c8' },
  amarelo:    { bg: '#fffbea', surface: '#ffffff', gridSep: '#ede09a', text: '#3a2d00', sub: '#b0940a', accent: '#f5c842' },
};

export const THEME_NAMES = Object.keys(THEMES) as ThemeName[];

export interface ThemeTokens {
  bg: string;
  surface: string;
  gridSep: string;
  text: string;
  sub: string;
  accent: string;
}

export type ThemeName = 'classic' | 'mint' | 'violet' | 'navy' | 'rose' | 'sun';

export interface ThemeOption {
  name: ThemeName;
  label: string;
  preview: readonly [string, string, string];
}

export const THEMES: Record<ThemeName, ThemeTokens> = {
  classic: { bg: '#f7f3f0', surface: '#fffefd', gridSep: '#e8e1dc', text: '#292827', sub: '#827d78', accent: '#718cc3' },
  mint: { bg: '#effaf5', surface: '#ffffff', gridSep: '#cde7da', text: '#174d36', sub: '#63917b', accent: '#71cda5' },
  violet: { bg: '#faf5fc', surface: '#ffffff', gridSep: '#e5d4ec', text: '#40304e', sub: '#9a7dab', accent: '#9d7cbb' },
  navy: { bg: '#f0f4fb', surface: '#ffffff', gridSep: '#d7e0ef', text: '#173863', sub: '#6e83a1', accent: '#254b7d' },
  rose: { bg: '#fff5f8', surface: '#ffffff', gridSep: '#f0d6e0', text: '#613044', sub: '#a66a82', accent: '#d78cab' },
  sun: { bg: '#fff9e8', surface: '#fffefa', gridSep: '#f0dfad', text: '#5f4810', sub: '#9c7c2c', accent: '#e3ad3e' },
};

export const THEME_OPTIONS: readonly ThemeOption[] = [
  { name: 'classic', label: 'Clássico', preview: ['#f7f3f0', '#718cc3', '#292827'] },
  { name: 'mint', label: 'Menta', preview: ['#effaf5', '#71cda5', '#174d36'] },
  { name: 'violet', label: 'Violeta', preview: ['#faf5fc', '#9d7cbb', '#40304e'] },
  { name: 'navy', label: 'Azul', preview: ['#f0f4fb', '#254b7d', '#173863'] },
  { name: 'rose', label: 'Rosa', preview: ['#fff5f8', '#d78cab', '#613044'] },
  { name: 'sun', label: 'Sol', preview: ['#fff9e8', '#e3ad3e', '#5f4810'] },
];

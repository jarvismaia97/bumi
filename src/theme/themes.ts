export interface ThemeTokens {
  bg: string;
  surface: string;
  gridSep: string;
  text: string;
  sub: string;
  accent: string;
}

/**
 * Status colours. Each family is a triplet so a tinted panel can be painted without
 * inventing a foreground for it: `x` reads on the page and on `xSurface`, `xBorder`
 * outlines `xSurface`.
 */
export interface SemanticTokens {
  danger: string;
  dangerSurface: string;
  dangerBorder: string;
  warning: string;
  warningSurface: string;
  warningBorder: string;
  success: string;
  successSurface: string;
  successBorder: string;
  info: string;
  infoSurface: string;
  infoBorder: string;
  streak: string;
  gold: string;
  silver: string;
  bronze: string;
}

export type ThemeName = 'classic' | 'mint' | 'violet' | 'navy' | 'rose' | 'sun' | 'natal' | 'halloween';

export type Appearance = 'light' | 'dark';

/** `auto` follows the device appearance, which is what every player gets until they choose. */
export type AppearancePreference = 'auto' | Appearance;

// Dark is not an inversion: the ground stays near-black carrying the theme's hue, `surface`
// sits above the ground instead of below it, accents give up some chroma so they stop
// vibrating, and `text` is off-white so a full-screen board does not glare.
export const THEMES: Record<ThemeName, Record<Appearance, ThemeTokens>> = {
  classic: {
    light: { bg: '#f7f3f0', surface: '#fffefd', gridSep: '#e8e1dc', text: '#292827', sub: '#736e6a', accent: '#718cc3' },
    dark: { bg: '#1a1817', surface: '#252220', gridSep: '#3a3532', text: '#f2efec', sub: '#aca49d', accent: '#96acd6' },
  },
  mint: {
    light: { bg: '#effaf5', surface: '#ffffff', gridSep: '#cde7da', text: '#174d36', sub: '#537967', accent: '#338461' },
    dark: { bg: '#111815', surface: '#1b2520', gridSep: '#2c3a33', text: '#e7f2ec', sub: '#9db9ab', accent: '#6fc7a1' },
  },
  violet: {
    light: { bg: '#faf5fc', surface: '#ffffff', gridSep: '#e5d4ec', text: '#40304e', sub: '#86639a', accent: '#9d7cbb' },
    dark: { bg: '#18141b', surface: '#231e27', gridSep: '#382f3e', text: '#efe9f3', sub: '#b3a5bc', accent: '#b99dd2' },
  },
  navy: {
    light: { bg: '#f0f4fb', surface: '#ffffff', gridSep: '#d7e0ef', text: '#173863', sub: '#5c708e', accent: '#254b7d' },
    dark: { bg: '#10151c', surface: '#1a2029', gridSep: '#2b3644', text: '#e7edf6', sub: '#a2b2c7', accent: '#89aede' },
  },
  rose: {
    light: { bg: '#fff5f8', surface: '#ffffff', gridSep: '#f0d6e0', text: '#613044', sub: '#9e5e77', accent: '#c14d7d' },
    dark: { bg: '#1b1316', surface: '#261c20', gridSep: '#3c2d34', text: '#f6eaee', sub: '#c39bab', accent: '#dda2bc' },
  },
  sun: {
    light: { bg: '#fff9e8', surface: '#fffefa', gridSep: '#f0dfad', text: '#5f4810', sub: '#8a6e27', accent: '#976e1c' },
    dark: { bg: '#19160c', surface: '#242015', gridSep: '#3a3320', text: '#f5efdd', sub: '#bdaa7e', accent: '#dfb35b' },
  },
  // Seasonal, and the first two designed against `contrast.test.ts` rather than by eye alone.
  // Both keep a saturated accent: the red is the point of the one and the pumpkin is the point
  // of the other, and neither had to be washed out to make the clue readable — the light reds
  // and oranges are dark enough to carry a number, the dark ones bright enough.
  natal: {
    light: { bg: '#f3f7f2', surface: '#ffffff', gridSep: '#d5e5d6', text: '#1c3524', sub: '#4d6a56', accent: '#c0273f' },
    dark: { bg: '#111a14', surface: '#1a251d', gridSep: '#2b3a30', text: '#eef4ef', sub: '#a4bcab', accent: '#e35c72' },
  },
  halloween: {
    light: { bg: '#fbf4ea', surface: '#fffdf9', gridSep: '#eeddc4', text: '#3a2412', sub: '#7a5a34', accent: '#bb5711' },
    dark: { bg: '#14100f', surface: '#1f1917', gridSep: '#352a26', text: '#f5ece3', sub: '#bfa895', accent: '#f08a3c' },
  },
};

// A clue on an empty cell is `accent` on `surface`, so the accent is not only decoration —
// it is the puzzle's own numbers. Mint and sun were painting them at 1.9 and 2.0 against the
// cell, well under the 4.5 the rest of the app is held to, and nobody reading this file would
// have guessed that from the word "accent". Both were darkened along their own hue, the
// lightest value that clears the bar, so they read as the same colours they were.
//
// It fixes a second thing on the way: the campaign card is `accent` behind white text.
//
// Status is not brand: a player reads "done", "careful", "gone" the same way whichever
// palette they picked, so these vary by appearance only and no theme redefines them.
// The dark tints are re-mixed rather than dimmed — a dimmed mint reads as grey, so the
// dark surfaces keep just enough chroma to still say green, amber, rose or violet.
export const SEMANTIC: Record<Appearance, SemanticTokens> = {
  light: {
    danger: '#b03060',
    dangerSurface: '#ffd6e0',
    dangerBorder: '#ffb3c6',
    warning: '#845c00',
    warningSurface: '#ffe870',
    warningBorder: '#f0c820',
    success: '#267543',
    successSurface: '#e8f5ee',
    successBorder: '#90d0a0',
    info: '#5b3a9c',
    infoSurface: '#e8d5ff',
    infoBorder: '#c0a8e8',
    streak: '#c2733c',
    gold: '#ab8419',
    silver: '#7d8b9a',
    bronze: '#ab6c40',
  },
  dark: {
    danger: '#f191ae',
    dangerSurface: '#3b2029',
    dangerBorder: '#5e3341',
    warning: '#f0cb6a',
    warningSurface: '#3a2f11',
    warningBorder: '#5b4a1d',
    success: '#79d2a0',
    successSurface: '#1a3527',
    successBorder: '#2f5c42',
    info: '#c3a9ee',
    infoSurface: '#2a2140',
    infoBorder: '#453567',
    streak: '#e0a271',
    gold: '#e0b846',
    silver: '#a9b7c5',
    bronze: '#d0946a',
  },
};

export const THEME_OPTIONS: readonly ThemeName[] = ['classic', 'mint', 'violet', 'navy', 'rose', 'sun', 'natal', 'halloween'];

// The device scheme arrives as React Native's `ColorSchemeName`, so anything the platform
// reports that is not an explicit `dark` is painted light.
export function resolveAppearance(preference: AppearancePreference, systemScheme: string | null | undefined): Appearance {
  if (preference !== 'auto') return preference;
  return systemScheme === 'dark' ? 'dark' : 'light';
}

import type { SupportedLanguage } from '@/i18n';
import { BD_PAL, BG_PAL } from '@/theme/palette';

// Players are shown a generated nickname and a square mosaic instead of the provider's
// name and email. Apple's "hide my email" relay addresses are unreadable, and nobody needs
// to see anyone's real address to play. Everything here is derived from the account id, so
// the same person gets the same identity on every device without storing an extra column.

// The word lists are index-aligned across languages: an account always lands on the same
// slot, so the nickname translates rather than changing identity with the device language.
/** Portuguese adjectives are invariant so they agree with any noun gender. */
export const ADJECTIVES: Record<SupportedLanguage, string[]> = {
  'pt-PT': ['Veloz', 'Ágil', 'Feliz', 'Gentil', 'Valente', 'Radiante', 'Brilhante', 'Elegante', 'Alegre', 'Forte', 'Leal', 'Hábil', 'Audaz', 'Sagaz', 'Grande', 'Doce', 'Nobre', 'Simples', 'Amável', 'Fiel'],
  en: ['Swift', 'Nimble', 'Happy', 'Gentle', 'Brave', 'Radiant', 'Bright', 'Elegant', 'Cheerful', 'Strong', 'Loyal', 'Skilful', 'Bold', 'Clever', 'Grand', 'Sweet', 'Noble', 'Simple', 'Kind', 'True'],
};

export const NOUNS: Record<SupportedLanguage, string[]> = {
  'pt-PT': ['Lince', 'Coruja', 'Raposa', 'Tartaruga', 'Golfinho', 'Pinguim', 'Falcão', 'Lontra', 'Texugo', 'Camaleão', 'Polvo', 'Esquilo', 'Panda', 'Doninha', 'Íbis', 'Foca', 'Corvo', 'Alce', 'Gaivota', 'Toupeira'],
  en: ['Lynx', 'Owl', 'Fox', 'Turtle', 'Dolphin', 'Penguin', 'Falcon', 'Otter', 'Badger', 'Chameleon', 'Octopus', 'Squirrel', 'Panda', 'Weasel', 'Ibis', 'Seal', 'Raven', 'Elk', 'Seagull', 'Mole'],
};

export const AVATAR_GRID = 5;
/** Mirrored around the centre column, so only the left half carries information. */
const HALF_COLUMNS = Math.ceil(AVATAR_GRID / 2);

export interface PlayerAvatar {
  /** Row-major, `AVATAR_GRID * AVATAR_GRID` long. */
  cells: boolean[];
  /** Tile background. */
  fill: string;
  /** Colour of the filled squares. */
  ink: string;
}

/** FNV-1a, 32-bit. */
function hashSeed(value: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < value.length; i++) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

/** mulberry32 — small, deterministic, good enough to scatter bits. */
function random(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function seedOf(userId: string | null | undefined): number {
  return hashSeed(userId?.trim() || 'bumi');
}

export function playerName(userId: string | null | undefined, language: SupportedLanguage): string {
  const next = random(seedOf(userId));
  const adjectives = ADJECTIVES[language];
  const nouns = NOUNS[language];
  const adjective = adjectives[Math.floor(next() * adjectives.length)];
  const noun = nouns[Math.floor(next() * nouns.length)];
  // Portuguese puts the adjective after the noun.
  return language === 'en' ? `${adjective} ${noun}` : `${noun} ${adjective}`;
}

export function playerAvatar(userId: string | null | undefined): PlayerAvatar {
  const next = random(seedOf(userId) ^ 0x5bf03635);
  const paletteIndex = Math.floor(next() * BG_PAL.length);

  const cells = Array<boolean>(AVATAR_GRID * AVATAR_GRID).fill(false);
  for (let row = 0; row < AVATAR_GRID; row++) {
    for (let col = 0; col < HALF_COLUMNS; col++) {
      if (next() >= 0.55) continue;
      cells[row * AVATAR_GRID + col] = true;
      cells[row * AVATAR_GRID + (AVATAR_GRID - 1 - col)] = true;
    }
  }
  // A blank tile reads as a rendering bug, so guarantee at least the centre square.
  if (!cells.some(Boolean)) cells[Math.floor(cells.length / 2)] = true;

  return {
    cells,
    fill: BG_PAL[paletteIndex],
    ink: BD_PAL[paletteIndex],
  };
}

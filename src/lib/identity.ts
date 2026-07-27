import type { SupportedLanguage } from '@/i18n/messages';
import { BD_PAL, BG_PAL } from '@/theme/palette';

// Players are shown a painter's nickname and a square mosaic instead of the provider's
// name and email. Apple's "hide my email" relay addresses are unreadable, and nobody needs
// to see anyone's real address to play. Everything here is derived from the account id, so
// the same person gets the same identity on every device without storing an extra column.

interface Artist {
  /** The name the artist is commonly known by. Never translated. */
  name: string;
  /** Affectionate jab at the artist's most recognisable habit, per language. */
  epithet: Record<SupportedLanguage, string>;
}

// Artist and epithet are one unit: the joke only lands because the nickname matches that
// particular painter, so these are fixed pairs rather than two lists combined at random.
// The jabs are aimed at style and subject matter only — never at anyone's illness, body or
// death. Collisions between players are fine; this is decoration, not an identifier.
export const ARTISTS: Artist[] = [
  { name: 'Mondrian', epithet: { 'pt-PT': 'Grelha Perfeita', en: 'Perfect Grid' } },
  { name: 'Malevich', epithet: { 'pt-PT': 'Só um Quadrado', en: 'Just a Square' } },
  { name: 'Rothko', epithet: { 'pt-PT': 'Dois Retângulos', en: 'Two Rectangles' } },
  { name: 'Pollock', epithet: { 'pt-PT': 'Pinga-Pinga', en: 'Drip Drop' } },
  { name: 'Munch', epithet: { 'pt-PT': 'O Desesperado', en: 'The Screamer' } },
  { name: 'Magritte', epithet: { 'pt-PT': 'Cara de Maçã', en: 'Apple Face' } },
  { name: 'Matisse', epithet: { 'pt-PT': 'Recorta e Cola', en: 'Cut and Paste' } },
  { name: 'Michelangelo', epithet: { 'pt-PT': 'Músculo Puro', en: 'Pure Muscle' } },
  { name: 'Rembrandt', epithet: { 'pt-PT': 'Luz de Vela', en: 'Candlelight' } },
  { name: 'Botticelli', epithet: { 'pt-PT': 'Vénus na Concha', en: 'Venus on a Shell' } },
  { name: 'Monet', epithet: { 'pt-PT': 'Mais Nenúfares', en: 'More Water Lilies' } },
  { name: 'Dalí', epithet: { 'pt-PT': 'Relógio Derretido', en: 'Melting Clock' } },
  { name: 'Picasso', epithet: { 'pt-PT': 'Nariz ao Lado', en: 'Nose on the Side' } },
  { name: 'Warhol', epithet: { 'pt-PT': 'Lata de Sopa', en: 'Soup Can' } },
  { name: 'Klimt', epithet: { 'pt-PT': 'Tudo Dourado', en: 'All That Gold' } },
  { name: 'Vermeer', epithet: { 'pt-PT': 'Brinco de Pérola', en: 'Pearl Earring' } },
  { name: 'Escher', epithet: { 'pt-PT': 'Escada Sem Fim', en: 'Endless Stairs' } },
  { name: 'Hokusai', epithet: { 'pt-PT': 'Onda Gigante', en: 'Giant Wave' } },
  { name: 'Da Vinci', epithet: { 'pt-PT': 'Sorriso Estranho', en: 'That Odd Smile' } },
  { name: 'Caravaggio', epithet: { 'pt-PT': 'Luz Dramática', en: 'Spotlight' } },
  { name: 'Goya', epithet: { 'pt-PT': 'Sonho Escuro', en: 'Dark Dream' } },
  { name: 'Miró', epithet: { 'pt-PT': 'Rabisco Alegre', en: 'Happy Scribble' } },
  { name: 'Chagall', epithet: { 'pt-PT': 'Toda a Gente Voa', en: 'Everyone Floats' } },
  { name: 'Cézanne', epithet: { 'pt-PT': 'Maçãs na Mesa', en: 'Apples on a Table' } },
  { name: 'Gauguin', epithet: { 'pt-PT': 'Fugiu para a Ilha', en: 'Off to the Island' } },
  { name: 'Rousseau', epithet: { 'pt-PT': 'Selva Imaginada', en: 'Imaginary Jungle' } },
  { name: 'Bosch', epithet: { 'pt-PT': 'Monstros Estranhos', en: 'Weird Monsters' } },
  { name: 'Bruegel', epithet: { 'pt-PT': 'Aldeia Cheia', en: 'Crowded Village' } },
  { name: 'Turner', epithet: { 'pt-PT': 'Só Nevoeiro', en: 'Mostly Fog' } },
  { name: 'Degas', epithet: { 'pt-PT': 'Mais Bailarinas', en: 'More Ballerinas' } },
  { name: 'Renoir', epithet: { 'pt-PT': 'Sempre Feliz', en: 'Always Happy' } },
  { name: 'Seurat', epithet: { 'pt-PT': 'Ponto por Ponto', en: 'Dot by Dot' } },
  { name: 'Modigliani', epithet: { 'pt-PT': 'Pescoço Comprido', en: 'Long Neck' } },
  { name: "O'Keeffe", epithet: { 'pt-PT': 'Flor Gigante', en: 'Giant Flower' } },
  { name: 'Hopper', epithet: { 'pt-PT': 'Café Vazio', en: 'Empty Diner' } },
  { name: 'Kahlo', epithet: { 'pt-PT': 'Autorretrato Nº9', en: 'Self-Portrait No.9' } },
  { name: 'Basquiat', epithet: { 'pt-PT': 'Coroa em Tudo', en: 'Crown on All' } },
  { name: 'Haring', epithet: { 'pt-PT': 'Bonecos a Dançar', en: 'Dancing Figures' } },
  { name: 'Lichtenstein', epithet: { 'pt-PT': 'Banda Desenhada', en: 'Comic Panel' } },
  { name: 'Kusama', epithet: { 'pt-PT': 'Bolinhas Infinitas', en: 'Infinite Dots' } },
  { name: 'Calder', epithet: { 'pt-PT': 'Tudo a Baloiçar', en: 'All Wobbly' } },
  { name: 'Giacometti', epithet: { 'pt-PT': 'Bonecos Magros', en: 'Skinny Figures' } },
  { name: 'Brancusi', epithet: { 'pt-PT': 'Liso e Brilhante', en: 'Smooth and Shiny' } },
  { name: 'Rodin', epithet: { 'pt-PT': 'A Pensar Muito', en: 'Deep in Thought' } },
  { name: 'Duchamp', epithet: { 'pt-PT': 'Isto é Arte?', en: 'Is This Art?' } },
  { name: 'Kandinsky', epithet: { 'pt-PT': 'Muitos Círculos', en: 'So Many Circles' } },
  { name: 'Hockney', epithet: { 'pt-PT': 'Piscina Outra Vez', en: 'Another Pool' } },
  { name: 'Klee', epithet: { 'pt-PT': 'Linha a Passear', en: 'Wandering Line' } },
  { name: 'Arcimboldo', epithet: { 'pt-PT': 'Cabeça de Legumes', en: 'Veggie Head' } },
  { name: 'Vasarely', epithet: { 'pt-PT': 'Olhos a Girar', en: 'Spinning Eyes' } },
];

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
  const artist = ARTISTS[seedOf(userId) % ARTISTS.length];
  return `${artist.name} "${artist.epithet[language]}"`;
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

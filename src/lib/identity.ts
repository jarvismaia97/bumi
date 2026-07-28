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
  { name: 'Mondrian', epithet: { 'pt-PT': 'Grelha Perfeita', en: 'Perfect Grid', es: 'Rejilla Perfecta' } },
  { name: 'Malevich', epithet: { 'pt-PT': 'Só um Quadrado', en: 'Just a Square', es: 'Solo un Cuadrado' } },
  { name: 'Rothko', epithet: { 'pt-PT': 'Dois Retângulos', en: 'Two Rectangles', es: 'Dos Rectángulos' } },
  { name: 'Pollock', epithet: { 'pt-PT': 'Pinga-Pinga', en: 'Drip Drop', es: 'Gota a Gota' } },
  { name: 'Munch', epithet: { 'pt-PT': 'O Desesperado', en: 'The Screamer', es: 'El Desesperado' } },
  { name: 'Magritte', epithet: { 'pt-PT': 'Cara de Maçã', en: 'Apple Face', es: 'Cara de Manzana' } },
  { name: 'Matisse', epithet: { 'pt-PT': 'Recorta e Cola', en: 'Cut and Paste', es: 'Recorta y Pega' } },
  { name: 'Michelangelo', epithet: { 'pt-PT': 'Músculo Puro', en: 'Pure Muscle', es: 'Músculo Puro' } },
  { name: 'Rembrandt', epithet: { 'pt-PT': 'Luz de Vela', en: 'Candlelight', es: 'Luz de Vela' } },
  { name: 'Botticelli', epithet: { 'pt-PT': 'Vénus na Concha', en: 'Venus on a Shell', es: 'Venus en la Concha' } },
  { name: 'Monet', epithet: { 'pt-PT': 'Mais Nenúfares', en: 'More Water Lilies', es: 'Más Nenúfares' } },
  { name: 'Dalí', epithet: { 'pt-PT': 'Relógio Derretido', en: 'Melting Clock', es: 'Reloj Derretido' } },
  { name: 'Picasso', epithet: { 'pt-PT': 'Nariz ao Lado', en: 'Nose on the Side', es: 'Nariz de Lado' } },
  { name: 'Warhol', epithet: { 'pt-PT': 'Lata de Sopa', en: 'Soup Can', es: 'Lata de Sopa' } },
  { name: 'Klimt', epithet: { 'pt-PT': 'Tudo Dourado', en: 'All That Gold', es: 'Todo Dorado' } },
  { name: 'Vermeer', epithet: { 'pt-PT': 'Brinco de Pérola', en: 'Pearl Earring', es: 'Pendiente de Perla' } },
  { name: 'Escher', epithet: { 'pt-PT': 'Escada Sem Fim', en: 'Endless Stairs', es: 'Escalera Sin Fin' } },
  { name: 'Hokusai', epithet: { 'pt-PT': 'Onda Gigante', en: 'Giant Wave', es: 'Ola Gigante' } },
  { name: 'Da Vinci', epithet: { 'pt-PT': 'Sorriso Estranho', en: 'That Odd Smile', es: 'Sonrisa Rara' } },
  { name: 'Caravaggio', epithet: { 'pt-PT': 'Luz Dramática', en: 'Spotlight', es: 'Luz Dramática' } },
  { name: 'Goya', epithet: { 'pt-PT': 'Sonho Escuro', en: 'Dark Dream', es: 'Sueño Oscuro' } },
  { name: 'Miró', epithet: { 'pt-PT': 'Rabisco Alegre', en: 'Happy Scribble', es: 'Garabato Alegre' } },
  { name: 'Chagall', epithet: { 'pt-PT': 'Toda a Gente Voa', en: 'Everyone Floats', es: 'Todos Vuelan' } },
  { name: 'Cézanne', epithet: { 'pt-PT': 'Maçãs na Mesa', en: 'Apples on a Table', es: 'Manzanas en la Mesa' } },
  { name: 'Gauguin', epithet: { 'pt-PT': 'Fugiu para a Ilha', en: 'Off to the Island', es: 'Se Fue a la Isla' } },
  { name: 'Rousseau', epithet: { 'pt-PT': 'Selva Imaginada', en: 'Imaginary Jungle', es: 'Selva Imaginada' } },
  { name: 'Bosch', epithet: { 'pt-PT': 'Monstros Estranhos', en: 'Weird Monsters', es: 'Monstruos Raros' } },
  { name: 'Bruegel', epithet: { 'pt-PT': 'Aldeia Cheia', en: 'Crowded Village', es: 'Aldea Llena' } },
  { name: 'Turner', epithet: { 'pt-PT': 'Só Nevoeiro', en: 'Mostly Fog', es: 'Solo Niebla' } },
  { name: 'Degas', epithet: { 'pt-PT': 'Mais Bailarinas', en: 'More Ballerinas', es: 'Más Bailarinas' } },
  { name: 'Renoir', epithet: { 'pt-PT': 'Sempre Feliz', en: 'Always Happy', es: 'Siempre Feliz' } },
  { name: 'Seurat', epithet: { 'pt-PT': 'Ponto por Ponto', en: 'Dot by Dot', es: 'Punto a Punto' } },
  { name: 'Modigliani', epithet: { 'pt-PT': 'Pescoço Comprido', en: 'Long Neck', es: 'Cuello Largo' } },
  { name: "O'Keeffe", epithet: { 'pt-PT': 'Flor Gigante', en: 'Giant Flower', es: 'Flor Gigante' } },
  { name: 'Hopper', epithet: { 'pt-PT': 'Café Vazio', en: 'Empty Diner', es: 'Bar Vacío' } },
  { name: 'Kahlo', epithet: { 'pt-PT': 'Autorretrato Nº9', en: 'Self-Portrait No.9', es: 'Autorretrato Nº9' } },
  { name: 'Basquiat', epithet: { 'pt-PT': 'Coroa em Tudo', en: 'Crown on All', es: 'Corona en Todo' } },
  { name: 'Haring', epithet: { 'pt-PT': 'Bonecos a Dançar', en: 'Dancing Figures', es: 'Muñecos Bailando' } },
  { name: 'Lichtenstein', epithet: { 'pt-PT': 'Banda Desenhada', en: 'Comic Panel', es: 'Viñeta de Cómic' } },
  { name: 'Kusama', epithet: { 'pt-PT': 'Bolinhas Infinitas', en: 'Infinite Dots', es: 'Lunares Infinitos' } },
  { name: 'Calder', epithet: { 'pt-PT': 'Tudo a Baloiçar', en: 'All Wobbly', es: 'Todo se Balancea' } },
  { name: 'Giacometti', epithet: { 'pt-PT': 'Bonecos Magros', en: 'Skinny Figures', es: 'Figuras Flacas' } },
  { name: 'Brancusi', epithet: { 'pt-PT': 'Liso e Brilhante', en: 'Smooth and Shiny', es: 'Liso y Brillante' } },
  { name: 'Rodin', epithet: { 'pt-PT': 'A Pensar Muito', en: 'Deep in Thought', es: 'Pensando Mucho' } },
  { name: 'Duchamp', epithet: { 'pt-PT': 'Isto é Arte?', en: 'Is This Art?', es: '¿Esto es Arte?' } },
  { name: 'Kandinsky', epithet: { 'pt-PT': 'Muitos Círculos', en: 'So Many Circles', es: 'Muchos Círculos' } },
  { name: 'Hockney', epithet: { 'pt-PT': 'Piscina Outra Vez', en: 'Another Pool', es: 'Otra Piscina' } },
  { name: 'Klee', epithet: { 'pt-PT': 'Linha a Passear', en: 'Wandering Line', es: 'Línea de Paseo' } },
  { name: 'Arcimboldo', epithet: { 'pt-PT': 'Cabeça de Legumes', en: 'Veggie Head', es: 'Cabeza de Verduras' } },
  { name: 'Vasarely', epithet: { 'pt-PT': 'Olhos a Girar', en: 'Spinning Eyes', es: 'Ojos que Giran' } },
];

export const AVATAR_GRID = 5;
/** Mirrored around the centre column, so only the left half carries information. */
const HALF_COLUMNS = Math.ceil(AVATAR_GRID / 2);

export interface PlayerAvatar {
  /** Row-major, `AVATAR_GRID * AVATAR_GRID` long. `null` is an empty square. */
  cells: (string | null)[];
  /** Tile background. */
  fill: string;
}

/**
 * Three inks per tile, not one. A single ink made every avatar a two-colour silhouette, so
 * two accounts landing on the same palette index looked like the same creature in the same
 * outfit. The inks are mirrored with the shape, so the tile stays symmetric.
 */
const INKS_PER_AVATAR = 3;

/** Hue in degrees. Only used to group the palette, so lightness and saturation are ignored. */
function hueOf(hex: string): number {
  const r = parseInt(hex.slice(1, 3), 16) / 255;
  const g = parseInt(hex.slice(3, 5), 16) / 255;
  const b = parseInt(hex.slice(5, 7), 16) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  if (max === min) return 0;
  const d = max - min;
  const h = max === r ? (g - b) / d + (g < b ? 6 : 0) : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return h * 60;
}

/**
 * Picking by a fixed stride kept landing on three blues, because the palette holds several
 * and is not ordered by hue. Grouping first and then taking one ink per group is what makes
 * a tile actually read as colourful rather than as one colour in three shades.
 */
const INK_FAMILIES: string[][] = (() => {
  const families = new Map<number, string[]>();
  for (const hex of BD_PAL) {
    const family = Math.floor(hueOf(hex) / 60);
    families.set(family, [...(families.get(family) ?? []), hex]);
  }
  return [...families.entries()].sort(([a], [b]) => a - b).map(([, hexes]) => hexes);
})();

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
  const backdrop = Math.floor(next() * BG_PAL.length);

  // One ink per hue family, walking the families from a seeded start so no two inks on a
  // tile are the same colour twice over.
  const familyStart = Math.floor(next() * INK_FAMILIES.length);
  const inks = Array.from({ length: Math.min(INKS_PER_AVATAR, INK_FAMILIES.length) }, (_, i) => {
    const family = INK_FAMILIES[(familyStart + i) % INK_FAMILIES.length];
    return family[Math.floor(next() * family.length)];
  });

  // Density varies per tile so some creatures are sparse and others solid, rather than every
  // one of them sitting at the same fill ratio.
  const density = 0.42 + next() * 0.28;

  const cells = Array<string | null>(AVATAR_GRID * AVATAR_GRID).fill(null);
  for (let row = 0; row < AVATAR_GRID; row++) {
    for (let col = 0; col < HALF_COLUMNS; col++) {
      if (next() >= density) continue;
      const ink = inks[Math.floor(next() * inks.length)];
      cells[row * AVATAR_GRID + col] = ink;
      cells[row * AVATAR_GRID + (AVATAR_GRID - 1 - col)] = ink;
    }
  }
  // A blank tile reads as a rendering bug, so guarantee at least the centre square.
  if (!cells.some(Boolean)) cells[Math.floor(cells.length / 2)] = inks[0];

  return { cells, fill: BG_PAL[backdrop] };
}

/**
 * Who a player is, as shown to other players: a painter's nickname derived from the account id.
 * It lives apart from `identity.ts` because the API imports it — `api/paths.test.ts` forbids
 * `@/` imports anywhere in a handler's import graph, and the avatar half of identity pulls the
 * palette, which a serverless function has no business bundling.
 *
 * The leaderboard sends artist *indexes* rather than names, so the epithet is translated on the
 * device that shows it and no account id ever leaves the server.
 */
import type { SupportedLanguage } from '../i18n/messages';

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

/** FNV-1a, 32-bit. The avatar seeds from the same hash, so both halves of an identity agree. */
function hashSeed(value: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < value.length; i++) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

export function seedOf(userId: string | null | undefined): number {
  return hashSeed(userId?.trim() || 'bumi');
}

/** Which painter an account is, as an index into `ARTISTS`. The API sends this. */
export function artistIndexFor(userId: string | null | undefined): number {
  return seedOf(userId) % ARTISTS.length;
}

export function playerName(userId: string | null | undefined, language: SupportedLanguage): string {
  const artist = ARTISTS[seedOf(userId) % ARTISTS.length];
  return `${artist.name} "${artist.epithet[language]}"`;
}

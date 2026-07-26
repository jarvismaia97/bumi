import type { Level } from './types';

// Clue placement can vary while leaving players with the exact same partition to draw.
// The catalogue therefore uses the solved rectangle layout, not the raw level object.
export function getSolutionFingerprint(level: Pick<Level, 'size' | 'solution'>): string {
  const rects = [...level.solution]
    .sort((a, b) => a.r1 - b.r1 || a.c1 - b.c1 || a.r2 - b.r2 || a.c2 - b.c2)
    .map(rect => `${rect.r1},${rect.c1},${rect.r2},${rect.c2}`)
    .join(';');
  return `${level.size}|${rects}`;
}

export function findRepeatedSolutionIndexes(levels: readonly Pick<Level, 'size' | 'solution'>[]): number[][] {
  const indexesByFingerprint = new Map<string, number[]>();

  levels.forEach((level, index) => {
    const fingerprint = getSolutionFingerprint(level);
    indexesByFingerprint.set(fingerprint, [...(indexesByFingerprint.get(fingerprint) ?? []), index]);
  });

  return [...indexesByFingerprint.values()].filter(indexes => indexes.length > 1);
}

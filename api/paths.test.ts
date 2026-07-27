import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

// Vercel's function builder compiles each API file on its own and does not read the
// `paths` map in tsconfig.json, so a `@/…` import anywhere in a handler's import graph
// builds fine and then throws MODULE_NOT_FOUND at request time — a 500 no local check
// catches, because Metro and vitest both resolve the alias happily.
const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const IMPORT = /(?:from|import)\s+['"](\.[^'"]*|@\/[^'"]*)['"]/g;

function sourceOf(modulePath: string): { file: string; text: string } | null {
  for (const candidate of [`${modulePath}.ts`, `${modulePath}.tsx`, join(modulePath, 'index.ts')]) {
    try {
      return { file: candidate, text: readFileSync(candidate, 'utf8') };
    } catch {
      // Try the next extension.
    }
  }
  return null;
}

/** Every file reachable from the API handlers, plus any aliased import found on the way. */
function walkFromHandlers(): { visited: string[]; aliased: string[] } {
  const apiDir = join(repoRoot, 'api');
  const queue = readdirSync(apiDir, { recursive: true, encoding: 'utf8' })
    .filter(name => name.endsWith('.ts') && !name.endsWith('.test.ts'))
    .map(name => join(apiDir, name).replace(/\.ts$/, ''));

  const visited = new Set<string>();
  const aliased: string[] = [];

  while (queue.length) {
    const modulePath = queue.pop()!;
    if (visited.has(modulePath)) continue;
    visited.add(modulePath);

    const source = sourceOf(modulePath);
    if (!source) continue;

    for (const [, specifier] of source.text.matchAll(IMPORT)) {
      if (specifier.startsWith('@/')) {
        aliased.push(`${source.file.replace(`${repoRoot}/`, '')} imports ${specifier}`);
        continue;
      }
      queue.push(resolve(dirname(source.file), specifier));
    }
  }

  return { visited: [...visited], aliased };
}

describe('api import graph', () => {
  it('reaches shared source outside api/, so the walk is actually proving something', () => {
    const { visited } = walkFromHandlers();
    expect(visited.some(path => path.includes('/src/game/challenge'))).toBe(true);
    expect(visited.some(path => path.includes('/src/i18n/messages'))).toBe(true);
  });

  it('never uses the @/ alias, which Vercel resolves at request time and fails', () => {
    expect(walkFromHandlers().aliased).toEqual([]);
  });
});

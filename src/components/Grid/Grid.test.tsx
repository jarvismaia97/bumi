import { render } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Level, PlacedRect } from '@/game/types';
import { BG_PAL, clueInkOn } from '@/theme/palette';
import { THEMES } from '@/theme/themes';
import { Grid } from './Grid';

// Reanimated is stubbed for every component test (see src/test/setup.ts); reduced motion is the
// branch these components own, so it gets a switch the tests can throw.
const { reducedMotion } = vi.hoisted(() => ({ reducedMotion: { on: false } }));
vi.mock('react-native-reanimated', async () => ({
  ...(await import('@/test/reanimated-stub')),
  useReducedMotion: () => reducedMotion.on,
}));

// Gesture Handler resolves to its untranspiled source under the react-native condition, which
// vitest cannot parse. The gestures are not what these assertions are about; the styles are.
vi.mock('react-native-gesture-handler', () => {
  const gesture: unknown = new Proxy({}, { get: () => () => gesture });
  return {
    GestureDetector: ({ children }: { children: React.ReactNode }) => children,
    Gesture: gesture,
  };
});

const LEVEL: Level = {
  size: 2,
  clues: [{ r: 0, c: 0, v: 2 }],
  solution: [{ r1: 0, c1: 0, r2: 1, c2: 2 }],
};
const PLACED: PlacedRect[] = [{ r1: 0, c1: 0, r2: 1, c2: 2, ci: 0 }];

/**
 * The absolutely-positioned *animated* overlays: the drag preview, the celebration border, the
 * glow. The placed rectangles are absolute too — they are drawn as whole shapes under the
 * squares rather than assembled from them — but they never move, so they are filtered out.
 */
function renderOverlays(celebrating: boolean) {
  const { container } = render(
    <Grid level={LEVEL} placed={PLACED} cellSize={40} celebrating={celebrating} onPlace={() => {}} onRemoveAt={() => {}} />,
  );
  return Array.from(container.querySelectorAll<HTMLElement>('div')).filter(
    node => getComputedStyle(node).position === 'absolute' && node.dataset.testid !== 'grid-piece',
  );
}

/** Nothing sets a theme in a component test, so the board paints in classic's light tokens. */
const TOKENS = THEMES.classic.light;

/** `getComputedStyle` answers in `rgb()`, so the tokens have to be read the same way. */
function rgb(hex: string): string {
  const [r, g, b] = [1, 3, 5].map(at => parseInt(hex.slice(at, at + 2), 16));
  return `rgb(${r}, ${g}, ${b})`;
}

/** The row views, in board order: everything in the grid that is not an absolute overlay. */
function rowsOf(container: HTMLElement): HTMLElement[] {
  const grid = container.firstElementChild?.firstElementChild as HTMLElement;
  return Array.from(grid.children).filter(
    (node): node is HTMLElement => getComputedStyle(node as HTMLElement).position !== 'absolute',
  );
}

afterEach(() => {
  reducedMotion.on = false;
});

describe('Grid under reduced motion', () => {
  it('drives its overlays off transforms by default', () => {
    const nodes = renderOverlays(true);

    expect(nodes.length).toBeGreaterThan(1);
    expect(nodes.map(node => getComputedStyle(node).transform)).not.toContain('none');
  });

  // Every one of those transforms is a scale, and a scale is the thing the setting is about.
  it('takes every transform off them', () => {
    reducedMotion.on = true;
    const nodes = renderOverlays(true);

    expect(nodes.length).toBeGreaterThan(1);
    expect(nodes.map(node => getComputedStyle(node).transform)).toEqual(nodes.map(() => 'none'));
  });

  // The preview rectangle is where the player's finger is. Losing its geometry would not be
  // reducing motion, it would be removing the only feedback the drag has.
  it('leaves the drag preview sized to the cells it covers', () => {
    reducedMotion.on = true;
    const [preview] = renderOverlays(false);

    const { width, height } = getComputedStyle(preview);
    expect(width).toBe('40px');
    expect(height).toBe('40px');
  });

  // The burst is nothing but movement, so unlike the rectangles and the glow it has no reduced
  // version — it goes entirely, and with it 44 mounted views. It used to disappear only because
  // Reanimated's default snapped `progress` to 1, where the opacity formula happens to be 0.
  it('unmounts the burst rather than animating it to nothing', () => {
    const { container, rerender } = render(
      <Grid level={LEVEL} placed={PLACED} cellSize={40} celebrating celebrationTier="gold" onPlace={() => {}} onRemoveAt={() => {}} />,
    );
    expect(container.querySelectorAll('[data-testid="burst-particle"]').length).toBeGreaterThan(0);

    reducedMotion.on = true;
    rerender(
      <Grid level={LEVEL} placed={PLACED} cellSize={40} celebrating celebrationTier="gold" onPlace={() => {}} onRemoveAt={() => {}} />,
    );
    expect(container.querySelectorAll('[data-testid="burst-particle"]')).toHaveLength(0);
  });
});

// A 3x3 with a clue in three different squares, one of them a 1 — which is a rectangle of a
// single square and so needs no number drawn on it.
const CLUE_LEVEL: Level = {
  size: 3,
  clues: [{ r: 0, c: 0, v: 3 }, { r: 1, c: 2, v: 1 }, { r: 2, c: 1, v: 6 }],
  solution: [{ r1: 0, c1: 0, r2: 3, c2: 1 }, { r1: 0, c1: 1, r2: 3, c2: 3 }],
};

describe('Grid clue lookup', () => {
  // The clues used to be found with a linear scan inside the square loop. Keyed by
  // `r * columns + c` the answer has to be identical, including the squares with no clue at all.
  it('draws every clue on its own square, and nothing on the rest', () => {
    const { container } = render(
      <Grid level={CLUE_LEVEL} placed={[]} cellSize={40} onPlace={() => {}} onRemoveAt={() => {}} />,
    );

    const board = rowsOf(container).map(row => Array.from(row.children).map(cell => cell.textContent));
    expect(board).toEqual([
      ['3', '', ''],
      ['', '', ''],
      ['', '6', ''],
    ]);
  });
});

describe('Grid rectangle colours', () => {
  const HELD: PlacedRect[] = [{ r1: 0, c1: 0, r2: 1, c2: 1, ci: 0 }];

  function pieceOf(placed: PlacedRect[]) {
    const { container } = render(
      <Grid level={LEVEL} placed={placed} cellSize={40} onPlace={() => {}} onRemoveAt={() => {}} />,
    );
    return { container, piece: container.querySelector<HTMLElement>('[data-testid="grid-piece"]')! };
  }

  // The wash was `rgba(113,140,195,0.12)` — classic's own light accent, hardcoded, so a held
  // rectangle stayed blue under the red theme and the amber one.
  it('washes a held rectangle in the live accent rather than a hardcoded blue', () => {
    const { piece } = pieceOf(HELD);

    const [r, g, b] = [1, 3, 5].map(at => parseInt(TOKENS.accent.slice(at, at + 2), 16));
    expect(getComputedStyle(piece).backgroundColor).toContain(`${r}, ${g}, ${b}`);
  });

  it('paints a solved rectangle in its own colour, not the wash', () => {
    const { piece } = pieceOf(PLACED);

    expect(getComputedStyle(piece).backgroundColor).toBe(rgb(BG_PAL[0]));
  });

  // A held rectangle is painted in the wash, which is the board tinted — so the clue on it sits
  // on the board and takes the board's ink. Measuring it against the fill that is *not* being
  // painted is what put near-black clues on the dark themes' held rectangles at 1.83-2.29:1.
  it('inks a clue for the colour actually under it, held or solved', () => {
    const held = rowsOf(pieceOf(HELD).container)[0].children[0] as HTMLElement;
    expect(getComputedStyle(held.firstElementChild as HTMLElement).color).toBe(rgb(TOKENS.text));

    const solved = rowsOf(pieceOf(PLACED).container)[0].children[0] as HTMLElement;
    expect(getComputedStyle(solved.firstElementChild as HTMLElement).color).toBe(rgb(clueInkOn(BG_PAL[0])));
  });

  // The drag preview's border is the affordance the whole interaction rests on, and at 44%
  // alpha it measured 1.58-2.73:1 against the board in all twenty-two theme/appearance pairs.
  it('draws the drag preview border in a solid accent', () => {
    const [preview] = renderOverlays(false);

    expect(getComputedStyle(preview).borderTopColor).toBe(rgb(TOKENS.accent));
  });
});

describe('Grid accessibility', () => {
  // A screen reader used to reach an unlabelled box and then walk 144 squares of it.
  it('answers as one labelled node instead of a wall of unlabelled squares', () => {
    const { container } = render(
      <Grid level={CLUE_LEVEL} placed={[]} cellSize={40} onPlace={() => {}} onRemoveAt={() => {}} />,
    );

    const board = container.firstElementChild as HTMLElement;
    expect(board.getAttribute('role')).toBe('img');
    expect(board.getAttribute('aria-label')).toContain('3');
  });
});

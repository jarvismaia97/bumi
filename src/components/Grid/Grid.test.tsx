import { render } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Level, PlacedRect } from '@/game/types';
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

/** The absolutely-positioned overlays: the drag preview, the celebration border, the glow. */
function renderOverlays(celebrating: boolean) {
  const { container } = render(
    <Grid level={LEVEL} placed={PLACED} cellSize={40} celebrating={celebrating} onPlace={() => {}} onRemoveAt={() => {}} />,
  );
  return Array.from(container.querySelectorAll<HTMLElement>('div')).filter(
    node => getComputedStyle(node).position === 'absolute',
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
});

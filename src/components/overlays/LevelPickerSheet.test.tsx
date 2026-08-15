import { act, render, screen, waitFor } from '@testing-library/react';
import { createRef, forwardRef } from 'react';
import { View } from 'react-native';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { DIFFS } from '@/game/difficulty';
import { ISLANDS } from '@/game/islands';
import { translate } from '@/i18n/messages';
import { useAppearanceStore } from '@/state/appearanceStore';
import { islandInkFor } from '@/theme/islands';
import { LevelPickerSheet, type LevelPickerSheetHandle } from './LevelPickerSheet';

// Every test here opens the sheet, and opening it mounts five hundred level buttons. That is
// comfortably inside the default five seconds on an idle machine and not when the rest of the
// suite is running beside it, which is the only reason this file needs its own ceiling.
vi.setConfig({ testTimeout: 30000 });

const t = (key: string, variables?: Record<string, number | string>) => translate('pt-PT', key, variables);

/** What jsdom answers with, so an expectation can be written as the token it came from. */
function rgb(hex: string): string {
  const at = (i: number) => parseInt(hex.slice(i, i + 2), 16);
  return `rgb(${at(1)}, ${at(3)}, ${at(5)})`;
}

// Reanimated is stubbed for every component test (see src/test/setup.ts); reduced motion is the
// branch the cascade owns, so it gets a switch the tests can throw. `withDelay` is spied because
// a delay the stub discards leaves no trace in the DOM, and the stagger is half of what the
// setting is meant to remove here.
const { reducedMotion, withDelay } = vi.hoisted(() => ({
  reducedMotion: { on: false },
  withDelay: vi.fn(<T,>(_delay: number, animation: T) => animation),
}));
vi.mock('react-native-reanimated', async () => ({
  ...(await import('@/test/reanimated-stub')),
  useReducedMotion: () => reducedMotion.on,
  withDelay,
}));

// The sheet chrome is native and is not what these tests are about; plain views render the cards.
vi.mock('@gorhom/bottom-sheet', () => ({
  BottomSheetModal: forwardRef<unknown, { children?: React.ReactNode }>(function BottomSheetModal({ children }, _ref) {
    return <View>{children}</View>;
  }),
  BottomSheetScrollView: View,
}));

/**
 * Presents the sheet, because the island cards deliberately do not mount until it does — they
 * are five hundred buttons deep and waiting for the open animation is the point.
 */
async function presentSheet(overrides: Partial<React.ComponentProps<typeof LevelPickerSheet>> = {}) {
  const ref = createRef<LevelPickerSheetHandle>();
  const { container } = render(
    <LevelPickerSheet
      ref={ref}
      curLvl={0}
      isSolved={() => false}
      getLevelMedal={() => undefined}
      solvedCount={0}
      onSelectLevel={() => {}}
      {...overrides}
    />,
  );

  act(() => ref.current?.present());

  // Waiting on a node count waits for the sheet chrome, which is up long before the cards are:
  // under suite load the assertions then ran against a half-built tree and this file failed
  // intermittently. The first island's name is the earliest proof a card actually mounted.
  await waitFor(() => expect(container.textContent).toContain(t(`island.${ISLANDS[0].id}.name`)));

  return container;
}

async function renderSheet() {
  const container = await presentSheet();
  return Array.from(container.querySelectorAll<HTMLElement>('*')).map(node => getComputedStyle(node).transform);
}

afterEach(() => {
  reducedMotion.on = false;
  withDelay.mockClear();
  useAppearanceStore.setState({ preference: 'auto' });
});

describe('LevelPickerSheet under reduced motion', () => {
  it('lifts the island cards into place by default', async () => {
    const transforms = await renderSheet();

    expect(transforms.some(transform => transform.includes('translate'))).toBe(true);
    expect(withDelay).toHaveBeenCalled();
  });

  // Thirteen cards arriving one after another is the shape the setting exists to stop, and the
  // stagger is the worse half of it: a wave down the list reads as motion even once each card
  // has stopped. What is left is a cross-fade, which puts nothing on screen in motion at all.
  it('cross-fades them in together with nothing moving', async () => {
    reducedMotion.on = true;
    const transforms = await renderSheet();

    expect(transforms.filter(transform => transform !== 'none')).toEqual([]);
    expect(withDelay).not.toHaveBeenCalled();
  });
});

describe('LevelPickerSheet island cards', () => {
  const first = ISLANDS[0];
  const ink = islandInkFor(first.id, 'light');

  // One presentation for all of it: the sheet mounts five hundred level buttons, so a test
  // that opens it again to check one more attribute costs more than the check is worth.
  it('reads against the light art it is painted on', async () => {
    const container = await presentSheet();

    // The card is light art in both appearances and every word on it was painted in the
    // island's identity hue, which was chosen to look like a place: 2.32 to 3.49:1 across the
    // thirteen. `ink` is that hue taken down far enough to be read.
    expect(getComputedStyle(screen.getByText(t(`island.${first.id}.name`))).color).toBe(rgb(ink.ink));

    // The grid label had `opacity: 0.75` on top of its colour, which composited correct ink
    // back down to under 3.5:1 — the fix and its undoing in the same stylesheet.
    const label = screen.getByText(`${DIFFS[0].size}×${DIFFS[0].size} · ${t(`difficulty.${DIFFS[0].label}`)}`);
    expect(getComputedStyle(label).opacity).toBe('1');
    expect(getComputedStyle(label).color).toBe(rgb(ink.ink));

    // A bar with a width and no value is a decoration to anything that cannot see it.
    const bars = Array.from(container.querySelectorAll('[role="progressbar"]'));
    expect(bars.length).toBe(1 + DIFFS.length);
    expect(bars.every(bar => bar.getAttribute('aria-valuemax') !== null)).toBe(true);
  });
});

describe('LevelPickerSheet after dark', () => {
  const first = ISLANDS[0];

  // The island art used to be light in both appearances, which put a 14.91-17.79:1 slab on the
  // sheet thirteen times down a scrolling list. It now has a night of its own, and the card is
  // the one thing that has to change for everything on it to follow.
  it('paints the island card in its dark art', async () => {
    useAppearanceStore.setState({ preference: 'dark' });
    await presentSheet();

    const dark = islandInkFor(first.id, 'dark');
    const name = screen.getByText(t(`island.${first.id}.name`));
    expect(getComputedStyle(name).color).toBe(rgb(dark.ink));
    // The card is somewhere above the name; which ancestor exactly is a layout detail, and
    // pinning it here would make this test fail for a reason it is not about.
    const grounds: string[] = [];
    for (let node = name.parentElement; node; node = node.parentElement) {
      grounds.push(getComputedStyle(node).backgroundColor);
    }
    expect(grounds).toContain(rgb(dark.bg));
  });
});

describe('LevelPickerSheet level buttons', () => {
  const ink = islandInkFor(ISLANDS[0].id, 'light');

  /** The three states differ in ring, ground and weight — never in a tint over the number. */
  it('tells resting, solved and current apart without dimming any of them', async () => {
    const container = await presentSheet({ curLvl: 1, isSolved: idx => idx === 0 });

    const buttons = Array.from(container.querySelectorAll<HTMLElement>('[role="button"]'))
      .filter(node => /^\d+$/.test(node.textContent ?? ''));
    const [solved, current, resting] = buttons;

    expect(solved.textContent).toBe('1');
    expect(current.textContent).toBe('2');
    expect(resting.textContent).toBe('3');

    // Solved keeps the resting slot and takes the island's ring; only the current level fills.
    expect(getComputedStyle(solved).backgroundColor).toBe(rgb(ink.well));
    expect(getComputedStyle(resting).backgroundColor).toBe(rgb(ink.well));
    expect(getComputedStyle(current).backgroundColor).toBe(rgb(ink.ink));

    expect(getComputedStyle(solved).borderTopColor).toBe(rgb(ink.color));
    expect(getComputedStyle(resting).borderTopColor).not.toBe(rgb(ink.color));
    expect(getComputedStyle(current).borderTopColor).toBe(rgb(ink.ink));

    // And the number is never painted on a tinted ground, which is what used to hold it at
    // 3.57-3.87:1 no matter which alpha the tint used.
    for (const [button, colour] of [[solved, ink.ink], [resting, ink.ink], [current, ink.onInk]] as const) {
      const label = button.querySelector('div');
      expect(getComputedStyle(label as HTMLElement).color).toBe(rgb(colour));
    }
  });
});

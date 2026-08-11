import { act, render, waitFor } from '@testing-library/react';
import { createRef, forwardRef } from 'react';
import { View } from 'react-native';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { LevelPickerSheet, type LevelPickerSheetHandle } from './LevelPickerSheet';

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
async function renderSheet() {
  const ref = createRef<LevelPickerSheetHandle>();
  const { container } = render(
    <LevelPickerSheet
      ref={ref}
      curLvl={0}
      isSolved={() => false}
      getLevelMedal={() => undefined}
      solvedCount={0}
      onSelectLevel={() => {}}
    />,
  );

  act(() => ref.current?.present());
  await waitFor(() => expect(container.querySelectorAll('*').length).toBeGreaterThan(50));

  return Array.from(container.querySelectorAll<HTMLElement>('*')).map(node => getComputedStyle(node).transform);
}

afterEach(() => {
  reducedMotion.on = false;
  withDelay.mockClear();
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

import { render } from '@testing-library/react';
import type { BottomSheetBackdropProps } from '@gorhom/bottom-sheet';
import { View } from 'react-native';
import { describe, expect, it, vi } from 'vitest';
import { renderSheetBackdrop, renderStaticSheetBackdrop } from './SheetBackdrop';

// The real backdrop drives a reanimated shared value the modal owns; these tests are about
// what the two exports hand it, so the component is stood in for and its props recorded.
const { backdropProps } = vi.hoisted(() => ({ backdropProps: vi.fn() }));
vi.mock('@gorhom/bottom-sheet', () => ({
  BottomSheetBackdrop: (props: Record<string, unknown>) => {
    backdropProps(props);
    return <View />;
  },
}));

/** Only `animatedIndex` and `style` are read by the stub; the modal supplies the rest. */
const modalProps = {} as BottomSheetBackdropProps;

function propsFrom(Backdrop: (props: BottomSheetBackdropProps) => React.ReactNode) {
  backdropProps.mockClear();
  render(<>{Backdrop(modalProps)}</>);
  return backdropProps.mock.lastCall?.[0] as Record<string, unknown>;
}

describe('SheetBackdrop', () => {
  // The two used to be separate components carrying their own copy of the opacity, which is
  // how one sheet's scrim ends up a shade off every other sheet's.
  it('dims both scrims by the same amount', () => {
    expect(propsFrom(renderSheetBackdrop).opacity).toBe(propsFrom(renderStaticSheetBackdrop).opacity);
  });

  it('closes on a tap outside, which is what a modal scrim is for', () => {
    expect(propsFrom(renderSheetBackdrop).pressBehavior).toBe('close');
  });

  // The win sheet is the level's only way forward, so its scrim dims without being a target.
  it('leaves the static scrim inert', () => {
    expect(propsFrom(renderStaticSheetBackdrop).pressBehavior).toBe('none');
  });

  it('fades in with the sheet and out with it', () => {
    const props = propsFrom(renderSheetBackdrop);
    expect(props.appearsOnIndex).toBe(0);
    expect(props.disappearsOnIndex).toBe(-1);
  });
});

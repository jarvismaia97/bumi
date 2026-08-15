import { BottomSheetBackdrop, type BottomSheetBackdropProps } from '@gorhom/bottom-sheet';
import type { ComponentProps } from 'react';

type PressBehavior = ComponentProps<typeof BottomSheetBackdrop>['pressBehavior'];

/**
 * One value for every sheet in the app. Written twice, the two scrims could be retuned apart
 * without anyone noticing until a win sheet sat visibly lighter than the settings sheet it
 * opened over.
 */
const SCRIM_OPACITY = 0.45;

/**
 * Every sheet used to open over the menu with nothing behind it, so the screen underneath kept
 * its full contrast and the sheet's top edge read as a cut through whatever it landed on — the
 * "Bumi" wordmark sliced in half being the obvious one. A scrim is what says "this is behind".
 *
 * Whether the scrim is also a dismiss target is the only thing the two exports disagree on.
 */
function sheetBackdrop(pressBehavior: PressBehavior) {
  return function renderBackdrop(props: BottomSheetBackdropProps) {
    return (
      <BottomSheetBackdrop
        {...props}
        appearsOnIndex={0}
        disappearsOnIndex={-1}
        opacity={SCRIM_OPACITY}
        pressBehavior={pressBehavior}
      />
    );
  };
}

/** Gives back the tap-outside-to-close that a modal is expected to have. */
export const renderSheetBackdrop = sheetBackdrop('close');

/**
 * The win sheet is the level's only way forward — the board behind it is locked — so its scrim
 * dims without being a dismiss target. Closing it by accident would strand the player on a
 * finished puzzle with nothing to press.
 */
export const renderStaticSheetBackdrop = sheetBackdrop('none');

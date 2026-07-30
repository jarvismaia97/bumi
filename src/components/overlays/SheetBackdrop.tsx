import { BottomSheetBackdrop, type BottomSheetBackdropProps } from '@gorhom/bottom-sheet';

/**
 * Every sheet used to open over the menu with nothing behind it, so the screen underneath kept
 * its full contrast and the sheet's top edge read as a cut through whatever it landed on — the
 * "Bumi" wordmark sliced in half being the obvious one. A scrim is what says "this is behind",
 * and it also gives back the tap-outside-to-close that a modal is expected to have.
 */
export function renderSheetBackdrop(props: BottomSheetBackdropProps) {
  return (
    <BottomSheetBackdrop
      {...props}
      appearsOnIndex={0}
      disappearsOnIndex={-1}
      opacity={0.45}
      pressBehavior="close"
    />
  );
}

/**
 * The win sheet is the level's only way forward — the board behind it is locked — so its scrim
 * dims without being a dismiss target. Closing it by accident would strand the player on a
 * finished puzzle with nothing to press.
 */
export function renderStaticSheetBackdrop(props: BottomSheetBackdropProps) {
  return (
    <BottomSheetBackdrop
      {...props}
      appearsOnIndex={0}
      disappearsOnIndex={-1}
      opacity={0.45}
      pressBehavior="none"
    />
  );
}

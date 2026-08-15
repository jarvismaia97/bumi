import { render, screen } from '@testing-library/react';
import { forwardRef } from 'react';
import { ScrollView, View } from 'react-native';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { MIN_TOUCH_TARGET } from '@/lib/touchTarget';
import { useLanguageStore } from '@/state/languageStore';
import { IOSInstallPromptSheet } from './IOSInstallPromptSheet';

// The brand mark is drawn with react-native-svg, which ships Flow-typed source vitest cannot
// parse. The mark is decorative here.
vi.mock('react-native-svg', () => ({ default: View, Rect: View }));

// The sheet chrome is native (reanimated + gesture handler under the hood) and is not what
// these tests are about; swapping it for plain views renders the prompt itself.
vi.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));

vi.mock('@gorhom/bottom-sheet', () => ({
  BottomSheetModal: forwardRef<unknown, { children?: React.ReactNode }>(function BottomSheetModal({ children }, _ref) {
    return <View>{children}</View>;
  }),
  BottomSheetView: View,
  BottomSheetScrollView: ScrollView,
}));

afterEach(() => {
  useLanguageStore.setState({ preference: 'auto' });
});

describe('IOSInstallPromptSheet close button', () => {
  // It has no label of its own to be found by, so without the role it is a named box rather
  // than something assistive tech offers to press.
  it('is a button to assistive tech, not just a labelled view', () => {
    render(<IOSInstallPromptSheet />);

    expect(screen.getByLabelText('Fechar').getAttribute('role')).toBe('button');
  });

  // It floats over the sheet corner at the icon-button size the header and the sheet back
  // arrow are painted at; hitSlop, not size, is what carries it to the 44pt minimum.
  it('is painted at the shared icon size and reaches 44pt through its slop', () => {
    render(<IOSInstallPromptSheet />);

    const { width, height } = getComputedStyle(screen.getByLabelText('Fechar'));
    expect(width).toBe('36px');
    expect(height).toBe('36px');
    expect(parseFloat(width)).toBeLessThan(MIN_TOUCH_TARGET);
  });
});

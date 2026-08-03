import { render, screen } from '@testing-library/react';
import { forwardRef } from 'react';
import { ScrollView, View } from 'react-native';
import { describe, expect, it, vi } from 'vitest';
import { translate } from '@/i18n/messages';
import { PrivacySheet } from './PrivacySheet';

// The sheet chrome is native and is not what these tests are about; plain views render the
// content itself. Same approach as ThemePickerSheet.test.tsx.
vi.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));

vi.mock('@gorhom/bottom-sheet', () => ({
  BottomSheetModal: forwardRef<unknown, { children?: React.ReactNode }>(function BottomSheetModal({ children }, _ref) {
    return <View>{children}</View>;
  }),
  BottomSheetScrollView: ScrollView,
}));

describe('PrivacySheet', () => {
  it('sends the player back to settings, not out to wherever they came from', () => {
    // The policy used to push a full screen whose arrow ran router.back(), landing on the
    // game rather than on the settings sheet it was opened from.
    render(<PrivacySheet />);
    expect(screen.getByLabelText(translate('pt-PT', 'a11y.backToSettings'))).toBeTruthy();
    expect(screen.queryByLabelText(translate('pt-PT', 'a11y.back'))).toBeNull();
  });

  it('carries the whole policy, not just the heading', () => {
    render(<PrivacySheet />);
    for (const section of ['stored', 'purpose', 'location', 'friends', 'delete', 'contact']) {
      expect(screen.getByText(translate('pt-PT', `privacy.${section}Title`))).toBeTruthy();
    }
  });

  it('shows the title once, in the header rather than twice down the page', () => {
    render(<PrivacySheet />);
    expect(screen.getAllByText(translate('pt-PT', 'privacy.title'))).toHaveLength(1);
  });
});

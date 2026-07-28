import { fireEvent, render, screen } from '@testing-library/react';
import { forwardRef } from 'react';
import { View } from 'react-native';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { playHaptic } from '@/lib/haptics';
import { translate } from '@/i18n/messages';
import { useLanguageStore } from '@/state/languageStore';
import { LanguageSheet } from './LanguageSheet';

vi.mock('@/lib/haptics', () => ({ playHaptic: vi.fn() }));
vi.mock('@gorhom/bottom-sheet', () => ({
  BottomSheetModal: forwardRef<unknown, { children?: React.ReactNode }>(function BottomSheetModal({ children }, _ref) {
    return <View>{children}</View>;
  }),
  BottomSheetView: View,
}));

afterEach(() => {
  useLanguageStore.setState({ preference: 'auto' });
  vi.mocked(playHaptic).mockClear();
});

describe('LanguageSheet', () => {
  it('returns to settings rather than to wherever the player came from', () => {
    render(<LanguageSheet />);
    expect(screen.getByLabelText(translate('pt-PT', 'a11y.backToSettings'))).toBeTruthy();
  });

  it('offers each language in its own name, so a player in the wrong one can find theirs', () => {
    render(<LanguageSheet />);
    expect(screen.getByText('Português')).toBeTruthy();
    expect(screen.getByText('English')).toBeTruthy();
  });

  it('explains what automatic follows', () => {
    render(<LanguageSheet />);
    expect(screen.getByText(translate('pt-PT', 'settings.languageAutoDetail'))).toBeTruthy();
  });

  it('commits the choice and answers it with selection feedback', () => {
    render(<LanguageSheet />);

    fireEvent.click(screen.getByText('English'));

    expect(useLanguageStore.getState().preference).toBe('en');
    expect(playHaptic).toHaveBeenCalledExactlyOnceWith('selection');
  });
});

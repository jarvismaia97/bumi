import { fireEvent, render, screen } from '@testing-library/react';
import { forwardRef } from 'react';
import { View } from 'react-native';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { playHaptic } from '@/lib/haptics';
import { useLanguageStore } from '@/state/languageStore';
import { THEME_OPTIONS } from '@/theme/themes';
import { ThemePickerSheet } from './ThemePickerSheet';

// The module guards itself off on anything but a device, so under jsdom it is stubbed to
// record intent. Which style each word maps to is pinned in src/lib/haptics.test.ts.
vi.mock('@/lib/haptics', () => ({ playHaptic: vi.fn() }));

// The sheet chrome is native (reanimated + gesture handler under the hood) and is not what
// these tests are about; swapping it for plain views renders the rows themselves.
vi.mock('@gorhom/bottom-sheet', () => ({
  BottomSheetModal: forwardRef<unknown, { children?: React.ReactNode }>(function BottomSheetModal({ children }, _ref) {
    return <View>{children}</View>;
  }),
  BottomSheetView: View,
}));

/** Every rendered box that carries copy — the ones Dynamic Type can overflow. */
function textBoxes(container: HTMLElement): HTMLElement[] {
  return (Array.from(container.querySelectorAll('*')) as HTMLElement[])
    .filter(node => (node.textContent ?? '').trim().length > 0);
}

function label(node: HTMLElement) {
  return `<${node.tagName.toLowerCase()}> ${(node.textContent ?? '').trim().slice(0, 24)}`;
}

afterEach(() => {
  useLanguageStore.setState({ preference: 'auto' });
  vi.mocked(playHaptic).mockClear();
});

describe('ThemePickerSheet haptics', () => {
  it('answers a theme pick with selection feedback', () => {
    render(<ThemePickerSheet onBack={() => {}} />);

    fireEvent.click(screen.getByLabelText('Usar tema Clássico'));

    expect(playHaptic).toHaveBeenCalledExactlyOnceWith('selection');
  });

  // Going back changes nothing; the sheet sliding away is already the answer. Buzzing here
  // is how an interface starts feeling cheap.
  it('leaves the back button silent', () => {
    render(<ThemePickerSheet onBack={() => {}} />);

    fireEvent.click(screen.getByLabelText('Voltar a definições'));

    expect(playHaptic).not.toHaveBeenCalled();
  });
});

describe('ThemePickerSheet', () => {
  it('offers one row per theme', () => {
    render(<ThemePickerSheet onBack={() => {}} />);
    // One button per theme plus the back button.
    expect(screen.getAllByRole('button')).toHaveLength(THEME_OPTIONS.length + 1);
  });

  // The rows are sized for the resting text size. Pinning their height instead of their
  // minimum is what clips a label once the system font size grows.
  it('never pins the height of a box that holds text', () => {
    const { container } = render(<ThemePickerSheet onBack={() => {}} />);
    const pinned = textBoxes(container).filter(node => {
      const height = getComputedStyle(node).height;
      return height !== '' && height !== 'auto';
    });
    expect(pinned.map(label)).toEqual([]);
  });

  it('keeps the 48pt touch target as a minimum the row can grow past', () => {
    render(<ThemePickerSheet onBack={() => {}} />);
    const row = screen.getByLabelText('Usar tema Clássico');
    const { minHeight, paddingTop, paddingBottom } = getComputedStyle(row);
    expect(minHeight).toBe('48px');
    // Padding, not centring inside a fixed box, is what keeps a wrapped label off the border.
    expect(parseFloat(paddingTop)).toBeGreaterThan(0);
    expect(parseFloat(paddingBottom)).toBeGreaterThan(0);
  });

  it('lets every theme name wrap instead of truncating it', () => {
    const { container } = render(<ThemePickerSheet onBack={() => {}} />);
    // react-native-web turns numberOfLines into an ellipsis, on one line or clamped to many.
    const truncated = textBoxes(container).filter(node => getComputedStyle(node).textOverflow === 'ellipsis');
    expect(truncated.map(label)).toEqual([]);
  });
});

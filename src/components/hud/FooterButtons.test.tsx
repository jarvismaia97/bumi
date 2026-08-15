import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useLanguageStore } from '@/state/languageStore';
import { useThemeStore } from '@/state/themeStore';
import { THEMES } from '@/theme/themes';
import { FooterButtons } from './FooterButtons';

const props = {
  hintLabel: 'Dica · 3',
  hintDisabled: false,
  onUndo: () => {},
  onClear: () => {},
  onHint: () => {},
};

afterEach(() => {
  useLanguageStore.setState({ preference: 'auto' });
  useThemeStore.setState({ themeName: 'classic' });
});

/** `rgb(r, g, b)`, which is what jsdom hands back for any hex it was given. */
function rgb(hex: string) {
  const [r, g, b] = [1, 3, 5].map(offset => parseInt(hex.slice(offset, offset + 2), 16));
  return `rgb(${r}, ${g}, ${b})`;
}

describe('FooterButtons', () => {
  it('exposes all three actions as buttons to assistive tech', () => {
    render(<FooterButtons {...props} />);
    expect(screen.getAllByRole('button')).toHaveLength(3);
  });

  it('translates the fixed labels and passes the hint label straight through', () => {
    useLanguageStore.setState({ preference: 'en' });
    render(<FooterButtons {...props} hintLabel="Hint · 3" />);
    expect(screen.getByText('Undo')).toBeTruthy();
    expect(screen.getByText('Clear')).toBeTruthy();
    expect(screen.getByText('Hint · 3')).toBeTruthy();
  });

  it('announces the hint button as disabled, not just dimmed', () => {
    render(<FooterButtons {...props} hintDisabled />);
    const hint = screen.getByText('Dica · 3').closest('[role="button"]');
    expect(hint?.getAttribute('aria-disabled')).toBe('true');
  });

  it('does not fire the hint callback while disabled', () => {
    const onHint = vi.fn();
    render(<FooterButtons {...props} hintDisabled onHint={onHint} />);
    fireEvent.click(screen.getByText('Dica · 3'));
    expect(onHint).not.toHaveBeenCalled();
  });

  // A third of the screen each, so at the accessibility text sizes the labels have to wrap
  // down rather than be cut to "Desfa…".
  it('wraps the button labels instead of truncating them', () => {
    render(<FooterButtons {...props} />);
    for (const text of ['Desfazer', 'Limpar', 'Dica · 3']) {
      // react-native-web renders numberOfLines as an ellipsis, on one line or clamped to many.
      expect(getComputedStyle(screen.getByText(text)).textOverflow).not.toBe('ellipsis');
    }
  });

  // The buttons used to be painted from a `theme` prop typed to the three fields they happened
  // to read, so they could not see a token the rest of the app had. They read the store now,
  // and a theme change has to reach them without the parent passing anything down.
  it('paints itself from the theme in force, not from what its parent hands it', () => {
    useThemeStore.setState({ themeName: 'mint' });
    render(<FooterButtons {...props} />);

    const button = screen.getByText('Desfazer').closest('[role="button"]') as HTMLElement;
    expect(getComputedStyle(button).backgroundColor).toBe(rgb(THEMES.mint.light.surface));
  });

  it('fires undo and clear when tapped', () => {
    const onUndo = vi.fn();
    const onClear = vi.fn();
    render(<FooterButtons {...props} onUndo={onUndo} onClear={onClear} />);
    fireEvent.click(screen.getByText('Desfazer'));
    fireEvent.click(screen.getByText('Limpar'));
    expect(onUndo).toHaveBeenCalledTimes(1);
    expect(onClear).toHaveBeenCalledTimes(1);
  });
});

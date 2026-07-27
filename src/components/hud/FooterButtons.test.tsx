import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useLanguageStore } from '@/state/languageStore';
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
});

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

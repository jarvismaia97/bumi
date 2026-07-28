import { render, screen } from '@testing-library/react';
import { View } from 'react-native';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useLanguageStore } from '@/state/languageStore';
import { MIN_TOUCH_TARGET } from '@/lib/touchTarget';
import { ACTION_GAP, Header, ICON_BUTTON_HIT_SLOP } from './Header';

// The brand mark is drawn with react-native-svg, which ships Flow-typed source vitest cannot
// parse. Nothing here is about the mark.
vi.mock('react-native-svg', () => ({ default: View, Rect: View }));

const props = {
  mode: 'campaign' as const,
  levelLabel: 'Nível 12',
  diffLabel: 'Fácil',
  onMenu: () => {},
  onLevels: () => {},
  onShare: () => {},
};

afterEach(() => {
  useLanguageStore.setState({ preference: 'auto' });
});

describe('Header', () => {
  it('keeps the icon buttons painted small', () => {
    render(<Header {...props} />);
    // The 36pt square beside the 22pt wordmark is a proportion. Growing the box to reach the
    // 44pt minimum would coarsen the chrome, which is what the slop exists to avoid.
    const { width, height } = getComputedStyle(screen.getByLabelText('Abrir mapa de níveis'));
    expect(width).toBe('36px');
    expect(height).toBe('36px');
  });

  it('carries those buttons to the 44pt minimum with slop instead', () => {
    expect(36 + ICON_BUTTON_HIT_SLOP.left + ICON_BUTTON_HIT_SLOP.right).toBeGreaterThanOrEqual(MIN_TOUCH_TARGET);
    expect(36 + ICON_BUTTON_HIT_SLOP.top + ICON_BUTTON_HIT_SLOP.bottom).toBeGreaterThanOrEqual(MIN_TOUCH_TARGET);
  });

  // The map and share slops meet in the gap between them. If the gap is ever tightened back
  // to 6 the two touch targets overlap by 2pt and the tap between them becomes ambiguous.
  it('spaces the two actions so their slops cannot overlap', () => {
    render(<Header {...props} />);
    const row = screen.getByLabelText('Abrir mapa de níveis').parentElement;
    const gap = parseFloat(getComputedStyle(row as HTMLElement).gap);
    expect(gap).toBe(ACTION_GAP);
    expect(gap).toBeGreaterThanOrEqual(ICON_BUTTON_HIT_SLOP.right + ICON_BUTTON_HIT_SLOP.left);
  });
});

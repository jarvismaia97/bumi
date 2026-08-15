import { render, screen } from '@testing-library/react';
import { forwardRef } from 'react';
import { ScrollView, View } from 'react-native';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { getAchievements } from '@/game/achievements';
import { useLanguageStore } from '@/state/languageStore';
import { useProgressStore } from '@/state/progressStore';
import { AchievementsSheet } from './AchievementsSheet';
import { HEADER_SLOT_WIDTH } from './SettingsChildSheet';

// The sheet chrome is native (reanimated + gesture handler under the hood) and is not what
// these tests are about; swapping it for plain views renders the cards themselves.
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

function achievementCount() {
  const { solvedMap, solvedDateMap, levelMedals, dailyStreak } = useProgressStore.getState();
  return getAchievements({ solvedMap, solvedDateMap, levelMedals, dailyStreak: dailyStreak() }).length;
}

beforeEach(() => {
  // Two of the first island's six levels, which puts the campaign bars part-way rather than
  // at either end — an empty bar and a full one both hide an off-by-one in the value.
  useProgressStore.setState({ solvedMap: { 0: true, 1: true }, solvedDateMap: {}, levelMedals: {} });
});

afterEach(() => {
  useLanguageStore.setState({ preference: 'auto' });
  useProgressStore.setState({ solvedMap: {}, solvedDateMap: {}, levelMedals: {} });
});

describe('AchievementsSheet progress bars', () => {
  // The bar was a plain view, so a screen reader met an unlabelled box between the description
  // and the next card and had nothing to say about it.
  it('exposes every bar as a progressbar rather than decoration', () => {
    render(<AchievementsSheet />);

    expect(screen.getAllByRole('progressbar')).toHaveLength(achievementCount());
  });

  it('carries the same count the label beside it spells out', () => {
    render(<AchievementsSheet />);

    // `campaign-10` is two of ten with the first two levels solved.
    const bar = screen.getAllByRole('progressbar')[1];
    expect(bar.getAttribute('aria-valuemin')).toBe('0');
    expect(bar.getAttribute('aria-valuemax')).toBe('10');
    expect(bar.getAttribute('aria-valuenow')).toBe('2');
  });

  // The label clamps at the target once an achievement is beaten, and the value has to clamp
  // with it or assistive tech reads a progress above its own maximum.
  it('clamps a beaten achievement to its target instead of running past it', () => {
    render(<AchievementsSheet />);

    const firstStep = screen.getAllByRole('progressbar')[0];
    expect(firstStep.getAttribute('aria-valuemax')).toBe('1');
    expect(firstStep.getAttribute('aria-valuenow')).toBe('1');
  });
});

describe('AchievementsSheet header', () => {
  // The count badge fills the slot the shell leaves empty on every other child sheet. It used
  // to floor at a 54 of its own, a number that agreed with the shell's 36 only by not being
  // checked; now the two read from one constant and the badge grows on its content.
  it('floors the count badge at the shell slot width rather than a number of its own', () => {
    render(<AchievementsSheet />);

    // Last child of the header row, which is where the shell paints its spacer otherwise.
    const header = screen.getByLabelText('Voltar a definições').parentElement as HTMLElement;
    expect(getComputedStyle(header.lastElementChild as HTMLElement).minWidth).toBe(`${HEADER_SLOT_WIDTH}px`);
  });

  it('leaves the back button and the slot facing it the same width', () => {
    render(<AchievementsSheet />);

    expect(getComputedStyle(screen.getByLabelText('Voltar a definições')).minWidth).toBe(`${HEADER_SLOT_WIDTH}px`);
  });
});

describe('AchievementsSheet section headings', () => {
  // The category names are sentence case in every translation while the settings sheet's own
  // headings are shouted by their strings. Two sheets one tap apart, reading differently.
  it('uppercases the category headings the way every other sheet does', () => {
    render(<AchievementsSheet />);

    const heading = screen.getByText('Campanha');
    expect(getComputedStyle(heading).textTransform).toBe('uppercase');
    // Visual only: the word a screen reader reads is still the one the catalogue holds.
    expect(heading.textContent).toBe('Campanha');
  });
});

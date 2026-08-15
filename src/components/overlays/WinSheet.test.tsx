import { render, screen } from '@testing-library/react';
import { forwardRef } from 'react';
import { View } from 'react-native';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { translate } from '@/i18n/messages';
import { useAppearanceStore } from '@/state/appearanceStore';
import { THEMES } from '@/theme/themes';
import { WinSheet } from './WinSheet';

vi.mock('react-native-svg', () => ({ default: View, Rect: View, Path: View }));

// The sheet chrome is native and is not what these tests are about; a plain view renders the
// contents. Same approach as PrivacySheet.test.tsx.
vi.mock('@gorhom/bottom-sheet', () => ({
  BottomSheetModal: forwardRef<unknown, { children?: React.ReactNode }>(function BottomSheetModal({ children }, _ref) {
    return <View>{children}</View>;
  }),
  BottomSheetView: View,
}));

const t = (key: string, variables?: Record<string, number | string>) => translate('pt-PT', key, variables);

function renderSheet(overrides: Partial<React.ComponentProps<typeof WinSheet>> = {}) {
  return render(
    <WinSheet
      title={t('win.title')}
      subtitle={t('win.levelSubtitle', { level: 4, difficulty: t('difficulty.easy') })}
      showHintReward={false}
      isDaily={false}
      campaignMedal="gold"
      campaignPoints={5}
      campaignSummary="42s · 0 dicas · 0 tentativas inválidas"
      dailyStreak={0}
      nextLabel={t('win.nextLevel')}
      onReview={() => {}}
      onNext={() => {}}
      {...overrides}
    />,
  );
}

/** What jsdom answers with, so an expectation can be written as the token it came from. */
function rgb(hex: string): string {
  const at = (i: number) => parseInt(hex.slice(i, i + 2), 16);
  return `rgb(${at(1)}, ${at(3)}, ${at(5)})`;
}

afterEach(() => {
  useAppearanceStore.setState({ preference: 'auto' });
});

describe('WinSheet', () => {
  it('says what the medal added to the board', () => {
    renderSheet();

    expect(screen.getByText(t('win.medal', { medal: t('medal.gold') }))).toBeTruthy();
    expect(screen.getByText(t('win.points', { count: 5 }))).toBeTruthy();
  });

  it('pays the difference when a medal was improved, not the full medal', () => {
    renderSheet({ campaignPoints: 2 });

    expect(screen.getByText(t('win.points', { count: 2 }))).toBeTruthy();
  });

  it('claims nothing on a replay that improved nothing', () => {
    // The level keeps its best medal, so this result changed no points at all.
    renderSheet({ campaignPoints: 0 });

    expect(screen.queryByText(/pontos/)).toBeNull();
  });

  // The label on the filled accent was hardcoded white, which on a dark theme's accent is as
  // low as 1.96:1 — and this is the button that starts the next level.
  it('reads the next action against the fill it sits on', () => {
    useAppearanceStore.setState({ preference: 'dark' });
    renderSheet();

    expect(getComputedStyle(screen.getByText(t('win.nextLevel'))).color).toBe(rgb(THEMES.classic.dark.onAccent));
  });

  it('leaves the points out of a daily result, which is not scored by medal', () => {
    renderSheet({ isDaily: true, campaignMedal: undefined, campaignPoints: undefined, dailySummary: '42s' });

    expect(screen.queryByText(/pontos/)).toBeNull();
  });
});

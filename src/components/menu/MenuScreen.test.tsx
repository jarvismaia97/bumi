import { cleanup, render, screen } from '@testing-library/react';
import { forwardRef } from 'react';
import { ScrollView, View } from 'react-native';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { translate } from '@/i18n/messages';
import { MONTHLY_TARGET, WEEKLY_TARGET, type GoalProgress } from '@/game/goals';
import { getIslandJourney } from '@/game/islands';
import { useAppearanceStore } from '@/state/appearanceStore';
import { useProgressStore } from '@/state/progressStore';
import { THEMES } from '@/theme/themes';
import { MenuScreen } from './MenuScreen';

// The account pill reads the auth store, which reaches expo-secure-store through the auth
// client — native source vitest cannot parse. Signed out is the state these tests want.
vi.mock('@/lib/auth-client', () => ({
  authClient: {
    getSession: vi.fn().mockResolvedValue({ data: null, error: null }),
    signOut: vi.fn().mockResolvedValue({ error: null }),
    deleteUser: vi.fn().mockResolvedValue({ error: null }),
    signIn: { social: vi.fn().mockResolvedValue({ error: null }) },
  },
}));

vi.mock('@/lib/haptics', () => ({ playHaptic: vi.fn() }));

// The Google mark and the brand mark are drawn with react-native-svg, which ships Flow-typed
// source vitest cannot parse. Same stub as Header.test.tsx.
vi.mock('react-native-svg', () => ({ default: View, Rect: View, Path: View }));

// The sheet chrome is native and none of it is what these tests are about; the menu mounts
// six sheets purely to hold their refs. Same approach as PrivacySheet.test.tsx.
vi.mock('@gorhom/bottom-sheet', () => ({
  BottomSheetModal: forwardRef<unknown, { children?: React.ReactNode }>(function BottomSheetModal({ children }, _ref) {
    return <View>{children}</View>;
  }),
  BottomSheetView: View,
  BottomSheetScrollView: ScrollView,
}));

vi.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));

const t = (key: string, variables?: Record<string, number | string>) => translate('pt-PT', key, variables);

function goal(done: number, target: number): GoalProgress {
  return { done, target, complete: done >= target, daysLeft: 3 };
}

function renderMenu(overrides: Partial<React.ComponentProps<typeof MenuScreen>> = {}) {
  return render(
    <MenuScreen
      dailyDone={false}
      dailyStreak={0}
      freezeHeld={false}
      weekly={goal(1, WEEKLY_TARGET)}
      monthly={goal(4, MONTHLY_TARGET)}
      solvedCount={12}
      goldMedalCount={3}
      completedIslandCount={2}
      islandTotal={13}
      journey={getIslandJourney({}, 12)}
      onOpenMap={() => {}}
      campaignLevel={13}
      campaignTotal={500}
      campaignComplete={false}
      onStartGame={() => {}}
      onStartDaily={() => {}}
      onStartTraining={() => {}}
      onStartDailyFor={() => {}}
      {...overrides}
    />,
  );
}

/** What jsdom answers with, so an expectation can be written as the token it came from. */
function rgb(hex: string): string {
  const at = (i: number) => parseInt(hex.slice(i, i + 2), 16);
  return `rgb(${at(1)}, ${at(3)}, ${at(5)})`;
}

describe('MenuScreen', () => {
  beforeEach(() => {
    useProgressStore.setState({ dailyCompletionDates: [] });
    useAppearanceStore.setState({ preference: 'auto' });
  });

  it('states both goals with their counts and their rewards', () => {
    renderMenu();

    expect(screen.getByText(t('menu.weeklyGoal'))).toBeTruthy();
    expect(screen.getByText(t('menu.monthlyGoal'))).toBeTruthy();
    expect(screen.getByText(`1 / ${WEEKLY_TARGET}`)).toBeTruthy();
    expect(screen.getByText(`4 / ${MONTHLY_TARGET}`)).toBeTruthy();
    // The reward is what makes the goal worth chasing, so it shows before it is earned.
    expect(screen.getByText(t('menu.goalReward', { count: 1, label: t('menu.hintOne') }))).toBeTruthy();
    expect(screen.getByText(t('menu.goalReward', { count: 3, label: t('menu.hintMany') }))).toBeTruthy();
  });

  it('drops the reward once a goal is met, the count being what says so', () => {
    renderMenu({ weekly: goal(WEEKLY_TARGET, WEEKLY_TARGET) });

    // There is no line under the bar announcing it any more: `3 / 3`, a full bar and the border
    // taking the accent colour are three ways of saying the same thing, and the reward leaving
    // is the fourth.
    expect(screen.getByText(`${WEEKLY_TARGET} / ${WEEKLY_TARGET}`)).toBeTruthy();
    expect(screen.queryByText(t('menu.goalReward', { count: 1, label: t('menu.hintOne') }))).toBeNull();
  });

  it('never counts past the target when the player overshoots', () => {
    renderMenu({ weekly: goal(WEEKLY_TARGET + 2, WEEKLY_TARGET) });

    expect(screen.getByText(`${WEEKLY_TARGET} / ${WEEKLY_TARGET}`)).toBeTruthy();
  });

  it('offers to continue the campaign, start it, or replay it', () => {
    renderMenu();
    expect(screen.getByText(t('menu.continueLevel', { level: 13 }))).toBeTruthy();

    cleanup();
    renderMenu({ solvedCount: 0, campaignLevel: 1 });
    expect(screen.getByText(t('menu.startCampaign'))).toBeTruthy();

    cleanup();
    renderMenu({ campaignComplete: true });
    expect(screen.getByText(t('menu.playAgain'))).toBeTruthy();
  });

  it('invites a first streak, then reports the one the player has', () => {
    renderMenu();
    expect(screen.getByText(t('menu.startStreak'))).toBeTruthy();

    cleanup();
    renderMenu({ dailyDone: true, dailyStreak: 1 });
    expect(screen.getByText(t('menu.dailyDone'))).toBeTruthy();
    expect(screen.getByText(t('menu.streak', { count: 1, label: t('menu.day') }))).toBeTruthy();
  });

  it('shows a new player none of the counters, because none has counted anything', () => {
    renderMenu({
      solvedCount: 0,
      goldMedalCount: 0,
      completedIslandCount: 0,
      dailyStreak: 0,
      weekly: goal(0, WEEKLY_TARGET),
      monthly: goal(0, MONTHLY_TARGET),
    });

    expect(screen.queryByText(t('menu.solved'))).toBeNull();
    expect(screen.queryByText(t('menu.gold'))).toBeNull();
    expect(screen.queryByText(t('menu.weeklyGoal'))).toBeNull();
    expect(screen.queryByText(t('menu.islands', { completed: 0, total: 13 }))).toBeNull();
    // What is left is the invitation to play, which is the whole point of the screen.
    expect(screen.getByText(t('menu.startCampaign'))).toBeTruthy();
  });

  it('brings each counter back as soon as it has something to say', () => {
    renderMenu({ goldMedalCount: 0, completedIslandCount: 0, weekly: goal(1, WEEKLY_TARGET) });

    expect(screen.getByText(t('menu.solved'))).toBeTruthy();
    expect(screen.queryByText(t('menu.gold'))).toBeNull();
    expect(screen.getByText(t('menu.weeklyGoal'))).toBeTruthy();
    expect(screen.queryByText(t('menu.islands', { completed: 0, total: 13 }))).toBeNull();
  });

  it('reports island progress out of the total, not as a bare number', () => {
    renderMenu();

    expect(screen.getByText(t('menu.islands', { completed: 2, total: 13 }))).toBeTruthy();
  });

  // Every line on the campaign button used to be white, two of them at 0.72 and 0.75 alpha,
  // which on a dark theme's accent measured under 2:1. There is one foreground for an accent
  // fill and all three lines take it, undimmed.
  it('paints the whole campaign button in the foreground the accent owns', () => {
    useAppearanceStore.setState({ preference: 'dark' });
    renderMenu();

    const onAccent = rgb(THEMES.classic.dark.onAccent);
    for (const label of [
      t('menu.continueLevel', { level: 13 }),
      t('menu.levelsExplore', { count: 488 }),
    ]) {
      expect(getComputedStyle(screen.getByText(label)).color, label).toBe(onAccent);
    }
  });

  // The island bar carries a percentage that appears nowhere else on the screen, so without a
  // role and a value a reader is told nothing about it at all.
  it('gives every bar a value a reader can hear', () => {
    const { container } = renderMenu();

    const bars = Array.from(container.querySelectorAll('[role="progressbar"]'));
    // Levels solved, gold medals and both goals, at least — the menu also mounts every sheet
    // it can open, and their bars land in the same tree.
    expect(bars.length).toBeGreaterThanOrEqual(4);
    expect(bars.every(bar => bar.getAttribute('aria-valuenow') !== null)).toBe(true);

    // And the one that matters most, which says how far into the current island the player is
    // and is the only place on the screen that says it.
    const campaignButton = screen.getByText(t('menu.continueLevel', { level: 13 })).closest('[role="button"]');
    expect(campaignButton?.querySelector('[role="progressbar"]')).toBeTruthy();
  });

  // A 20pt row is the height of its own text. It opens the map, so it is a control, and the
  // row is already full width — the height was free to take.
  it('gives the island row a full touch target', () => {
    renderMenu();

    const row = screen.getByText(t('menu.islands', { completed: 2, total: 13 })).parentElement;
    expect(getComputedStyle(row as HTMLElement).minHeight).toBe('44px');
  });
});

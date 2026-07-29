import { cleanup, render, screen } from '@testing-library/react';
import { forwardRef } from 'react';
import { ScrollView, View } from 'react-native';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { translate } from '@/i18n/messages';
import { MONTHLY_TARGET, WEEKLY_TARGET, type GoalProgress } from '@/game/goals';
import { useProgressStore } from '@/state/progressStore';
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
      weekly={goal(1, WEEKLY_TARGET)}
      monthly={goal(4, MONTHLY_TARGET)}
      solvedCount={12}
      goldMedalCount={3}
      completedIslandCount={2}
      islandTotal={13}
      campaignLevel={13}
      campaignTotal={500}
      campaignComplete={false}
      onStartGame={() => {}}
      onStartDaily={() => {}}
      onStartDailyFor={() => {}}
      {...overrides}
    />,
  );
}

describe('MenuScreen', () => {
  beforeEach(() => {
    useProgressStore.setState({ dailyCompletionDates: [] });
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

  it('drops the reward and says so once a goal is met', () => {
    renderMenu({ weekly: goal(WEEKLY_TARGET, WEEKLY_TARGET) });

    expect(screen.getByText(t('menu.weeklyDone'))).toBeTruthy();
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

  it('says how many archive days are open, or that none are', () => {
    const today = new Date();
    const key = (day: number) =>
      `${today.getFullYear()}${String(today.getMonth() + 1).padStart(2, '0')}${String(day).padStart(2, '0')}`;
    // Today counts as open until it is solved, so a full month includes it.
    const everyDaySoFar = Array.from({ length: today.getDate() }, (_, index) => key(index + 1));

    useProgressStore.setState({ dailyCompletionDates: everyDaySoFar });
    renderMenu();
    expect(screen.getByText(t('archive.allDone'))).toBeTruthy();

    cleanup();
    useProgressStore.setState({ dailyCompletionDates: everyDaySoFar.slice(0, -1) });
    renderMenu();
    expect(screen.getByText(t('archive.openDetail', { count: 1 }))).toBeTruthy();
  });

  it('reports island progress out of the total, not as a bare number', () => {
    renderMenu();

    expect(screen.getByText(t('menu.islands', { completed: 2, total: 13 }))).toBeTruthy();
  });
});

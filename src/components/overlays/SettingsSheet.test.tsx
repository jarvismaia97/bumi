import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { forwardRef } from 'react';
import { View } from 'react-native';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { playHaptic } from '@/lib/haptics';
import { refreshDailyReminders } from '@/lib/dailyReminder';
import { useAuthStore } from '@/state/authStore';
import { useLanguageStore } from '@/state/languageStore';
import { translate } from '@/i18n/messages';
import { useProgressStore } from '@/state/progressStore';
import { SettingsSheet } from './SettingsSheet';

// The module guards itself off on anything but a device, so under jsdom it is stubbed to
// record intent. Which style each word maps to is pinned in src/lib/haptics.test.ts.
vi.mock('@/lib/haptics', () => ({ playHaptic: vi.fn() }));

// Scheduling touches expo-notifications and the permission prompt; the tests drive its
// answer directly because the answer is what decides the feedback.
vi.mock('@/lib/dailyReminder', () => ({ refreshDailyReminders: vi.fn() }));

vi.mock('expo-router', () => ({ router: { push: vi.fn() } }));

// The auth client reaches expo-secure-store, whose native source vitest cannot parse. The
// tests put the account into the store directly rather than through a session.
vi.mock('@/lib/auth-client', () => ({
  authClient: {
    getSession: vi.fn().mockResolvedValue({ data: null, error: null }),
    signOut: vi.fn().mockResolvedValue({ error: null }),
    deleteUser: vi.fn().mockResolvedValue({ error: null }),
    signIn: { social: vi.fn().mockResolvedValue({ error: null }) },
  },
}));

// The sheet chrome is native and is not what these tests are about.
vi.mock('@gorhom/bottom-sheet', () => ({
  BottomSheetModal: forwardRef<unknown, { children?: React.ReactNode }>(function BottomSheetModal({ children }, _ref) {
    return <View>{children}</View>;
  }),
  BottomSheetView: View,
}));

// The reminder row only exists off the web build, and Alert is native chrome whose buttons
// the tests need to press.
const { alert } = vi.hoisted(() => ({ alert: vi.fn() }));
vi.mock('react-native', async () => {
  const actual = await vi.importActual<typeof import('react-native')>('react-native');
  return { ...actual, Platform: { ...actual.Platform, OS: 'ios' }, Alert: { alert } };
});

/** Presses the destructive choice in the confirmation dialog the last tap raised. */
function confirmDestructive() {
  const buttons = alert.mock.lastCall?.[2] as { style?: string; onPress?: () => void }[];
  buttons.find(button => button.style === 'destructive')?.onPress?.();
}

function renderSheet() {
  return render(<SettingsSheet onOpenAchievements={() => {}} onOpenThemes={() => {}} onOpenPrivacy={() => {}} onOpenLanguage={() => {}} onOpenLeaderboard={() => {}} onOpenArchive={() => {}} />);
}

beforeEach(() => {
  vi.mocked(refreshDailyReminders).mockResolvedValue(true);
  // The switch starts off, so every test's click is a request to turn the reminder on.
  useProgressStore.setState({ dailyReminderEnabled: false });
  useAuthStore.setState({
    user: { id: 'player-1', name: 'Player', email: 'player@example.com' },
    session: null,
    loading: false,
    error: null,
  });
});

afterEach(() => {
  vi.clearAllMocks();
  useLanguageStore.setState({ preference: 'auto' });
  useAuthStore.setState({ user: null, session: null, loading: true, error: null });
});

describe('SettingsSheet archive row', () => {
  const key = (day: number) => {
    const today = new Date();
    return `${today.getFullYear()}${String(today.getMonth() + 1).padStart(2, '0')}${String(day).padStart(2, '0')}`;
  };

  it('counts the days still open, the way the menu button used to', () => {
    // Every day of the month bar today, which counts as open until it is solved.
    const played = Array.from({ length: new Date().getDate() - 1 }, (_, index) => key(index + 1));
    useProgressStore.setState({ dailyReminderEnabled: false, dailyCompletionDates: played });

    renderSheet();

    expect(screen.getByText(translate('pt-PT', 'archive.open'))).toBeTruthy();
    expect(screen.getByText('1')).toBeTruthy();
  });

  it('says the month is complete rather than showing a zero', () => {
    const played = Array.from({ length: new Date().getDate() }, (_, index) => key(index + 1));
    useProgressStore.setState({ dailyReminderEnabled: false, dailyCompletionDates: played });

    renderSheet();

    expect(screen.getByText(translate('pt-PT', 'archive.allDoneShort'))).toBeTruthy();
  });
});

describe('SettingsSheet haptics', () => {
  it('stays silent opening the language sheet, like every other row that navigates', () => {
    renderSheet();

    fireEvent.click(screen.getByText('Idioma'));

    expect(playHaptic).not.toHaveBeenCalled();
  });

  it('answers a reminder that was scheduled with selection feedback', async () => {
    renderSheet();

    fireEvent.click(screen.getByRole('switch'));

    await waitFor(() => expect(playHaptic).toHaveBeenCalledExactlyOnceWith('selection'));
  });

  // The switch springs back rather than turning on, so success feedback here would be a lie.
  it('warns instead when the reminder could not be scheduled', async () => {
    vi.mocked(refreshDailyReminders).mockResolvedValue(false);
    renderSheet();

    fireEvent.click(screen.getByRole('switch'));

    await waitFor(() => expect(playHaptic).toHaveBeenCalledExactlyOnceWith('warning'));
  });

  it('warns when the destructive delete is confirmed, not when its dialog opens', () => {
    renderSheet();

    fireEvent.click(screen.getByText('Eliminar conta e dados'));
    expect(playHaptic).not.toHaveBeenCalled();

    confirmDestructive();
    expect(playHaptic).toHaveBeenCalledExactlyOnceWith('warning');
  });

  // Opening another sheet changes nothing yet. Feedback on mere navigation is what makes an
  // interface feel cheap, so these rows stay silent.
  it.each(['Conquistas', 'Temas', 'Política de privacidade'])('leaves the %s row silent', label => {
    renderSheet();

    fireEvent.click(screen.getByText(label));

    expect(playHaptic).not.toHaveBeenCalled();
  });
});

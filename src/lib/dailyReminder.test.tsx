import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const getLastNotificationResponseAsync = vi.fn();
const addNotificationResponseReceivedListener = vi.fn();
const scheduleNotificationAsync = vi.fn();
const cancelScheduledNotificationAsync = vi.fn();
const getPermissionsAsync = vi.fn();
const requestPermissionsAsync = vi.fn();
const remove = vi.fn();

vi.mock('expo-notifications', () => ({
  getLastNotificationResponseAsync,
  addNotificationResponseReceivedListener,
  scheduleNotificationAsync,
  cancelScheduledNotificationAsync,
  getPermissionsAsync,
  requestPermissionsAsync,
  setNotificationChannelAsync: vi.fn(),
  AndroidImportance: { DEFAULT: 3 },
  SchedulableTriggerInputTypes: { DATE: 'date' },
}));

// The module bails out on web, and react-native-web reports exactly that under jsdom.
vi.mock('react-native', async importOriginal => {
  const actual = await importOriginal<typeof import('react-native')>();
  return { ...actual, Platform: { ...actual.Platform, OS: 'ios' } };
});

function response(data: unknown) {
  return { notification: { request: { content: { data } } } };
}

beforeEach(() => {
  vi.clearAllMocks();
  getLastNotificationResponseAsync.mockResolvedValue(null);
  addNotificationResponseReceivedListener.mockReturnValue({ remove });
  getPermissionsAsync.mockResolvedValue({ granted: true });
  scheduleNotificationAsync.mockResolvedValue('id');
  cancelScheduledNotificationAsync.mockResolvedValue(undefined);
  // Mid-morning, so both the 19:00 and 21:00 slots are still ahead of now.
  vi.setSystemTime(new Date(2026, 6, 15, 10, 0, 0));
});

afterEach(() => {
  vi.useRealTimers();
});

/** The identifiers actually handed to expo-notifications this run. */
function scheduled(): string[] {
  return scheduleNotificationAsync.mock.calls.map(call => call[0].identifier);
}

async function refresh(overrides: Partial<Parameters<typeof import('./dailyReminder').refreshDailyReminders>[0]> = {}) {
  const { refreshDailyReminders } = await import('./dailyReminder');
  return refreshDailyReminders({
    enabled: true,
    language: 'pt-PT',
    dailyDoneToday: false,
    dailyStreak: 0,
    ...overrides,
  });
}

describe('what gets scheduled', () => {
  it('skips today once the daily is played, and keeps the days after it', async () => {
    // The old repeating trigger could not skip a day, so it buzzed even after you played.
    await refresh({ dailyDoneToday: true });

    expect(scheduled()).not.toContain('bumi-daily-reminder-0');
    expect(scheduled()).toContain('bumi-daily-reminder-1');
  });

  it('schedules a week ahead, since iOS only lets the app schedule while running', async () => {
    await refresh();
    expect(scheduled().filter(id => id.startsWith('bumi-daily-reminder-'))).toHaveLength(7);
  });

  it('warns about a streak worth saving', async () => {
    await refresh({ dailyStreak: 12 });
    expect(scheduled()).toContain('bumi-streak-at-risk');
  });

  it('stays quiet about a streak nobody would mourn', async () => {
    await refresh({ dailyStreak: 1 });
    expect(scheduled()).not.toContain('bumi-streak-at-risk');
  });

  it('never warns about a streak that is already safe today', async () => {
    await refresh({ dailyStreak: 30, dailyDoneToday: true });
    expect(scheduled()).not.toContain('bumi-streak-at-risk');
  });

  it('names the streak length in the warning, so it reads as something to lose', async () => {
    await refresh({ dailyStreak: 12 });
    const warning = scheduleNotificationAsync.mock.calls.find(call => call[0].identifier === 'bumi-streak-at-risk');
    expect(warning?.[0].content.body).toContain('12');
  });

  it('clears everything before re-arming, so nothing stale survives', async () => {
    await refresh();
    expect(cancelScheduledNotificationAsync).toHaveBeenCalledWith('bumi-streak-at-risk');
    expect(cancelScheduledNotificationAsync).toHaveBeenCalledWith('bumi-daily-reminder-0');
  });

  it('schedules nothing at all when the reminder is off', async () => {
    await refresh({ enabled: false });
    expect(scheduleNotificationAsync).not.toHaveBeenCalled();
  });

  it('reports failure rather than scheduling when permission is refused', async () => {
    getPermissionsAsync.mockResolvedValue({ granted: false });
    requestPermissionsAsync.mockResolvedValue({ granted: false });

    expect(await refresh()).toBe(false);
    expect(scheduleNotificationAsync).not.toHaveBeenCalled();
  });

  it('does not ambush a revoked permission with a dialog when only re-arming', async () => {
    getPermissionsAsync.mockResolvedValue({ granted: false });

    expect(await refresh({ promptForPermission: false })).toBe(false);
    expect(requestPermissionsAsync).not.toHaveBeenCalled();
  });
});

describe('opening the app from a reminder', () => {
  it('honours the screen a notification tapped while running asks for', async () => {
    const { onNotificationOpened, REMINDER_SCREEN } = await import('./dailyReminder');
    const open = vi.fn();
    await onNotificationOpened(open);

    addNotificationResponseReceivedListener.mock.calls[0][0](response({ screen: REMINDER_SCREEN }));

    expect(open).toHaveBeenCalledWith(REMINDER_SCREEN);
  });

  it('honours a notification that launched the app from cold', async () => {
    // Already delivered before the listener exists, so without this the reminder only
    // worked when the app happened to be running.
    const { onNotificationOpened, REMINDER_SCREEN } = await import('./dailyReminder');
    getLastNotificationResponseAsync.mockResolvedValue(response({ screen: REMINDER_SCREEN }));
    const open = vi.fn();

    await onNotificationOpened(open);

    expect(open).toHaveBeenCalledWith(REMINDER_SCREEN);
  });

  it('ignores a payload with no screen rather than opening something arbitrary', async () => {
    const { onNotificationOpened } = await import('./dailyReminder');
    const open = vi.fn();
    await onNotificationOpened(open);

    addNotificationResponseReceivedListener.mock.calls[0][0](response(undefined));
    addNotificationResponseReceivedListener.mock.calls[0][0](response({ screen: 42 }));

    expect(open).not.toHaveBeenCalled();
  });

  it('hands back a teardown that unsubscribes', async () => {
    const { onNotificationOpened } = await import('./dailyReminder');
    (await onNotificationOpened(vi.fn()))();
    expect(remove).toHaveBeenCalledOnce();
  });
});

import { Platform } from 'react-native';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const getLastNotificationResponseAsync = vi.fn();
const setNotificationChannelAsync = vi.fn();
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
  setNotificationChannelAsync,
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
  // Every test but the Android ones runs as iOS; those set their own and this puts it back.
  Object.defineProperty(Platform, 'OS', { value: 'ios', configurable: true });
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

/** Every trigger scheduled this run, which is where the channel has to be named. */
function triggers(): { type: string; date: Date; channelId?: string }[] {
  return scheduleNotificationAsync.mock.calls.map(call => call[0].trigger);
}

function onAndroid(): void {
  Object.defineProperty(Platform, 'OS', { value: 'android', configurable: true });
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

  it('cancels the whole week when the reminder is turned off, rather than just not re-arming', async () => {
    // Turning it off has to reach the notifications already armed: seven days of them plus the
    // streak warning were sitting on the device, and nothing else ever cancels them.
    await refresh({ enabled: false });

    const cancelled = cancelScheduledNotificationAsync.mock.calls.map(call => call[0]);
    expect(cancelled).toContain('bumi-streak-at-risk');
    for (let day = 0; day < 7; day++) expect(cancelled).toContain(`bumi-daily-reminder-${day}`);
  });

  it('clears everything on cancelDailyReminders, for an account that is being deleted', async () => {
    const { cancelDailyReminders } = await import('./dailyReminder');
    await cancelDailyReminders();

    expect(cancelScheduledNotificationAsync).toHaveBeenCalledTimes(8);
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

describe('the Android channel', () => {
  it('names the channel on every trigger, so the reminder is mutable on its own', async () => {
    // The channel was created with a translated name and then never asked for. `channelId` is a
    // property of the trigger, not of the content, so every reminder was delivered on the
    // "Miscellaneous" channel expo-notifications creates for notifications that name none —
    // which a player cannot recognise, let alone mute without muting the whole app.
    onAndroid();

    await refresh({ dailyStreak: 5 });

    expect(setNotificationChannelAsync).toHaveBeenCalledWith('daily-reminder', expect.anything());
    expect(triggers()).not.toHaveLength(0);
    for (const trigger of triggers()) expect(trigger.channelId).toBe('daily-reminder');
  });

  it('leaves the trigger alone off Android, which has no channels to name', async () => {
    await refresh({ dailyStreak: 5 });

    expect(setNotificationChannelAsync).not.toHaveBeenCalled();
    for (const trigger of triggers()) expect(trigger).not.toHaveProperty('channelId');
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

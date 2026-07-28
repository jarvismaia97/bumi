import { beforeEach, describe, expect, it, vi } from 'vitest';

const getLastNotificationResponseAsync = vi.fn();
const addNotificationResponseReceivedListener = vi.fn();
const remove = vi.fn();

vi.mock('expo-notifications', () => ({
  getLastNotificationResponseAsync,
  addNotificationResponseReceivedListener,
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

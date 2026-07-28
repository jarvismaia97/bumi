import { Platform } from 'react-native';
import type { DateTriggerInput } from 'expo-notifications';
import { translate, type SupportedLanguage } from '@/i18n/messages';

const REMINDER_HOUR = 19;
/** Late enough to be a last call, early enough not to wake anyone. */
const STREAK_HOUR = 21;

/**
 * A repeating trigger cannot skip a day, so it fired at 19:00 even when the player had
 * already played that morning — the fastest way to get an app's notifications turned off.
 * Each day is scheduled as its own one-off instead, which can be dropped individually.
 *
 * Scheduling a week ahead is what keeps the reminder alive for a player who does not open
 * the app: iOS only lets us schedule while running, so the horizon is the reach.
 */
const LOOKAHEAD_DAYS = 7;
const dailyId = (offset: number) => `bumi-daily-reminder-${offset}`;
const STREAK_ID = 'bumi-streak-at-risk';

/** Below this a lost streak is no loss, and the notification would just be noise. */
const STREAK_WORTH_SAVING = 2;

function at(hour: number, dayOffset: number): Date {
  const when = new Date();
  when.setDate(when.getDate() + dayOffset);
  when.setHours(hour, 0, 0, 0);
  return when;
}

/** What the reminder asks the app to open when it is tapped. */
export const REMINDER_SCREEN = 'daily';

/**
 * Calls back with the screen a tapped notification asked for, including the one that
 * launched the app from cold. Returns a teardown, or a no-op where notifications cannot run.
 */
export async function onNotificationOpened(open: (screen: string) => void): Promise<() => void> {
  if (Platform.OS === 'web') return () => {};

  const Notifications = await import('expo-notifications');

  // A notification that launched the app has already been delivered, so the listener below
  // never fires for it — without this the reminder only works while the app is running.
  const launched = await Notifications.getLastNotificationResponseAsync();
  const launchedScreen = launched?.notification.request.content.data?.screen;
  if (typeof launchedScreen === 'string') open(launchedScreen);

  const subscription = Notifications.addNotificationResponseReceivedListener(response => {
    const screen = response.notification.request.content.data?.screen;
    if (typeof screen === 'string') open(screen);
  });

  return () => subscription.remove();
}

export async function configureNotificationHandler(): Promise<void> {
  if (Platform.OS === 'web') return;

  const Notifications = await import('expo-notifications');
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: false,
      shouldSetBadge: false,
    }),
  });
}

export interface ReminderState {
  enabled: boolean;
  language: SupportedLanguage;
  /** Today's daily is done, so today's reminder is dropped and the streak is safe. */
  dailyDoneToday: boolean;
  dailyStreak: number;
  /**
   * Off when only re-arming an already-enabled reminder, so a player whose permission was
   * revoked is not ambushed by a system dialog on launch.
   */
  promptForPermission?: boolean;
}

/** Clears everything this module schedules, so re-arming never leaves a stale copy behind. */
async function cancelAll(Notifications: typeof import('expo-notifications')): Promise<void> {
  const ids = [STREAK_ID, ...Array.from({ length: LOOKAHEAD_DAYS }, (_, i) => dailyId(i))];
  await Promise.all(ids.map(id => Notifications.cancelScheduledNotificationAsync(id).catch(() => {})));
}

export async function refreshDailyReminders({
  enabled,
  language,
  dailyDoneToday,
  dailyStreak,
  promptForPermission = true,
}: ReminderState): Promise<boolean> {
  if (Platform.OS === 'web') return false;

  const Notifications = await import('expo-notifications');
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('daily-reminder', {
      name: translate(language, 'reminder.channel'),
      importance: Notifications.AndroidImportance.DEFAULT,
    });
  }

  await cancelAll(Notifications);
  if (!enabled) return true;

  const current = await Notifications.getPermissionsAsync();
  if (!current.granted && !promptForPermission) return false;
  const permission = current.granted ? current : await Notifications.requestPermissionsAsync();
  if (!permission.granted) return false;

  const now = Date.now();
  const schedule = (identifier: string, when: Date, title: string, body: string) => {
    if (when.getTime() <= now) return null;
    const trigger: DateTriggerInput = { type: Notifications.SchedulableTriggerInputTypes.DATE, date: when };
    return Notifications.scheduleNotificationAsync({
      identifier,
      content: { title, body, data: { screen: REMINDER_SCREEN } },
      trigger,
    });
  };

  const pending: (Promise<string> | null)[] = [];
  for (let day = 0; day < LOOKAHEAD_DAYS; day++) {
    // Today is skipped once it is already played; every later day is still unknown.
    if (day === 0 && dailyDoneToday) continue;
    pending.push(
      schedule(dailyId(day), at(REMINDER_HOUR, day), translate(language, 'reminder.title'), translate(language, 'reminder.body')),
    );
  }

  // The one notification worth interrupting someone for: it expires at midnight and the
  // player would genuinely regret missing it.
  if (!dailyDoneToday && dailyStreak >= STREAK_WORTH_SAVING) {
    pending.push(
      schedule(
        STREAK_ID,
        at(STREAK_HOUR, 0),
        translate(language, 'reminder.streakTitle'),
        translate(language, 'reminder.streakBody', { count: dailyStreak }),
      ),
    );
  }

  await Promise.all(pending);
  return true;
}

import { Platform } from 'react-native';
import type { CalendarTriggerInput, DailyTriggerInput } from 'expo-notifications';
import { translate, type SupportedLanguage } from '@/i18n/messages';

const REMINDER_ID = 'bumi-daily-reminder';
const REMINDER_HOUR = 19;

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

/**
 * `promptForPermission` is off when we are only re-scheduling an already-enabled reminder
 * (a language change), so a player whose permission was revoked is not ambushed by a
 * system dialog on launch.
 */
export async function setDailyReminder(
  enabled: boolean,
  language: SupportedLanguage,
  { promptForPermission = true }: { promptForPermission?: boolean } = {},
): Promise<boolean> {
  if (Platform.OS === 'web') return false;

  const Notifications = await import('expo-notifications');
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('daily-reminder', {
      name: translate(language, 'reminder.channel'),
      importance: Notifications.AndroidImportance.DEFAULT,
    });
  }

  await Notifications.cancelScheduledNotificationAsync(REMINDER_ID).catch(() => {});
  if (!enabled) return true;

  const current = await Notifications.getPermissionsAsync();
  if (!current.granted && !promptForPermission) return false;
  const permission = current.granted ? current : await Notifications.requestPermissionsAsync();
  if (!permission.granted) return false;

  const iosTrigger: CalendarTriggerInput = {
    type: Notifications.SchedulableTriggerInputTypes.CALENDAR,
    repeats: true,
    hour: REMINDER_HOUR,
    minute: 0,
  };
  const androidTrigger: DailyTriggerInput = {
    type: Notifications.SchedulableTriggerInputTypes.DAILY,
    hour: REMINDER_HOUR,
    minute: 0,
  };

  await Notifications.scheduleNotificationAsync({
    identifier: REMINDER_ID,
    content: {
      title: translate(language, 'reminder.title'),
      body: translate(language, 'reminder.body'),
      data: { screen: REMINDER_SCREEN },
    },
    trigger: Platform.OS === 'ios' ? iosTrigger : androidTrigger,
  });
  return true;
}

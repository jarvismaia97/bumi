import { Platform } from 'react-native';
import type { CalendarTriggerInput, DailyTriggerInput } from 'expo-notifications';
import { translate, type SupportedLanguage } from '@/i18n/messages';

const REMINDER_ID = 'bumi-daily-reminder';
const REMINDER_HOUR = 19;

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
      data: { screen: 'daily' },
    },
    trigger: Platform.OS === 'ios' ? iosTrigger : androidTrigger,
  });
  return true;
}

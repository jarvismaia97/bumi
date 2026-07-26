import { Platform } from 'react-native';
import type { CalendarTriggerInput, DailyTriggerInput } from 'expo-notifications';

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

export async function setDailyReminder(enabled: boolean): Promise<boolean> {
  if (Platform.OS === 'web') return false;

  const Notifications = await import('expo-notifications');
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('daily-reminder', {
      name: 'Desafio diário',
      importance: Notifications.AndroidImportance.DEFAULT,
    });
  }

  await Notifications.cancelScheduledNotificationAsync(REMINDER_ID).catch(() => {});
  if (!enabled) return true;

  const current = await Notifications.getPermissionsAsync();
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
      title: 'O desafio diário está pronto',
      body: 'Reserva dois minutos para resolver o puzzle de hoje.',
      data: { screen: 'daily' },
    },
    trigger: Platform.OS === 'ios' ? iosTrigger : androidTrigger,
  });
  return true;
}

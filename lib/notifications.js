import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

/** Reminders a grower set themselves, kept apart from the watering ones. */
export const SCHEDULE_CHANNEL = 'scheduled-actions';

export async function requestNotificationPermissions() {
  if (!Device.isDevice) return false;

  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('watering-reminders', {
      name: 'Watering reminders',
      importance: Notifications.AndroidImportance.DEFAULT,
    });
    await Notifications.setNotificationChannelAsync(SCHEDULE_CHANNEL, {
      name: 'Scheduled actions',
      importance: Notifications.AndroidImportance.DEFAULT,
    });
  }

  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;
  if (existingStatus !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }
  return finalStatus === 'granted';
}

function nextDueDate(lastWateredAt, intervalDays) {
  const due = new Date(lastWateredAt);
  due.setDate(due.getDate() + intervalDays);
  return due;
}

export async function scheduleWateringReminder(plant) {
  await cancelWateringReminder(plant.id);

  const dueDate = nextDueDate(plant.last_watered_at, plant.watering_interval_days);
  if (dueDate.getTime() <= Date.now()) return;

  await Notifications.scheduleNotificationAsync({
    identifier: plant.id,
    content: {
      title: 'Time to water your plant',
      body: `${plant.name} is due for watering.`,
    },
    trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: dueDate },
  });
}

export async function cancelWateringReminder(plantId) {
  await Notifications.cancelScheduledNotificationAsync(plantId);
}

/**
 * A one-off reminder at a given moment, identified by the id of the row that
 * asked for it — so rescheduling or deleting that row can find its notification
 * again without storing a handle alongside it.
 *
 * A time that has already passed schedules nothing: the reminder was for then,
 * and firing it late would be a nag rather than a nudge.
 */
export async function scheduleReminderAt({ id, title, body, date, channelId }) {
  await cancelReminder(id);
  if (!date || date.getTime() <= Date.now()) return false;

  await Notifications.scheduleNotificationAsync({
    identifier: id,
    content: { title, body },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DATE,
      date,
      ...(channelId ? { channelId } : {}),
    },
  });
  return true;
}

export async function cancelReminder(id) {
  await Notifications.cancelScheduledNotificationAsync(id);
}

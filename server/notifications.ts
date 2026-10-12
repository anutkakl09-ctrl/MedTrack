export interface NotificationSettings {
  enabled: boolean;
  reminderOffsets: number[];
  atDoseEnabled: boolean;
}

export interface DueNotificationTarget {
  kind: 'advance' | 'at_dose';
  minutesBefore: number;
}

export const DEFAULT_REMINDER_OFFSETS = [60, 30, 5];

export function defaultNotificationSettings(): NotificationSettings {
  return { enabled: true, reminderOffsets: [...DEFAULT_REMINDER_OFFSETS], atDoseEnabled: true };
}

function asRecord(value: unknown) {
  return value && typeof value === 'object' ? (value as Record<string, unknown>) : {};
}

export function normalizeNotificationSettings(value: unknown): NotificationSettings {
  const input = asRecord(value);
  const rawOffsets = Array.isArray(input.reminderOffsets) ? input.reminderOffsets : DEFAULT_REMINDER_OFFSETS;
  const reminderOffsets = [...new Set(rawOffsets.map(Number).filter((offset) => Number.isInteger(offset) && offset > 0 && offset <= 10080))].sort((a, b) => b - a);
  return { enabled: input.enabled !== false, reminderOffsets, atDoseEnabled: input.atDoseEnabled !== false };
}

function plural(value: number, one: string, few: string, many: string) {
  const absolute = Math.abs(value) % 100;
  if (absolute >= 11 && absolute <= 14) return many;
  const last = absolute % 10;
  return last === 1 ? one : last >= 2 && last <= 4 ? few : many;
}

export function formatReminderLead(minutes: number) {
  const safe = Math.max(0, Math.round(minutes));
  const hours = Math.floor(safe / 60);
  const rest = safe % 60;
  const parts: string[] = [];
  if (hours) parts.push(hours + ' ' + plural(hours, 'час', 'часа', 'часов'));
  if (rest || !hours) parts.push(rest + ' ' + plural(rest, 'минуту', 'минуты', 'минут'));
  return parts.join(' ');
}

export function findDueNotifications(
  scheduledAt: string,
  settings: NotificationSettings,
  sentReminderOffsets: number[] = [],
  atDoseSent = false,
  now = Date.now(),
  windowMs = 90_000,
): DueNotificationTarget[] {
  if (!settings.enabled) return [];
  const scheduledMs = new Date(scheduledAt).getTime();
  if (Number.isNaN(scheduledMs)) return [];
  const sent = new Set(sentReminderOffsets);
  const targets: Array<DueNotificationTarget & { targetAt: number }> = [];
  for (const minutesBefore of settings.reminderOffsets) {
    if (sent.has(minutesBefore)) continue;
    const targetAt = scheduledMs - minutesBefore * 60_000;
    if (Math.abs(targetAt - now) <= windowMs) targets.push({ kind: 'advance', minutesBefore, targetAt });
  }
  if (settings.atDoseEnabled && !atDoseSent && Math.abs(scheduledMs - now) <= windowMs) {
    targets.push({ kind: 'at_dose', minutesBefore: 0, targetAt: scheduledMs });
  }
  return targets.sort((a, b) => a.targetAt - b.targetAt).map((target) => ({ kind: target.kind, minutesBefore: target.minutesBefore }));
}

export function notificationLeadText(minutes: number) {
  return 'Через ' + formatReminderLead(minutes) + ' нужно принять лекарство';
}


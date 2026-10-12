import { describe, expect, it } from 'vitest';
import {
  DEFAULT_REMINDER_OFFSETS,
  defaultNotificationSettings,
  findDueNotifications,
  formatReminderLead,
  normalizeNotificationSettings,
} from './notifications';

const scheduledAt = '2026-10-11T12:00:00.000Z';
const scheduledMs = new Date(scheduledAt).getTime();

describe('notification settings and timing', () => {
  it('uses one hour, thirty minutes and five minutes by default', () => {
    expect(defaultNotificationSettings()).toEqual({
      enabled: true,
      reminderOffsets: DEFAULT_REMINDER_OFFSETS,
      atDoseEnabled: true,
    });
  });

  it('normalizes custom offsets and removes invalid values', () => {
    expect(normalizeNotificationSettings({ reminderOffsets: [15, 60, 15, 0, -5, 10081] })).toEqual({
      enabled: true,
      reminderOffsets: [60, 15],
      atDoseEnabled: true,
    });
  });

  it('returns the selected advance reminder and the reminder at dose time', () => {
    expect(findDueNotifications(scheduledAt, { enabled: true, reminderOffsets: [60, 30, 5], atDoseEnabled: true }, [], false, scheduledMs - 30 * 60_000, 1_000)).toEqual([
      { kind: 'advance', minutesBefore: 30 },
    ]);
    expect(findDueNotifications(scheduledAt, { enabled: true, reminderOffsets: [60, 30, 5], atDoseEnabled: true }, [], false, scheduledMs, 1_000)).toEqual([
      { kind: 'at_dose', minutesBefore: 0 },
    ]);
  });

  it('does not return disabled or already sent reminders', () => {
    expect(findDueNotifications(scheduledAt, { enabled: false, reminderOffsets: [60], atDoseEnabled: true }, [], false, scheduledMs - 60 * 60_000, 1_000)).toEqual([]);
    expect(findDueNotifications(scheduledAt, { enabled: true, reminderOffsets: [60, 30], atDoseEnabled: false }, [60], false, scheduledMs - 30 * 60_000, 1_000)).toEqual([
      { kind: 'advance', minutesBefore: 30 },
    ]);
    expect(findDueNotifications(scheduledAt, { enabled: true, reminderOffsets: [60], atDoseEnabled: true }, [], true, scheduledMs, 1_000)).toEqual([]);
  });

  it('formats Russian lead time', () => {
    expect(formatReminderLead(60)).toBe('1 час');
    expect(formatReminderLead(30)).toBe('30 минут');
    expect(formatReminderLead(125)).toBe('2 часа 5 минут');
  });
});

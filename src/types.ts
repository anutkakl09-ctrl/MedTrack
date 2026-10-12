export type Theme = 'dark' | 'light' | 'system';
export type ProfileType = 'self' | 'child' | 'relative' | 'patient' | 'other';
export type MedicationStatus = 'active' | 'paused' | 'completed' | 'archived';
export type DoseStatus =
  | 'scheduled'
  | 'reminder_sent'
  | 'snoozed'
  | 'taken_on_time'
  | 'taken_late'
  | 'skipped'
  | 'missed'
  | 'cancelled'
  | 'rescheduled';
export type ScheduleType = 'fixed' | 'interval' | 'meal' | 'as_needed';
export type ReschedulePolicy = 'none' | 'shift_all' | 'minimum_interval' | 'waking_hours' | 'ask';
export type IntakeCondition = 'before_meal' | 'with_meal' | 'after_meal' | 'anytime';

export interface NotificationSettings {
  enabled: boolean;
  reminderOffsets: number[];
  atDoseEnabled: boolean;
}

export interface User {
  id: string;
  telegramId: string;
  firstName: string;
  lastName?: string;
  username?: string;
  languageCode?: string;
}

export interface Profile {
  id: string;
  displayName: string;
  type: ProfileType;
  timezone: string;
  wakeTime: string;
  sleepTime: string;
  breakfastTime: string;
  lunchTime: string;
  dinnerTime: string;
  theme: Theme;
  notificationSettings: NotificationSettings;
  avatarColor: string;
  role: 'Owner' | 'Caregiver' | 'Viewer';
  memberCount: number;
}

export interface Medication {
  id: string;
  profileId: string;
  name: string;
  form: string;
  dosage: string;
  doseAmount: number;
  stockAmount: number;
  stockUnit: string;
  packageSize: number;
  lowStockThreshold: number;
  purchaseReminderDays: number;
  intakeCondition: IntakeCondition;
  customInstruction?: string;
  startDate: string;
  endDate?: string;
  status: MedicationStatus;
  color: string;
  scheduleType: ScheduleType;
  scheduleLabel: string;
  intervalHours?: number;
  timesOfDay: string[];
  mealType?: 'breakfast' | 'lunch' | 'dinner';
  mealOffsetMinutes?: number;
  reschedulePolicy: ReschedulePolicy;
  adherence: number;
  nextDoseAt?: string;
}

export interface Dose {
  id: string;
  profileId: string;
  medicationId: string;
  medicationName: string;
  medicationColor: string;
  scheduledAt: string;
  actualTakenAt?: string;
  status: DoseStatus;
  doseAmount: number;
  delayMinutes?: number;
  note?: string;
  snoozedUntil?: string;
}

export interface Activity {
  id: string;
  title: string;
  detail: string;
  time: string;
  tone: 'success' | 'warning' | 'neutral' | 'accent';
}

export interface Stats {
  todayTotal: number;
  todayTaken: number;
  todayLate: number;
  todayMissed: number;
  adherence: number;
  streak: number;
  lowStockCount: number;
}

export interface BootstrapData {
  user: User;
  profiles: Profile[];
  activeProfileId: string;
  medications: Medication[];
  doses: Dose[];
  activities: Activity[];
  stats: Stats;
  theme: Theme;
}

export interface SchedulePreview {
  dates: string[];
  warnings: string[];
  selectedStrategy: string;
  explanation: string;
}

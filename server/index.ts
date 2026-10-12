import 'dotenv/config';
import cors from 'cors';
import express, { type Request } from 'express';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import {
  buildSchedulePreview,
  generateDoseTimes,
  moveToWakingWindow,
  scheduleLabel,
} from './schedule.js';
import {
  defaultNotificationSettings,
  findDueNotifications,
  normalizeNotificationSettings,
  type NotificationSettings,
} from './notifications.js';

type Theme = 'dark' | 'light' | 'system';
type DoseStatus =
  | 'scheduled'
  | 'reminder_sent'
  | 'snoozed'
  | 'taken_on_time'
  | 'taken_late'
  | 'skipped'
  | 'missed'
  | 'cancelled'
  | 'rescheduled';
type ScheduleType = 'fixed' | 'interval' | 'meal' | 'as_needed';
type ReschedulePolicy = 'none' | 'shift_all' | 'minimum_interval' | 'waking_hours' | 'ask';

interface StoredUser {
  id: string;
  telegramId: string;
  firstName: string;
  lastName?: string;
  username?: string;
  languageCode?: string;
}
interface StoredAccount {
  user: StoredUser;
  profiles: StoredProfile[];
}
interface StoredProfile {
  id: string;
  displayName: string;
  type: string;
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
interface StoredMedication {
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
  intakeCondition: string;
  customInstruction?: string;
  startDate: string;
  endDate?: string;
  status: 'active' | 'paused' | 'completed' | 'archived';
  color: string;
  scheduleType: ScheduleType;
  scheduleLabel: string;
  intervalHours?: number;
  allowNightDoses: boolean;
  timesOfDay: string[];
  mealType?: 'breakfast' | 'lunch' | 'dinner';
  mealOffsetMinutes?: number;
  reschedulePolicy: ReschedulePolicy;
  adherence: number;
  nextDoseAt?: string;
  lowStockNotifiedAt?: string;
}
interface StoredDose {
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
  notificationSentAt?: string;
  sentReminderOffsets?: number[];
  atDoseNotificationSentAt?: string;
}

interface Store {
  accounts: Record<string, StoredAccount>;
  medications: StoredMedication[];
  doses: StoredDose[];
  activities: {
    id: string;
    profileId?: string;
    title: string;
    detail: string;
    time: string;
    tone: 'success' | 'warning' | 'neutral' | 'accent';
  }[];
  theme: Theme;
}

const port = Number(process.env.PORT || process.env.API_PORT || 4000);
const demoMode = process.env.DEMO_MODE
  ? process.env.DEMO_MODE === 'true'
  : process.env.NODE_ENV !== 'production' && !process.env.TELEGRAM_BOT_TOKEN;
const dataDirectory = path.resolve(process.env.DATA_DIR || path.join(process.cwd(), 'data'));
const dataPath = path.resolve(process.env.DATA_FILE || path.join(dataDirectory, 'store.json'));

if (!demoMode) {
  const missing = ['TELEGRAM_BOT_TOKEN', 'INTERNAL_API_TOKEN', 'MINI_APP_URL'].filter(
    (name) => !process.env[name],
  );
  if (missing.length) {
    throw new Error('Production configuration is incomplete. Missing: ' + missing.join(', '));
  }
}

const colors = ['#ff5a1f', '#a78bfa', '#36c995', '#f3b34c', '#66a6ff', '#f06b9a'];

function id(prefix: string) {
  return prefix + '_' + crypto.randomUUID().slice(0, 8);
}

function isoAtToday(time: string, offsetDays = 0) {
  const date = new Date();
  date.setDate(date.getDate() + offsetDays);
  const [hours, minutes] = time.split(':').map(Number);
  date.setHours(hours || 0, minutes || 0, 0, 0);
  return date.toISOString();
}

function seedStore(): Store {
  const profileId = 'profile_demo';
  const vitaminId = 'med_vitamin';
  const magnesiumId = 'med_magnesium';
  const today = new Date();
  const isoDate = today.toISOString().slice(0, 10);
  const doses: StoredDose[] = [
    {
      id: 'dose_1',
      profileId,
      medicationId: vitaminId,
      medicationName: 'Витамин D3',
      medicationColor: '#ff5a1f',
      scheduledAt: isoAtToday('09:00'),
      status: 'taken_on_time',
      actualTakenAt: isoAtToday('09:04'),
      doseAmount: 1,
      delayMinutes: 4,
    },
    {
      id: 'dose_2',
      profileId,
      medicationId: magnesiumId,
      medicationName: 'Магний B6',
      medicationColor: '#a78bfa',
      scheduledAt: isoAtToday('13:30'),
      status: 'scheduled',
      doseAmount: 2,
    },
    {
      id: 'dose_3',
      profileId,
      medicationId: vitaminId,
      medicationName: 'Витамин D3',
      medicationColor: '#ff5a1f',
      scheduledAt: isoAtToday('20:30'),
      status: 'scheduled',
      doseAmount: 1,
    },
  ];

  return {
    accounts: {
      demo: {
        user: {
          id: 'user_demo',
          telegramId: 'demo',
          firstName: 'Алексей',
          username: 'alexey',
          languageCode: 'ru',
        },
        profiles: [
      {
        id: profileId,
        displayName: 'Алексей',
        type: 'self',
        timezone: 'Europe/Moscow',
        wakeTime: '07:30',
        sleepTime: '23:30',
        breakfastTime: '08:30',
        lunchTime: '13:30',
        dinnerTime: '19:30',
        theme: 'dark',
        notificationSettings: defaultNotificationSettings(),
        avatarColor: '#ff5a1f',
        role: 'Owner',
        memberCount: 1,
      },
      {
        id: 'profile_mom',
        displayName: 'Мама',
        type: 'relative',
        timezone: 'Europe/Moscow',
        wakeTime: '07:00',
        sleepTime: '22:30',
        breakfastTime: '08:00',
        lunchTime: '13:00',
        dinnerTime: '19:00',
        theme: 'dark',
        notificationSettings: defaultNotificationSettings(),
        avatarColor: '#a78bfa',
        role: 'Caregiver',
        memberCount: 2,
      },
        ],
      },
    },
    medications: [
      {
        id: vitaminId,
        profileId,
        name: 'Витамин D3',
        form: 'Капсула',
        dosage: '2000 МЕ',
        doseAmount: 1,
        stockAmount: 18,
        stockUnit: 'капсул',
        packageSize: 30,
        lowStockThreshold: 7,
        purchaseReminderDays: 5,
        intakeCondition: 'after_meal',
        customInstruction: 'После завтрака',
        startDate: isoDate,
        status: 'active',
        color: '#ff5a1f',
        scheduleType: 'fixed',
        scheduleLabel: 'Каждый день • 09:00',
        allowNightDoses: false,
        timesOfDay: ['09:00'],
        reschedulePolicy: 'none',
        adherence: 94,
        nextDoseAt: isoAtToday('20:30'),
      },
      {
        id: magnesiumId,
        profileId,
        name: 'Магний B6',
        form: 'Таблетка',
        dosage: '100 мг',
        doseAmount: 2,
        stockAmount: 42,
        stockUnit: 'таблетки',
        packageSize: 60,
        lowStockThreshold: 10,
        purchaseReminderDays: 5,
        intakeCondition: 'with_meal',
        customInstruction: 'Во время обеда',
        startDate: isoDate,
        status: 'active',
        color: '#a78bfa',
        scheduleType: 'meal',
        scheduleLabel: 'Во время обеда',
        allowNightDoses: false,
        timesOfDay: ['13:30'],
        mealType: 'lunch',
        reschedulePolicy: 'none',
        adherence: 88,
        nextDoseAt: isoAtToday('13:30'),
      },
    ],
    doses,
    activities: [
      {
        id: 'activity_1',
        profileId,
        title: 'Витамин D3 принят',
        detail: 'Задержка 4 минуты',
        time: '09:04',
        tone: 'success',
      },
      {
        id: 'activity_2',
        profileId,
        title: 'Напоминание отправлено',
        detail: 'Магний B6 • 13:30',
        time: '08:00',
        tone: 'accent',
      },
      {
        id: 'activity_3',
        profileId,
        title: 'Осталось мало',
        detail: 'Витамин D3 • 18 капсул',
        time: 'вчера',
        tone: 'warning',
      },
    ],
    theme: 'dark',
  };
}

function emptyStore(): Store {
  return {
    accounts: {},
    medications: [],
    doses: [],
    activities: [],
    theme: 'dark',
  };
}

function readStore(): Store {
  try {
    const loaded = JSON.parse(fs.readFileSync(dataPath, 'utf8')) as Partial<Store> & {
      user?: StoredUser;
      profiles?: StoredProfile[];
    };
    if (!loaded.accounts) {
      if (!demoMode) return emptyStore();
      return {
        ...loaded,
        accounts: {
          demo: {
            user: loaded.user || seedStore().accounts.demo.user,
            profiles: loaded.profiles || seedStore().accounts.demo.profiles,
          },
        },
      } as Store;
    }
    if (!demoMode && loaded.accounts.demo?.user.telegramId === 'demo') {
      const demoProfileIds = new Set(loaded.accounts.demo.profiles.map((profile) => profile.id));
      delete loaded.accounts.demo;
      loaded.medications = (loaded.medications || []).filter(
        (medication) => !demoProfileIds.has(medication.profileId),
      );
      loaded.doses = (loaded.doses || []).filter((dose) => !demoProfileIds.has(dose.profileId));
      loaded.activities = (loaded.activities || []).filter(
        (activity) => !activity.profileId || !demoProfileIds.has(activity.profileId),
      );
      fs.writeFileSync(dataPath, JSON.stringify(loaded, null, 2));
    }
    return loaded as Store;
  } catch {
    const initial = demoMode ? seedStore() : emptyStore();
    fs.mkdirSync(path.dirname(dataPath), { recursive: true });
    fs.writeFileSync(dataPath, JSON.stringify(initial, null, 2));
    return initial;
  }
}

const store = readStore();

for (const account of Object.values(store.accounts)) {
  for (const profile of account.profiles) {
    profile.notificationSettings = normalizeNotificationSettings(profile.notificationSettings);
  }
}

function saveStore() {
  fs.mkdirSync(path.dirname(dataPath), { recursive: true });
  fs.writeFileSync(dataPath, JSON.stringify(store, null, 2));
}

function getTelegramUserFromInitData(initData: string) {
  if (demoMode && (!initData || initData === 'demo')) return store.accounts.demo.user;
  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  if (!botToken || !initData) return null;
  const params = new URLSearchParams(initData);
  const hash = params.get('hash');
  const authDate = Number(params.get('auth_date'));
  if (!hash || !authDate || Date.now() / 1000 - authDate > 86400) return null;
  params.delete('hash');
  const dataCheckString = [...params.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, value]) => key + '=' + value)
    .join('\n');
  const secretKey = crypto.createHmac('sha256', 'WebAppData').update(botToken).digest();
  const calculated = crypto
    .createHmac('sha256', secretKey)
    .update(dataCheckString)
    .digest('hex');
  const expected = Buffer.from(calculated, 'utf8');
  const provided = Buffer.from(hash, 'utf8');
  if (expected.length !== provided.length || !crypto.timingSafeEqual(expected, provided)) return null;
  let telegramUser: {
    id: number;
    first_name: string;
    last_name?: string;
    username?: string;
    language_code?: string;
  };
  try {
    telegramUser = JSON.parse(params.get('user') || '{}') as typeof telegramUser;
  } catch {
    return null;
  }
  if (!telegramUser.id || !telegramUser.first_name) return null;
  return {
    id: 'user_' + telegramUser.id,
    telegramId: String(telegramUser.id),
    firstName: telegramUser.first_name,
    lastName: telegramUser.last_name,
    username: telegramUser.username,
    languageCode: telegramUser.language_code,
  };
}

function getTelegramUser(req: Request) {
  return getTelegramUserFromInitData(req.header('x-telegram-init-data') || '');
}

function accountForUser(user: StoredUser) {
  const key = user.telegramId;
  if (!store.accounts[key]) {
    store.accounts[key] = {
      user,
      profiles: [],
    };
    saveStore();
  } else {
    store.accounts[key].user = {
      ...store.accounts[key].user,
      ...user,
    };
  }
  return store.accounts[key];
}

function requireUser(req: Request, res: express.Response) {
  const user = getTelegramUser(req);
  if (!user) {
    res.status(401).json({ message: 'Не удалось проверить Telegram-сессию' });
    return null;
  }
  return { user, account: accountForUser(user) };
}

function profileFromRequest(req: Request, account: StoredAccount) {
  return String(req.query.profileId || req.body?.profileId || account.profiles[0]?.id);
}

function getProfile(profileId: string, account: StoredAccount) {
  return account.profiles.find((profile) => profile.id === profileId);
}

function buildBootstrap(account: StoredAccount, profileId?: string) {
  const activeProfileId =
    profileId && getProfile(profileId, account) ? profileId : account.profiles[0]?.id || '';
  const profile = getProfile(activeProfileId, account);
  const profileDoses = store.doses.filter((dose) => dose.profileId === activeProfileId);
  const profileMeds = store.medications.filter((med) => med.profileId === activeProfileId);
  const todayPrefix = new Date().toISOString().slice(0, 10);
  const todayDoses = profileDoses.filter((dose) => dose.scheduledAt.startsWith(todayPrefix));
  const taken = todayDoses.filter((dose) => dose.status === 'taken_on_time' || dose.status === 'taken_late');
  const late = todayDoses.filter((dose) => dose.status === 'taken_late');
  const missed = todayDoses.filter((dose) => dose.status === 'missed' || dose.status === 'skipped');
  const adherence = profileMeds.length
    ? Math.round(profileMeds.reduce((sum, medication) => sum + medication.adherence, 0) / profileMeds.length)
    : 0;
  return {
    user: account.user,
    profiles: account.profiles,
    activeProfileId,
    medications: profileMeds,
    doses: profileDoses,
    activities: store.activities.filter((activity) => !activity.profileId || activity.profileId === activeProfileId),
    stats: {
      todayTotal: todayDoses.length,
      todayTaken: taken.length,
      todayLate: late.length,
      todayMissed: missed.length,
      adherence,
      streak: 6,
      lowStockCount: profileMeds.filter((med) => med.stockAmount <= med.lowStockThreshold).length,
    },
    theme: profile?.theme || store.theme,
    notificationSettings: profile?.notificationSettings || defaultNotificationSettings(),
  };
}

function addActivity(
  profileId: string,
  title: string,
  detail: string,
  tone: 'success' | 'warning' | 'neutral' | 'accent',
) {
  store.activities.unshift({
    id: id('activity'),
    profileId,
    title,
    detail,
    time: 'только что',
    tone,
  });
  store.activities = store.activities.slice(0, 12);
}

function toScheduleInput(medication: StoredMedication, profile: StoredProfile) {
  return {
    scheduleType: medication.scheduleType,
    firstDoseTime: medication.timesOfDay[0] || '09:00',
    intervalHours: medication.intervalHours,
    allowNightDoses: medication.allowNightDoses,
    timesOfDay: medication.timesOfDay,
    mealType: medication.mealType,
    mealOffsetMinutes: medication.mealOffsetMinutes,
    wakeTime: profile.wakeTime,
    sleepTime: profile.sleepTime,
    breakfastTime: profile.breakfastTime,
    lunchTime: profile.lunchTime,
    dinnerTime: profile.dinnerTime,
  };
}

function futureDoseTimes(medication: StoredMedication, profile: StoredProfile, days = 14) {
  const rawTimes = generateDoseTimes(toScheduleInput(medication, profile), days);
  if (medication.scheduleType !== 'interval' || medication.allowNightDoses) return rawTimes;
  return rawTimes.map((time) => moveToWakingWindow(time, profile.wakeTime, profile.sleepTime));
}

function accountForProfile(profileId: string) {
  return Object.values(store.accounts).find((account) =>
    account.profiles.some((profile) => profile.id === profileId),
  );
}

function ensureDoseHorizon(medication: StoredMedication) {
  if (medication.status !== 'active' || medication.scheduleType === 'as_needed') return;
  const account = accountForProfile(medication.profileId);
  const profile = account ? getProfile(medication.profileId, account) : undefined;
  if (!profile) return;
  const existing = new Set(
    store.doses
      .filter((dose) => dose.medicationId === medication.id)
      .map((dose) => new Date(dose.scheduledAt).getTime()),
  );
  for (const plannedAt of futureDoseTimes(medication, profile)) {
    if (plannedAt.getTime() < Date.now() - 60_000 || existing.has(plannedAt.getTime())) continue;
    store.doses.push({
      id: id('dose'),
      profileId: medication.profileId,
      medicationId: medication.id,
      medicationName: medication.name,
      medicationColor: medication.color,
      scheduledAt: plannedAt.toISOString(),
      status: 'scheduled',
      doseAmount: medication.doseAmount,
    });
  }
  const nextDose = store.doses
    .filter((dose) => dose.medicationId === medication.id && ['scheduled', 'snoozed', 'rescheduled'].includes(dose.status))
    .sort((left, right) => new Date(left.scheduledAt).getTime() - new Date(right.scheduledAt).getTime())[0];
  medication.nextDoseAt = nextDose?.scheduledAt;
}

function regenerateFutureDoses(medication: StoredMedication, from = new Date()) {
  store.doses = store.doses.map((dose) =>
    dose.medicationId === medication.id &&
    ['scheduled', 'snoozed', 'rescheduled'].includes(dose.status) &&
    new Date(dose.scheduledAt) >= from
      ? { ...dose, status: 'cancelled' as DoseStatus, note: 'Пересчитано после изменения приема' }
      : dose,
  );
  ensureDoseHorizon(medication);
}

function applyReschedulePolicy(
  medication: StoredMedication | undefined,
  dose: StoredDose,
  action: 'take' | 'skip',
) {
  if (!medication || medication.reschedulePolicy === 'none' || medication.reschedulePolicy === 'ask') return;
  if (action === 'skip' && medication.reschedulePolicy !== 'shift_all') return;
  if (medication.reschedulePolicy === 'shift_all' && dose.actualTakenAt) {
    const future = store.doses
      .filter((item) => item.medicationId === medication.id && ['scheduled', 'snoozed', 'rescheduled'].includes(item.status))
      .sort((left, right) => new Date(left.scheduledAt).getTime() - new Date(right.scheduledAt).getTime());
    if (future.length) {
      const delay = new Date(dose.actualTakenAt).getTime() - new Date(dose.scheduledAt).getTime();
      for (const futureDose of future) {
        futureDose.scheduledAt = new Date(new Date(futureDose.scheduledAt).getTime() + delay).toISOString();
        futureDose.status = 'rescheduled';
        futureDose.note = 'Перенесено после задержки';
        futureDose.sentReminderOffsets = [];
        futureDose.atDoseNotificationSentAt = undefined;
        futureDose.notificationSentAt = undefined;
      }
    }
    return;
  }
  if (medication.reschedulePolicy === 'minimum_interval' && dose.actualTakenAt && medication.intervalHours) {
    const minimum = new Date(dose.actualTakenAt).getTime() + medication.intervalHours * 60 * 60 * 1000;
    const next = store.doses
      .filter((item) => item.medicationId === medication.id && ['scheduled', 'snoozed', 'rescheduled'].includes(item.status))
      .sort((left, right) => new Date(left.scheduledAt).getTime() - new Date(right.scheduledAt).getTime())[0];
    if (next && new Date(next.scheduledAt).getTime() < minimum) {
      next.scheduledAt = new Date(minimum).toISOString();
      next.status = 'rescheduled';
      next.note = 'Сохранен минимальный интервал';
      next.sentReminderOffsets = [];
      next.atDoseNotificationSentAt = undefined;
      next.notificationSentAt = undefined;
    }
  }
}

function performDoseAction(doseId: string, body: Record<string, unknown>) {
  const dose = store.doses.find((item) => item.id === doseId);
  if (!dose) return { error: 'Прием не найден', status: 404 };
  const medication = store.medications.find((item) => item.id === dose.medicationId);
  const action = String(body.action || '');
  if (!['take', 'snooze', 'skip', 'reschedule'].includes(action)) {
    return { error: 'Неизвестное действие', status: 400 };
  }
  if (action === 'take') {
    if (dose.status === 'taken_on_time' || dose.status === 'taken_late') return { dose, status: 200 };
    const now = new Date();
    const scheduled = new Date(dose.scheduledAt);
    const delay = Math.max(0, Math.round((now.getTime() - scheduled.getTime()) / 60000));
    dose.actualTakenAt = now.toISOString();
    dose.delayMinutes = delay;
    dose.status = delay > 0 ? 'taken_late' : 'taken_on_time';
    dose.sentReminderOffsets = [];
    dose.atDoseNotificationSentAt = undefined;
    dose.notificationSentAt = undefined;
    if (medication) medication.stockAmount = Math.max(0, medication.stockAmount - dose.doseAmount);
    applyReschedulePolicy(medication, dose, 'take');
    addActivity(
      dose.profileId,
      (medication?.name || 'Лекарство') + ' принят',
      delay ? 'Задержка ' + delay + ' минут' : 'Вовремя',
      delay ? 'warning' : 'success',
    );
  } else if (action === 'snooze') {
    const minutes = Math.max(1, Number(body.minutes || 10));
    dose.status = 'snoozed';
    dose.snoozedUntil = new Date(Date.now() + minutes * 60000).toISOString();
    dose.scheduledAt = dose.snoozedUntil;
    dose.note = 'Отложено на ' + minutes + ' минут';
    dose.sentReminderOffsets = [];
    dose.atDoseNotificationSentAt = undefined;
    dose.notificationSentAt = undefined;
  } else if (action === 'skip') {
    dose.status = 'skipped';
    dose.note = String(body.note || 'Пользователь отметил прием как пропущенный');
    dose.sentReminderOffsets = [];
    dose.atDoseNotificationSentAt = undefined;
    dose.notificationSentAt = undefined;
    applyReschedulePolicy(medication, dose, 'skip');
    addActivity(
      dose.profileId,
      (medication?.name || 'Лекарство') + ' пропущен',
      'Расписание сохранено согласно настройкам',
      'warning',
    );
  } else if (action === 'reschedule') {
    const nextAt = String(body.scheduledAt || dose.scheduledAt);
    if (Number.isNaN(new Date(nextAt).getTime())) return { error: 'Некорректное время', status: 400 };
    dose.scheduledAt = nextAt;
    dose.status = 'rescheduled';
    dose.note = 'Время изменено пользователем';
    dose.sentReminderOffsets = [];
    dose.atDoseNotificationSentAt = undefined;
    dose.notificationSentAt = undefined;
  }
  if (medication) {
    ensureDoseHorizon(medication);
  }
  saveStore();
  return { dose, status: 200 };
}

const app = express();
app.use(cors());
app.use(express.json());

app.get('/api/health', (_req, res) => res.json({ ok: true, service: 'medtrack-api' }));

app.post('/api/auth/telegram', (req, res) => {
  const user = getTelegramUserFromInitData(String(req.body?.initData || ''));
  if (!user) return res.status(401).json({ message: 'Не удалось проверить Telegram-сессию' });
  res.json({ user, mode: demoMode ? 'demo' : 'telegram' });
});

app.get('/api/bootstrap', (req, res) => {
  const context = requireUser(req, res);
  if (!context) return;
  res.json(buildBootstrap(context.account, String(req.query.profileId || '')));
});

app.post('/api/profiles', (req, res) => {
  const context = requireUser(req, res);
  if (!context) return;
  const profile: StoredProfile = {
    id: id('profile'),
    displayName: String(req.body.displayName || 'Новый профиль'),
    type: String(req.body.type || 'other'),
    timezone: String(req.body.timezone || 'Europe/Moscow'),
    wakeTime: String(req.body.wakeTime || '07:30'),
    sleepTime: String(req.body.sleepTime || '23:30'),
    breakfastTime: String(req.body.breakfastTime || '08:30'),
    lunchTime: String(req.body.lunchTime || '13:30'),
    dinnerTime: String(req.body.dinnerTime || '19:30'),
    theme: (req.body.theme || 'dark') as Theme,
    notificationSettings: defaultNotificationSettings(),
    avatarColor: colors[context.account.profiles.length % colors.length],
    role: 'Owner',
    memberCount: 1,
  };
  context.account.profiles.push(profile);
  saveStore();
  res.json(profile);
});

app.patch('/api/profiles/:id', (req, res) => {
  const context = requireUser(req, res);
  if (!context) return;
  const profile = getProfile(req.params.id, context.account);
  if (!profile) return res.status(404).json({ message: 'Профиль не найден' });
  Object.assign(profile, req.body);
  if (Object.prototype.hasOwnProperty.call(req.body, 'notificationSettings')) {
    profile.notificationSettings = normalizeNotificationSettings(req.body.notificationSettings);
  }
  saveStore();
  res.json(profile);
});

app.post('/api/medications', (req, res) => {
  const context = requireUser(req, res);
  if (!context) return;
  const profileId = String(req.body.profileId || context.account.profiles[0]?.id);
  if (!getProfile(profileId, context.account)) return res.status(404).json({ message: 'Профиль не найден' });
  const scheduleType = (req.body.scheduleType || 'fixed') as ScheduleType;
  const medication: StoredMedication = {
    id: id('med'),
    profileId,
    name: String(req.body.name || 'Новое лекарство'),
    form: String(req.body.form || 'Таблетка'),
    dosage: String(req.body.dosage || ''),
    doseAmount: Number(req.body.doseAmount || 1),
    stockAmount: Number(req.body.stockAmount || 0),
    stockUnit: String(req.body.stockUnit || 'таблетки'),
    packageSize: Number(req.body.packageSize || req.body.stockAmount || 0),
    lowStockThreshold: Number(req.body.lowStockThreshold || 5),
    purchaseReminderDays: Number(req.body.purchaseReminderDays || 5),
    intakeCondition: String(req.body.intakeCondition || 'anytime'),
    customInstruction: String(req.body.customInstruction || ''),
    startDate: String(req.body.startDate || new Date().toISOString().slice(0, 10)),
    endDate: req.body.endDate ? String(req.body.endDate) : undefined,
    status: 'active',
    color: String(req.body.color || colors[store.medications.length % colors.length]),
    scheduleType,
    scheduleLabel: String(req.body.scheduleLabel || scheduleLabel(req.body)),
    intervalHours: req.body.intervalHours ? Number(req.body.intervalHours) : undefined,
    allowNightDoses: Boolean(req.body.allowNightDoses),
    timesOfDay: Array.isArray(req.body.timesOfDay) ? req.body.timesOfDay.map(String) : ['09:00'],
    mealType: req.body.mealType,
    mealOffsetMinutes: req.body.mealOffsetMinutes ? Number(req.body.mealOffsetMinutes) : undefined,
    reschedulePolicy: (req.body.reschedulePolicy || 'none') as ReschedulePolicy,
    adherence: 100,
    nextDoseAt: isoAtToday(String(req.body.timesOfDay?.[0] || '09:00')),
  };
  store.medications.push(medication);
  ensureDoseHorizon(medication);
  addActivity(profileId, 'Добавлено лекарство', medication.name, 'accent');
  saveStore();
  res.status(201).json(medication);
});

app.patch('/api/medications/:id', (req, res) => {
  const context = requireUser(req, res);
  if (!context) return;
  const medication = store.medications.find((item) => item.id === req.params.id);
  if (!medication || !getProfile(medication.profileId, context.account)) return res.status(404).json({ message: 'Лекарство не найдено' });
  Object.assign(medication, req.body);
  regenerateFutureDoses(medication);
  saveStore();
  res.json(medication);
});

app.delete('/api/medications/:id', (req, res) => {
  const context = requireUser(req, res);
  if (!context) return;
  const medication = store.medications.find((item) => item.id === req.params.id);
  if (!medication || !getProfile(medication.profileId, context.account)) return res.status(404).json({ message: 'Лекарство не найдено' });
  medication.status = 'archived';
  store.doses = store.doses.map((dose) =>
    dose.medicationId === medication.id && dose.status === 'scheduled'
      ? { ...dose, status: 'cancelled' }
      : dose,
  );
  addActivity(medication.profileId, 'Лекарство архивировано', medication.name, 'neutral');
  saveStore();
  res.json({ ok: true });
});

app.post('/api/medications/:id/restock', (req, res) => {
  const context = requireUser(req, res);
  if (!context) return;
  const medication = store.medications.find((item) => item.id === req.params.id);
  if (!medication || !getProfile(medication.profileId, context.account)) return res.status(404).json({ message: 'Лекарство не найдено' });
  const amount = Math.max(0, Number(req.body.amount || medication.packageSize || 0));
  medication.stockAmount += amount;
  addActivity(
    medication.profileId,
    'Запас пополнен',
    medication.name + ' • +' + amount + ' ' + medication.stockUnit,
    'success',
  );
  saveStore();
  res.json(medication);
});

app.post('/api/medications/:id/take-now', (req, res) => {
  const context = requireUser(req, res);
  if (!context) return;
  const medication = store.medications.find((item) => item.id === req.params.id);
  if (!medication || !getProfile(medication.profileId, context.account)) {
    return res.status(404).json({ message: 'Лекарство не найдено' });
  }
  const dose: StoredDose = {
    id: id('dose'),
    profileId: medication.profileId,
    medicationId: medication.id,
    medicationName: medication.name,
    medicationColor: medication.color,
    scheduledAt: new Date().toISOString(),
    status: 'scheduled',
    doseAmount: medication.doseAmount,
  };
  store.doses.push(dose);
  const result = performDoseAction(dose.id, { action: 'take' });
  if ('error' in result) return res.status(result.status).json({ message: result.error });
  res.status(201).json(result.dose);
});

app.post('/api/doses/:id/action', (req, res) => {
  const context = requireUser(req, res);
  if (!context) return;
  const requestedDose = store.doses.find((item) => item.id === req.params.id);
  if (!requestedDose || !getProfile(requestedDose.profileId, context.account)) {
    return res.status(404).json({ message: 'Прием не найден' });
  }
  const result = performDoseAction(req.params.id, req.body);
  if ('error' in result) return res.status(result.status).json({ message: result.error });
  res.status(result.status).json(result.dose);
});

app.post('/api/schedule/preview', (req, res) => {
  if (!requireUser(req, res)) return;
  res.json(buildSchedulePreview(req.body));
});

app.get('/api/calendar', (req, res) => {
  const context = requireUser(req, res);
  if (!context) return;
  const profileId = profileFromRequest(req, context.account);
  if (!getProfile(profileId, context.account)) return res.status(404).json({ message: 'Профиль не найден' });
  res.json(store.doses.filter((dose) => dose.profileId === profileId));
});

app.get('/api/history', (req, res) => {
  const context = requireUser(req, res);
  if (!context) return;
  const profileId = profileFromRequest(req, context.account);
  if (!getProfile(profileId, context.account)) return res.status(404).json({ message: 'Профиль не найден' });
  res.json(store.doses.filter((dose) => dose.profileId === profileId && dose.status !== 'scheduled'));
});

function requireInternal(req: Request, res: express.Response) {
  const internalToken = process.env.INTERNAL_API_TOKEN;
  if (!internalToken) {
    if (demoMode) return true;
    res.status(503).json({ message: 'Внутренний токен не настроен' });
    return false;
  }
  if (req.header('x-internal-token') !== internalToken) {
    res.status(401).json({ message: 'Нет доступа к внутреннему API' });
    return false;
  }
  return true;
}

app.post('/api/internal/doses/:id/action', (req, res) => {
  if (!requireInternal(req, res)) return;
  const result = performDoseAction(req.params.id, req.body);
  if ('error' in result) return res.status(result.status).json({ message: result.error });
  res.status(result.status).json(result.dose);
});

app.get('/api/internal/due-doses', (req, res) => {
  if (!requireInternal(req, res)) return;
  const now = Date.now();
  const dueWindow = Number(process.env.NOTIFICATION_POLL_WINDOW_MS || 90_000);
  const reminders: Array<Record<string, unknown>> = [];
  for (const dose of store.doses) {
    if (!['scheduled', 'snoozed', 'rescheduled'].includes(dose.status)) continue;
    const medication = store.medications.find((item) => item.id === dose.medicationId);
    const account = accountForProfile(dose.profileId);
    const profile = account ? getProfile(dose.profileId, account) : undefined;
    const chatId = account?.user.telegramId || '';
    if (!profile || !chatId) continue;
    const settings = normalizeNotificationSettings(profile.notificationSettings);
    const targets = findDueNotifications(
      dose.scheduledAt,
      settings,
      dose.sentReminderOffsets,
      Boolean(dose.atDoseNotificationSentAt || dose.notificationSentAt),
      now,
      dueWindow,
    );
    for (const target of targets) {
      reminders.push({
        id: dose.id,
        chatId,
        profileName: profile.displayName,
        medicationName: dose.medicationName,
        doseAmount: dose.doseAmount,
        scheduledAt: dose.scheduledAt,
        timezone: profile.timezone,
        instruction: medication?.customInstruction,
        stockAmount: medication?.stockAmount || 0,
        stockUnit: medication?.stockUnit || 'шт.',
        notificationType: target.kind,
        minutesBefore: target.minutesBefore,
      });
    }
  }
  if (reminders.length) saveStore();
  res.json(reminders);
});

app.post('/api/internal/notifications/:doseId/ack', (req, res) => {
  if (!requireInternal(req, res)) return;
  const dose = store.doses.find((item) => item.id === req.params.doseId);
  if (!dose) return res.status(404).json({ message: 'Прием не найден' });
  const type = String(req.body?.notificationType || 'at_dose');
  if (type === 'advance') {
    const minutesBefore = Number(req.body?.minutesBefore);
    if (Number.isInteger(minutesBefore) && minutesBefore > 0) {
      dose.sentReminderOffsets = [...new Set([...(dose.sentReminderOffsets || []), minutesBefore])];
    }
  } else {
    const sentAt = new Date().toISOString();
    dose.atDoseNotificationSentAt = sentAt;
    dose.notificationSentAt = sentAt;
  }
  saveStore();
  res.json({ ok: true });
});

const frontendPath = path.resolve(process.env.FRONTEND_DIR || path.join(process.cwd(), 'dist'));
if (fs.existsSync(frontendPath)) {
  app.use(express.static(frontendPath));
  app.use((req, res, next) => {
    if (req.method !== 'GET' || req.path.startsWith('/api/')) {
      next();
      return;
    }
    res.sendFile(path.join(frontendPath, 'index.html'));
  });
}

app.listen(port, '0.0.0.0', () => {
  console.log('MedTrack API listening on http://localhost:' + port);
  console.log('MedTrack mode: ' + (demoMode ? 'demo' : 'telegram production'));
  console.log('MedTrack data file: ' + dataPath);
});

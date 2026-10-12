export type ScheduleType = 'fixed' | 'interval' | 'meal' | 'as_needed';

export interface ScheduleInput {
  scheduleType?: ScheduleType | string;
  firstDoseTime?: string;
  intervalHours?: number;
  timesOfDay?: string[];
  allowNightDoses?: boolean;
  wakeTime?: string;
  sleepTime?: string;
  mealType?: 'breakfast' | 'lunch' | 'dinner' | string;
  breakfastTime?: string;
  lunchTime?: string;
  dinnerTime?: string;
  mealOffsetMinutes?: number;
  anchorDate?: string;
}

export interface SchedulePreview {
  dates: string[];
  warnings: string[];
  selectedStrategy: string;
  explanation: string;
}

function clockToMinutes(value: string | undefined, fallback: string) {
  const [hours, minutes] = (value || fallback).split(':').map(Number);
  return (Number.isFinite(hours) ? hours : 0) * 60 + (Number.isFinite(minutes) ? minutes : 0);
}

function dateAtClock(anchor: Date, clock: string) {
  const date = new Date(anchor);
  const [hours, minutes] = clock.split(':').map(Number);
  date.setHours(hours || 0, minutes || 0, 0, 0);
  return date;
}

export function isWithinWakingHours(
  value: Date,
  wakeTime = '07:30',
  sleepTime = '23:30',
) {
  const minute = value.getHours() * 60 + value.getMinutes();
  const wake = clockToMinutes(wakeTime, '07:30');
  const sleep = clockToMinutes(sleepTime, '23:30');
  if (wake === sleep) return true;
  if (wake < sleep) return minute >= wake && minute <= sleep;
  return minute >= wake || minute <= sleep;
}

export function moveToWakingWindow(
  value: Date,
  wakeTime: string,
  sleepTime: string,
) {
  if (isWithinWakingHours(value, wakeTime, sleepTime)) return value;
  const wake = clockToMinutes(wakeTime, '07:30');
  const sleep = clockToMinutes(sleepTime, '23:30');
  const minute = value.getHours() * 60 + value.getMinutes();
  const result = new Date(value);

  if (wake < sleep) {
    if (minute < wake) {
      result.setHours(Math.floor(wake / 60), wake % 60, 0, 0);
    } else {
      result.setDate(result.getDate() + 1);
      result.setHours(Math.floor(wake / 60), wake % 60, 0, 0);
    }
  } else {
    // For a schedule crossing midnight, the nearest valid boundary is sleep.
    result.setHours(Math.floor(sleep / 60), sleep % 60, 0, 0);
  }
  return result;
}

function baseDate(anchorDate?: string) {
  const parsed = anchorDate ? new Date(anchorDate) : new Date();
  return Number.isNaN(parsed.getTime()) ? new Date() : parsed;
}

export function buildSchedulePreview(input: ScheduleInput): SchedulePreview {
  const scheduleType = String(input.scheduleType || 'fixed') as ScheduleType;
  const anchor = baseDate(input.anchorDate);
  const warnings: string[] = [];
  const dates: Date[] = [];
  let selectedStrategy = 'Сохранить заданные времена';
  let explanation = 'Расписание рассчитано по выбранным параметрам.';

  if (scheduleType === 'as_needed') {
    return {
      dates: [],
      warnings: [],
      selectedStrategy: 'Без автоматических напоминаний',
      explanation: 'Прием фиксируется вручную, когда пользователь нажимает «Зафиксировать прием».',
    };
  }

  if (scheduleType === 'interval') {
    const first = dateAtClock(anchor, input.firstDoseTime || '09:00');
    const intervalHours = Math.max(1, Number(input.intervalHours || 6));
    const allowNight = Boolean(input.allowNightDoses);
    for (let index = 0; index < 6; index += 1) {
      const original = new Date(first.getTime() + index * intervalHours * 60 * 60 * 1000);
      if (allowNight) {
        dates.push(original);
      } else {
        const adjusted = moveToWakingWindow(
          original,
          input.wakeTime || '07:30',
          input.sleepTime || '23:30',
        );
        if (adjusted.getTime() !== original.getTime()) {
          warnings.push('Один или несколько приемов попали в тихие часы.');
          selectedStrategy = 'Перенести ночные уведомления в разрешенное окно';
          explanation =
            'Точные интервалы создают ночные уведомления, поэтому система выбрала ближайшее допустимое окно. Этот вариант можно изменить перед сохранением.';
        }
        dates.push(adjusted);
      }
    }
  } else if (scheduleType === 'meal') {
    const mealTimes: Record<string, string> = {
      breakfast: input.breakfastTime || '08:30',
      lunch: input.lunchTime || '13:30',
      dinner: input.dinnerTime || '19:30',
    };
    const mealTime = mealTimes[String(input.mealType || 'breakfast')] || mealTimes.breakfast;
    const dose = dateAtClock(anchor, mealTime);
    dose.setMinutes(dose.getMinutes() + Number(input.mealOffsetMinutes || 0));
    dates.push(dose);
  } else {
    const times = input.timesOfDay?.length ? input.timesOfDay : [input.firstDoseTime || '09:00'];
    for (const time of times) dates.push(dateAtClock(anchor, time));
  }

  return {
    dates: dates.map((date) => date.toISOString()),
    warnings: [...new Set(warnings)],
    selectedStrategy,
    explanation,
  };
}

export function generateDoseTimes(
  input: ScheduleInput,
  days = 14,
  anchorDate?: string,
) {
  const anchor = baseDate(anchorDate || input.anchorDate);
  const scheduleType = String(input.scheduleType || 'fixed') as ScheduleType;
  const result: Date[] = [];

  if (scheduleType === 'as_needed') return result;

  if (scheduleType === 'interval') {
    const intervalHours = Math.max(1, Number(input.intervalHours || 6));
    let current = dateAtClock(anchor, input.firstDoseTime || '09:00');
    const end = new Date(anchor);
    end.setDate(end.getDate() + days);
    while (current <= end) {
      result.push(new Date(current));
      current = new Date(current.getTime() + intervalHours * 60 * 60 * 1000);
    }
    return result;
  }

  for (let day = 0; day < days; day += 1) {
    const date = new Date(anchor);
    date.setDate(date.getDate() + day);
    if (scheduleType === 'meal') {
      const mealTimes: Record<string, string> = {
        breakfast: input.breakfastTime || '08:30',
        lunch: input.lunchTime || '13:30',
        dinner: input.dinnerTime || '19:30',
      };
      const mealTime = mealTimes[String(input.mealType || 'breakfast')] || mealTimes.breakfast;
      const dose = dateAtClock(date, mealTime);
      dose.setMinutes(dose.getMinutes() + Number(input.mealOffsetMinutes || 0));
      result.push(dose);
    } else {
      const times = input.timesOfDay?.length ? input.timesOfDay : [input.firstDoseTime || '09:00'];
      for (const time of times) result.push(dateAtClock(date, time));
    }
  }
  return result;
}

export function scheduleLabel(input: ScheduleInput) {
  const scheduleType = String(input.scheduleType || 'fixed') as ScheduleType;
  if (scheduleType === 'interval') return 'Каждые ' + Math.max(1, Number(input.intervalHours || 6)) + ' ч';
  if (scheduleType === 'meal') {
    const meals: Record<string, string> = { breakfast: 'завтрака', lunch: 'обеда', dinner: 'ужина' };
    return 'Относительно ' + (meals[String(input.mealType || 'breakfast')] || 'еды');
  }
  if (scheduleType === 'as_needed') return 'По необходимости';
  return 'Каждый день • ' + (input.timesOfDay?.join(', ') || input.firstDoseTime || '09:00');
}

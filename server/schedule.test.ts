import { describe, expect, it } from 'vitest';
import {
  buildSchedulePreview,
  generateDoseTimes,
  isWithinWakingHours,
  scheduleLabel,
} from './schedule';

function localClock(value: string) {
  const date = new Date(value);
  return String(date.getHours()).padStart(2, '0') + ':' + String(date.getMinutes()).padStart(2, '0');
}

describe('schedule engine', () => {
  it('keeps a six-hour interval exact when night doses are allowed', () => {
    const result = buildSchedulePreview({
      scheduleType: 'interval',
      firstDoseTime: '08:00',
      intervalHours: 6,
      allowNightDoses: true,
      anchorDate: '2026-10-11T00:00:00.000Z',
    });

    expect(result.dates.map(localClock)).toEqual([
      '08:00',
      '14:00',
      '20:00',
      '02:00',
      '08:00',
      '14:00',
    ]);
    expect(result.warnings).toHaveLength(0);
  });

  it('chooses a waking-hour strategy for a night interval', () => {
    const result = buildSchedulePreview({
      scheduleType: 'interval',
      firstDoseTime: '08:00',
      intervalHours: 6,
      allowNightDoses: false,
      wakeTime: '07:30',
      sleepTime: '23:30',
      anchorDate: '2026-10-11T00:00:00.000Z',
    });

    expect(result.warnings.length).toBeGreaterThan(0);
    expect(result.selectedStrategy).toContain('разрешенное окно');
    expect(result.dates.every((date) => !['02:00'].includes(localClock(date)))).toBe(true);
  });

  it('calculates a meal offset', () => {
    const result = buildSchedulePreview({
      scheduleType: 'meal',
      mealType: 'lunch',
      lunchTime: '13:30',
      mealOffsetMinutes: 20,
      anchorDate: '2026-10-11T00:00:00.000Z',
    });

    expect(localClock(result.dates[0])).toBe('13:50');
  });

  it('generates multiple days for a fixed schedule', () => {
    const result = generateDoseTimes(
      { scheduleType: 'fixed', timesOfDay: ['09:00', '21:00'] },
      2,
      '2026-10-11T00:00:00.000Z',
    );
    expect(result).toHaveLength(4);
  });

  it('handles waking hours that cross midnight', () => {
    expect(isWithinWakingHours(new Date('2026-10-11T01:00:00.000Z'), '22:00', '06:00')).toBe(true);
    expect(isWithinWakingHours(new Date('2026-10-11T12:00:00.000Z'), '22:00', '06:00')).toBe(false);
  });

  it('creates human-readable labels', () => {
    expect(scheduleLabel({ scheduleType: 'interval', intervalHours: 6 })).toBe('Каждые 6 ч');
    expect(scheduleLabel({ scheduleType: 'as_needed' })).toBe('По необходимости');
  });
});

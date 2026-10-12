import 'dotenv/config';
import { advanceDoseKeyboard, doseKeyboard } from './telegram-ui.js';
import { notificationLeadText } from './notifications.js';

const token = process.env.TELEGRAM_BOT_TOKEN;
const apiBaseUrl = process.env.API_BASE_URL || 'http://localhost:' + (process.env.PORT || process.env.API_PORT || '4000');

async function sendTelegram(chatId: string, text: string, replyMarkup: Record<string, unknown>) {
  if (!token) return;
  const response = await fetch('https://api.telegram.org/bot' + token + '/sendMessage', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, text, reply_markup: replyMarkup }),
  });
  if (!response.ok) throw new Error('Telegram sendMessage failed: ' + response.status);
  const payload = (await response.json()) as { ok?: boolean; description?: string };
  if (!payload.ok) throw new Error('Telegram sendMessage failed: ' + (payload.description || 'unknown error'));
}

async function checkDueDoses() {
  if (!token) return;
  const response = await fetch(apiBaseUrl + '/api/internal/due-doses', {
    headers: { 'x-internal-token': process.env.INTERNAL_API_TOKEN || '' },
  });
  if (!response.ok) return;

  const doses = (await response.json()) as Array<{
    id: string;
    chatId: string;
    profileName: string;
    medicationName: string;
    doseAmount: number;
    scheduledAt: string;
    instruction?: string;
    stockAmount: number;
    stockUnit: string;
    notificationType: 'advance' | 'at_dose';
    minutesBefore: number;
  }>;

  for (const dose of doses) {
    try {
      const time = new Intl.DateTimeFormat('ru-RU', {
        hour: '2-digit',
        minute: '2-digit',
      }).format(new Date(dose.scheduledAt));
      const isAdvance = dose.notificationType === 'advance';
      await sendTelegram(
        dose.chatId,
        (isAdvance ? 'Напоминание\n\n' + notificationLeadText(dose.minutesBefore) : 'Время приема') +
          '\n\nПрофиль: ' +
          dose.profileName +
          '\nЛекарство: ' +
          dose.medicationName +
          '\nДоза: ' +
          dose.doseAmount +
          '\nПлановое время: ' +
          time +
          (dose.instruction ? '\n' + dose.instruction : '') +
          '\nОсталось: ' +
          dose.stockAmount +
          ' ' +
          dose.stockUnit,
        isAdvance ? advanceDoseKeyboard() : doseKeyboard(dose.id),
      );
      await fetch(apiBaseUrl + '/api/internal/notifications/' + dose.id + '/ack', {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-internal-token': process.env.INTERNAL_API_TOKEN || '' },
        body: JSON.stringify({ notificationType: dose.notificationType, minutesBefore: dose.minutesBefore }),
      });
    } catch (error) {
      console.error('Notification send error:', error instanceof Error ? error.message : error);
    }
  }
}

if (!token) {
  console.log('Notification worker is waiting for TELEGRAM_BOT_TOKEN.');
} else {
  console.log('MedTrack notification worker started.');
  void checkDueDoses();
  setInterval(() => void checkDueDoses(), 60_000);
}

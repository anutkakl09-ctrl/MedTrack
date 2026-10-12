import 'dotenv/config';

const token = process.env.TELEGRAM_BOT_TOKEN;
const miniAppUrl = process.env.MINI_APP_URL || 'http://localhost:3000';
const apiBaseUrl = process.env.API_BASE_URL || 'http://localhost:' + (process.env.PORT || process.env.API_PORT || '4000');

type TelegramUpdate = {
  update_id: number;
  message?: { chat: { id: number }; from?: { id: number; first_name: string }; text?: string };
  callback_query?: {
    id: string;
    data?: string;
    from: { id: number };
    message?: { chat: { id: number }; message_id: number };
  };
};

async function telegram(method: string, body: Record<string, unknown>) {
  if (!token) return null;
  const response = await fetch('https://api.telegram.org/bot' + token + '/' + method, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!response.ok) throw new Error('Telegram API ' + method + ' failed: ' + response.status);
  return response.json() as Promise<{ ok: boolean; result: unknown }>;
}

function appKeyboard() {
  return { inline_keyboard: [[{ text: 'Открыть приложение', web_app: { url: miniAppUrl } }]] };
}

function doseKeyboard(doseId: string) {
  return {
    inline_keyboard: [
      [
        { text: '✅ Принял/а', callback_data: 'take:' + doseId },
        { text: '❌ Нет', callback_data: 'skip:' + doseId },
      ],
    ],
  };
}

async function sendStart(chatId: number, firstName = 'друг') {
  await telegram('sendMessage', {
    chat_id: chatId,
    text: 'Привет, ' + firstName + '!\n\nMedTrack поможет вести расписание лекарств, отмечать приемы и следить за остатком. Настройка выполняется в Mini App, а напоминания приходят сюда.',
    reply_markup: appKeyboard(),
  });
}

async function handleCallback(query: NonNullable<TelegramUpdate['callback_query']>) {
  const [action, maybeMinutes, maybeDoseId] = String(query.data || '').split(':');
  const doseId = action === 'snooze' ? maybeDoseId : maybeMinutes;
  if (!doseId) {
    await telegram('answerCallbackQuery', { callback_query_id: query.id, text: 'Не удалось определить прием' });
    return;
  }
  const body = action === 'snooze' ? { action: 'snooze', minutes: Number(maybeMinutes || 10) } : { action };
  const response = await fetch(apiBaseUrl + '/api/internal/doses/' + doseId + '/action', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-internal-token': process.env.INTERNAL_API_TOKEN || '' },
    body: JSON.stringify(body),
  });
  const payload = (await response.json().catch(() => ({}))) as { message?: string; delayMinutes?: number };
  if (!response.ok) {
    await telegram('answerCallbackQuery', { callback_query_id: query.id, text: payload.message || 'Действие недоступно', show_alert: true });
    return;
  }
  const text = action === 'take'
    ? 'Прием отмечен' + (payload.delayMinutes ? '. Задержка: ' + payload.delayMinutes + ' мин.' : ' вовремя.')
    : action === 'snooze'
      ? 'Напоминание отложено на ' + maybeMinutes + ' минут.'
      : 'Прием отмечен как пропущенный.';
  await telegram('answerCallbackQuery', { callback_query_id: query.id, text });
  if (query.message) {
    await telegram('editMessageReplyMarkup', {
      chat_id: query.message.chat.id,
      message_id: query.message.message_id,
      reply_markup: appKeyboard(),
    }).catch(() => null);
  }
}

async function longPoll() {
  if (!token) {
    console.log('Telegram bot is waiting for TELEGRAM_BOT_TOKEN. Mini App demo mode remains available.');
    return;
  }
  console.log('MedTrack bot started in long-polling mode.');
  let offset = 0;
  while (true) {
    try {
      const response = await fetch('https://api.telegram.org/bot' + token + '/getUpdates?timeout=45&allowed_updates=' + encodeURIComponent(JSON.stringify(['message', 'callback_query'])) + '&offset=' + offset);
      const data = (await response.json()) as { ok: boolean; result: TelegramUpdate[] };
      if (!data.ok) throw new Error('getUpdates failed');
      for (const update of data.result) {
        offset = update.update_id + 1;
        if (update.message?.text === '/start') await sendStart(update.message.chat.id, update.message.from?.first_name);
        if (update.message?.text === '/app') await telegram('sendMessage', { chat_id: update.message.chat.id, text: 'Открываю MedTrack.', reply_markup: appKeyboard() });
        if (update.callback_query) await handleCallback(update.callback_query);
      }
    } catch (error) {
      console.error('Bot polling error', error instanceof Error ? error.message : error);
      await new Promise((resolve) => setTimeout(resolve, 5000));
    }
  }
}

void longPoll();

export { doseKeyboard };

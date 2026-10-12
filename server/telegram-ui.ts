export const miniAppUrl = process.env.MINI_APP_URL || 'http://localhost:3000';

export function appKeyboard() {
  return {
    inline_keyboard: [[{ text: 'Открыть приложение', web_app: { url: miniAppUrl } }]],
  };
}

export function doseKeyboard(doseId: string) {
  return {
    inline_keyboard: [
      [
        { text: '✅ Принял/а', callback_data: 'take:' + doseId },
        { text: '❌ Нет', callback_data: 'skip:' + doseId },
      ],
    ],
  };
}

export function advanceDoseKeyboard() {
  return appKeyboard();
}

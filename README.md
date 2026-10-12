# MedTrack

Telegram Mini App для учета лекарств: Mini App управляет профилями, лекарствами, запасом, календарем и историей; Telegram-бот отправляет напоминания и принимает быстрые действия.

## Реализованный MVP

- вход через Telegram WebApp initData, без самостоятельной регистрации и PIN;
- локальный DEMO_MODE, чтобы интерфейс можно было открыть без бота и базы;
- несколько профилей пациентов;
- добавление лекарств и учет остатка;
- фиксированное время, прием через интервал, относительно еды и по необходимости;
- предпросмотр расписания с обработкой ночных приемов;
- действия «Принял», «Отложить», «Пропустить», «Изменить время»;
- журнал приемов и календарь;
- темная, светлая и системная темы;
- Telegram long-polling bot и worker уведомлений;
- уведомления за 1 час, 30 минут и 5 минут до приема с настройкой отключения и собственных интервалов;
- тесты движка расписаний.

## Локальный запуск

Нужны Node.js 20+ и npm 10+.

```powershell
npm install
Copy-Item .env.example .env
npm run dev
```

После запуска откройте http://localhost:3000. В браузере включается demo-режим с локальным JSON-хранилищем в data/store.json.

Отдельно можно запустить:

```powershell
npm run dev:api
npm run dev:web
npm run dev:bot
npm run dev:worker
```

Для production API запускается через `server/index.ts`, а единая точка входа для хостинга с одним процессом — `index.js`. Он собирает frontend при необходимости и запускает API, bot и worker. При раздельных процессах используйте `npm run start:api`, `npm run start:bot` и `npm run start:worker`.

## Проверки

```powershell
npm run typecheck
npm test
npm run build
```

## Подключение Telegram

1. Создайте бота через BotFather и укажите токен в TELEGRAM_BOT_TOKEN.
2. Разместите frontend на публичном HTTPS URL.
3. Укажите этот URL в MINI_APP_URL и настройте Menu Button в BotFather.
4. Укажите публичный URL API в API_BASE_URL.
5. Выключите DEMO_MODE и задайте сложный INTERNAL_API_TOKEN.
6. Запустите API, bot и worker отдельными процессами.

По умолчанию профиль получает предварительные уведомления за 60, 30 и 5 минут, а также уведомление в момент приема. Эти интервалы можно изменить или отключить в разделе «Настройки → Уведомления» Mini App. Worker проверяет расписание каждую минуту; `NOTIFICATION_POLL_WINDOW_MS` задает допустимое окно отправки.

В production backend проверяет подпись Telegram initData по HMAC. Mini App передает initData в заголовке x-telegram-init-data; Telegram ID из браузера не считается источником истины.

## Production-запуск

В production обязательно задайте `DEMO_MODE=false`. В этом режиме тестовый профиль не используется: новый пользователь определяется по Telegram initData, а данные сохраняются в `DATA_DIR/store.json`. Каталог `DATA_DIR` должен быть постоянным диском хостинга или подключенным volume.

```env
NODE_ENV=production
DEMO_MODE=false
PORT=3000
API_BASE_URL=https://bot-1791821989-5814-pharmagot.bothost.tech
MINI_APP_URL=https://bot-1791821989-5814-pharmagot.bothost.tech
VITE_API_URL=https://bot-1791821989-5814-pharmagot.bothost.tech
TELEGRAM_BOT_TOKEN=получить_новый_токен_через_BotFather
INTERNAL_API_TOKEN=длинный_случайный_секрет
DATA_DIR=/app/data
```

Если хостинг поддерживает только один web-процесс, команда `npm start` собирает Mini App, поднимает API и раздает собранный frontend из `dist`. Она также запускает bot и worker через `server/all.ts`. Если Bothost запускает главный файл напрямую, указывайте `index.js`: он автоматически выполнит `npm run build:web`, если `dist/index.html` еще нет, а затем запустит API, bot и worker. `eslint.config.js` главным файлом быть не должен. На Bothost укажите внутренний порт `3000`, переменную `PORT=3000` и включите запуск через `Dockerfile` либо главный файл `index.js`. На хостинге с отдельными процессами используйте `npm run start:api`, `npm run start:bot` и `npm run start:worker`, но там `MINI_APP_URL` и `INTERNAL_API_TOKEN` нужно задать вручную.

Проект является Node.js/TypeScript-приложением, поэтому `requirements.txt` не используется. Для Docker уже добавлен `Dockerfile`: сборка выполняется через `npm ci` и `npm run build`, запуск контейнера — через `npm run start:all`.

Проверка доступности: `GET /api/health`. После запуска отправьте боту `/start`, затем откройте Mini App и создайте профиль. Пока пользователь не создал профиль, production-приложение покажет экран первичной настройки, а не демо-данные.

## Ограничение текущего MVP

Для текущего MVP данные хранятся в JSON-файле, поэтому на хостинге нужен постоянный диск. Перед масштабированием на нескольких экземплярах необходимо заменить JSON-хранилище на PostgreSQL и добавить Redis/BullMQ для очереди.

MedTrack организует расписание и фиксирует приемы, но не заменяет назначения врача.

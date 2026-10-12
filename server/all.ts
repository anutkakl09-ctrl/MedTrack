import crypto from 'node:crypto';

const bothostAppUrl = 'https://bot-1791821989-5814-pharmagot.bothost.tech';

// The single-container deployment shares one process, so these defaults keep it bootable
// when the hosting panel does not expose optional environment variables.
process.env.PORT ||= '3000';
process.env.API_PORT ||= process.env.PORT;
process.env.API_BASE_URL ||= bothostAppUrl;
process.env.MINI_APP_URL ||= bothostAppUrl;
process.env.INTERNAL_API_TOKEN ||= crypto.randomBytes(32).toString('hex');

await import('./index.js');
await import('./bot.js');
await import('./worker.js');

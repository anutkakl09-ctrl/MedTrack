import crypto from 'node:crypto';

// The single-container deployment shares one process, so these defaults keep it bootable
// when the hosting panel does not expose optional environment variables.
process.env.MINI_APP_URL ||= 'https://bot-1791820781-9432-pharmagot.bothost.tech';
process.env.INTERNAL_API_TOKEN ||= crypto.randomBytes(32).toString('hex');

await import('./index.js');
await import('./bot.js');
await import('./worker.js');

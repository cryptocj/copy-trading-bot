import dotenv from 'dotenv';

dotenv.config({ path: '../../.env' });

export const config = {
  telegram: {
    botToken: process.env.TELEGRAM_BOT_TOKEN || '',
  },
  database: {
    url: process.env.DATABASE_URL || '',
  },
  redis: {
    url: process.env.REDIS_URL,
  },
} as const;

// Validate required config
if (!config.telegram.botToken) {
  throw new Error('TELEGRAM_BOT_TOKEN is required');
}

if (!config.database.url) {
  throw new Error('DATABASE_URL is required');
}

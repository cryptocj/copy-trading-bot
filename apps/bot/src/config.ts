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

/**
 * Validate configuration at startup
 * Fails fast with clear error messages if config is invalid
 */
export function validateConfig() {
  // Check bot token exists
  if (!config.telegram.botToken) {
    throw new Error('TELEGRAM_BOT_TOKEN not found in environment');
  }

  // Validate bot token format (digits:alphanumeric)
  if (!/^\d+:[A-Za-z0-9_-]+$/.test(config.telegram.botToken)) {
    throw new Error('TELEGRAM_BOT_TOKEN has invalid format');
  }

  // Check database URL exists
  if (!config.database.url) {
    throw new Error('DATABASE_URL not found in environment');
  }

  return config;
}

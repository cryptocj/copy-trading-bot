import { Bot } from 'grammy';
import { config } from './config.js';

// Create bot instance
const bot = new Bot(config.telegram.botToken);

// Register handlers
bot.command('start', (ctx) => {
  return ctx.reply('Welcome to Signal Tracker Bot! 🚀\n\nI will monitor crypto trading signals.');
});

bot.command('status', (ctx) => {
  return ctx.reply('Bot is running! ✅');
});

// Listen to all messages (for signal parsing)
bot.on('message:text', async (ctx) => {
  const text = ctx.message.text;
  console.log(`Received message from ${ctx.chat.id}:`, text);

  // TODO: Parse and process signals
});

// Error handling
bot.catch((err) => {
  console.error('Bot error:', err);
});

// Start bot
console.log('Starting Signal Tracker Bot...');
bot.start();

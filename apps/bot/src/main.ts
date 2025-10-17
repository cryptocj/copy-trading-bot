import { Bot } from 'grammy';
import { validateConfig } from './config.js';
import { detectSignal } from './handlers/messages.js';

async function main() {
  try {
    // Validate configuration before bot initialization
    const config = validateConfig();
    console.log('✅ Configuration validated');

    // Create bot instance
    const bot = new Bot(config.telegram.botToken);

    // Register global error handler first
    bot.catch((err) => {
      console.error('❌ Bot error:', err);
    });

    // Register handlers
    bot.command('start', (ctx) => {
      return ctx.reply('Welcome to Signal Tracker Bot! 🚀\n\nI will monitor crypto trading signals.');
    });

    bot.command('status', (ctx) => {
      const response = [
        'Bot Status: Online ✅',
        `Chat ID: ${ctx.chat.id}`,
        `Chat Type: ${ctx.chat.type}`,
        `Chat Title: ${ctx.chat.title || 'N/A'}`
      ].join('\n');
      return ctx.reply(response);
    });

    // Listen to all messages (for signal parsing)
    bot.on('message:text', async (ctx) => {
      const messageText = ctx.message.text;

      // Detect if message contains a signal
      const detection = detectSignal(messageText);

      // Base log structure
      const log = {
        timestamp: new Date().toISOString(),
        chatId: ctx.chat.id,
        chatTitle: ctx.chat.title || 'Private',
        messageId: ctx.message.message_id,
        from: ctx.from?.username,
        text: messageText
      };

      if (detection.isSignal) {
        // Signal detected - use special log format
        console.log('SIGNAL DETECTED:', JSON.stringify({
          ...log,
          confidence: detection.confidence,
          matchedPatterns: detection.matchedPatterns
        }));
      } else {
        // Regular message - standard log format
        console.log('MESSAGE:', JSON.stringify(log));
      }

      // TODO: Parse and store signals (US3)
    });

    // Start bot
    console.log('🚀 Starting Signal Tracker Bot...');
    console.log('Bot is running! Listening for messages...');

    await bot.start();
  } catch (error) {
    console.error('❌ Failed to start bot:', error);
    process.exit(1);
  }
}

main();

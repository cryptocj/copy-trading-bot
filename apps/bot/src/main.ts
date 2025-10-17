import { Bot } from 'grammy';
import { validateConfig } from './config.js';
import { detectSignal } from './handlers/messages.js';
import { parseSignal } from './parsers/signal-parser.js';
import {
  storeSignal,
  storeUnparseableSignal,
  getGroupByTelegramId,
} from './services/signal-service.js';

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
      return ctx.reply(
        'Welcome to Signal Tracker Bot! 🚀\n\nI will monitor crypto trading signals.'
      );
    });

    bot.command('status', (ctx) => {
      const response = [
        'Bot Status: Online ✅',
        `Chat ID: ${ctx.chat.id}`,
        `Chat Type: ${ctx.chat.type}`,
        `Chat Title: ${ctx.chat.title || 'N/A'}`,
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
        text: messageText,
      };

      if (detection.isSignal) {
        // Signal detected - use special log format
        console.log(
          'SIGNAL DETECTED:',
          JSON.stringify({
            ...log,
            confidence: detection.confidence,
            matchedPatterns: detection.matchedPatterns,
          })
        );

        // Parse and store signal (US3)
        const telegramId = ctx.chat.id.toString();
        const group = await getGroupByTelegramId(telegramId);

        if (!group) {
          console.error(`⚠️ Signal from unknown group: ${telegramId} (${ctx.chat.title})`);
          return;
        }

        // Parse signal
        const parsed = parseSignal(messageText, group.id, group.name, ctx.message.message_id);

        if (parsed.success) {
          // Store parsed signal
          const stored = await storeSignal(parsed);
          if (stored) {
            console.log(`✅ Signal stored: ${stored.id} (${stored.symbol} ${stored.direction})`);
          } else {
            console.error('❌ Failed to store parsed signal');
          }
        } else {
          // Parsing failed - store raw message for manual review
          const stored = await storeUnparseableSignal(
            messageText,
            group.id,
            ctx.message.message_id,
            parsed.error || 'Unknown parsing error'
          );
          if (stored) {
            console.log(`⚠️ Unparseable signal stored: ${stored.id}`);
          } else {
            console.error('❌ Failed to store unparseable signal');
          }
        }
      } else {
        // Regular message - standard log format
        console.log('MESSAGE:', JSON.stringify(log));
      }
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

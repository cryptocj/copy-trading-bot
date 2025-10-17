# Research: Signal Collection (User Story 1)

**Feature**: Bot Registration and Connection
**Date**: 2025-10-17
**Scope**: User Story 1 - Establish bot infrastructure and connect to test groups

## Research Questions & Decisions

### 1. Telegram Bot Registration Process

**Question**: What is the complete workflow for registering a Telegram bot and obtaining credentials?

**Decision**: Use @BotFather (Telegram's official bot creation tool)

**Rationale**:
- @BotFather is Telegram's official, well-documented bot registration service
- Provides instant bot token generation
- Zero cost for development and production use
- Supports all bot features needed for signal tracking

**Implementation Steps**:
1. Open Telegram and search for "@BotFather"
2. Send `/newbot` command
3. Provide bot name (e.g., "Signal Tracker Bot")
4. Provide bot username (must end with "bot", e.g., "signal_tracker_bot")
5. Receive bot token in format: `1234567890:ABCdefGHIjklMNOpqrsTUVwxyz`
6. Store token in `.env` file as `TELEGRAM_BOT_TOKEN`

**Alternatives Considered**:
- Telegram Bot API self-hosting: Rejected - unnecessary complexity for MVP
- Third-party bot services: Rejected - adds dependencies and costs

### 2. grammY Framework Bot Connection Pattern

**Question**: What is the correct pattern for initializing and maintaining a stable grammY bot connection?

**Decision**: Use grammY's long-polling mode with built-in error handling

**Rationale**:
- Long-polling is simpler than webhooks (no HTTPS/domain required)
- grammY handles reconnection automatically
- Built-in error catching via `bot.catch()`
- Suitable for development and small-scale production

**Best Practices**:
```typescript
import { Bot } from 'grammy';

const bot = new Bot(process.env.TELEGRAM_BOT_TOKEN);

// Register error handler first
bot.catch((err) => {
  console.error('Bot error:', err);
});

// Then register message handlers
bot.command('start', (ctx) => ctx.reply('Bot online'));

// Start bot (automatically handles reconnection)
bot.start();
```

**Key Patterns**:
- Always register `bot.catch()` before `bot.start()`
- Use `bot.start()` not `bot.run()` for simple long-polling
- Bot automatically reconnects on transient errors
- Process doesn't exit on Telegram API errors

**Alternatives Considered**:
- Webhooks: Rejected - requires HTTPS endpoint, added complexity
- Manual polling with `bot.run()`: Rejected - long-polling simpler for MVP
- Custom reconnection logic: Rejected - grammY handles this

### 3. Environment Configuration Validation

**Question**: How should we validate the bot token at startup to provide clear error messages?

**Decision**: Implement startup validation in `config.ts` with early failure

**Rationale**:
- Fail fast if token missing or invalid (better than runtime errors)
- Clear error messages guide user to fix configuration
- Validates token format before attempting connection

**Validation Strategy**:
```typescript
// config.ts
export function validateConfig() {
  const token = process.env.TELEGRAM_BOT_TOKEN;

  if (!token) {
    throw new Error('TELEGRAM_BOT_TOKEN not found in environment');
  }

  // Telegram tokens format: digits:alphanumeric
  if (!/^\d+:[A-Za-z0-9_-]+$/.test(token)) {
    throw new Error('TELEGRAM_BOT_TOKEN has invalid format');
  }

  return { botToken: token };
}
```

**Alternatives Considered**:
- Skip validation: Rejected - leads to confusing errors
- Validate by attempting connection: Rejected - slower, less clear errors
- Use Zod schema: Rejected - overkill for single environment variable

### 4. Group Message Access Permissions

**Question**: What permissions does the bot need to read messages in Telegram groups?

**Decision**: Bot must be added as member with default permissions

**Rationale**:
- Telegram bots can read all messages when added to groups (default behavior)
- No special "privacy mode" required for signal tracking use case
- Group admins must explicitly add the bot (security by design)

**Group Setup Steps**:
1. Bot must be added to group by admin
2. Bot automatically has read access to all messages
3. Bot can respond to commands and mentions
4. No additional API configuration needed

**Privacy Mode Note**:
- By default, bots see all messages (good for our use case)
- Privacy mode can be disabled via @BotFather if needed
- Current implementation assumes privacy mode is OFF (default for new bots)

**Alternatives Considered**:
- Request admin permissions: Rejected - unnecessary, adds friction
- Use privacy mode: Rejected - would only see @mentions, missing signals

### 5. Message Logging Strategy

**Question**: How should we log incoming messages for debugging without storing full message history?

**Decision**: Console logging with structured format, no database storage in US1

**Rationale**:
- Console logs sufficient for MVP development debugging
- Defer database storage until signal parsing implemented (US3)
- Structured logging format enables easy parsing if needed later

**Logging Format**:
```typescript
bot.on('message:text', async (ctx) => {
  const log = {
    timestamp: new Date().toISOString(),
    chatId: ctx.chat.id,
    chatTitle: ctx.chat.title,
    messageId: ctx.message.message_id,
    from: ctx.from?.username,
    text: ctx.message.text
  };

  console.log('MESSAGE:', JSON.stringify(log));
});
```

**Alternatives Considered**:
- File logging: Rejected - adds complexity, rotation issues
- Database logging: Rejected - deferred to US3 with signal storage
- Structured logging library (Winston/Pino): Rejected - overkill for MVP

### 6. Connection Status Verification

**Question**: How can we verify the bot is connected and receiving messages from all 3 groups?

**Decision**: Implement `/status` command with connection check

**Rationale**:
- Provides immediate feedback that bot is online
- Simple to test manually (send `/status` in each group)
- Can be enhanced later with uptime/message count metrics

**Status Command Implementation**:
```typescript
bot.command('status', (ctx) => {
  const response = [
    'Bot Status: Online ✅',
    `Chat ID: ${ctx.chat.id}`,
    `Chat Type: ${ctx.chat.type}`,
    `Chat Title: ${ctx.chat.title || 'N/A'}`
  ].join('\n');

  return ctx.reply(response);
});
```

**Manual Testing Workflow**:
1. Start bot: `pnpm --filter @signal-tracker/bot dev`
2. Send `/start` in private chat → verify bot responds
3. Add bot to Evening Trader group → send `/status` → verify response
4. Add bot to Wolf of Trading group → send `/status` → verify response
5. Add bot to Binance Killers group → send `/status` → verify response
6. Send test message in each group → verify console log appears

**Alternatives Considered**:
- Heartbeat pings: Rejected - unnecessary for MVP
- Database connection tracking: Rejected - deferred to later phase
- Prometheus metrics: Rejected - premature optimization

## Technical Decisions Summary

| Decision Area | Choice | Rationale |
|---------------|--------|-----------|
| Bot Registration | @BotFather | Official, free, instant |
| Connection Mode | Long-polling | Simpler than webhooks for MVP |
| Framework Usage | grammY 1.27+ | Already in dependencies, active community |
| Error Handling | Built-in grammY + try-catch | Sufficient for MVP, auto-reconnects |
| Config Validation | Early validation in config.ts | Fail fast with clear errors |
| Group Permissions | Default member access | Reads all messages, no special setup |
| Message Logging | Console with structured JSON | Sufficient for debugging MVP |
| Status Verification | /status command | Simple manual testing workflow |

## Implementation Readiness

✅ All research questions resolved with clear decisions
✅ No blocking unknowns remaining
✅ Implementation patterns identified and documented
✅ Manual testing workflow defined
✅ Ready to proceed to Phase 1 (Design & Contracts)

## References

- [grammY Documentation](https://grammy.dev/guide/getting-started.html)
- [Telegram Bot API](https://core.telegram.org/bots/api)
- [BotFather Commands](https://core.telegram.org/bots#botfather)

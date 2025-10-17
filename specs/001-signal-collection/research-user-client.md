# Research: Telegram User Client Implementation (Alternative to Bot)

**Date**: 2025-10-17
**Purpose**: Evaluate using Telegram user account (MTProto Client API) instead of Bot API

## Executive Summary

**Recommendation for MVP**: ⚠️ **Stick with Bot API** (current approach)

**Reasoning**:

- Bot API is simpler and officially designed for automation
- User client adds authentication complexity (phone codes, session management)
- For MVP, create test groups where you're admin (removes blocker)
- User client can be added in Phase 2 if needed for real signal groups

## User Client vs Bot Comparison

### Authentication

**Bot API** (Current):

```typescript
const bot = new Bot(process.env.TELEGRAM_BOT_TOKEN);
// Done - single token, instant start
```

**User Client** (GramJS):

```typescript
const client = new TelegramClient(session, apiId, apiHash, {});
await client.start({
  phoneNumber: async () => '+1234567890',
  phoneCode: async () => {
    // User must enter SMS code
    // Blocks startup, needs input mechanism
    return await promptUser('Enter code:');
  },
  password: async () => '2fa_password',
});
// Complex - phone, code, 2FA, session persistence
```

### Group Access

| Scenario              | Bot API                | User Client API            |
| --------------------- | ---------------------- | -------------------------- |
| Join public group     | ❌ Need admin          | ✅ Join directly           |
| Join private group    | ❌ Need admin + invite | ✅ If you have invite link |
| Read current messages | ✅ After added         | ✅ After joining           |
| Read message history  | ❌ No                  | ✅ Yes                     |
| Permissions required  | Admin must add         | You join as member         |

### Implementation Complexity

**Bot API**: ⭐⭐☆☆☆ (Simple)

- Single token authentication
- Stateless (no session management)
- Clear error messages
- Well-documented grammY framework
- No phone number required

**User Client API**: ⭐⭐⭐⭐⭐ (Complex)

- Multi-step authentication (phone → code → 2FA)
- Session string persistence required
- First-run requires user interaction
- More error modes (rate limits, flood waits)
- Larger API surface area

## GramJS Implementation Details

### Installation

```bash
# In your project root
pnpm add telegram
pnpm add -D @types/node
```

### Environment Variables

```bash
# .env (add these to .env.example)
TELEGRAM_API_ID=12345  # From https://my.telegram.org/apps
TELEGRAM_API_HASH=abcdef1234567890  # From https://my.telegram.org/apps
TELEGRAM_PHONE=+1234567890  # Your phone number
TELEGRAM_PASSWORD=your_2fa_password  # If 2FA enabled
TELEGRAM_SESSION=  # Empty first run, saved after authentication
```

### Getting API Credentials

1. Visit: https://my.telegram.org/apps
2. Login with your Telegram account
3. Click "API Development Tools"
4. Fill form:
   - App title: "Signal Tracker"
   - Short name: "signal-tracker"
   - Platform: "Other"
5. Get `api_id` (number) and `api_hash` (hex string)

### Code Structure

```typescript
// apps/user-client/src/main.ts
import { TelegramClient } from 'telegram';
import { StringSession } from 'telegram/sessions';
import { NewMessage } from 'telegram/events';
import * as readline from 'readline';

// Helper for interactive code input
function input(prompt: string): Promise<string> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise((resolve) => {
    rl.question(prompt, (answer) => {
      rl.close();
      resolve(answer);
    });
  });
}

async function main() {
  const apiId = parseInt(process.env.TELEGRAM_API_ID!);
  const apiHash = process.env.TELEGRAM_API_HASH!;
  const sessionString = process.env.TELEGRAM_SESSION || '';

  const client = new TelegramClient(new StringSession(sessionString), apiId, apiHash, {
    connectionRetries: 5,
  });

  console.log('Connecting to Telegram...');

  await client.start({
    phoneNumber: async () => process.env.TELEGRAM_PHONE!,
    password: async () => process.env.TELEGRAM_PASSWORD || '',
    phoneCode: async () => {
      // First run: user must enter SMS code
      return await input('Enter the code you received: ');
    },
    onError: (err) => console.error('Auth error:', err),
  });

  console.log('Connected! Session:', client.session.save());
  console.log('Save this session string to TELEGRAM_SESSION in .env');

  // Monitor messages
  client.addEventHandler(async (event) => {
    if (event.message && event.message.text) {
      const chat = await event.message.getChat();

      console.log('MESSAGE:', {
        timestamp: new Date().toISOString(),
        chatId: event.message.chatId.toString(),
        chatTitle: chat.title || 'Private',
        messageId: event.message.id,
        text: event.message.text,
      });
    }
  }, new NewMessage({}));

  console.log('Monitoring messages...');
}

main().catch(console.error);
```

### Session Persistence

**Critical**: Save the session string after first authentication:

```typescript
// After successful client.start()
const sessionString = client.session.save();
console.log('SAVE THIS TO .env:');
console.log(`TELEGRAM_SESSION=${sessionString}`);

// Next run uses saved session (no phone code needed)
```

**Security**: Session string = full account access. Protect like a password!

### Filtering Messages by Group

```typescript
import { prisma } from '@signal-tracker/database';

client.addEventHandler(async (event) => {
  const message = event.message;
  if (!message?.text) return;

  const chatId = message.chatId.toString();

  // Check if monitored group
  const group = await prisma.group.findUnique({
    where: { telegramId: chatId },
  });

  if (!group) {
    // Not a monitored group, ignore
    return;
  }

  console.log(`Signal from ${group.name}:`, message.text);

  // Parse and store signal (US3)
}, new NewMessage({}));
```

## Pros and Cons for Signal Tracking

### Advantages

✅ **Join Groups Directly**

- No need to ask admins to add a bot
- Join any public signal group instantly
- Use invite links for private groups

✅ **Access Message History**

- Read past signals for backtesting
- Don't miss signals from before you joined

✅ **Works in Bot-Restricted Groups**

- Many premium signal groups ban bots
- User account works everywhere

✅ **More Natural Integration**

- You're probably already in these groups
- Just automate what you do manually

### Disadvantages

❌ **Complex Authentication**

- Phone number required
- SMS/Telegram code on every first run
- 2FA adds another step
- Session management required

❌ **Account Risk**

- Automation detected → account warnings
- Possible temporary bans if misused
- Risk to your personal Telegram account

❌ **Rate Limits**

- Lower than Bot API for some operations
- Flood wait errors if too many requests
- Need exponential backoff

❌ **Terms of Service Gray Area**

- Bots are officially supported for automation
- User account automation is less clear
- Personal use is generally okay
- Commercial use may violate TOS

❌ **Operational Complexity**

- Session expiration handling
- Phone code input mechanism needed
- More failure modes to handle
- Harder to run in production (CI/CD)

## Hybrid Architecture Option

**Best of both worlds**: Run both bot and user client

```
┌─────────────────┐
│  Telegram Bot   │  → Admin commands (/start, /status)
│   (grammY)      │  → User-facing interface
└─────────────────┘

┌─────────────────┐
│  User Client    │  → Monitor signal groups you've joined
│   (GramJS)      │  → Read messages, detect signals
└─────────────────┘
         ↓
┌─────────────────┐
│   Database      │  → Store signals
│  (Postgres)     │
└─────────────────┘
```

**Benefits**:

- User client for monitoring groups
- Bot for management/status
- Separate concerns cleanly

## Migration Path from Bot to User Client

If you want to migrate later:

### Phase 1: Keep Current Bot

- Continue with bot approach
- Create test groups you control
- Prove signal parsing works

### Phase 2: Add User Client Alongside

- Add GramJS package
- Run user client in parallel
- Gradually shift monitoring to user client

### Phase 3: Full User Client (Optional)

- Keep bot for admin commands
- User client handles all monitoring
- Best of both worlds

## Recommendation

**For MVP (Current Phase)**:

❌ **Do NOT implement user client yet**

**Reasons**:

1. Violates MVP-First principle (adds complexity)
2. Authentication blocking (phone codes on startup)
3. Account risk to your personal Telegram
4. Bot API is officially supported for automation
5. Test groups solve the "admin blocker"

**Instead**:

1. ✅ Stick with current bot approach
2. ✅ Create 3 test groups (you're admin)
3. ✅ Prove concept with controlled data
4. ✅ Defer user client to Phase 2

**When to Revisit User Client**:

- After MVP working (signal parsing proven)
- When you need to join real signal groups
- When you want historical data
- When test groups are insufficient

## If You Insist on User Client Now

Required changes to project:

1. Add GramJS: `pnpm add telegram`
2. Get API credentials from my.telegram.org
3. Create `apps/user-client/` directory
4. Implement authentication with session save
5. Handle phone code input (readline or web UI)
6. Add session to .env (secret!)
7. Update quickstart with user client setup

**Estimated additional effort**: 4-6 hours
**Estimated debugging time**: 2-4 hours
**Total delay to MVP**: 1-2 days

**Not recommended for MVP** per constitution.

## Security Considerations

### Protecting Session String

```typescript
// BAD - session in code
const session = new StringSession('very_long_session_string...');

// GOOD - session in environment
const session = new StringSession(process.env.TELEGRAM_SESSION);

// BETTER - session encrypted at rest
import { decrypt } from './crypto';
const session = new StringSession(decrypt(process.env.ENCRYPTED_SESSION));
```

### Account Isolation

**If using user client in production**:

1. **Use a separate phone number**
   - Not your primary personal account
   - Virtual number from services like TextNow
   - Reduces risk if account flagged

2. **Limit automation scope**
   - Only read messages (don't send)
   - Respect rate limits
   - Add delays between requests

3. **Monitor for warnings**
   - Telegram may send warnings
   - React immediately to avoid bans
   - Have backup plan

## Conclusion

**TL;DR for Your MVP**:

✅ **Keep bot approach** (grammY + Bot API)
✅ **Create test groups** (you're admin, no blocker)
✅ **Defer user client** (Phase 2, after proven)

User client is powerful but adds significant complexity not justified for MVP. The "admin blocker" is easily solved by creating your own test groups.

Save user client investigation for when you need it (Phase 2+).

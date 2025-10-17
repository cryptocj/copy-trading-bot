# Quickstart: Bot Registration and Connection (US1)

**Feature**: Signal Collection - User Story 1
**Date**: 2025-10-17
**Estimated Time**: 15-20 minutes

## Prerequisites

Before starting, ensure you have:

- ✅ Node.js ≥20.0.0 installed
- ✅ pnpm ≥9.0.0 installed
- ✅ PostgreSQL database running
- ✅ Repository cloned and dependencies installed (`pnpm install`)
- ✅ Database schema applied (`pnpm --filter @signal-tracker/database db:push`)
- ✅ Test groups seeded (`pnpm --filter @signal-tracker/database db:seed`)
- ✅ Telegram account for bot creation

## Step 1: Create Telegram Bot (5 minutes)

### 1.1 Open Telegram and Find BotFather

1. Open Telegram app (mobile or desktop)
2. Search for "@BotFather" in the search bar
3. Start a chat with BotFather

### 1.2 Create New Bot

Send the following commands to BotFather:

```
/newbot
```

BotFather will ask for a name:

```
Signal Tracker Bot
```

(Or any name you prefer - this is the display name)

BotFather will ask for a username:

```
signal_tracker_mvp_bot
```

(Must end with "bot" and be unique across Telegram)

### 1.3 Save Bot Token

BotFather will respond with your bot token:

```
Done! Congratulations on your new bot...

Use this token to access the HTTP API:
1234567890:ABCdefGHIjklMNOpqrsTUVwxyz

...
```

**IMPORTANT**: Copy this token - you'll need it in the next step!

### 1.4 Disable Privacy Mode (CRITICAL)

**Why**: By default, bots in groups only receive commands and @mentions. To log ALL messages (including trading signals), Privacy Mode must be disabled.

Send to BotFather:

```
/mybots
```

Then:

1. Select your bot from the list
2. Click **"Bot Settings"**
3. Click **"Group Privacy"**
4. Click **"Turn OFF"** (or "Disable")

You should see: **"Privacy mode is disabled for [your bot]"**

**Without this step, your bot will NOT receive regular messages in groups - only commands!**

## Step 2: Configure Environment (2 minutes)

### 2.1 Update .env File

If you haven't already, copy the example:

```bash
cp .env.example .env
```

Edit `.env` and paste your bot token:

```bash
# Telegram Bot Configuration
TELEGRAM_BOT_TOKEN=1234567890:ABCdefGHIjklMNOpqrsTUVwxyz

# Database Configuration (should already be set)
DATABASE_URL=postgresql://user:password@localhost:5432/signal_tracker
```

### 2.2 Verify Configuration

```bash
# Check environment variables are loaded
cat .env | grep TELEGRAM_BOT_TOKEN
```

Expected output: Your token should be displayed

## Step 3: Start the Bot (2 minutes)

### 3.1 Start Bot in Development Mode

```bash
pnpm --filter @signal-tracker/bot dev
```

Expected output:

```
Starting Signal Tracker Bot...
Bot is running! Listening for messages...
```

**Leave this terminal open** - the bot must be running to receive messages.

### 3.2 Verify Bot is Online

Open Telegram, search for your bot username (e.g., `@signal_tracker_mvp_bot`), and send:

```
/start
```

Expected response:

```
Welcome to Signal Tracker Bot! 🚀

I will monitor crypto trading signals.
```

Send `/status`:

```
Bot Status: Online ✅
Chat ID: 123456789
Chat Type: private
Chat Title: N/A
```

✅ **Checkpoint**: Bot is online and responding to commands

## Step 4: Add Bot to Test Groups (8-10 minutes)

### 4.1 Join Test Groups

You need to join (or create) 3 Telegram groups to serve as test signal channels:

**Option A: Use Real Signal Groups** (if you have access):

1. Evening Trader
2. Wolf of Trading
3. Binance Killers

**Option B: Create Test Groups**:

1. Create a new group: "Test Group 1 - Evening Trader"
2. Create a new group: "Test Group 2 - Wolf of Trading"
3. Create a new group: "Test Group 3 - Binance Killers"

### 4.2 Add Bot to Each Group

For each group:

1. Open the group chat
2. Click group name → "Add Members"
3. Search for your bot username (e.g., `@signal_tracker_mvp_bot`)
4. Add the bot

**Note**: You must be a group admin to add bots.

### 4.3 Verify Bot Can See Messages

In each group, send:

```
/status
```

Expected response:

```
Bot Status: Online ✅
Chat ID: -1001234567890
Chat Type: supergroup
Chat Title: Test Group 1 - Evening Trader
```

**Important**: Copy the Chat ID from each group! You'll need these in Step 5.

### 4.4 Test Message Logging

Send a test message in one of the groups:

```
Test message from Evening Trader
```

Check the bot terminal - you should see:

```json
MESSAGE: {"timestamp":"2025-10-17T...","chatId":-1001234567890,"chatTitle":"Test Group 1 - Evening Trader","messageId":123,"from":"your_username","text":"Test message from Evening Trader"}
```

✅ **Checkpoint**: Bot receives and logs messages from all 3 groups

## Step 5: Update Seeded Group Data (3 minutes)

### 5.1 Open Prisma Studio

In a new terminal (keep bot running):

```bash
pnpm --filter @signal-tracker/database db:studio
```

This opens a database GUI at `http://localhost:5555`

### 5.2 Update Telegram Chat IDs

1. Click on "Group" model
2. Find "Evening Trader" record
3. Click Edit
4. Replace the `telegramId` placeholder with the actual Chat ID from Step 4.3
5. Click Save
6. Repeat for "Wolf of Trading" and "Binance Killers"

**Example**:

- Before: `telegramId: "-1001234567890"` (placeholder)
- After: `telegramId: "-1001987654321"` (actual chat ID from /status)

### 5.3 Verify Updates

Click "Group" model again and verify all 3 groups have real Telegram chat IDs.

✅ **Checkpoint**: Database has correct chat IDs for all test groups

## Step 6: Manual Testing (5 minutes)

### 6.1 Test Bot Startup

Stop the bot (Ctrl+C in bot terminal) and restart:

```bash
pnpm --filter @signal-tracker/bot dev
```

Expected output:

```
Starting Signal Tracker Bot...
Bot is running! Listening for messages...
```

### 6.2 Test All Acceptance Scenarios

| Scenario | Action                     | Expected Result                                     |
| -------- | -------------------------- | --------------------------------------------------- |
| AS-1     | Create bot via @BotFather  | ✅ Bot token received                               |
| AS-2     | Start bot with valid token | ✅ Bot comes online, responds to /start and /status |
| AS-3     | Add bot to Evening Trader  | ✅ Bot sees and logs messages from that group       |
| AS-4     | Add bot to Wolf of Trading | ✅ Bot sees and logs messages from that group       |
| AS-5     | Add bot to Binance Killers | ✅ Bot sees and logs messages from that group       |

Send a test message in each group and verify console logs appear for all 3.

### 6.3 Test Error Handling

Test invalid token:

1. Edit `.env` and corrupt the token (e.g., remove last 5 characters)
2. Restart bot
3. Expected: Clear error message about invalid token format
4. Restore correct token and restart

✅ **Checkpoint**: All acceptance scenarios passing

## Success Criteria Verification

Verify against spec.md success criteria:

- ✅ **SC-001**: Bot registers and comes online within 30 seconds
- ✅ **SC-002**: Bot connects to all 3 test groups without errors
- ✅ **SC-008**: Bot maintains connection (leave running for 24h to verify)
- ✅ **SC-010**: Logs provide debugging info (check console output)

**Note**: SC-003 through SC-007 are tested in US2/US3 (signal detection and parsing).

## Troubleshooting

### Bot doesn't start

**Error**: `TELEGRAM_BOT_TOKEN not found in environment`
**Solution**: Ensure `.env` file exists and contains `TELEGRAM_BOT_TOKEN=your_token`

**Error**: `TELEGRAM_BOT_TOKEN has invalid format`
**Solution**: Verify token format is `digits:alphanumeric` (e.g., `123456:ABCdef`)

### Bot doesn't respond to /start

**Problem**: Bot created but no response in Telegram
**Solution**:

1. Verify bot is running (`pnpm --filter @signal-tracker/bot dev`)
2. Check for errors in terminal
3. Try sending `/start` again
4. If still fails, regenerate bot token via @BotFather

### Bot doesn't see group messages

**Problem**: Bot responds to `/status` but doesn't log regular messages
**Solution**: **Privacy Mode is ON** (most common issue!)

1. **Disable Privacy Mode via @BotFather**:
   - Send `/mybots` to @BotFather
   - Select your bot → "Bot Settings" → "Group Privacy" → "Turn OFF"
2. **Restart your bot** (Ctrl+C then start again)
3. Send a test message - logs should now appear

**Other checks**:

- Verify you're an admin in the group
- Check bot is actually in the group (see member list)
- Check terminal for errors

### Wrong Chat IDs in database

**Problem**: Bot logs messages but they're not associated with correct groups
**Solution**:

1. Open Prisma Studio (`pnpm --filter @signal-tracker/database db:studio`)
2. Update `Group.telegramId` with actual Chat IDs from `/status` command
3. Restart bot

## Next Steps

✅ **User Story 1 Complete!** You now have:

- Telegram bot registered and online
- Bot connected to 3 test signal groups
- Bot logging messages from all groups
- Database with correct group mappings

**Ready for**:

- ✅ User Story 2: Signal Message Detection
- ✅ User Story 3: Signal Parsing and Storage

To continue, run:

```bash
/speckit.tasks  # Generate implementation tasks for all user stories
```

## Quick Reference

### Essential Commands

```bash
# Start bot in development
pnpm --filter @signal-tracker/bot dev

# View database
pnpm --filter @signal-tracker/database db:studio

# Build and validate
pnpm build

# View bot logs
# (logs appear in terminal where bot is running)
```

### Bot Commands

```
/start  - Verify bot is online
/status - Show connection info and chat ID
```

### File Locations

- Bot code: `apps/bot/src/main.ts`
- Config: `apps/bot/src/config.ts`
- Environment: `.env` (root directory)
- Database schema: `packages/database/prisma/schema.prisma`

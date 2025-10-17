# Setup Guide

## 1. Create Telegram Bot

```bash
# Visit @BotFather on Telegram
# Send /newbot and follow instructions
# Copy bot token to .env
```

## 2. Setup Database

### Docker (Recommended)

```bash
docker run --name signal-tracker-db \
  -e POSTGRES_PASSWORD=password \
  -e POSTGRES_DB=signal_tracker \
  -p 5432:5432 -d postgres:16
```

### Local PostgreSQL

```bash
brew install postgresql@16
brew services start postgresql@16
createdb signal_tracker
```

## 3. Initialize

```bash
# Install dependencies
pnpm install

# Setup environment
cp .env.example .env
# Edit .env: add TELEGRAM_BOT_TOKEN and DATABASE_URL

# Initialize database
pnpm --filter @signal-tracker/database db:generate
pnpm --filter @signal-tracker/database db:push
pnpm --filter @signal-tracker/database db:seed

# Run bot
pnpm --filter @signal-tracker/bot dev
```

## 4. Get Chat ID

```bash
# Method 1: Check console logs after sending message to bot
# Method 2: Use API
curl https://api.telegram.org/bot<TOKEN>/getUpdates
```

## Troubleshooting

- Bot not responding → Check `TELEGRAM_BOT_TOKEN` in `.env`
- Database error → Verify PostgreSQL running: `pg_isready`
- Type errors → Run `pnpm --filter @signal-tracker/database db:generate`

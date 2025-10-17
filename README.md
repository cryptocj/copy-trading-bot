# Signal Tracker

Crypto trading signal performance tracker for monitoring Telegram signal groups.

## Tech Stack

- **Bot**: grammY (TypeScript)
- **Database**: PostgreSQL + Prisma
- **Exchange API**: CCXT

## Quick Start

```bash
# Install
pnpm install

# Setup env
cp .env.example .env
# Add TELEGRAM_BOT_TOKEN and DATABASE_URL

# Setup database
pnpm --filter @signal-tracker/database db:generate
pnpm --filter @signal-tracker/database db:push
pnpm --filter @signal-tracker/database db:seed

# Run
pnpm --filter @signal-tracker/bot dev
```

## Project Structure

```
apps/bot/          # Telegram bot
packages/
  database/        # Prisma schema
  types/           # Shared types
```

## Test Groups

1. Evening Trader - 92-95% win rate
2. Wolf of Trading - 200K+ subscribers
3. Binance Killers - Binance-focused

## Next Steps

- [ ] Implement signal parser
- [ ] Add CCXT price tracking
- [ ] Calculate P&L statistics

# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Signal Tracker is a Telegram bot for monitoring and analyzing crypto trading signal performance from Telegram channels. Built as a pnpm monorepo using Turborepo with TypeScript throughout.

**Core Purpose**: Track signals from Telegram groups, fetch real-time prices via CCXT, and calculate performance metrics (win rate, P&L).

## Tech Stack

- **Monorepo**: pnpm workspace + Turborepo
- **Bot Framework**: grammY (Telegram bot)
- **Database**: PostgreSQL + Prisma ORM
- **Exchange Integration**: CCXT (multi-exchange price fetching)
- **Runtime**: Node.js ≥20.0.0, pnpm ≥9.0.0
- **Validation**: Zod schemas in shared types package

## Essential Commands

### Initial Setup

```bash
# Install dependencies (pnpm workspace aware)
pnpm install

# Setup environment
cp .env.example .env
# Edit .env: Add TELEGRAM_BOT_TOKEN and DATABASE_URL

# Database setup (must run in order)
pnpm --filter @signal-tracker/database db:generate  # Generate Prisma client
pnpm --filter @signal-tracker/database db:push      # Push schema to DB
pnpm --filter @signal-tracker/database db:seed      # Seed test data
```

### Development

```bash
# Run bot in watch mode
pnpm --filter @signal-tracker/bot dev

# Run all dev tasks (via Turborepo)
pnpm dev

# Build all packages
pnpm build

# Format code
pnpm format
```

### Database Management

```bash
# Open Prisma Studio (database GUI)
pnpm --filter @signal-tracker/database db:studio

# Create migration (after schema changes)
pnpm --filter @signal-tracker/database db:migrate

# Regenerate Prisma client (after schema.prisma changes)
pnpm --filter @signal-tracker/database db:generate
```

### Workspace Commands

```bash
# Run command in specific workspace
pnpm --filter <workspace-name> <command>

# Examples:
pnpm --filter @signal-tracker/bot dev
pnpm --filter @signal-tracker/database db:studio
```

## Architecture

### Monorepo Structure

```
apps/
  bot/              # Telegram bot application (grammY)
    src/
      main.ts       # Bot entry point with message handlers
      config.ts     # Configuration management

packages/
  database/         # Prisma schema + client export
    prisma/
      schema.prisma # Database schema (Groups, Signals, PriceUpdates)
      seed.ts       # Test data seeding
    src/index.ts    # Re-exports Prisma client

  types/            # Shared TypeScript types + Zod schemas
    src/
      signal.ts     # Signal enums, Zod schemas, ParsedSignal interface
      group.ts      # Group enums, Zod schemas, GroupStatistics interface
      index.ts      # Barrel exports
```

### Data Model (Prisma Schema)

**Group** (Signal source):

- Telegram channel metadata (name, telegramId, subscriberCount)
- Status: ACTIVE | INACTIVE | TESTING
- Aggregated statistics: totalSignals, winningSignals, losingSignals, totalPnl
- One-to-many relationship with Signals

**Signal** (Trading signal):

- Belongs to a Group (via groupId)
- Signal details: symbol, direction (LONG/SHORT), leverage
- Price levels: entryPrice/entryPriceMin/entryPriceMax, stopLoss, takeProfits[]
- Status: PENDING | ACTIVE | CLOSED | CANCELLED
- Performance tracking: currentPrice, pnl, pnlAbsolute, closedAt
- Stores rawMessage for parsing validation
- One-to-many relationship with PriceUpdates

**PriceUpdate** (Time-series price tracking):

- Belongs to a Signal (via signalId)
- Records price snapshots over time for performance calculation

### Type System

The `@signal-tracker/types` package provides:

1. **Zod Schemas**: Runtime validation for Signal and Group data
2. **TypeScript Types**: Inferred from Zod schemas (`z.infer<>`)
3. **Enums**: SignalDirection, SignalStatus, GroupStatus (exported from types, mirrored in Prisma)
4. **Interfaces**: ParsedSignal (signal parser return type), GroupStatistics (analytics)

### Key Design Patterns

**Workspace Dependencies**:

- Bot depends on `@signal-tracker/database` (workspace:_) and `@signal-tracker/types` (workspace:_)
- Database package exports Prisma client for bot consumption
- Types package provides shared schemas and enums

**ESM Modules**: All packages use `"type": "module"` in package.json. Import statements must include `.js` extensions even for `.ts` files (TypeScript ESM convention).

**Environment Configuration**: Bot uses dotenv to load `.env` file. Database URL must be set for Prisma to connect.

## Development Workflow

### Adding a New Signal Parser

1. Define parsing logic in bot/src (parse rawMessage → structured Signal)
2. Use Zod schemas from `@signal-tracker/types` for validation
3. Create Signal record in database via Prisma client
4. Consider signal format variations (different groups use different formats)

### Adding CCXT Price Tracking

1. Import ccxt library (already in bot dependencies)
2. Initialize exchange connection (e.g., `new ccxt.binance()`)
3. Fetch ticker prices for signal symbols
4. Create PriceUpdate records to track price over time
5. Calculate P&L based on entry price and current price

### Database Schema Changes

1. Edit `packages/database/prisma/schema.prisma`
2. Run `pnpm --filter @signal-tracker/database db:generate` (regenerate client)
3. Run `pnpm --filter @signal-tracker/database db:push` (apply to dev DB) OR
4. Run `pnpm --filter @signal-tracker/database db:migrate` (create migration for production)

### Adding New Workspace Package

1. Create directory in `packages/` or `apps/`
2. Add package.json with name matching `@signal-tracker/<name>`
3. Package automatically picked up by pnpm workspace (defined in `pnpm-workspace.yaml`)
4. Reference in other packages via `"@signal-tracker/<name>": "workspace:*"`

## Testing Context

The seed script (`packages/database/prisma/seed.ts`) creates three test groups:

1. **Evening Trader**: 92-95% win rate claim
2. **Wolf of Trading**: 200K+ subscribers
3. **Binance Killers**: Binance-focused signals

Use these for development testing of signal parsing and performance tracking.

## Common Patterns

### Database Access

```typescript
import { prisma } from '@signal-tracker/database';

// Query with relations
const group = await prisma.group.findUnique({
  where: { telegramId: '...' },
  include: { signals: true },
});
```

### Type Validation

```typescript
import { SignalSchema, type Signal } from '@signal-tracker/types';

// Parse and validate
const result = SignalSchema.safeParse(data);
if (result.success) {
  const signal: Signal = result.data;
}
```

### Bot Message Handling

```typescript
bot.on('message:text', async (ctx) => {
  const text = ctx.message.text;
  const chatId = ctx.chat.id.toString();

  // Parse signal, store in DB, respond to user
});
```

## Important Notes

- **ESM imports**: Always use `.js` extension in import paths, even for `.ts` files
- **Prisma client**: Must regenerate after schema changes (`db:generate`)
- **pnpm filters**: Use `--filter` to run commands in specific workspaces
- **Turbo caching**: Build/lint tasks cached by Turborepo for performance
- **Database indexes**: Schema includes indexes on telegramId, groupId, symbol, status, timestamp for query performance

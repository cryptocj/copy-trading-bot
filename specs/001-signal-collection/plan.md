# Implementation Plan: Signal Collection (User Story 1 Focus)

**Branch**: `001-signal-collection` | **Date**: 2025-10-17 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/001-signal-collection/spec.md`
**Scope**: **User Story 1 only** - Bot Registration and Connection

## Summary

Implement the foundational bot infrastructure to register a Telegram bot and connect it to 3 test signal groups (Evening Trader, Wolf of Trading, Binance Killers). This establishes the monitoring infrastructure needed for all future signal collection work.

**Technical Approach**: Use grammY framework for Telegram bot API integration, environment-based configuration for bot token, and leverage existing Prisma database schema for group management. Focus on connection stability and message logging without signal parsing (defer to US2/US3).

## Technical Context

**Language/Version**: TypeScript 5.5+ (Node.js ≥20.0.0)
**Primary Dependencies**: grammY 1.27+ (Telegram bot framework), dotenv 16.4+ (environment config), @signal-tracker/database (workspace package with Prisma client)
**Storage**: PostgreSQL via Prisma ORM (schema already defined, groups pre-seeded)
**Testing**: Manual testing via documented test scenarios (per MVP constitution Phase 1)
**Target Platform**: Node.js server (Linux/macOS development, cloud deployment ready)
**Project Type**: Monorepo (pnpm workspace + Turborepo)
**Performance Goals**: <30s bot startup, <5s message receipt latency, 24h+ uptime without restarts
**Constraints**: Must follow ESM module conventions (.js imports), workspace dependencies (workspace:\*), TypeScript strict mode
**Scale/Scope**: 3 test groups initially, designed for 10+ groups in production

## Constitution Check

_GATE: Must pass before Phase 0 research. Re-check after Phase 1 design._

### Principle I: MVP-First Development ✅ PASS

- **P1 Priority**: User Story 1 is marked P1 (foundational capability) - COMPLIANT
- **Independent Testing**: Story can be tested independently via bot commands and message logs - COMPLIANT
- **Deferred Complexity**: Signal parsing (US2/US3) deferred until bot connection proven - COMPLIANT
- **Good Enough Solution**: Basic connection + logging sufficient for MVP - COMPLIANT
- **Technical Debt**: Documented areas for improvement (reconnection logic, error handling) - COMPLIANT

### Principle II: Quality Gates (Non-Negotiable) ✅ PASS

- **TypeScript Compilation**: All code must pass `tsc` with no errors - ENFORCED
- **Project Patterns**: Follow monorepo structure, workspace deps, ESM imports - ENFORCED
- **Database Schema**: Prisma schema already defined, no changes needed for US1 - COMPLIANT
- **Environment Variables**: TELEGRAM_BOT_TOKEN documented in .env.example - REQUIRED
- **Build Validation**: `pnpm build` must pass before commit - ENFORCED
- **Manual Test Scenario**: 5 acceptance scenarios documented in spec.md - COMPLIANT

### Principle III: Incremental Testing Strategy ✅ PASS

- **Phase 1 (MVP)**: Manual testing via acceptance scenarios - SUFFICIENT
- **Automated Tests**: Not required for US1 per constitution - OPTIONAL
- **Smoke Testing**: Bot startup + group connection verification - DOCUMENTED
- **Test Scenarios**: Each acceptance scenario maps to manual test step - COMPLIANT

**Constitution Verdict**: ✅ **ALL GATES PASSED** - Ready for Phase 0 research

## Project Structure

### Documentation (this feature)

```
specs/001-signal-collection/
├── spec.md              # Feature specification (completed)
├── plan.md              # This file (in progress)
├── research.md          # Phase 0 output (to be created)
├── data-model.md        # Phase 1 output (to be created)
├── quickstart.md        # Phase 1 output (to be created)
├── contracts/           # Phase 1 output (N/A for US1 - no API contracts)
└── tasks.md             # Phase 2 output (created by /speckit.tasks - NOT by this command)
```

### Source Code (existing monorepo structure)

```
apps/bot/                # Telegram bot application
├── src/
│   ├── main.ts         # Bot entry point (MODIFY: add group connection logic)
│   ├── config.ts       # Configuration management (MODIFY: validate bot token)
│   └── handlers/       # NEW: Message handlers directory
│       ├── commands.ts # NEW: /start and /status command handlers
│       └── messages.ts # NEW: Message logging (no parsing yet)
├── package.json        # Dependencies already defined
└── tsconfig.json       # TypeScript config already defined

packages/database/       # Prisma schema + client (NO CHANGES for US1)
├── prisma/
│   ├── schema.prisma   # Groups already defined
│   └── seed.ts         # Test groups already seeded
└── src/index.ts        # Prisma client export

packages/types/          # Shared types (NO CHANGES for US1)
└── src/
    ├── group.ts        # Group types already defined
    └── signal.ts       # Signal types (not used in US1)
```

**Structure Decision**: Using existing monorepo structure. All US1 work confined to `apps/bot/src/` with new handlers directory. No new packages needed. No database schema changes required (groups already seeded).

## Complexity Tracking

_No constitution violations - this section intentionally left empty._

All implementation follows MVP-First principles:

- No premature abstractions (direct grammY API usage)
- No complex error recovery patterns (basic try-catch sufficient for MVP)
- No comprehensive test framework (manual testing per constitution)

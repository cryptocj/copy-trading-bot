# Implementation Plan: Hyperliquid Copy Trading

**Branch**: `002-hyperliquid-copy-trading` | **Date**: 2025-01-18 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/002-hyperliquid-copy-trading/spec.md`

**Note**: This template is filled in by the `/speckit.plan` command. See `.specify/templates/commands/plan.md` for the execution workflow.

## Summary

Build a browser-based copy trading interface that allows users to discover top-performing traders from Hyperliquid's public leaderboard, configure copy trading parameters (trade value, leverage limits), and automatically replicate their trades in real-time. The system monitors trader wallet addresses via WebSocket, calculates proportional position sizes, and executes matching limit orders with appropriate leverage settings.

## Technical Context

**Language/Version**: TypeScript (Node.js 20+) / JavaScript (browser ESM)
**Primary Dependencies**: CCXT v4.3.66+ (ccxt.pro for WebSocket, ccxt for REST), HTML/CSS/JS (browser UI)
**Storage**: Browser memory only (no persistence, no database) - session stops when tab closes
**Testing**: Manual testing per MVP constitution (no automated tests in Phase 1)
**Target Platform**: Modern browsers (Chrome, Firefox, Safari, Edge) with WebSocket support
**Project Type**: Browser-based single-page application (HTML + vanilla JS)
**Performance Goals**:
- Leaderboard load: <3 seconds
- Trade copy latency: <5 seconds from trader execution
- Order list update: <1 second
**Constraints**:
- No server-side persistence (browser-only operation)
- Single trader monitoring per session
- Cross margin mode only (no isolated margin)
- Limit orders only (no market orders)
**Scale/Scope**:
- 20 traders displayed in leaderboard
- 6 recent orders displayed (FIFO)
- Single active copy trading session

## Constitution Check

_GATE: Must pass before Phase 0 research. Re-check after Phase 1 design._

### Quality Gates (Non-Negotiable)

✅ **TypeScript Compilation**: N/A - using vanilla JavaScript in browser (no build step for MVP)
✅ **Project Patterns**: Follows signal-tracker monorepo structure (new app in `apps/copy-trader/`)
✅ **Database Schema**: N/A - no database for this feature (browser-only)
✅ **Environment Variables**: N/A - API endpoints are public, user provides credentials in UI
✅ **Breaking Changes Validation**: N/A - new standalone feature, no breaking changes
✅ **Manual Test Scenario**: Documented in spec.md for all 4 user stories

### MVP-First Development

✅ **Independent User Stories**: 4 stories with clear priorities (P1: US1-3, P2: US4)
✅ **P1 Priority**: US1 (Discover), US2 (Configure), US3 (Auto-Copy) are MVP core
✅ **Deferred Complexity**: No abstractions/patterns until proven necessary
✅ **Technical Debt**: Acceptable and documented (e.g., no server persistence, single trader only)

### Incremental Testing

✅ **Phase 1 - MVP Testing**: Manual testing scenarios documented in spec.md acceptance criteria
✅ **No Automated Tests**: Per constitution, automated tests are optional for MVP
✅ **Smoke Testing Focus**: Each user story has "Independent Test" documented

**Status**: ✅ **PASSED** - All constitution gates satisfied

## Project Structure

### Documentation (this feature)

```
specs/002-hyperliquid-copy-trading/
├── spec.md              # Feature specification (input)
├── plan.md              # This file (/speckit.plan command output)
├── research.md          # Phase 0 output (/speckit.plan command)
├── data-model.md        # Phase 1 output (/speckit.plan command)
├── quickstart.md        # Phase 1 output (/speckit.plan command)
├── contracts/           # Phase 1 output (/speckit.plan command)
│   └── leaderboard.yaml # Leaderboard API contract
└── tasks.md             # Phase 2 output (/speckit.tasks command - NOT created by /speckit.plan)
```

### Source Code (repository root)

```
apps/copy-trader/          # New browser-based copy trading app
├── index.html             # Main UI with leaderboard, config form, order list
├── src/
│   ├── main.js            # Entry point - UI initialization and event handlers
│   ├── services/
│   │   ├── leaderboard.js # Fetch and display leaderboard data
│   │   ├── trading.js     # CCXT integration for monitoring and execution
│   │   └── validation.js  # Input validation (address, API key, trade value, leverage)
│   └── utils/
│       └── format.js      # Format numbers, timestamps, symbols for display
├── styles/
│   └── main.css           # UI styling (leaderboard table, form, order list)
└── README.md              # Setup and usage instructions
```

**Structure Decision**: Single-page browser application with vanilla JavaScript. No build step required for MVP - uses browser-native ESM imports. Organized by feature (services/) for clarity. Follows monorepo convention by creating new app in `apps/` directory.

## Complexity Tracking

_Fill ONLY if Constitution Check has violations that must be justified_

**No violations** - all constitution gates passed without exceptions.

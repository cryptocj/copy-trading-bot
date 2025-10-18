# Tasks: Hyperliquid Copy Trading

**Input**: Design documents from `/specs/002-hyperliquid-copy-trading/`
**Prerequisites**: plan.md (required), spec.md (required), research.md, data-model.md, contracts/, quickstart.md

**Tests**: Manual testing only per MVP constitution - no automated test tasks included

**Organization**: Tasks organized by user story for independent implementation and testing

## Format: `[ID] [P?] [Story?] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (US1, US2, US3, US4)
- Include exact file paths in descriptions

## Path Conventions

- **Browser app**: `apps/copy-trader/` for all code
- **HTML entry**: `apps/copy-trader/index.html`
- **JavaScript modules**: `apps/copy-trader/src/`
- **Styles**: `apps/copy-trader/styles/`

---

## Phase 1: Setup (Project Initialization)

**Purpose**: Create browser app directory structure and basic files

- [X] T001 Create directory structure for copy-trader app in apps/copy-trader/
- [X] T002 Create index.html with basic structure (leaderboard table, config form, order list) in apps/copy-trader/
- [X] T003 Create main.css with basic layout styles in apps/copy-trader/styles/
- [X] T004 Create README.md with project description in apps/copy-trader/

**Checkpoint**: Directory structure created, HTML skeleton in place ✓

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core utilities that ALL user stories depend on

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [X] T005 [P] Create validation.js with address/API key validators in apps/copy-trader/src/services/
- [X] T006 [P] Create format.js with number/timestamp formatting in apps/copy-trader/src/utils/
- [X] T007 Create main.js with CCXT CDN import and app initialization in apps/copy-trader/src/

**Checkpoint**: Foundation ready - validation and formatting utilities available ✓

---

## Phase 3: User Story 1 - Discover Traders via Leaderboard (Priority: P1) 🎯 MVP

**Goal**: Fetch and display top 20 traders, enable selection via click

**Independent Test**: Open page → leaderboard loads → displays 20 traders → click row → address populates form

### Implementation for User Story 1

- [X] T008 [P] [US1] Create leaderboard.js service in apps/copy-trader/src/services/
- [X] T009 [US1] Implement fetchLeaderboard() function with API call to stats-data.hyperliquid.xyz
- [X] T010 [US1] Implement parseLeaderboardData() to extract weekly ROI and format traders
- [X] T011 [US1] Implement renderLeaderboardTable() to create table HTML with trader rows
- [X] T012 [US1] Add click event listener to table rows in main.js to populate trader address
- [X] T013 [US1] Add error handling for leaderboard fetch failures (show error, enable manual entry)
- [X] T014 [US1] Call fetchLeaderboard() on page load in main.js

**Checkpoint**: US1 complete - leaderboard displays, click handler works ✓

**Manual Testing Checklist**:
- [ ] AS-1: Leaderboard displays top 20 traders within 3 seconds
- [ ] AS-2: Click trader row → address auto-fills in "Trader Address" input
- [ ] AS-3: Leaderboard API fails → error message shows, manual entry still works

---

## Phase 4: User Story 2 - Configure and Start Copy Trading (Priority: P1)

**Goal**: Enable user to configure parameters and start/stop copy trading

**Independent Test**: Select trader → fill credentials → validation passes → Start button enables → click Start → form disables → click Stop → form re-enables

### Implementation for User Story 2

- [X] T015 [P] [US2] Add form input elements to index.html (trader address, API key, trade value, max leverage)
- [X] T016 [P] [US2] Add Start/Stop buttons to index.html with initial disabled state
- [X] T017 [US2] Implement validateTradeValue() in validation.js (minimum $12)
- [X] T018 [US2] Implement validateLeverage() in validation.js (1-50 range)
- [X] T019 [US2] Add blur event listeners for all form inputs in main.js (real-time validation)
- [X] T020 [US2] Implement enableStartButton() function in main.js (enable when all fields valid)
- [X] T021 [US2] Implement setFormDisabled() function in main.js (disable/enable form inputs)
- [X] T022 [US2] Add click handler for Start button in main.js (calls startCopyTrading)
- [X] T023 [US2] Add click handler for Stop button in main.js (calls stopCopyTrading)

**Checkpoint**: US2 complete - form validation works, Start/Stop buttons functional ✓

**Manual Testing Checklist**:
- [ ] AS-1: Valid inputs → Start button enables
- [ ] AS-2: Invalid/missing fields → validation errors show, Start button stays disabled
- [ ] AS-3: Click Stop → monitoring stops, form re-enables

---

## Phase 5: User Story 3 - Auto-Copy Trader Positions (Priority: P1)

**Goal**: Monitor trader via WebSocket and automatically execute matching trades

**Independent Test**: Start copy trading → trader opens LONG BTC/USDT → matching LONG opens in user account → verify size and leverage correct

### Implementation for User Story 3

- [X] T024 [P] [US3] Create trading.js service in apps/copy-trader/src/services/
- [X] T025 [US3] Implement startCopyTrading() function that initializes CCXT instances
- [X] T026 [US3] Create monitorExchange (ccxt.pro.hyperliquid) with WebSocket connection
- [X] T027 [US3] Create executeExchange (ccxt.hyperliquid) with REST connection
- [X] T028 [US3] Implement monitoringLoop() function with watchMyTrades() call
- [X] T029 [US3] Add timestamp filtering to ignore historical trades (before activation)
- [X] T030 [US3] Implement calculateTradeAmount() function (tradeValue / price)
- [X] T031 [US3] Implement fetchMarketInfo() to get symbol leverage limits
- [X] T032 [US3] Implement setLeverageIfNeeded() with leverageCache check
- [X] T033 [US3] Implement executeCopyTrade() function that creates limit orders
- [X] T034 [US3] Add error handling for order execution failures (log, continue monitoring)
- [X] T035 [US3] Implement stopCopyTrading() function that closes connections and clears state
- [X] T036 [US3] Add reconnection logic for network failures (reset timestamp)

**Checkpoint**: US3 complete - trades copy automatically, leverage managed correctly ✓

**Manual Testing Checklist**:
- [ ] AS-1: Trader opens LONG BTC/USDT at $40k, user trade value $50 → user opens LONG with 0.00125 BTC
- [ ] AS-2: Trader uses 20x leverage, user max is 10x → user position uses 10x
- [ ] AS-3: Trader closes position → user position closes automatically

---

## Phase 6: User Story 4 - View Recent Copied Orders (Priority: P2)

**Goal**: Display last 6 copied orders with symbol, side, amount, timestamp

**Independent Test**: Start copy trading → 3 trades execute → all 3 display in order list → 4 more trades → oldest removed, showing latest 6

### Implementation for User Story 4

- [X] T037 [P] [US4] Add order list container to index.html with table structure
- [X] T038 [P] [US4] Add CSS styling for order list in main.css (buy/sell colors)
- [X] T039 [US4] Implement addOrder() function in main.js with FIFO logic (max 6 orders)
- [X] T040 [US4] Implement renderOrderList() function to update table HTML
- [X] T041 [US4] Implement formatOrderSide() in format.js (buy = green +, sell = red -)
- [X] T042 [US4] Implement formatTimestamp() in format.js (readable date/time)
- [X] T043 [US4] Call addOrder() from executeCopyTrade() after successful order creation
- [X] T044 [US4] Initialize empty orderList array in main.js global state

**Checkpoint**: US4 complete - order list displays last 6 orders with proper formatting ✓

**Manual Testing Checklist**:
- [ ] AS-1: 3 orders execute → all 3 display with symbol, side, timestamp
- [ ] AS-2: 7 orders execute → only 6 most recent display (oldest removed)
- [ ] AS-3: Order fails → error logged to console, list doesn't update

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: Final validation and cleanup

- [ ] T045 Test complete user flow: select trader → configure → start → trade executes → order displays → stop
- [ ] T046 Verify leaderboard loads within 3 seconds (SC-001)
- [ ] T047 Verify trade copy latency < 5 seconds (SC-003)
- [ ] T048 Verify leverage respects user and exchange limits (SC-005)
- [ ] T049 Test browser tab close stops copy trading (no server persistence)
- [ ] T050 Test network disconnect → auto-reconnect with timestamp reset
- [ ] T051 Update apps/copy-trader/README.md with usage instructions from quickstart.md
- [ ] T052 Update PROJECT_STATUS.md with completed Phase 2 (Copy Trading MVP)

**Checkpoint**: Phase 7 complete - All manual tests passing, ready for user validation ✓

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies - start immediately
- **Foundational (Phase 2)**: Depends on Setup - blocks all user stories
- **User Story 1 (Phase 3)**: Depends on Foundational - independent from US2/US3/US4
- **User Story 2 (Phase 4)**: Depends on Foundational - independent from US1/US3/US4
- **User Story 3 (Phase 5)**: Depends on Foundational AND US2 (needs form state management)
- **User Story 4 (Phase 6)**: Depends on Foundational AND US3 (needs trade execution)
- **Polish (Phase 7)**: Depends on all user stories being complete

### User Story Dependencies

```
Setup (Phase 1)
    ↓
Foundational (Phase 2) - BLOCKS ALL STORIES
    ↓
    ├── US1 (Leaderboard) - INDEPENDENT
    ├── US2 (Configuration) - INDEPENDENT
    ↓
US3 (Auto-Copy) - requires US2's form state
    ↓
US4 (Order Display) - requires US3's trade execution
```

**Critical Path**: Setup → Foundational → US2 → US3 → US4 → Polish

**Recommended Order**: Phase 1 → Phase 2 → Phase 4 (US2) → Phase 3 (US1 parallel) → Phase 5 (US3) → Phase 6 (US4) → Phase 7

### Within Each User Story

- **US1**: All tasks sequential except T008 can start early (create file first)
- **US2**: T015-T016 parallel (HTML changes), then T017-T023 sequential (JavaScript logic)
- **US3**: T024-T027 sequential (setup), then T028-T036 mostly sequential (monitoring loop logic)
- **US4**: T037-T038 parallel (HTML/CSS), T039-T044 sequential (JavaScript logic)

### Parallel Opportunities

```bash
# Phase 1 Setup: Sequential (each depends on directory structure)

# Phase 2 Foundational: Can parallelize utility creation
Task T005: "Create validation.js"
Task T006: "Create format.js"
# Then sequential: T007 (imports both)

# Phase 3 (US1): Sequential after file creation
Task T008: "Create leaderboard.js"
# Then: T009 → T010 → T011 → T012 → T013 → T014

# Phase 4 (US2): Can parallelize HTML/CSS changes
Task T015: "Add form inputs"
Task T016: "Add Start/Stop buttons"
# Then sequential: T017 → T018 → T019 → T020 → T021 → T022 → T023

# Phase 5 (US3): Mostly sequential (complex integration)
Task T024: "Create trading.js"
# Then: T025 → T026 → T027 → T028 → T029 → T030 → T031 → T032 → T033 → T034 → T035 → T036

# Phase 6 (US4): Can parallelize HTML/CSS changes
Task T037: "Add order list HTML"
Task T038: "Add order list CSS"
# Then sequential: T039 → T040 → T041 → T042 → T043 → T044

# Phase 7 Polish: Sequential manual testing
```

---

## Implementation Strategy

### MVP First (Recommended for Fast Delivery)

**Focus on US2 + US3 FIRST** (fastest path to working copy trading):

1. ✓ Complete Phase 1: Setup (T001-T004)
2. ✓ Complete Phase 2: Foundational (T005-T007)
3. ✓ Complete Phase 4: User Story 2 (T015-T023) - Configuration
4. **STOP and VALIDATE**: Test form validation manually
5. ✓ Complete Phase 5: User Story 3 (T024-T036) - Auto-copy
6. **STOP and VALIDATE**: Test trade copying with real trader
7. 🎉 **MVP Delivered**: Core copy trading works (manual trader address entry)
8. ✓ **Then add US1** (T008-T014): Leaderboard discovery (nice-to-have)
9. ✓ **Then add US4** (T037-T044): Order display (observability)
10. ✓ Complete Phase 7: Polish (T045-T052)

**Time Estimate for Core MVP (US2 + US3)**: 4-6 hours
- Setup: 30 min (T001-T004)
- Foundational: 1 hour (T005-T007)
- US2 Configuration: 1-2 hours (T015-T023)
- US3 Auto-copy: 2-3 hours (T024-T036)
- Manual Testing: 30 min

**Then Add US1** (leaderboard discovery): +1 hour (T008-T014)
**Then Add US4** (order display): +30 min (T037-T044)

### Full Implementation (All 4 User Stories)

If implementing all at once (P1 stories in priority order):

1. Complete Phase 1: Setup → Infrastructure ready
2. Complete Phase 2: Foundational → Utilities ready
3. Complete Phase 4: User Story 2 → Test independently → Configuration working
4. Complete Phase 3: User Story 1 (parallel with US2 if desired) → Test independently → Discovery working
5. Complete Phase 5: User Story 3 → Test independently → Auto-copy working
6. Complete Phase 6: User Story 4 → Test independently → Display working
7. Complete Phase 7: Polish → Final validation

**Time Estimate for Full**: 6-8 hours
- Includes all 4 user stories
- Includes manual testing for each story
- Includes final polish and validation

---

## Notes

- **No automated tests**: Manual testing per MVP constitution Phase 1
- **No database**: All state in browser memory (no schema changes)
- **No build step**: Vanilla JavaScript with ESM imports (instant development)
- **Browser-only**: No server setup, deployment, or hosting
- **CCXT CDN import**: `https://cdn.jsdelivr.net/npm/ccxt@4.3.66/dist/ccxt.browser.js`
- **Commit strategy**: Commit after each phase for rollback safety
- **US2 + US3 are core MVP**: Can stop after these, add US1/US4 later
- **Leaderboard is optional**: Users can manually enter trader addresses if API fails

## Success Criteria Validation

After completing all tasks, verify against spec.md success criteria:

- **SC-001**: Leaderboard loads within 3 seconds ✓ (Test T046)
- **SC-002**: User starts copy trading in under 30 seconds ✓ (Manual testing US2)
- **SC-003**: System copies trades within 5 seconds ✓ (Test T047)
- **SC-004**: Order list updates instantly ✓ (Manual testing US4)
- **SC-005**: Leverage respects limits 100% of time ✓ (Test T048)
- **SC-006**: Zero unauthorized trades ✓ (Code review US3)
- **SC-007**: System runs continuously 24h ✓ (Test T049)
- **SC-008**: Copy trading stops within 2 seconds ✓ (Manual testing US2)

## Quick Reference

### File Structure Created

```
apps/copy-trader/
├── index.html                   # Main UI (T002)
├── README.md                    # Project docs (T004, T051)
├── src/
│   ├── main.js                  # Entry point (T007)
│   ├── services/
│   │   ├── leaderboard.js      # US1: Leaderboard API (T008)
│   │   ├── trading.js          # US3: CCXT integration (T024)
│   │   └── validation.js       # Foundation: Input validators (T005)
│   └── utils/
│       └── format.js           # Foundation: Formatters (T006)
└── styles/
    └── main.css                # UI styling (T003)
```

### Essential Commands

```bash
# Development (serve static files)
cd apps/copy-trader
python3 -m http.server 8000
# Open http://localhost:8000

# Or just open the file
open apps/copy-trader/index.html

# No build, no npm install, no compilation!
```

### Manual Testing Workflow

1. Open index.html in browser → leaderboard loads
2. Click trader row → address populates
3. Fill API key, trade value ($50), max leverage (10x)
4. Click "Start Copy Trading" → WebSocket connects
5. Trader executes trade → order appears in list within 5 seconds
6. Verify symbol, side, amount correct
7. Click "Stop Copy Trading" → connection closes
8. Close browser tab → all state cleared

## Task Completion Tracking

**Total Tasks**: 52
- Setup: 4 tasks
- Foundational: 3 tasks
- US1 (Leaderboard): 7 tasks
- US2 (Configuration): 9 tasks
- US3 (Auto-Copy): 13 tasks
- US4 (Order Display): 8 tasks
- Polish: 8 tasks

**Parallel Opportunities**: 6 tasks can be parallelized
- T005 + T006 (utilities)
- T015 + T016 (HTML changes)
- T037 + T038 (HTML/CSS)

**Independent Test Criteria**:
- ✅ US1: Leaderboard loads → click row → address populates
- ✅ US2: Fill form → Start enables → click Start → form disables
- ✅ US3: Start copy → trader trades → matching order executes
- ✅ US4: Orders execute → display updates → FIFO behavior

**MVP Scope**: US2 (Configuration) + US3 (Auto-Copy) = Core functionality (4-6 hours)

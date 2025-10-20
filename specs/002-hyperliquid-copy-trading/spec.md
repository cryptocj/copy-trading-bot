# Feature Specification: Hyperliquid Copy Trading

**Feature Branch**: `002-hyperliquid-copy-trading`
**Created**: 2025-01-18
**Status**: Draft
**Input**: User description: "Let's follow this file to implement copy trading from hyperliquid"

## User Scenarios & Testing _(mandatory)_

### User Story 1 - Discover Traders via Leaderboard (Priority: P1)

A user wants to browse top-performing traders from the Hyperliquid leaderboard to find a trader worth copying.

**Why this priority**: Entry point - users need to discover traders before they can copy them. Without trader discovery, users must manually find wallet addresses elsewhere.

**Independent Test**: Open interface → fetch leaderboard data → display top 20 traders with ROI, account value, PnL → click trader row → verify address populates in copy trading form.

**Acceptance Scenarios**:

1. **Given** user opens the interface, **When** leaderboard loads, **Then** system displays top 20 traders sorted by weekly ROI with address, account value, and performance metrics
2. **Given** leaderboard is displayed, **When** user clicks a trader row, **Then** system auto-fills trader wallet address in configuration form
3. **Given** leaderboard fetch fails, **When** API error occurs, **Then** system shows error message and provides manual address entry option

---

### User Story 2 - Configure and Start Copy Trading (Priority: P1)

A user wants to set up copy trading by entering (or selecting) trader wallet address, their API key, and basic risk parameters, then start monitoring.

**Why this priority**: Configuration is required before any trading can happen. Links trader discovery to execution.

**Independent Test**: Enter/select trader wallet (40-char hex), API key (64-char hex), trade value ($12+ USDC), max leverage (1-50x) → click Start → verify validation and monitoring begins.

**Acceptance Scenarios**:

1. **Given** user has selected a trader from leaderboard, **When** user enters API key, trade value ($50), and max leverage (10x), **Then** system validates inputs and enables "Start Copy Trading" button
2. **Given** user enters invalid/missing fields, **When** user clicks "Start Copy Trading", **Then** system shows validation errors and prevents activation
3. **Given** copy trading is active, **When** user clicks "Stop Copy Trading", **Then** system stops monitoring immediately and re-enables form fields

---

### User Story 3 - Auto-Copy Trader Positions (Priority: P1)

A user wants the system to automatically replicate new trades from the monitored trader using their configured risk parameters.

**Why this priority**: Core value - this is what makes it copy trading. Without auto-execution, it's just monitoring.

**Independent Test**: Start copy trading → trader opens LONG BTC/USDT → verify matching LONG position opens in user account with correct size/leverage.

**Acceptance Scenarios**:

1. **Given** copy trading is active with $50 trade value, **When** trader opens LONG BTC/USDT at $40,000, **Then** user's account opens matching LONG with 0.00125 BTC size ($50 ÷ $40,000)
2. **Given** user max leverage is 10x, **When** trader opens position with 20x leverage, **Then** user's position uses 10x (respects user limit)
3. **Given** trader closes a position, **When** system detects the closing trade, **Then** user's matching position closes automatically

---

### User Story 4 - View Recent Copied Orders (Priority: P2)

A user wants to see the last few copied orders to verify the system is working correctly.

**Why this priority**: MVP observability - minimal transparency to confirm trades are executing. Can enhance with detailed analytics later.

**Independent Test**: Start copy trading → trader executes 3 trades → verify order list shows last 3 orders with symbol, buy/sell indicator, and timestamp.

**Acceptance Scenarios**:

1. **Given** copy trading is active, **When** 3 orders execute successfully, **Then** order list displays all 3 with symbol (BTC/USDT), side (+/-), and timestamp
2. **Given** order list shows 6 orders, **When** new order executes, **Then** oldest order is removed and list shows most recent 6 only
3. **Given** order fails to execute, **When** error occurs, **Then** error is logged to browser console (no user notification in MVP)

---

### Edge Cases

- **Leaderboard API unavailable**: Shows error message, allows manual trader address entry
- **No trader activity**: System keeps monitoring until user clicks Stop (no timeout)
- **Historical trades**: Ignores all trades before activation timestamp (only copies new activity)
- **Insufficient balance**: Order fails, logs error to console, continues monitoring next trade
- **Invalid API key**: Connection fails on Start, shows error, prevents activation
- **Browser closes**: Copy trading stops immediately (no server persistence in MVP)
- **Network disconnect**: Reconnects automatically, resets activation time to avoid copying stale trades

## Requirements _(mandatory)_

### Functional Requirements

**Trader Discovery** (US1):

- **FR-001**: System MUST fetch leaderboard data from public API on interface load
- **FR-002**: System MUST display top 20 traders sorted by weekly ROI (descending)
- **FR-003**: System MUST show trader address, account value, and weekly ROI for each trader
- **FR-004**: System MUST auto-fill trader address when user clicks a leaderboard row
- **FR-005**: System MUST provide manual address entry option if leaderboard fetch fails

**Configuration & Validation** (US2):

- **FR-006**: System MUST validate trader wallet address format (40-char hex, optional 0x prefix)
- **FR-007**: System MUST validate API key format (64-char hex, optional 0x prefix)
- **FR-008**: System MUST enforce minimum trade value of $12 USDC
- **FR-009**: System MUST enforce max leverage range of 1x-50x
- **FR-010**: System MUST disable configuration inputs while copy trading is active
- **FR-011**: System MUST re-enable inputs when stopped

**Trade Monitoring & Execution** (US3):

- **FR-012**: System MUST monitor trader wallet using real-time WebSocket connection
- **FR-013**: System MUST ignore trades with timestamps before activation time
- **FR-014**: System MUST calculate trade amount as: trade_value ÷ trader_entry_price
- **FR-015**: System MUST respect minimum of (user_max_leverage, exchange_symbol_max_leverage)
- **FR-016**: System MUST create limit orders matching trader's side, symbol, price, and calculated amount
- **FR-017**: System MUST set cross margin mode with leverage before first trade per symbol

**Order Display** (US4):

- **FR-018**: System MUST display last 6 orders only (FIFO)
- **FR-019**: System MUST show symbol, side (buy/sell), and timestamp per order
- **FR-020**: System MUST visually distinguish buy (+/green) vs sell (-/red) orders

**Error Handling & Reliability**:

- **FR-021**: System MUST log all errors to browser console
- **FR-022**: System MUST reconnect on network failure and reset activation timestamp
- **FR-023**: System MUST close connections gracefully when stopped

### Key Entities

- **Leaderboard Trader**: Address, account value, weekly ROI, PnL (fetched from public API)
- **Configuration**: Trader wallet address, user API key, trade value ($12+ USDC), max leverage (1-50x)
- **Copied Order**: Symbol, side (buy/sell), amount, timestamp (last 6 displayed)
- **Active Session**: Monitoring state with start time, WebSocket connection, leverage cache per symbol

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: Leaderboard loads and displays top 20 traders within 3 seconds of interface opening
- **SC-002**: User can select a trader and start copy trading in under 30 seconds (with credentials ready)
- **SC-003**: System copies trades within 5 seconds of trader's execution
- **SC-004**: Order list updates instantly (under 1 second) after successful copy
- **SC-005**: Leverage respects both user and exchange limits 100% of the time
- **SC-006**: Zero unauthorized trades (only copies monitored trader)
- **SC-007**: System runs continuously for 24+ hours (while browser tab open)
- **SC-008**: Copy trading stops within 2 seconds of clicking Stop button

## Assumptions

- **Browser-based only**: Runs in browser, stops when tab closes (no server persistence)
- **Single trader**: Monitor one trader at a time
- **Limit orders**: Uses limit orders at trader's price (not market orders)
- **Cross margin**: All positions use cross margin mode
- **Fixed trade value**: Same dollar amount for all copied trades
- **Stable internet**: WebSocket requires stable connection
- **User knowledge**: Users understand leverage, long/short, and USDC balance needs

## Dependencies

- **Leaderboard API**: `https://stats-data.hyperliquid.xyz/Mainnet/leaderboard` (public GET endpoint)
- **Exchange**: Hyperliquid DEX operational with WebSocket and REST APIs
- **User wallet**: Funded account with $12+ USDC per trade
- **API key**: User-generated from exchange (64-char hex)

## Future Enhancements (Out of MVP Scope)

After MVP validation, consider:

- **Vault discovery**: Browse and copy professional vault leaders
- **Performance tracking**: Monitor trader's ROI/PnL over time with charts
- **Multi-trader portfolio**: Copy multiple traders with allocation %
- **Risk management**: Auto-stop if losses exceed threshold
- **Historical backtesting**: Simulate past performance before committing funds

## Out of Scope (MVP)

- Server-side persistence (requires browser tab open)
- Trade history beyond last 6 orders
- P&L tracking and performance analytics
- Auto stop-loss/take-profit rules
- User authentication and config saving
- Mobile app or responsive design
- Market orders (MVP uses limit orders only)
- Multi-exchange support
- Browser notifications
- Social features (ratings, comments)

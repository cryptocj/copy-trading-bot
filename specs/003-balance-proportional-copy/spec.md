# Feature Specification: Balance-Proportional Position Copying

**Feature Branch**: `003-balance-proportional-copy`
**Created**: 2025-10-21
**Status**: Draft
**Input**: User description: "I want to copy the selected wallet position based on my current balance, using the same distribution from the beginning"

## User Scenarios & Testing

### User Story 1 - One-Click Proportional Position Copy (Priority: P1)

A user views a monitored wallet's positions and wants to replicate their entire portfolio allocation proportionally based on their available balance, with a single action.

**Why this priority**: This is the core MVP functionality - allowing users to instantly mirror a trader's position distribution without manually calculating each position size. This delivers immediate value and is the primary reason users would want this feature.

**Independent Test**: Can be fully tested by selecting a wallet with multiple open positions, clicking a "Copy Positions" button, and verifying that all positions are created with proportional sizes based on available balance.

**Acceptance Scenarios**:

1. **Given** a monitored wallet has 3 open positions (BTC 50%, ETH 30%, SOL 20% of their portfolio) and user has $1000 available balance, **When** user clicks "Copy All Positions", **Then** user's account opens 3 positions with $500 in BTC, $300 in ETH, and $200 in SOL
2. **Given** user has insufficient balance to meet minimum trade size for all positions, **When** user attempts to copy positions, **Then** system shows clear error indicating minimum balance required and which positions cannot be copied
3. **Given** user already has open positions, **When** user copies new positions, **Then** system merges or averages positions for the same symbol (existing + new)

---

### User Story 2 - Visual Position Distribution Preview (Priority: P2)

Before committing to copy positions, users want to see exactly what positions will be opened, their sizes, and how their balance will be allocated.

**Why this priority**: Essential for user confidence and preventing mistakes. Users need to understand what will happen before executing trades worth hundreds or thousands of dollars.

**Independent Test**: Select a wallet, click "Copy Positions", and verify that a preview modal shows all positions to be copied, their sizes, leverage, and remaining balance before confirmation.

**Acceptance Scenarios**:

1. **Given** user clicks "Copy Positions", **When** preview modal appears, **Then** user sees a table with symbol, direction (long/short), size, leverage, estimated cost, and total remaining balance
2. **Given** preview modal is open, **When** user adjusts their allocation percentage (e.g., use 80% instead of 100% of balance), **Then** position sizes update in real-time
3. **Given** preview modal is open, **When** user clicks "Confirm", **Then** all positions are executed and modal shows execution progress

---

### User Story 3 - Position Distribution Persistence (Priority: P3)

Users want the system to remember the initial distribution ratio from the copied wallet, so future position adjustments maintain the same proportions automatically.

**Why this priority**: Nice-to-have for maintaining alignment with the copied trader's strategy over time. Less critical for MVP but enhances long-term usability.

**Independent Test**: Copy positions from a wallet, wait for the monitored wallet to adjust their positions, and verify that suggested adjustments maintain the original distribution ratios.

**Acceptance Scenarios**:

1. **Given** user copied positions with 50/30/20 distribution, **When** monitored wallet changes their distribution to 60/25/15, **Then** system suggests rebalancing user's positions to match new distribution
2. **Given** user's balance increases, **When** user wants to scale up positions, **Then** system calculates new position sizes maintaining original 50/30/20 ratio

---

### Edge Cases

- What happens when user's available balance is below minimum trade size ($12) multiplied by number of positions?
- How does system handle positions with zero size or invalid market data?
- What if monitored wallet has positions in markets not supported or available?
- How to handle slippage when executing multiple positions simultaneously?
- What happens if user's balance changes (new deposit/withdrawal) between preview and execution?
- How to handle positions that fail to open (some succeed, some fail)?

## Requirements

### Functional Requirements

- **FR-001**: System MUST calculate position sizes proportionally based on monitored wallet's position distribution (percentage of total position value)
- **FR-002**: System MUST use user's available balance (not total balance or including margin) for position size calculation
- **FR-003**: System MUST respect minimum trade size per position ($12 minimum on Hyperliquid)
- **FR-004**: System MUST validate that user has sufficient balance before executing any positions
- **FR-005**: System MUST show a preview of all positions to be copied with sizes, leverage, and cost breakdown
- **FR-006**: System MUST execute all positions atomically or provide rollback if any position fails
- **FR-007**: System MUST preserve the monitored wallet's leverage ratios for each position
- **FR-008**: System MUST handle both long and short positions correctly
- **FR-009**: System MUST provide real-time progress feedback during multi-position execution
- **FR-010**: System MUST calculate remaining balance after all positions are opened
- **FR-011**: Users MUST be able to adjust allocation percentage (e.g., use only 50% of available balance instead of 100%)
- **FR-012**: System MUST handle position merging when user already has an open position in the same symbol

### Key Entities

- **Position Copy Request**: Represents a user's intent to copy all positions from a monitored wallet, including source wallet address, user's available balance, allocation percentage (default 100%)
- **Position Distribution**: The calculated proportional allocation for each position, including symbol, side (long/short), percentage of total, absolute size, leverage, estimated cost
- **Execution Result**: Track success/failure for each position, including order details, actual size, entry price, errors

## Success Criteria

### Measurable Outcomes

- **SC-001**: Users can copy all positions from a monitored wallet in under 10 seconds (including preview and confirmation)
- **SC-002**: Position size calculation maintains ≤1% error margin from exact proportional distribution
- **SC-003**: System executes multi-position copies with ≥95% success rate (all positions open successfully)
- **SC-004**: Preview modal displays all position details with ≤200ms load time
- **SC-005**: 90% of users successfully copy positions on first attempt without errors
- **SC-006**: System handles edge cases (insufficient balance, market unavailable) with clear error messages
- **SC-007**: Position distribution calculations complete in ≤100ms for up to 10 simultaneous positions

## Assumptions

- Users understand basic trading concepts (long/short, leverage, position sizing)
- Monitored wallet's positions are already loaded and available in the UI
- User has already configured API key and trading parameters
- Execution uses existing copy trading infrastructure (leverage management, order execution)
- System uses Hyperliquid's minimum trade size of $12 per position
- Default allocation is 100% of available balance, adjustable by user
- Position merging uses simple averaging for entry price when combining existing and new positions
- Leverage is copied as-is from monitored wallet (subject to user's configured max leverage limit)

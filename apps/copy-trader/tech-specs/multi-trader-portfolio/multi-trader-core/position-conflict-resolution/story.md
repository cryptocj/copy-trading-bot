# User Story: Position Conflict Resolution

## Story

**As a** user following multiple AI traders
**I want** the system to automatically handle conflicts when multiple traders open the same position (symbol + side)
**So that** I don't end up with oversized positions that exceed my risk tolerance or available capital.

## Priority

**Must Have (P0)** - MVP Core Feature

## Acceptance Criteria

### AC1: Detect Position Conflicts
- **Given** Multiple traders are being monitored
- **When** 2 or more traders open positions with same symbol AND same side (LONG/SHORT)
- **Then** System detects the conflict before executing positions
- **And** System logs the conflict with details (traders, symbol, side, sizes)

### AC2: Apply Default Conflict Strategy (Combine)
- **Given** A position conflict is detected
- **And** User's conflict strategy is "Combine" (default)
- **When** System executes positions
- **Then** System opens a single combined position:
  - Size = sum of all conflicting trader positions (scaled by allocation)
  - Attribution tracked to source traders
  - UI shows conflict indicator (⚠️ icon)
- **And** System validates combined position ≤ available capital

### AC3: Alternative Strategy - Take Largest
- **Given** A position conflict is detected
- **And** User's conflict strategy is "Largest"
- **When** System executes positions
- **Then** System opens only the largest position
- **And** Skips smaller positions
- **And** Logs skipped positions with reason

### AC4: Alternative Strategy - First Only
- **Given** A position conflict is detected
- **And** User's conflict strategy is "First"
- **When** System executes positions
- **Then** System opens only the first trader's position (chronologically)
- **And** Skips subsequent positions
- **And** Logs skipped positions with reason

### AC5: Display Conflict Information in UI
- **Given** A combined or conflicted position exists
- **When** User views the position list
- **Then** Position row shows:
  - ⚠️ Conflict indicator icon
  - Hover tooltip: "Combined (N traders)" or "Conflict resolved: [strategy]"
  - Click to expand: Full breakdown by trader
- **And** Activity log shows conflict resolution details

### AC6: Handle Partial Position Closures
- **Given** A combined position from 2 traders (50% each)
- **When** Trader A closes their position
- **Then** System partially closes the position (reduces by Trader A's contribution)
- **And** Position remains open with Trader B's portion
- **When** Trader B closes their position
- **Then** System fully closes the remaining position

### AC7: Configure Conflict Strategy
- **Given** User is on settings page
- **When** User selects conflict strategy from dropdown
- **Then** Available options: Combine | Largest | First
- **And** Selection persisted in localStorage
- **And** Strategy applies to all future conflicts

## Technical Implementation

### Conflict Detection Logic

```javascript
// Detect conflicts across all trader positions
function detectPositionConflicts(traderPositions) {
  const conflicts = new Map(); // Key: symbol-side, Value: array of positions

  // Group positions by symbol + side
  traderPositions.forEach(traderPos => {
    traderPos.positions.forEach(pos => {
      const key = `${pos.symbol}-${pos.side}`; // e.g., "BTC-PERP-LONG"

      if (!conflicts.has(key)) {
        conflicts.set(key, []);
      }

      conflicts.get(key).push({
        traderId: traderPos.traderId,
        traderName: traderPos.traderName,
        position: pos,
        allocation: traderPos.allocation
      });
    });
  });

  // Filter to only conflicting positions (2+ traders)
  return Array.from(conflicts.entries())
    .filter(([key, positions]) => positions.length > 1)
    .map(([key, positions]) => ({
      symbol: positions[0].position.symbol,
      side: positions[0].position.side,
      conflictingPositions: positions
    }));
}
```

### Conflict Resolution Strategies

```javascript
// Resolve conflicts based on user's strategy
function resolveConflicts(conflicts, strategy) {
  return conflicts.map(conflict => {
    switch (strategy) {
      case 'combine':
        return resolveCombine(conflict);
      case 'largest':
        return resolveLargest(conflict);
      case 'first':
        return resolveFirst(conflict);
      default:
        return resolveCombine(conflict); // Default fallback
    }
  });
}

// Strategy: Combine
function resolveCombine(conflict) {
  const { symbol, side, conflictingPositions } = conflict;

  // Calculate combined size (sum of all scaled positions)
  const combinedSize = conflictingPositions.reduce((sum, cp) => {
    return sum + (cp.position.size * cp.allocation);
  }, 0);

  // Calculate combined notional value
  const combinedValue = conflictingPositions.reduce((sum, cp) => {
    return sum + (cp.position.notionalValue * cp.allocation);
  }, 0);

  // Create attribution map
  const attribution = conflictingPositions.map(cp => ({
    traderId: cp.traderId,
    traderName: cp.traderName,
    contribution: cp.position.size * cp.allocation,
    percentage: (cp.position.size * cp.allocation) / combinedSize
  }));

  return {
    symbol,
    side,
    size: combinedSize,
    notionalValue: combinedValue,
    leverage: conflictingPositions[0].position.leverage, // Assume same leverage
    entryPrice: conflictingPositions[0].position.entryPrice, // Same price
    isConflicted: true,
    strategy: 'combine',
    attribution,
    sourceTraders: conflictingPositions.map(cp => cp.traderId)
  };
}

// Strategy: Largest
function resolveLargest(conflict) {
  const { conflictingPositions } = conflict;

  // Find largest position (by notional value * allocation)
  const largest = conflictingPositions.reduce((max, cp) => {
    const scaledValue = cp.position.notionalValue * cp.allocation;
    const maxScaledValue = max.position.notionalValue * max.allocation;
    return scaledValue > maxScaledValue ? cp : max;
  });

  // Log skipped positions
  conflictingPositions
    .filter(cp => cp.traderId !== largest.traderId)
    .forEach(cp => {
      logActivity('info', `Skipped ${cp.position.symbol} (Trader: ${cp.traderName}) - Conflict: Largest strategy`);
    });

  return {
    ...largest.position,
    size: largest.position.size * largest.allocation,
    notionalValue: largest.position.notionalValue * largest.allocation,
    isConflicted: true,
    strategy: 'largest',
    attribution: [{
      traderId: largest.traderId,
      traderName: largest.traderName,
      contribution: largest.position.size * largest.allocation,
      percentage: 1.0
    }],
    sourceTraders: [largest.traderId]
  };
}

// Strategy: First
function resolveFirst(conflict) {
  const { conflictingPositions } = conflict;

  // Sort by timestamp (assume positions have openedAt field)
  const sorted = conflictingPositions.sort((a, b) =>
    new Date(a.position.openedAt) - new Date(b.position.openedAt)
  );

  const first = sorted[0];

  // Log skipped positions
  sorted.slice(1).forEach(cp => {
    logActivity('info', `Skipped ${cp.position.symbol} (Trader: ${cp.traderName}) - Conflict: First strategy`);
  });

  return {
    ...first.position,
    size: first.position.size * first.allocation,
    notionalValue: first.position.notionalValue * first.allocation,
    isConflicted: true,
    strategy: 'first',
    attribution: [{
      traderId: first.traderId,
      traderName: first.traderName,
      contribution: first.position.size * first.allocation,
      percentage: 1.0
    }],
    sourceTraders: [first.traderId]
  };
}
```

### Partial Closure Handling

```javascript
// Handle when one trader closes their portion of a combined position
function handlePartialClosure(position, closingTraderId) {
  if (!position.isConflicted) {
    // Normal closure - close entire position
    return { action: 'close_full', size: position.size };
  }

  // Find trader's contribution
  const traderAttribution = position.attribution.find(a => a.traderId === closingTraderId);
  if (!traderAttribution) {
    throw new Error('Trader not found in position attribution');
  }

  // Remove trader from attribution
  const remainingAttribution = position.attribution.filter(a => a.traderId !== closingTraderId);

  if (remainingAttribution.length === 0) {
    // Last trader closing - close entire position
    return { action: 'close_full', size: position.size };
  }

  // Partial closure - reduce position by trader's contribution
  const closureSize = traderAttribution.contribution;
  const newSize = position.size - closureSize;

  return {
    action: 'close_partial',
    size: closureSize,
    remainingSize: newSize,
    remainingAttribution
  };
}
```

### UI Components

```javascript
// Render position with conflict indicator
function renderPosition(position) {
  const conflictIndicator = position.isConflicted
    ? `<span class="conflict-indicator" title="Combined (${position.attribution.length} traders)">⚠️</span>`
    : '';

  const attributionDetails = position.isConflicted
    ? `<div class="attribution-details">
         ${position.attribution.map(a => `
           <div class="attribution-item">
             <span>${a.traderName}</span>
             <span>${a.contribution.toFixed(4)} (${(a.percentage * 100).toFixed(1)}%)</span>
           </div>
         `).join('')}
       </div>`
    : '';

  return `
    <div class="position-row ${position.isConflicted ? 'conflicted' : ''}">
      <span class="symbol">${position.symbol}</span>
      <span class="side ${position.side.toLowerCase()}">${position.side}</span>
      <span class="size">${position.size.toFixed(4)}</span>
      ${conflictIndicator}
      ${attributionDetails}
    </div>
  `;
}
```

## Test Scenarios

### Test 1: Detect Simple Conflict (2 Traders, Same Symbol/Side)
- **Given** Trader A opens BTC-PERP LONG (0.1 BTC)
- **And** Trader B opens BTC-PERP LONG (0.15 BTC)
- **When** System fetches positions
- **Then** Conflict detected for BTC-PERP LONG
- **And** Conflict logged with both traders

### Test 2: Combine Strategy - Add Positions
- **Given** Conflict detected (Trader A: 0.1 BTC, Trader B: 0.15 BTC)
- **And** Both traders have 50% allocation
- **And** Strategy is "Combine"
- **When** System resolves conflict
- **Then** Single position opened: 0.125 BTC (0.05 + 0.075)
- **And** Attribution: Trader A 40%, Trader B 60%

### Test 3: Largest Strategy - Keep Biggest
- **Given** Conflict detected (Trader A: 0.1 BTC @ 50%, Trader B: 0.15 BTC @ 50%)
- **And** Strategy is "Largest"
- **When** System resolves conflict
- **Then** Only Trader B's position opened: 0.075 BTC
- **And** Trader A's position skipped and logged

### Test 4: First Strategy - Chronological Order
- **Given** Trader A opens position at 10:00:00
- **And** Trader B opens same position at 10:00:05
- **And** Strategy is "First"
- **When** System resolves conflict
- **Then** Only Trader A's position opened
- **And** Trader B's position skipped and logged

### Test 5: No Conflict - Different Sides
- **Given** Trader A opens BTC-PERP LONG
- **And** Trader B opens BTC-PERP SHORT
- **When** System checks for conflicts
- **Then** No conflict detected (opposite sides)
- **And** Both positions opened independently

### Test 6: No Conflict - Different Symbols
- **Given** Trader A opens BTC-PERP LONG
- **And** Trader B opens ETH-PERP LONG
- **When** System checks for conflicts
- **Then** No conflict detected (different symbols)
- **And** Both positions opened independently

### Test 7: Partial Closure (Combined Position)
- **Given** Combined position: BTC-PERP LONG, 0.125 BTC
  - Trader A: 0.05 BTC (40%)
  - Trader B: 0.075 BTC (60%)
- **When** Trader A closes their position
- **Then** Position partially closed: -0.05 BTC
- **And** Remaining position: 0.075 BTC (Trader B only)
- **When** Trader B closes their position
- **Then** Position fully closed

### Test 8: Three-Way Conflict
- **Given** Trader A, B, C all open BTC-PERP LONG
- **And** Strategy is "Combine"
- **When** System resolves conflict
- **Then** Single combined position with 3-way attribution
- **And** Partial closures handled independently

## Dependencies

### Requires
- Multiple Trader Configuration (must have traders to detect conflicts)
- Position fetching logic (to get trader positions)
- Capital allocation system (for scaling)

### Blocks
- Aggregated Portfolio View (conflict indicators needed)

## Estimated Effort

**3-4 days** (1 developer)

- Day 1: Conflict detection logic, data structures
- Day 2: Resolution strategies (Combine, Largest, First)
- Day 3: Partial closure handling, attribution tracking
- Day 4: UI components, testing, edge cases

## Notes

- Conflict resolution happens BEFORE position execution (prevents over-allocation)
- Combined positions track attribution for proper partial closures
- Strategy selection persisted in localStorage config
- Future: Per-symbol conflict strategy overrides (Phase 2)
- Future: "Average" and "None" strategies (Phase 2 - REQ-13)
- Consider adding conflict simulation/preview mode for testing
- Conflict logs critical for debugging and user transparency

## Related Requirements

- **REQ-3**: Position Conflict Resolution

## Related User Stories

- Multiple Trader Configuration (provides traders)
- Aggregated Portfolio View (displays conflicts)
- Position Scaling (applies after conflict resolution)

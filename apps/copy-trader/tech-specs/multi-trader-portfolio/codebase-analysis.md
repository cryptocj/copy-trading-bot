# Codebase Analysis: Multi-Trader Portfolio

## Summary

The codebase **already has substantial multi-trader infrastructure** in `multi-trader-state.js`. This provides a strong foundation for implementing the multi-trader-core epic stories.

## Existing Infrastructure

### 1. Multi-Trader State Management (`js/multi-trader-state.js`)

**State Structure** (Lines 12-63):
```javascript
export const multiState = {
  isMonitoring: false,
  syncIntervals: new Map(), // Per-trader sync intervals
  watchedTraders: [], // Array of trader objects
  config: {
    allocationStrategy: 'equal', // equal | performance | sharpe | custom
    minPositionSize: 10,
    privateKey: null,
    platform: 'moonlander',
    maxTraders: 5,
    totalPortfolio: 0,
    minPnl: 10,
    minWinRate: 60,
  },
  portfolio: {
    positions: [], // With trader attribution
    totalValue: 0,
    totalMargin: 0,
    totalPnl: 0,
    availableBalance: 0,
  },
  stats: { syncs, opened, closed, errors, totalPnl, winRate, activePositions },
  activityLog: [],
  performance: {
    dailyPnl: [],
    traderContributions: new Map(),
  },
};
```

**Trader Object Structure** (Lines 66-83):
```javascript
{
  address: string,
  platform: 'hyperliquid' | 'moonlander',
  name: string,
  allocation: number, // % of portfolio (0-100)
  isActive: boolean,
  addedAt: timestamp,
  performance: {
    pnl, winRate, totalTrades, sharpeRatio, roi
  },
  positions: Array,
  lastSync: timestamp,
}
```

### 2. Trader Management Functions

**Already Implemented** (Lines 174-321):
- ✅ `addTrader(address, platform, name, allocation)` - Add trader with validation
- ✅ `removeTrader(address)` - Remove trader and their positions
- ✅ `toggleTraderActive(address, isActive)` - Pause/resume trader
- ✅ `getActiveTraders()` - Filter active traders
- ✅ `getTrader(address)` - Find trader by address
- ✅ `updateTraderPerformance(address, performance)` - Update metrics
- ✅ `updateTraderPositions(address, positions)` - Update positions

**Validation Logic**:
- Duplicate address check (case-insensitive)
- Max traders limit enforcement (default: 5)
- Positions cleanup on trader removal

### 3. Allocation Calculation (`calculateAllocations()` - Lines 329-395)

**Strategies Implemented**:
1. **Equal**: 100% / N traders (simple, MVP-ready)
2. **Performance**: Based on historical PnL (fallback to equal if no PnL)
3. **Sharpe**: Risk-adjusted returns (fallback to equal if no Sharpe)
4. **Custom**: User-defined, normalized to 100%

**Key Logic**:
```javascript
case 'equal':
  const equalAllocation = 100 / activeTraders.length;
  activeTraders.forEach(trader => {
    trader.allocation = equalAllocation;
  });
```

### 4. Portfolio Management

**Functions** (Lines 397-429):
- ✅ `getTraderAllocation(address)` - Calculate allocated capital
- ✅ `updatePortfolioStats()` - Aggregate portfolio metrics
  - Total value, margin, PnL
  - Active positions count
  - Win rate from closed positions

### 5. State Persistence (`localStorage`)

**Keys Defined** (Lines 7-9):
- `multi_trader_watched_traders` - Trader list
- `multi_trader_config` - Configuration (excluding privateKey)
- `multi_trader_positions` - Portfolio positions

**Functions** (Lines 92-160):
- ✅ `loadMultiTraderState()` - Load from localStorage
- ✅ `saveWatchedTraders()` - Persist traders
- ✅ `saveMultiConfig()` - Persist config (never saves privateKey)
- ✅ `savePortfolioPositions()` - Persist positions

### 6. Activity Logging (Lines 440-460)

- ✅ `addActivityLog(type, message)` - Add log entry with timestamp
- ✅ `clearActivityLog()` - Clear logs
- Keeps last 100 entries

### 7. Position Scaling (`js/sync-engine.js`)

**`calculateTargetPositions()` Function** (Lines 26-100):
- Calculates trader's total margin
- Applies dynamic safety buffer (100%)
- Scales positions proportionally
- Filters positions below minimum value ($20)
- Logs skipped positions

**Key Logic**:
```javascript
let scalingFactor = traderTotalMargin > 0
  ? (copyBalance * dynamicSafetyBuffer) / traderTotalMargin
  : 0;

if (scalingFactor > MAX_SCALING_FACTOR) {
  scalingFactor = MAX_SCALING_FACTOR; // Cap at 100%
}

const copySize = (copyMargin * pos.leverage) / pos.entryPrice;
const finalSize = Math.min(copySize, pos.size); // Never exceed trader
```

### 8. Configuration Constants (`js/config.js`)

**Trading Parameters**:
- `MIN_COPY_BALANCE`: $50
- `MIN_POSITION_VALUE`: $20
- `SIZE_TOLERANCE`: 25% (before adjustment)
- `DEFAULT_SLIPPAGE_PERCENT`: 10%

**Sync Settings**:
- `DEFAULT_SYNC_INTERVAL`: 10 seconds
- `MAX_SCALING_FACTOR`: 1.0 (100% cap)
- `SAFETY_BUFFER_PERCENT`: 1.0 (100% cap)

## What's Missing (To Implement)

### 1. Position Conflict Resolution
- **Not Implemented**: Conflict detection across traders
- **Not Implemented**: Conflict resolution strategies (Combine/Largest/First)
- **Not Implemented**: Attribution tracking for combined positions
- **Not Implemented**: Partial closure handling

### 2. Aggregated Portfolio View UI
- **Not Implemented**: UI for displaying consolidated positions
- **Not Implemented**: View toggle (aggregated vs. per-trader)
- **Not Implemented**: Attribution breakdown UI
- **Not Implemented**: Conflict indicators in UI

### 3. Real-Time Updates
- **Not Implemented**: Real-time portfolio metrics updates
- **Not Implemented**: Real-time position price updates
- **Not Implemented**: PnL color coding in UI

## Reusable Patterns for Specs

### 1. State Management Pattern
```javascript
// From multi-trader-state.js
import { multiState, saveWatchedTraders } from './multi-trader-state.js';

// Modify state
multiState.watchedTraders.push(newTrader);

// Persist
saveWatchedTraders();
```

### 2. Trader Management Pattern
```javascript
// Add trader with validation
const success = addTrader(address, platform, name);
if (!success) {
  // Handle error (duplicate, max limit, etc.)
}

// Auto-calculate allocations
calculateAllocations(); // Uses equal strategy in MVP
```

### 3. Position Scaling Pattern
```javascript
// From sync-engine.js
const scaledPositions = calculateTargetPositions(
  traderPositions,
  copyBalance,
  traderAccountData,
  userAccountData
);

// Filter valid positions (already implemented)
```

### 4. Activity Logging Pattern
```javascript
// From multi-trader-state.js
addActivityLog('success', 'Trader added: 0x123...');
addActivityLog('error', 'Failed to sync trader positions');
addActivityLog('warning', 'Conflict detected: BTC-PERP LONG');
```

### 5. localStorage Persistence Pattern
```javascript
// From multi-trader-state.js
try {
  localStorage.setItem(key, JSON.stringify(data));
} catch (error) {
  console.error('Failed to save:', error);
}

// Load with fallback
try {
  const saved = localStorage.getItem(key);
  return saved ? JSON.parse(saved) : defaultValue;
} catch (error) {
  console.error('Failed to load:', error);
  return defaultValue;
}
```

### 6. ES6 Module Pattern
```javascript
// Export named functions
export function addTrader(...) { }
export function removeTrader(...) { }

// Import in other modules
import { addTrader, removeTrader } from './multi-trader-state.js';
```

## Key Files Reference

| File | Purpose | Lines | Status |
|------|---------|-------|--------|
| `js/multi-trader-state.js` | Multi-trader state management | 528 | ✅ Complete |
| `js/state.js` | Single-trader state (legacy) | 86 | ⚠️ Will coexist |
| `js/sync-engine.js` | Position synchronization | ~500 | ⚠️ Needs conflict logic |
| `js/config.js` | Configuration constants | 63 | ✅ Complete |
| `js/ui.js` | UI rendering | Unknown | ⚠️ Needs multi-trader views |
| `js/hyperliquid-service.js` | Hyperliquid API integration | Unknown | ✅ Complete |
| `js/moonlander-service.js` | Moonlander API integration | Unknown | ✅ Complete |
| `js/utils.js` | Utility functions | Unknown | ✅ Complete |

## Implementation Strategy

### Phase 1: Leverage Existing Infrastructure
1. Use existing `multiState` structure (no changes needed)
2. Use existing `addTrader()`, `removeTrader()` functions (no changes needed)
3. Use existing `calculateAllocations()` with 'equal' strategy (MVP default)
4. Use existing localStorage persistence functions

### Phase 2: Add Missing Functionality
1. Implement conflict detection in sync-engine.js
2. Implement conflict resolution strategies
3. Build aggregated portfolio view UI
4. Add real-time update logic

### Phase 3: Integration
1. Wire up UI to existing state management
2. Connect conflict resolution to sync engine
3. Test end-to-end flows

## Recommendations for Specs

1. **Reuse Existing State Structure**: Don't reinvent - use `multiState` as-is
2. **Extend Sync Engine**: Add conflict detection/resolution to existing `calculateTargetPositions()`
3. **Follow Existing Patterns**: Use same error handling, logging, persistence patterns
4. **Minimal UI Changes**: Build on existing UI patterns in `ui.js`
5. **Backward Compatibility**: Keep single-trader mode working (state.js)

## Next Steps

1. Generate spec for **Multiple Trader Configuration** - mostly UI bindings to existing functions
2. Generate spec for **Position Conflict Resolution** - extend sync-engine.js
3. Generate spec for **Aggregated Portfolio View** - new UI components using existing state

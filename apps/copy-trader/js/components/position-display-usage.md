# Position Display Component - Usage Guide

Reusable component for displaying trading positions with balance info in both compact and full modes.

## Import

```javascript
import { createPositionDisplay } from './components/position-display.js';
```

## Usage Examples

### 1. Compact Mode (Multi-Trader Cards)

```javascript
// In ui-multi-trader.js
const { tableHtml } = createPositionDisplay({
  positions: posArray,
  accountData: null,
  mode: 'compact',
  showBalanceInfo: false,
});

// Returns 5-column table: Symbol, Side, Size, Entry, PnL
```

### 2. Full Mode (index.html Position Tables)

```javascript
// In js/ui.js - Update the updatePositions function
import { createPositionDisplay } from './components/position-display.js';

function updatePositions(traderPositions, userPositions, traderAccountData, userAccountData) {
  // Trader positions (full mode)
  const traderDisplay = createPositionDisplay({
    positions: traderPositions,
    accountData: traderAccountData,
    mode: 'full',
    showBalanceInfo: false, // Balance shown separately in index.html
  });

  document.getElementById('trader-positions-body').innerHTML =
    traderDisplay.tableHtml || '<tr><td colspan="13" class="text-center">No positions</td></tr>';

  // User positions (full mode)
  const userDisplay = createPositionDisplay({
    positions: userPositions,
    accountData: userAccountData,
    mode: 'full',
    showBalanceInfo: false,
  });

  document.getElementById('user-positions-body').innerHTML =
    userDisplay.tableHtml || '<tr><td colspan="13" class="text-center">No positions</td></tr>';
}
```

### 3. With Balance Info

```javascript
const { fullHtml } = createPositionDisplay({
  positions: positions,
  accountData: {
    marginSummary: { accountValue: 10000 },
    freeBalance: 5000,
  },
  mode: 'compact',
  showBalanceInfo: true,
});

// Returns balance info + table
document.getElementById('container').innerHTML = fullHtml;
```

## API Reference

### `createPositionDisplay(options)`

**Parameters:**

- `options.positions` (Array): Array of position objects
  - Required fields: `symbol`, `side`, `size`, `entryPrice`, `leverage`
  - Optional fields: `unrealizedPnl`, `stopLoss`, `takeProfit`, `margin`, `timestamp`

- `options.accountData` (Object | null): Account balance data
  - `marginSummary.accountValue`: Total account value
  - `freeBalance`: Available balance

- `options.mode` (string): Display mode
  - `'compact'`: 5 columns (Symbol, Side, Size, Entry, PnL)
  - `'full'`: 13 columns (all position details)

- `options.showBalanceInfo` (boolean): Show balance summary section
  - Default: `true`

**Returns:** Object with:
- `balanceHtml`: Balance info HTML
- `tableHtml`: Table HTML
- `fullHtml`: Combined HTML

## Position Object Format

```javascript
{
  symbol: 'BTC',           // Required
  side: 'long' | 'short',  // Required
  size: 0.5,               // Required
  entryPrice: 45000,       // Required
  leverage: 10,            // Required
  unrealizedPnl: 250.50,   // Optional
  stopLoss: 44000,         // Optional
  takeProfit: 46000,       // Optional
  margin: 2250,            // Optional (calculated if not provided)
  timestamp: 1234567890,   // Optional (ms)
}
```

## Styling

The component uses these CSS classes (already defined in multi-trader.css and index.html):

- `.positions-table` - Table container
- `.side-long` / `.side-short` - Side badges
- `.text-green-400` / `.text-red-400` - PnL colors
- `.font-semibold` - Symbol text
- `.font-mono` - Numeric values
- `.text-right` - Right-aligned columns

## Migration from Old Code

### Before (ui-multi-trader.js):

```javascript
function renderTraderPositions(positions) {
  return `
    <div class="positions-list">
      <div class="positions-header">Open Positions (${positions.length}):</div>
      <div class="positions-table">
        <div class="position-table-header">...</div>
        ${positions.map(pos => `<div class="position-row">...</div>`).join('')}
      </div>
    </div>
  `;
}
```

### After (ui-multi-trader.js):

```javascript
import { createPositionDisplay } from './components/position-display.js';

function renderTraderPositions(positions) {
  const { tableHtml } = createPositionDisplay({
    positions: positions,
    accountData: null,
    mode: 'compact',
    showBalanceInfo: false,
  });

  return `
    <div class="positions-list">
      <div class="positions-header">Open Positions (${positions.length}):</div>
      ${tableHtml}
    </div>
  `;
}
```

## Benefits

✅ **DRY**: Single source of truth for position rendering
✅ **Consistent**: Same calculations across all pages
✅ **Maintainable**: Update logic in one place
✅ **Flexible**: Compact & full modes for different contexts
✅ **Tested**: Handles edge cases (missing data, calculations)

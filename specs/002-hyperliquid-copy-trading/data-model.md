# Data Model: Hyperliquid Copy Trading

**Feature**: Hyperliquid Copy Trading
**Date**: 2025-01-18
**Storage**: Browser memory only (no database persistence)

## Overview

This feature uses **in-memory data structures** stored in browser JavaScript variables. No database, no localStorage - all state is ephemeral and cleared when the tab closes. This aligns with the MVP constitution principle of simplicity and the spec requirement for browser-only operation.

## Entities

### 1. LeaderboardTrader

Represents a trader from the Hyperliquid public leaderboard API.

**Source**: `GET https://stats-data.hyperliquid.xyz/Mainnet/leaderboard`

**Structure**:
```javascript
{
  address: string,          // Ethereum wallet address (40-char hex)
  accountValue: number,     // Total account value in USDC
  weeklyPnL: number,        // Week profit/loss in USDC
  weeklyROI: number,        // Week return on investment (decimal, e.g., 0.0752 = 7.52%)
  weeklyVolume: number,     // Week trading volume in USDC
  displayName: string | null // Optional trader display name
}
```

**Validation Rules**:
- `address` MUST be 40 hex characters (case-insensitive)
- `accountValue` MUST be > 0
- `weeklyROI` is decimal percentage (not percentage points)
- All numeric fields parsed from API strings using `parseFloat()`

**State Transitions**: N/A (read-only, fetched once on page load)

**Storage**:
```javascript
// Global variable in main.js
let leaderboardTraders = []; // Array of LeaderboardTrader objects
```

---

### 2. CopyTradingConfiguration

User-provided configuration for copy trading session.

**Source**: Form inputs in UI

**Structure**:
```javascript
{
  traderAddress: string,    // Monitored trader's wallet address (40-char hex)
  userApiKey: string,       // User's Hyperliquid API key (64-char hex)
  tradeValue: number,       // Dollar amount per copied trade (USD, min $12)
  maxLeverage: number       // Maximum leverage (1-50x)
}
```

**Validation Rules**:
- `traderAddress`: 40 hex characters, optional 0x prefix
- `userApiKey`: 64 hex characters, optional 0x prefix
- `tradeValue`: >= 12 (minimum $12 USDC per spec FR-003)
- `maxLeverage`: integer between 1 and 50 inclusive (per spec FR-004)

**State Transitions**:
```
EMPTY (initial)
  → VALID (all fields pass validation)
  → ACTIVE (copy trading started, form disabled)
  → VALID (copy trading stopped, form re-enabled)
```

**Storage**:
```javascript
// Global variable in main.js
let config = {
  traderAddress: '',
  userApiKey: '',
  tradeValue: 0,
  maxLeverage: 1
};

let isCopyTradingActive = false; // Tracks active state
```

---

### 3. CopiedOrder

Represents a successfully executed copy trade displayed in the UI.

**Source**: Created when CCXT `createLimitOrder()` succeeds

**Structure**:
```javascript
{
  symbol: string,           // Trading pair (e.g., "BTC/USDT")
  side: 'buy' | 'sell',    // Order side
  amount: number,           // Position size in base currency
  price: number,            // Entry price in quote currency
  timestamp: number         // Execution time (Unix timestamp ms)
}
```

**Validation Rules**:
- `symbol` format: `BASE/QUOTE` (e.g., "BTC/USDT", "ETH/USDT")
- `side` MUST be either "buy" or "sell"
- `amount` MUST be > 0
- `price` MUST be > 0
- `timestamp` MUST be valid Unix timestamp

**State Transitions**: N/A (immutable once created, only added/removed from list)

**Storage**:
```javascript
// Global variable in main.js
let orderList = []; // Array of CopiedOrder, max length 6 (FIFO)
```

**FIFO Behavior**:
```javascript
function addOrder(order) {
  orderList.unshift(order);  // Add to front
  if (orderList.length > 6) {
    orderList.pop();           // Remove oldest
  }
  renderOrderList();
}
```

---

### 4. ActiveTradingSession

Runtime state for active copy trading monitoring.

**Source**: Created when user clicks "Start Copy Trading"

**Structure**:
```javascript
{
  monitorExchange: ccxt.pro.hyperliquid,  // WebSocket connection for watching trades
  executeExchange: ccxt.hyperliquid,      // REST API connection for placing orders
  activationTimestamp: number,             // Start time (Unix timestamp ms)
  leverageCache: Map<string, number>,      // Symbol → leverage mapping
  isRunning: boolean                       // Monitoring loop control flag
}
```

**Validation Rules**: N/A (internal runtime state)

**State Transitions**:
```
NULL (before start)
  → INITIALIZING (creating CCXT instances)
  → ACTIVE (monitoring loop running)
  → STOPPING (closing connections)
  → NULL (connections closed, variables cleared)
```

**Storage**:
```javascript
// Global variable in main.js
let session = null; // ActiveTradingSession | null
```

**Lifecycle**:
```javascript
// Start
session = {
  monitorExchange: new ccxt.pro.hyperliquid({ apiKey, secret }),
  executeExchange: new ccxt.hyperliquid({ apiKey, secret }),
  activationTimestamp: Date.now(),
  leverageCache: new Map(),
  isRunning: true
};

// Stop
session.isRunning = false;
await session.monitorExchange.close();
await session.executeExchange.close();
session = null;
```

---

## Relationships

### Entity Relationships

```
LeaderboardTrader (1) --- (0..1) CopyTradingConfiguration
  └─ User selects trader → populates traderAddress

CopyTradingConfiguration (1) --- (0..1) ActiveTradingSession
  └─ Config used to initialize session

ActiveTradingSession (1) --- (0..N) CopiedOrder
  └─ Session creates orders as trades are copied
```

**Diagram**:
```
┌─────────────────────┐
│ LeaderboardTrader   │
│ - address           │
│ - accountValue      │
│ - weeklyROI         │
└──────────┬──────────┘
           │ selects
           ↓
┌─────────────────────┐
│ Configuration       │
│ - traderAddress     │
│ - userApiKey        │
│ - tradeValue        │
│ - maxLeverage       │
└──────────┬──────────┘
           │ starts
           ↓
┌─────────────────────┐     creates     ┌─────────────────────┐
│ ActiveSession       │ ──────────────→ │ CopiedOrder         │
│ - monitorExchange   │                 │ - symbol            │
│ - executeExchange   │                 │ - side              │
│ - activationTime    │                 │ - amount            │
│ - leverageCache     │                 │ - price             │
└─────────────────────┘                 │ - timestamp         │
                                        └─────────────────────┘
```

---

## Data Flow

### 1. Trader Discovery Flow

```
User opens page
  ↓
main.js calls fetchLeaderboard()
  ↓
GET https://stats-data.hyperliquid.xyz/Mainnet/leaderboard
  ↓
Parse response → Array<LeaderboardTrader>
  ↓
Sort by weeklyROI (descending)
  ↓
Take top 20
  ↓
Store in leaderboardTraders[]
  ↓
Render table with click handlers
```

### 2. Configuration Flow

```
User clicks leaderboard row
  ↓
Extract address from row.dataset.address
  ↓
Update config.traderAddress
  ↓
Populate form input
  ↓
User fills remaining fields (apiKey, tradeValue, maxLeverage)
  ↓
Validate each field on blur
  ↓
Enable "Start" button when all valid
```

### 3. Trading Session Flow

```
User clicks "Start Copy Trading"
  ↓
Create ActiveTradingSession
  ↓
Initialize monitorExchange (ccxt.pro.hyperliquid)
  ↓
Initialize executeExchange (ccxt.hyperliquid)
  ↓
Start monitoring loop:
  while (session.isRunning) {
    trades = await monitorExchange.watchMyTrades(traderAddress)

    for each trade {
      if (trade.timestamp < activationTimestamp) continue

      Calculate amount = tradeValue / trade.price

      if (!leverageCache.has(symbol)) {
        marketInfo = await fetchMarket(symbol)
        leverage = min(maxLeverage, marketInfo.limits.leverage.max)
        await setMarginMode('cross', symbol, leverage)
        leverageCache.set(symbol, leverage)
      }

      order = await createLimitOrder(symbol, side, amount, price)

      copiedOrder = { symbol, side, amount, price, timestamp: now() }
      addOrder(copiedOrder)
    }
  }
```

### 4. Stop Flow

```
User clicks "Stop Copy Trading"
  ↓
Set session.isRunning = false
  ↓
Close monitorExchange connection
  ↓
Close executeExchange connection
  ↓
Clear leverageCache
  ↓
Set session = null
  ↓
Re-enable form inputs
```

---

## Memory Management

### Size Estimates

**LeaderboardTrader** (20 traders):
- 20 objects × ~200 bytes each = **~4 KB**

**CopyTradingConfiguration** (1 object):
- 4 strings (addresses, key) + 2 numbers = **~500 bytes**

**CopiedOrder** (6 orders max):
- 6 objects × ~150 bytes each = **~900 bytes**

**ActiveTradingSession** (1 object):
- 2 CCXT instances + Map + primitives = **~50 KB** (CCXT library overhead)

**Total Peak Memory**: ~55 KB (negligible for modern browsers)

### Cleanup Strategy

**On Tab Close**: All memory automatically released by browser

**On Stop Copy Trading**:
```javascript
async function stopCopyTrading() {
  if (session) {
    session.isRunning = false;
    await session.monitorExchange.close();
    await session.executeExchange.close();
    session.leverageCache.clear();
    session = null;
  }

  isCopyTradingActive = false;
  setFormDisabled(false);
}
```

**On Error**:
```javascript
window.addEventListener('error', (event) => {
  console.error('Global error:', event.error);
  if (session) {
    stopCopyTrading(); // Cleanup on crash
  }
});
```

---

## Validation Summary

### Required Validations (from spec FRs)

| Field          | FR     | Validation Rule                              | Error Message                              |
| -------------- | ------ | -------------------------------------------- | ------------------------------------------ |
| traderAddress  | FR-006 | 40 hex chars, optional 0x                    | "Invalid address format (40 hex chars)"    |
| userApiKey     | FR-007 | 64 hex chars, optional 0x                    | "Invalid API key format (64 hex chars)"    |
| tradeValue     | FR-008 | >= 12 (number)                               | "Minimum trade value is $12 USDC"          |
| maxLeverage    | FR-009 | 1-50 (integer)                               | "Leverage must be between 1x and 50x"      |

### Validation Functions

```javascript
// validation.js

export function validateAddress(address) {
  const clean = address.toLowerCase().replace(/^0x/, '');
  if (!/^[0-9a-f]{40}$/.test(clean)) {
    return { valid: false, error: 'Invalid address format (40 hex chars)' };
  }
  return { valid: true, address: '0x' + clean };
}

export function validateApiKey(key) {
  const clean = key.toLowerCase().replace(/^0x/, '');
  if (!/^[0-9a-f]{64}$/.test(clean)) {
    return { valid: false, error: 'Invalid API key format (64 hex chars)' };
  }
  return { valid: true, key: '0x' + clean };
}

export function validateTradeValue(value) {
  const num = parseFloat(value);
  if (isNaN(num) || num < 12) {
    return { valid: false, error: 'Minimum trade value is $12 USDC' };
  }
  return { valid: true, value: num };
}

export function validateLeverage(leverage) {
  const num = parseInt(leverage);
  if (isNaN(num) || num < 1 || num > 50) {
    return { valid: false, error: 'Leverage must be between 1x and 50x' };
  }
  return { valid: true, leverage: num };
}
```

---

## Edge Case Handling

### Leaderboard API Unavailable (FR-005)

```javascript
async function fetchLeaderboard() {
  try {
    const response = await fetch('https://stats-data.hyperliquid.xyz/Mainnet/leaderboard');
    if (!response.ok) throw new Error('API returned ' + response.status);

    const data = await response.json();
    return parseLeaderboardData(data);
  } catch (error) {
    console.error('Leaderboard fetch failed:', error);

    // Show error message
    document.getElementById('leaderboard-error').textContent =
      'Failed to load leaderboard. You can still enter a trader address manually below.';

    // Return empty array - manual entry still works
    return [];
  }
}
```

### Network Disconnect During Monitoring (FR-022)

```javascript
async function monitoringLoop() {
  while (session.isRunning) {
    try {
      const trades = await session.monitorExchange.watchMyTrades(config.traderAddress);
      // Process trades...
    } catch (error) {
      console.error('Monitor error:', error);

      // Reset activation timestamp to prevent copying stale trades after reconnect
      session.activationTimestamp = Date.now();

      // Wait before retry
      await sleep(5000);
    }
  }
}
```

### Insufficient Balance (Logged, Not Blocking)

```javascript
try {
  const order = await session.executeExchange.createLimitOrder(symbol, side, amount, price);
  addOrder(order);
} catch (error) {
  if (error.message.includes('insufficient')) {
    console.error('Insufficient balance for order:', { symbol, amount, price });
    // Continue monitoring - don't stop copy trading
  } else {
    throw error; // Other errors bubble up
  }
}
```

---

## Future Considerations (Post-MVP)

**Not implemented in MVP, documented for Phase 2**:

1. **localStorage Persistence**: Save config between sessions
2. **Multi-Trader Support**: Array of configurations, multiple WebSocket connections
3. **Historical Orders**: Database storage of all orders beyond last 6
4. **Performance Metrics**: Track user's P&L, win rate, max drawdown
5. **Risk Management State**: Daily loss tracking, circuit breaker thresholds

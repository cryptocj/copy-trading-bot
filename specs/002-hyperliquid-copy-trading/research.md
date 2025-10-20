# Research: Hyperliquid Copy Trading

**Feature**: Hyperliquid Copy Trading
**Date**: 2025-01-18
**Purpose**: Document technology choices, best practices, and integration patterns for browser-based copy trading implementation

## Technology Decisions

### 1. CCXT Library for Exchange Integration

**Decision**: Use CCXT v4.3.66+ with dual integration pattern (ccxt.pro for WebSocket monitoring, ccxt for REST API execution)

**Rationale**:

- **Official Hyperliquid Support**: CCXT has native Hyperliquid exchange integration with both WebSocket and REST APIs
- **Dual Mode Design**: ccxt.pro provides real-time trade monitoring via `watchMyTrades()`, while ccxt provides order execution via `createLimitOrder()`
- **Browser Compatible**: CCXT works in browser environments with proper import configuration
- **Mature Library**: Battle-tested with 120+ exchanges, active maintenance, comprehensive documentation

**Alternatives Considered**:

- **Direct WebSocket Implementation**: Rejected - would require custom protocol handling, reconnection logic, and exchange-specific message parsing
- **Polling REST API**: Rejected - high latency (>5s) for trade detection, excessive API calls, poor user experience
- **Hyperliquid SDK**: Rejected - no official JavaScript SDK available, would need to build from scratch

**Implementation Notes**:

- Import pattern: `import ccxt from 'https://cdn.jsdelivr.net/npm/ccxt@4.3.66/dist/ccxt.browser.js'`
- Use `ccxt.pro.hyperliquid` for monitoring (authenticated with API key for `watchMyTrades`)
- Use `ccxt.hyperliquid` for order placement (authenticated with API key for `createLimitOrder`)
- Handle reconnection automatically with try-catch and timestamp reset

---

### 2. Browser-Based Architecture (No Server)

**Decision**: Implement as pure browser application with no backend server

**Rationale**:

- **MVP Speed**: Eliminates server setup, deployment, and hosting complexity
- **User Privacy**: API keys never leave user's browser, no server-side credential storage
- **Zero Infrastructure Cost**: No hosting fees, no server maintenance
- **Matches Constitution**: Aligns with MVP-First principle of simplest working solution

**Alternatives Considered**:

- **Node.js Backend**: Rejected - adds deployment complexity, hosting costs, and doesn't improve security (user still needs to trust server with API key)
- **Chrome Extension**: Rejected - requires Chrome Web Store approval process, limited to Chrome users, adds packaging complexity

**Implementation Notes**:

- Use browser-native ESM imports (no build step required)
- Store configuration in browser memory only (no localStorage for MVP)
- Session ends when tab closes (acceptable trade-off for MVP simplicity)
- Serve as static files from monorepo `apps/copy-trader/`

---

### 3. Vanilla JavaScript (No Framework)

**Decision**: Use vanilla JavaScript with browser-native ESM modules, no React/Vue/Angular

**Rationale**:

- **MVP Simplicity**: No build tools, no npm scripts, no bundler configuration
- **Fast Development**: Direct DOM manipulation, no framework learning curve
- **Performance**: Zero framework overhead, instant page load
- **Constitution Alignment**: "Good enough" solution that ships quickly

**Alternatives Considered**:

- **React**: Rejected - requires build setup (Webpack/Vite), increases complexity for simple UI (leaderboard table + form + order list)
- **Vue**: Rejected - same concerns as React, overkill for 3 UI components
- **Svelte**: Rejected - requires compiler, adds toolchain complexity

**Implementation Notes**:

- Organize code by feature: `services/leaderboard.js`, `services/trading.js`, `services/validation.js`
- Use ES modules for clean separation: `import { fetchLeaderboard } from './services/leaderboard.js'`
- DOM manipulation with `getElementById`, `querySelector` for targeted updates
- Event delegation for dynamic table rows

---

### 4. Leaderboard API Integration

**Decision**: Fetch from `https://stats-data.hyperliquid.xyz/Mainnet/leaderboard` (public GET endpoint)

**Rationale**:

- **Public API**: No authentication required, no rate limits documented
- **Official Source**: Hyperliquid's stats server, same data as web app
- **Simple Integration**: Standard fetch() API, JSON response parsing

**Response Structure**:

```json
{
  "leaderboardRows": [
    {
      "ethAddress": "0x...",
      "accountValue": "78966920.9561",
      "windowPerformances": [
        ["week", { "pnl": "5439043.86", "roi": "0.0752", "vlm": "26809002207.07" }]
      ]
    }
  ]
}
```

**Implementation Notes**:

- Parse weekly ROI: `row.windowPerformances.find(([period]) => period === 'week')[1].roi`
- Sort by ROI descending: `rows.sort((a, b) => parseFloat(b.weeklyRoi) - parseFloat(a.weeklyRoi))`
- Take top 20: `rows.slice(0, 20)`
- Handle API errors: fallback to manual address entry

---

### 5. Trade Execution Pattern

**Decision**: Use limit orders at trader's exact price (not market orders)

**Rationale**:

- **Price Matching**: Ensures user gets same entry price as trader (critical for copy trading accuracy)
- **Slippage Control**: Limit orders prevent unfavorable fills during volatile markets
- **Spec Requirement**: Functional requirement FR-016 specifies limit orders

**Leverage Calculation**:

```javascript
const userMaxLeverage = parseFloat(document.getElementById('max-leverage').value);
const symbolMaxLeverage = marketInfo.leverage.max; // from exchange API
const leverage = Math.min(userMaxLeverage, symbolMaxLeverage);
```

**Position Sizing**:

```javascript
const tradeValue = parseFloat(document.getElementById('trade-value').value);
const traderEntryPrice = trade.price;
const amount = tradeValue / traderEntryPrice;
```

**Implementation Notes**:

- Set cross margin mode once per symbol: `exchange.setMarginMode('cross', symbol, { leverage })`
- Create limit order: `exchange.createLimitOrder(symbol, side, amount, price)`
- Track leverage cache to avoid redundant setMarginMode calls

---

### 6. Error Handling Strategy

**Decision**: Log all errors to browser console, show user-facing errors only for critical failures

**Rationale**:

- **MVP Debugging**: Console logs sufficient for initial users (developers/power users)
- **Non-Blocking**: Continue monitoring even if individual order fails
- **Constitution Alignment**: Defer comprehensive error UI until Phase 2

**Error Categories**:

- **Critical (block activation)**: Invalid API key, connection failure during start
- **Recoverable (log only)**: Order execution failure, network disconnect (auto-reconnect)
- **Expected (silent)**: Insufficient balance, trader no activity

**Implementation Notes**:

```javascript
try {
  await exchange.createLimitOrder(...);
} catch (error) {
  console.error('Order failed:', error.message, {symbol, side, amount, price});
  // Continue monitoring - don't stop copy trading
}
```

---

## Best Practices

### CCXT Browser Usage

**Import Best Practice**:

```javascript
// Use CDN for browser compatibility
import ccxt from 'https://cdn.jsdelivr.net/npm/ccxt@4.3.66/dist/ccxt.browser.js';
```

**Authentication Pattern**:

```javascript
const exchange = new ccxt.pro.hyperliquid({
  apiKey: userApiKey, // 64-char hex from user input
  secret: userApiKey, // Hyperliquid uses same value for both
});
```

**WebSocket Monitoring**:

```javascript
const activationTimestamp = Date.now();

while (isCopyTradingActive) {
  const trades = await exchange.watchMyTrades(traderAddress);

  for (const trade of trades) {
    if (trade.timestamp < activationTimestamp) continue; // Ignore historical

    // Execute copy logic here
  }
}
```

---

### Input Validation

**Wallet Address Validation**:

```javascript
function isValidAddress(address) {
  // Remove optional 0x prefix
  const cleanAddress = address.toLowerCase().replace(/^0x/, '');

  // Check 40 hex characters
  return /^[0-9a-f]{40}$/.test(cleanAddress);
}
```

**API Key Validation**:

```javascript
function isValidApiKey(key) {
  const cleanKey = key.toLowerCase().replace(/^0x/, '');
  return /^[0-9a-f]{64}$/.test(cleanKey);
}
```

**Trade Value Validation**:

```javascript
function isValidTradeValue(value) {
  const num = parseFloat(value);
  return !isNaN(num) && num >= 12; // Minimum $12 USDC
}
```

**Leverage Validation**:

```javascript
function isValidLeverage(leverage) {
  const num = parseInt(leverage);
  return !isNaN(num) && num >= 1 && num <= 50;
}
```

---

### UI Responsiveness

**Leaderboard Update Pattern**:

```javascript
async function refreshLeaderboard() {
  const response = await fetch('https://stats-data.hyperliquid.xyz/Mainnet/leaderboard');
  const data = await response.json();

  const rows = data.leaderboardRows
    .map(extractWeeklyMetrics)
    .sort((a, b) => b.roi - a.roi)
    .slice(0, 20);

  renderLeaderboardTable(rows);
}
```

**Order List FIFO Pattern**:

```javascript
const orderList = []; // Max 6 orders

function addOrder(order) {
  orderList.unshift(order); // Add to front
  if (orderList.length > 6) {
    orderList.pop(); // Remove oldest
  }
  renderOrderList();
}
```

**Form State Management**:

```javascript
function setFormDisabled(disabled) {
  ['trader-address', 'api-key', 'trade-value', 'max-leverage'].forEach((id) => {
    document.getElementById(id).disabled = disabled;
  });
}
```

---

## Integration Patterns

### Trader Selection Flow

```javascript
// 1. User clicks leaderboard row
document.getElementById('leaderboard-table').addEventListener('click', (e) => {
  const row = e.target.closest('tr[data-address]');
  if (!row) return;

  const address = row.dataset.address;
  document.getElementById('trader-address').value = address;
});

// 2. User fills remaining fields (API key, trade value, leverage)

// 3. User clicks "Start Copy Trading"
document.getElementById('start-button').addEventListener('click', startCopyTrading);
```

### Trade Monitoring Flow

```javascript
async function monitorTrader(traderAddress, userApiKey, config) {
  const monitorExchange = new ccxt.pro.hyperliquid({
    apiKey: userApiKey,
    secret: userApiKey,
  });

  const executeExchange = new ccxt.hyperliquid({
    apiKey: userApiKey,
    secret: userApiKey,
  });

  const activationTime = Date.now();
  const leverageCache = new Map();

  while (isCopyTradingActive) {
    try {
      const trades = await monitorExchange.watchMyTrades(traderAddress);

      for (const trade of trades) {
        if (trade.timestamp < activationTime) continue;

        await executeCopyTrade(trade, executeExchange, config, leverageCache);
      }
    } catch (error) {
      console.error('Monitor error:', error);
      await sleep(5000); // Retry after 5s
    }
  }
}
```

### Copy Execution Flow

```javascript
async function executeCopyTrade(trade, exchange, config, leverageCache) {
  const { symbol, side, price } = trade;
  const { tradeValue, maxLeverage } = config;

  // Calculate position size
  const amount = tradeValue / price;

  // Set leverage if first trade on this symbol
  if (!leverageCache.has(symbol)) {
    const marketInfo = await exchange.fetchMarket(symbol);
    const leverage = Math.min(maxLeverage, marketInfo.limits.leverage.max);

    await exchange.setMarginMode('cross', symbol, { leverage });
    leverageCache.set(symbol, leverage);
  }

  // Execute limit order
  try {
    const order = await exchange.createLimitOrder(symbol, side, amount, price);

    // Add to UI order list
    addOrder({
      symbol,
      side,
      amount,
      price,
      timestamp: Date.now(),
    });
  } catch (error) {
    console.error('Order execution failed:', error.message);
  }
}
```

---

## Security Considerations

### API Key Handling

- **Never Log Keys**: Exclude API keys from console.log statements
- **Memory Only**: Don't store in localStorage (survives tab close)
- **User Responsibility**: Display warning that API key has full trading permissions

### Input Sanitization

- Validate all inputs before passing to CCXT
- Use regex validation for hex addresses/keys
- Sanitize symbol names to prevent injection (though CCXT handles this)

### Rate Limiting

- CCXT handles exchange rate limits automatically
- Leaderboard API: No documented rate limits, but add 1min cache if needed

---

## Performance Optimization

### Lazy Loading

- Only fetch leaderboard once on page load
- Only initialize CCXT when user clicks "Start Copy Trading"
- Cache market info after first fetch per symbol

### Memory Management

- Limit order list to 6 items (FIFO)
- Clear leverageCache on stop
- Close WebSocket connection on stop

### Network Efficiency

- Batch market info fetches if possible (CCXT supports this)
- Use WebSocket for monitoring (more efficient than polling)
- Minimize leaderboard refreshes (cache for 1-5min)

---

## Testing Strategy

Per MVP constitution, manual testing only. See spec.md for acceptance scenarios.

**Manual Test Checklist**:

1. Leaderboard loads within 3 seconds
2. Click trader row → address populates
3. Enter valid credentials → Start button enables
4. Start → WebSocket connection established
5. Trader executes trade → Order appears in list within 5 seconds
6. Stop → Connection closes, form re-enables

---

## Future Considerations (Post-MVP)

These enhancements are out of scope for MVP but documented for Phase 2 planning:

1. **Vault Discovery**: Integrate `https://api.hyperliquid.xyz/info` with `type: "vaultDetails"`
2. **Performance Tracking**: Poll trader portfolio every 60s, display ROI chart
3. **Multi-Trader Portfolio**: Multiple WebSocket connections, allocation percentage per trader
4. **Risk Management**: Circuit breaker for daily loss threshold
5. **Historical Backtesting**: Fetch `userFills` API, simulate copy trading performance

---

## References

- **CCXT Documentation**: https://docs.ccxt.com/
- **CCXT Browser Usage**: https://github.com/ccxt/ccxt/wiki/Install#browser
- **Hyperliquid API Docs**: https://hyperliquid.gitbook.io/hyperliquid-docs/for-developers/api
- **Leaderboard Endpoint**: https://stats-data.hyperliquid.xyz/Mainnet/leaderboard
- **ESM Import Guide**: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide/Modules

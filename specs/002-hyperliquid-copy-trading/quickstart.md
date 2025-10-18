# Quickstart: Hyperliquid Copy Trading

**Feature**: Browser-based copy trading for Hyperliquid DEX
**Estimated Setup Time**: 10-15 minutes
**Prerequisites**: Modern browser (Chrome/Firefox/Safari/Edge), Hyperliquid account with API key

---

## Overview

This feature allows users to discover top traders, select one to copy, and automatically replicate their trades in real-time. Everything runs in the browser - no server required.

**Key Capabilities**:
1. Browse leaderboard of top 20 traders by weekly ROI
2. Configure copy trading parameters (trade value, leverage)
3. Auto-copy trades via WebSocket monitoring
4. View last 6 copied orders in real-time

---

## Quick Start

### Step 1: Verify Prerequisites (2 minutes)

**Browser Requirements**:
- Modern browser with WebSocket support
- JavaScript enabled
- No ad blockers interfering with external API calls

**Hyperliquid Account Requirements**:
- Funded account with ≥$12 USDC per trade
- API key generated from https://app.hyperliquid.xyz/API
  - ⚠️ **Security Note**: API key has full trading permissions
  - Keep private, never share, store securely

**Find a Trader** (Optional):
- Browse leaderboard at https://app.hyperliquid.xyz/leaderboard
- Or let the app show you top traders

---

### Step 2: Run the App (1 minute)

**Option A: Local Development**

```bash
# Navigate to project root
cd /path/to/signal-tracker

# Serve the app
cd apps/copy-trader
python3 -m http.server 8000

# Open browser
open http://localhost:8000
```

**Option B: Direct File Access**

```bash
# Just open the HTML file
open apps/copy-trader/index.html
```

---

### Step 3: Select a Trader (2 minutes)

**Automatic Discovery**:
1. Page loads → leaderboard fetches automatically
2. Top 20 traders displayed, sorted by weekly ROI
3. Review metrics: address, account value, ROI
4. **Click a row** → trader address auto-fills in form

**Manual Entry** (if leaderboard unavailable):
1. Paste trader wallet address in "Trader Address" field
2. Format: 40 hex characters (e.g., `0x87f9...2cf`)

---

### Step 4: Configure Copy Trading (3 minutes)

Fill in the configuration form:

**1. Trader Address** (already filled if clicked leaderboard)
- Example: `0x87f9cd15f5050a9283b8896300f7c8cf69ece2cf`
- Validation: 40 hex characters, optional 0x prefix

**2. Your API Key**
- Get from https://app.hyperliquid.xyz/API
- Format: 64 hex characters
- Example: `0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890`
- ⚠️ **Never share this key** - full trading access

**3. Trade Value** (USD per trade)
- Minimum: $12 USDC
- Example: $50 (will be converted to coin amount at trader's entry price)
- Formula: `amount = trade_value / trader_entry_price`

**4. Max Leverage** (risk control)
- Range: 1x to 50x
- Example: 10x
- System respects minimum of:
  - Your max leverage setting
  - Exchange's per-symbol maximum

---

### Step 5: Start Copy Trading (30 seconds)

1. Click **"Start Copy Trading"** button
2. Form inputs disable (copy trading active)
3. WebSocket connection establishes
4. Bot starts monitoring trader's wallet

**What Happens Next**:
- Trader opens position → Your account copies within 5 seconds
- Order appears in "Recent Orders" list
- Leverage set automatically per symbol (respecting limits)
- Continues until you click "Stop"

---

### Step 6: Monitor Activity (Ongoing)

**Recent Orders Display**:
- Shows last 6 orders (FIFO)
- Columns: Symbol, Side (Buy/Sell), Amount, Timestamp
- Green (+) = Buy, Red (-) = Sell

**Console Logging**:
- Open browser DevTools (F12 or Cmd+Option+I)
- View detailed logs in Console tab
- All errors, order details, connection status

---

### Step 7: Stop Copy Trading (30 seconds)

1. Click **"Stop Copy Trading"** button
2. WebSocket connection closes
3. Form re-enables for new session
4. Order history clears (not persisted)

⚠️ **Closing browser tab also stops copy trading** - no server persistence

---

## Manual Testing Checklist

Based on spec.md acceptance scenarios:

### US1: Trader Discovery

- [ ] **AS-1**: Open page → leaderboard displays top 20 traders within 3 seconds
- [ ] **AS-2**: Click trader row → address populates in "Trader Address" field
- [ ] **AS-3**: Leaderboard unavailable → error message shows, manual entry still works

### US2: Configuration

- [ ] **AS-1**: Enter valid credentials → "Start" button enables
- [ ] **AS-2**: Missing/invalid fields → validation errors show, "Start" button disabled
- [ ] **AS-3**: Click "Stop" → monitoring stops, form re-enables

### US3: Auto-Copy

- [ ] **AS-1**: Trader opens LONG BTC/USDT → matching LONG opens with correct size
- [ ] **AS-2**: Trader uses 20x leverage, user max is 10x → order uses 10x
- [ ] **AS-3**: Trader closes position → user's position closes automatically

### US4: Order Display

- [ ] **AS-1**: 3 orders execute → all 3 display with symbol, side, timestamp
- [ ] **AS-2**: 7 orders execute → only most recent 6 display (oldest removed)
- [ ] **AS-3**: Order fails → error logged to console, monitoring continues

---

## Common Issues & Solutions

### Issue: Leaderboard doesn't load

**Symptoms**: Empty table, error message displayed

**Solutions**:
1. Check browser DevTools Console for API errors
2. Verify network connection
3. Try manual trader address entry (leaderboard is optional)
4. API endpoint: https://stats-data.hyperliquid.xyz/Mainnet/leaderboard

---

### Issue: "Start Copy Trading" button disabled

**Symptoms**: Button remains grayed out after filling form

**Solutions**:
1. Validate each field:
   - Trader Address: 40 hex chars
   - API Key: 64 hex chars
   - Trade Value: ≥ $12
   - Max Leverage: 1-50
2. Check for red error messages below inputs
3. Open Console to see validation errors

---

### Issue: No orders appearing after starting

**Symptoms**: WebSocket connected, but no orders in list

**Possible Causes**:
1. **Trader not actively trading** (most common)
   - Solution: Wait or select different trader
2. **Historical trades ignored** (by design)
   - Only copies trades *after* activation timestamp
   - Prevents copying stale/old positions
3. **Invalid API key**
   - Check Console for authentication errors

---

### Issue: Orders failing to execute

**Symptoms**: Console shows "Order failed" errors

**Common Reasons**:
1. **Insufficient USDC balance**
   - Check account has ≥ trade value in USDC
   - Solution: Deposit more USDC or reduce trade value
2. **Symbol not supported**
   - Hyperliquid may not support that trading pair
   - Solution: Check exchange listings
3. **Leverage exceeds exchange maximum**
   - Some symbols have lower max leverage
   - Solution: System should handle this automatically

---

### Issue: Connection lost during monitoring

**Symptoms**: Console shows WebSocket errors, no new orders

**Recovery**:
- System auto-reconnects after 5 seconds
- Activation timestamp resets (prevents copying stale trades)
- Order history preserved in current session
- If persistent: click "Stop", check internet, restart

---

## Architecture Overview

**No Server Architecture**:
```
Browser Tab
├── index.html                   # UI structure
├── src/main.js                  # Event handlers, app initialization
├── src/services/
│   ├── leaderboard.js          # Fetch/display top traders
│   ├── trading.js              # CCXT WebSocket + order execution
│   └── validation.js           # Input validation functions
└── src/utils/
    └── format.js               # Number/date formatting
```

**External Dependencies**:
- CCXT v4.3.66+ (CDN import for browser)
- Hyperliquid APIs:
  - Leaderboard: `https://stats-data.hyperliquid.xyz/Mainnet/leaderboard`
  - Trading: via CCXT (WebSocket + REST)

**Data Flow**:
```
1. Page Load → Fetch Leaderboard
2. User Selects Trader → Populate Form
3. User Fills Credentials → Validate
4. Click Start → Initialize CCXT
5. Monitor Loop:
   - WebSocket receives trader's trade
   - Calculate position size
   - Set leverage (if first time for symbol)
   - Execute limit order
   - Add to order list
6. Click Stop → Close connections
```

---

## Development Notes

### File Structure

```
apps/copy-trader/
├── index.html                   # Main UI
├── README.md                    # This file
├── src/
│   ├── main.js                  # App entry point
│   ├── services/
│   │   ├── leaderboard.js      # GET leaderboard API
│   │   ├── trading.js          # CCXT integration
│   │   └── validation.js       # Input validators
│   └── utils/
│       └── format.js           # Display formatting
└── styles/
    └── main.css                # UI styling
```

### ESM Import Pattern

```javascript
// src/main.js
import ccxt from 'https://cdn.jsdelivr.net/npm/ccxt@4.3.66/dist/ccxt.browser.js';
import { fetchLeaderboard } from './services/leaderboard.js';
import { startCopyTrading } from './services/trading.js';
import { validateAddress, validateApiKey } from './services/validation.js';
```

### No Build Step

- Pure browser JavaScript (no Webpack/Vite)
- ES modules with `.js` extensions
- CDN imports for external libraries
- Instant development (no `npm install`, no compilation)

---

## Next Steps

### After MVP Validation

**Phase 2 Enhancements** (documented in spec.md, deferred for now):
1. **Vault Discovery**: Browse professional vault leaders
2. **Performance Tracking**: Monitor trader's ROI over time with charts
3. **Multi-Trader Portfolio**: Copy multiple traders with allocation %
4. **Risk Management**: Auto-stop if losses exceed threshold
5. **Historical Backtesting**: Simulate past performance

### Testing in Production

1. **Start Small**: Use minimum trade value ($12) for first test
2. **Single Trade**: Wait for one trade to copy, verify execution
3. **Check Position**: Confirm matching symbol, side, size in Hyperliquid UI
4. **Scale Up**: Increase trade value after successful test
5. **Monitor Closely**: Keep browser tab open, watch Console logs

---

## Security Best Practices

⚠️ **Critical Security Notes**:

1. **API Key Storage**:
   - Never commit API key to git
   - Never share API key with anyone
   - Key has **full trading permissions**
   - Revoke immediately if compromised

2. **Browser Security**:
   - Use trusted browser (official Chrome/Firefox)
   - Avoid public WiFi when trading
   - Close tab when not using (stops copy trading)

3. **Trade Monitoring**:
   - Watch first few trades closely
   - Verify positions match trader's
   - Check leverage is correct
   - Ensure balance sufficient

4. **Risk Management** (Manual for MVP):
   - Start with low trade value
   - Use conservative leverage (5-10x)
   - Don't copy traders with extreme strategies
   - Monitor account balance regularly

---

## Support & Resources

**Documentation**:
- Feature Spec: `/specs/002-hyperliquid-copy-trading/spec.md`
- Implementation Plan: `/specs/002-hyperliquid-copy-trading/plan.md`
- Research Notes: `/specs/002-hyperliquid-copy-trading/research.md`
- Data Model: `/specs/002-hyperliquid-copy-trading/data-model.md`

**External Resources**:
- CCXT Docs: https://docs.ccxt.com/
- Hyperliquid Docs: https://hyperliquid.gitbook.io/hyperliquid-docs/
- Hyperliquid Leaderboard: https://app.hyperliquid.xyz/leaderboard
- Hyperliquid API Keys: https://app.hyperliquid.xyz/API

**Debugging**:
- Browser DevTools Console (F12 or Cmd+Option+I)
- Check leaderboard API: `curl https://stats-data.hyperliquid.xyz/Mainnet/leaderboard`
- CCXT browser examples: https://github.com/ccxt/ccxt/tree/master/examples/js

---

## FAQ

**Q: Does this work on mobile?**
A: Works on mobile browsers, but not optimized for mobile UI (MVP targets desktop). Responsive design deferred to Phase 2.

**Q: Can I copy multiple traders at once?**
A: No, MVP supports one trader per session. Multi-trader portfolio is a Phase 2 enhancement.

**Q: What happens if I close the browser tab?**
A: Copy trading stops immediately. No server persistence in MVP - must keep tab open.

**Q: Is my API key stored anywhere?**
A: No. Key only exists in browser memory while tab is open. Never sent to any server (CCXT connects directly to Hyperliquid).

**Q: Can I see P&L of copied trades?**
A: Not in MVP. Order list shows symbol/side/amount only. Performance tracking is a Phase 2 enhancement.

**Q: Why limit orders instead of market orders?**
A: Ensures you get trader's exact entry price. Market orders have slippage that could result in worse fills.

**Q: What if trader uses higher leverage than my max?**
A: System automatically uses your max leverage setting. Example: Trader uses 20x, your max is 10x → your order uses 10x.

**Q: Can I backtest a trader before copying?**
A: Not in MVP. Historical backtesting is a Phase 2 enhancement using Hyperliquid's `userFills` API.

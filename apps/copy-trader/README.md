# Hyperliquid Copy Trading

Browser-based copy trading interface for Hyperliquid DEX. Discover top traders, configure copy trading parameters, and automatically replicate their trades in real-time.

## Features

- **Trader Discovery**: Browse top 20 traders by monthly ROI from public leaderboard
- **Configurable Copy Trading**: Set trade value ($12+ USDC) and max leverage (1-50x)
- **Auto-Copy Trades**: Monitor trader via WebSocket and execute matching limit orders
- **Order Display**: View last 6 copied orders with symbol, side, amount, timestamp

## Quick Start

### Prerequisites

- Modern browser (Chrome, Firefox, Safari, Edge) with WebSocket support
- Hyperliquid account with API key (get from https://app.hyperliquid.xyz/API)
- Funded account with ≥$12 USDC per trade

### Run Locally

```bash
# Serve with Python (required for leaderboard to load)
cd apps/copy-trader
python3 -m http.server 8000
# Open http://localhost:8000
```

**Note**: Opening `index.html` directly in browser won't work due to CORS restrictions on local file loading.

### Refresh Leaderboard Data

The leaderboard data is stored locally (filtered to top 20 active traders with $50K+ accounts) to bypass CORS restrictions and enable frontend deployment.

**To update:**

```bash
cd apps/copy-trader

# 1. Download full leaderboard (20MB, ~25K traders)
curl https://stats-data.hyperliquid.xyz/Mainnet/leaderboard -o data/leaderboard.json

# 2. Filter to top 20 active traders with $50K+ accounts (4.5KB)
node scripts/filter-leaderboard.js
```

**Filter criteria:**
- Account value > $50,000 (substantial capital)
- Trading volume > 0 (active traders, not dormant)
- Sorted by monthly ROI (current month performance)
- Top 20 only (deployment-optimized)

**File sizes:**
- `data/leaderboard.json`: 20MB (not committed to git)
- `data/leaderboard-top20.json`: 4.3KB (committed, production-ready)

**Recommendation**: Update weekly to see latest monthly top performers.

### Usage

1. **Select Trader**: Click a row in the leaderboard to auto-fill trader address
2. **Configure**: Enter your API key, trade value ($12 minimum), and max leverage (1-50x)
3. **Start**: Click "Start Copy Trading" to begin monitoring
4. **Monitor**: Trader's trades will be copied automatically within 5 seconds
5. **Stop**: Click "Stop Copy Trading" to disconnect

## Architecture

- **Browser-Only**: No server, no database, no persistence (state cleared on tab close)
- **Vanilla JavaScript**: No frameworks, browser-native ESM imports
- **CCXT v4.3.66+**: WebSocket for monitoring (ccxt.pro), REST API for execution (ccxt)
- **In-Memory Storage**: All data in browser JavaScript variables

## Project Structure

```
apps/copy-trader/
├── index.html             # Main UI
├── README.md              # This file
├── src/
│   ├── main.js            # App entry point
│   ├── services/
│   │   ├── leaderboard.js # Leaderboard API integration
│   │   ├── trading.js     # CCXT WebSocket + order execution
│   │   └── validation.js  # Input validation functions
│   └── utils/
│       └── format.js      # Number/timestamp formatting
└── styles/
    └── main.css           # UI styling
```

## Security

⚠️ **Critical**: API key has full trading permissions
- Never share your API key
- Never commit API key to git
- Close browser tab when not using (stops copy trading)
- Revoke immediately if compromised

## Manual Testing

See `/specs/002-hyperliquid-copy-trading/quickstart.md` for detailed testing checklist.

## Documentation

- **Feature Spec**: `/specs/002-hyperliquid-copy-trading/spec.md`
- **Implementation Plan**: `/specs/002-hyperliquid-copy-trading/plan.md`
- **Data Model**: `/specs/002-hyperliquid-copy-trading/data-model.md`
- **API Contracts**: `/specs/002-hyperliquid-copy-trading/contracts/`
- **Quickstart Guide**: `/specs/002-hyperliquid-copy-trading/quickstart.md`

## Support

- CCXT Docs: https://docs.ccxt.com/
- Hyperliquid Docs: https://hyperliquid.gitbook.io/hyperliquid-docs/
- Leaderboard API: https://stats-data.hyperliquid.xyz/Mainnet/leaderboard

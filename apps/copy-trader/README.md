# Hyperliquid Copy Trading

Browser-based copy trading interface for Hyperliquid DEX. Discover top traders, configure copy trading parameters, and automatically replicate their trades in real-time.

## Features

- **Trader Discovery**: Browse top 20 traders by weekly ROI from public leaderboard
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
# Option 1: Serve with Python
cd apps/copy-trader
python3 -m http.server 8000
# Open http://localhost:8000

# Option 2: Open directly in browser
open apps/copy-trader/index.html
```

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

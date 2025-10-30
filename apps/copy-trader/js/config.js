// ============================================
// CONFIG.JS - Configuration Constants
// ============================================

// ============================================
// VERSION
// ============================================
export const VERSION = '0.2.6';
export const BUILD_DATE = '2025-10-30';

// ============================================
// CONFIGURATION CONSTANTS
// ============================================

// Trading Parameters
export const MIN_COPY_BALANCE = 50; // Minimum copy balance in USD
export const MIN_POSITION_VALUE = 20; // Minimum position margin in USD ($30 minimum to avoid dust positions)
export const SIZE_TOLERANCE = 0.25; // 25% position size tolerance before triggering adjustment (increased to prevent churn from price movements)
export const DEFAULT_SLIPPAGE_PERCENT = 10; // 10% slippage tolerance
export const DEFAULT_BROKER_ID = 1; // Moonlander broker ID

// Gas Limits
export const GAS_LIMIT_OPEN_TRADE = 800000;
export const GAS_LIMIT_CLOSE_TRADE = 600000;
export const PYTH_UPDATE_FEE = '0.061'; // CRO fee for Pyth oracle update

// Decimals
export const DECIMALS_USDC = 6; // USDC token decimals
export const DECIMALS_QTY = 10; // Position quantity decimals
export const DECIMALS_PRICE = 18; // Price decimals

// Decimal conversion helpers (DRY principle - avoid magic numbers)
export const USDC_DIVISOR = 10 ** DECIMALS_USDC; // 1e6
export const QTY_DIVISOR = 10 ** DECIMALS_QTY; // 1e10
export const PRICE_DIVISOR = 10 ** DECIMALS_PRICE; // 1e18

// Liquidation calculation
export const MAINTENANCE_MARGIN_RATIO = 0.9; // 90% of margin before liquidation

// Price Calculation
export const STOP_LOSS_PERCENT_LONG = 50; // 50% of entry for long
export const STOP_LOSS_PERCENT_SHORT = 150; // 150% of entry for short
export const TAKE_PROFIT_PERCENT_LONG = 150; // 150% of entry for long
export const TAKE_PROFIT_PERCENT_SHORT = 50; // 50% of entry for short

// API Endpoints
export const HYPERLIQUID_API_URL = 'https://api.hyperliquid.xyz';
// export const PYTH_API_URL = 'https://hermes.pyth.network/api';
export const PYTH_API_URL =
  'https://cronosl-pythnet-6ee1.mainnet.pythnet.rpcpool.com/6180643a-f910-4bdd-8591-35f7c1b99d5a/hermes';

// Sync Settings
export const DEFAULT_SYNC_INTERVAL = 10; // seconds
export const MAX_LOG_ENTRIES = 100; // Maximum activity log entries
export const MAX_SCALING_FACTOR = 1.0; // Maximum scaling factor (100% - never copy more than trader)
export const SAFETY_BUFFER_PERCENT = 1.0; // Maximum safety buffer (100% cap) - users can use full balance for smaller trials

// Position Change Detection
export const TRADER_POSITION_CHANGE_THRESHOLD = 20; // Percentage threshold for detecting significant trader position changes

// Local Storage Keys
export const STORAGE_KEY_LAST_TRADER_POSITIONS = 'copy-trader:lastTraderPositions';

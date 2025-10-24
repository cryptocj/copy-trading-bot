/**
 * Application state management
 * Centralized state for copy trading application
 */

// Application configuration
export const config = {
  traderAddress: '',
  copyBalance: 0, // Total balance for copying (replaces tradeValue and maxLeverage)
  useLatestPrice: false, // Use latest market price instead of trader's entry price
  isDryRun: true, // Dry-run mode (simulate trades without executing real orders)
  executionPlatform: 'moonlander', // 'hyperliquid' or 'moonlander' - default to moonlander

  // API Keys (platform-specific)
  hyperliquidApiKey: '', // Used for Hyperliquid execution OR monitoring when Moonlander is selected
  monitoringApiKey: '', // Used for Hyperliquid monitoring when Moonlander is selected (same as hyperliquidApiKey in most cases)

  // Moonlander-specific configuration
  moonlander: {
    network: 'testnet', // 'testnet' or 'mainnet'
    privateKey: '', // User's private key for Moonlander execution
    // Other config (RPC, contracts, etc.) comes from moonlander.js config file
  },
};

// Copy trading session state
export let isCopyTradingActive = false;

// Order list (max 6 orders, FIFO)
export let orderList = [];

// Monitoring wallets (pre-configured)
export const monitoringWallets = [
  { label: 'DeepSeek', address: '0xC20aC4Dc4188660cBF555448AF52694CA62b0734' },
  { label: 'Grok', address: '0x56D652e62998251b56C8398FB11fcFe464c08F84' },
  { label: 'Claude', address: '0x59fA085d106541A834017b97060bcBBb0aa82869' },
  { label: 'GPT', address: '0x67293D914eAFb26878534571add81F6Bd2D9fE06' },
  { label: 'Gemini', address: '0x1b7A7D099a670256207a30dD0AE13D35f278010f' },
];

/**
 * Update config with new values
 * @param {object} updates - Partial config updates
 */
export function updateConfig(updates) {
  Object.assign(config, updates);
}

/**
 * Set copy trading active state
 * @param {boolean} active - Active state
 */
export function setCopyTradingActive(active) {
  isCopyTradingActive = active;
}

/**
 * Add order to order list (FIFO, max 6)
 * @param {object} order - Order object
 */
export function addOrderToList(order) {
  orderList.unshift(order); // Add to front
  if (orderList.length > 6) {
    orderList.pop(); // Remove oldest
  }
}

/**
 * Clear order list
 */
export function clearOrderList() {
  orderList = [];
}

/**
 * Get current order list
 * @returns {Array} Order list
 */
export function getOrderList() {
  return orderList;
}

/**
 * Get the appropriate API key based on the selected execution platform
 * For Hyperliquid: Use hyperliquidApiKey for both monitoring and execution
 * For Moonlander: Use monitoringApiKey for Hyperliquid monitoring
 * @returns {string} The API key to use for the current platform
 */
export function getApiKey() {
  if (config.executionPlatform === 'moonlander') {
    return config.monitoringApiKey;
  }
  return config.hyperliquidApiKey;
}

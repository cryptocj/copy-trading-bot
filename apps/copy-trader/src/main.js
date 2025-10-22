/**
 * Main entry point for Hyperliquid Copy Trading app
 * Initializes UI, handles events, coordinates services
 */

// CCXT library loaded via script tag in HTML (global variable)
// Available as window.ccxt

// Import services and utilities
import { validateAddress, validateApiKey, validateCopyBalance } from './services/validation.js';
import {
  startCopyTrading as startTradingService,
  stopCopyTrading as stopTradingService,
  isDryRunMode,
} from './services/trading.js';
import { fetchWalletInfo, fetchPositions, fetchWalletBalance } from './services/wallet.js';
import { loadSessionState, initializeTabId } from './services/sessionPersistence.js';
import {
  STORAGE_KEYS,
  loadSavedSettings,
  saveSettings,
  clearSavedSettings,
  viewSavedSettings,
} from './services/storage.js';
import {
  config,
  isCopyTradingActive,
  orderList,
  monitoringWallets,
  setCopyTradingActive,
  clearOrderList,
  getOrderList,
} from './state/appState.js';
import { initializeElements } from './dom/elements.js';
import {
  setupValidationListeners as setupValidation,
  checkFormValidity as checkValidity,
} from './validation/formValidation.js';
import {
  renderWalletsTable,
  displayYourWalletInfo,
  fetchAndDisplayYourWallet,
  fetchBalanceForAddress,
  fetchPositionsForAddress,
} from './rendering/wallet.js';
import {
  setupHistoryPanelListeners,
  showHistoryPanel,
} from './rendering/history.js';
import {
  addOrder,
  renderOrderList,
} from './rendering/orders.js';
import { setupCollapsibleSections } from './ui/collapsible.js';
import {
  refreshWalletInfo,
  loadCustomWallet,
  loadMyWalletByAddress,
} from './controllers/walletController.js';
import { confirmCopyTradingSession } from './controllers/tradingController.js';
import { testPositionCalculation } from './utils/testCalculation.js';

// DOM elements (will be initialized after DOM loads)
let elements = {};

/**
 * Initialize app when DOM is ready
 */
document.addEventListener('DOMContentLoaded', () => {
  console.log('Initializing Hyperliquid Copy Trading app...');

  // Cache DOM elements
  elements = initializeElements();

  // Initialize validation listeners
  setupValidation(elements, () => checkValidity(elements, isCopyTradingActive));

  // Initialize button listeners
  setupButtonListeners();

  // Initialize history panel listeners
  setupHistoryPanelListeners();

  // Initialize collapsible sections
  setupCollapsibleSections(elements);

  // Render monitoring wallets table
  renderWalletsTable(elements, (address) => showHistoryPanel(elements, address), () => checkValidity(elements, isCopyTradingActive));

  // Load saved settings from localStorage
  loadSavedSettings(elements, config, checkFormValidity, () => refreshWalletInfo(elements, isCopyTradingActive));

  // Restore active session if exists (T015 - US1: Automatic Session Recovery)
  // Non-blocking: runs in background, UI remains responsive
  restoreActiveSession().catch((error) => {
    console.error('Error during session restoration:', error);
  });

  // Expose utility functions to console for debugging
  window.copyTrading = {
    clearSavedSettings,
    saveSettings: () => saveSettings(config),
    config,
    viewSavedSettings,
  };

  console.log('App initialized successfully.');
  console.log('💾 Settings auto-save enabled with wallet-specific storage.');
  console.log('🔍 Debug utilities available:');
  console.log('   - copyTrading.viewSavedSettings() - View all saved configurations');
  console.log('   - copyTrading.clearSavedSettings() - Clear all saved settings');
});

/**
 * Restore active session from localStorage (T014 - US1: Automatic Session Recovery)
 * Called on page load to detect and restore active copy trading sessions
 * Now supports multi-tab with wallet-based storage
 */
async function restoreActiveSession() {
  console.log('Checking for active session to restore...');

  // Initialize tab ID for multi-tab coordination
  initializeTabId();

  // Get last monitored wallet to check for active session
  const lastWallet = localStorage.getItem(STORAGE_KEYS.LAST_MONITORED_WALLET);
  if (!lastWallet) {
    console.log('No last monitored wallet, cannot restore session');
    return;
  }

  // Get saved trader address for this wallet
  const savedTraderAddress = localStorage.getItem(STORAGE_KEYS.getTraderAddressKey(lastWallet));
  if (!savedTraderAddress) {
    console.log(`No saved trader address for wallet: ${lastWallet}`);
    return;
  }

  // Load saved session state for this wallet
  const sessionState = loadSessionState(savedTraderAddress);
  if (!sessionState || !sessionState.isActive) {
    console.log(`No active session to restore for wallet: ${savedTraderAddress}`);
    return;
  }

  console.log('Active session found, attempting restoration...', {
    startTime: new Date(sessionState.startTime).toLocaleString(),
    tradeCounter: sessionState.tradeCounter,
    monitoredWallet: sessionState.monitoredWallet,
  });

  // Validate session configuration (T016)
  const { config: savedConfig } = sessionState;
  if (!savedConfig) {
    console.error('Session state missing configuration');
    return;
  }

  // Validate required fields
  const addressValidation = validateAddress(savedConfig.traderAddress);
  const apiKeyValidation = validateApiKey(savedConfig.userApiKey);
  const copyBalanceValidation = validateCopyBalance(savedConfig.copyBalance);

  if (!addressValidation.valid || !apiKeyValidation.valid || !copyBalanceValidation.valid) {
    console.error('Session validation failed:', {
      address: addressValidation.valid,
      apiKey: apiKeyValidation.valid,
      copyBalance: copyBalanceValidation.valid,
    });
    alert('Cannot restore session: Configuration is invalid. Please reconfigure and start again.');
    return;
  }

  // Restore configuration to global config
  config.traderAddress = savedConfig.traderAddress;
  config.userApiKey = savedConfig.userApiKey;
  config.copyBalance = savedConfig.copyBalance;

  // Restore UI form values (T017)
  elements.traderAddressInput.value = savedConfig.traderAddress;
  elements.apiKeyInput.value = savedConfig.userApiKey;
  elements.copyBalanceInput.value = savedConfig.copyBalance;

  try {
    // Update UI to show restoration in progress
    elements.startButton.disabled = true;
    elements.stopButton.disabled = false;
    setFormDisabled(true);
    setCopyTradingActive(true);

    console.log('Restoring copy trading session...');

    // Start trading service with resumeState parameter
    await startTradingService(
      config,
      (order) => {
        addOrder(elements, order); // Add order to display list
      },
      sessionState
    ); // Pass resumeState to restore trade counter and startTime

    console.log('✅ Session restored successfully');
    console.log(`Session duration: ${Math.floor((Date.now() - sessionState.startTime) / 1000)}s`);
    console.log(`Trades executed: ${sessionState.tradeCounter}`);
  } catch (error) {
    // Handle restoration failure (T018)
    console.error('❌ Failed to restore session:', error);

    // Revert UI state
    setCopyTradingActive(false);
    elements.startButton.disabled = false;
    elements.stopButton.disabled = true;
    setFormDisabled(false);
    checkValidity(elements, isCopyTradingActive);

    alert(`Failed to restore copy trading session: ${error.message}\n\nPlease start manually.`);
  }
}

/**
 * Setup button click listeners
 */
function setupButtonListeners() {
  elements.testCalculationButton.addEventListener('click', () => testPositionCalculation(elements, config));
  elements.startButton.addEventListener('click', startCopyTrading);
  elements.stopButton.addEventListener('click', stopCopyTrading);
  elements.refreshWalletButton.addEventListener('click', () => refreshWalletInfo(elements, isCopyTradingActive));
  elements.loadCustomWalletButton.addEventListener('click', () => loadCustomWallet(elements, isCopyTradingActive));
  elements.loadMyWalletButton.addEventListener('click', () => loadMyWalletByAddress(elements));
}

/**
 * Enable or disable all form inputs
 * @param {boolean} disabled - Whether to disable inputs
 */
function setFormDisabled(disabled) {
  elements.traderAddressInput.disabled = disabled;
  elements.apiKeyInput.disabled = disabled;
  elements.copyBalanceInput.disabled = disabled;
}

/**
 * Fetch latest market prices for all trader positions (for confirmation display)
 * @param {string} apiKey - User's API key
 * @returns {Promise<Map<string, {bid: number, ask: number, last: number, orderPrice: number}>>}
 */
async function fetchLatestPricesForConfirmation(apiKey) {
  try {
    // Initialize exchange
    const wallet = new ethers.Wallet(apiKey);
    const exchange = new ccxt.hyperliquid({
      privateKey: apiKey,
      walletAddress: wallet.address,
    });

    await exchange.loadMarkets();

    // Get trader positions
    const traderPositions = await fetchPositions(exchange, config.traderAddress);

    const pricesMap = new Map();

    // Fetch ticker for each symbol
    for (const pos of traderPositions) {
      try {
        const ticker = await exchange.fetchTicker(pos.symbol);
        const bid = ticker.bid || ticker.last;
        const ask = ticker.ask || ticker.last;
        const last = ticker.last;

        // Calculate order price with tick offset
        const TICK_OFFSET_PERCENT = 0.0001; // 0.01%
        const tickOffset = pos.entryPrice * TICK_OFFSET_PERCENT;
        const orderPrice = pos.side === 'long'
          ? (bid || (last - tickOffset))  // Buy order
          : (ask || (last + tickOffset)); // Sell order

        pricesMap.set(pos.symbol, {
          bid,
          ask,
          last,
          orderPrice,
          traderEntry: pos.entryPrice
        });

        console.log(`  ${pos.symbol}: Trader=$${pos.entryPrice.toFixed(2)} → Order=$${orderPrice.toFixed(2)} (${((orderPrice - pos.entryPrice) / pos.entryPrice * 100).toFixed(2)}%)`);
      } catch (error) {
        console.warn(`  ⚠️ Failed to fetch price for ${pos.symbol}:`, error.message);
      }
    }

    await exchange.close();
    return pricesMap;
  } catch (error) {
    console.error('Failed to fetch latest prices:', error);
    return new Map();
  }
}

/**
 * Start copy trading (US2/US3)
 */
async function startCopyTrading() {
  console.log('🚀 Preparing to start copy trading...');
  console.log(`📊 Configuration:`);
  console.log(`  - Trader Address: ${config.traderAddress}`);
  console.log(`  - Copy Balance: $${config.copyBalance}`);
  console.log(`  - Use Latest Price: ${config.useLatestPrice}`);

  try {
    // Check for position conflicts between user and trader
    console.log('🔍 Checking for existing positions and conflicts...');

    // Get wallet address - use custom saved address if available, otherwise derive from API key
    const savedMyWalletAddress = localStorage.getItem(STORAGE_KEYS.MY_WALLET_ADDRESS);
    let myWalletAddress;

    if (savedMyWalletAddress) {
      myWalletAddress = savedMyWalletAddress;
      console.log('  - Using saved wallet address:', myWalletAddress);
    } else {
      const userWallet = new ethers.Wallet(config.userApiKey);
      myWalletAddress = userWallet.address;
      console.log('  - Using wallet derived from API key:', myWalletAddress);
    }

    // Fetch user's current positions using the wallet address
    const userPositions = await fetchPositionsForAddress(myWalletAddress);
    console.log('  - Your positions:', userPositions.length);

    // Fetch trader's positions
    const traderPositions = await fetchPositionsForAddress(config.traderAddress);
    console.log('  - Trader positions:', traderPositions.length);

    // Check for conflicts and prepare filtered list
    let positionsToSkip = new Set();

    if (userPositions.length > 0) {
      console.log('  - Your open positions:', userPositions.map(p => ({ symbol: p.symbol, side: p.side, size: p.size })));

      // Find overlapping symbols
      const userSymbols = new Set(userPositions.map(p => p.symbol));
      const traderSymbols = new Set(traderPositions.map(p => p.symbol));
      const conflicts = [...userSymbols].filter(symbol => traderSymbols.has(symbol));

      if (conflicts.length > 0) {
        const remainingPositions = traderPositions.length - conflicts.length;

        const proceed = confirm(
          `⚠️ Position Conflict Detected!\n\n` +
          `You have ${userPositions.length} open position(s): ${[...userSymbols].join(', ')}\n` +
          `Trader has ${traderPositions.length} position(s): ${[...traderSymbols].join(', ')}\n\n` +
          `Conflicting symbols: ${conflicts.join(', ')}\n\n` +
          `These ${conflicts.length} position(s) will be SKIPPED.\n` +
          `Remaining ${remainingPositions} position(s) will be copied.\n\n` +
          `Do you want to continue?`
        );

        if (!proceed) {
          console.log('❌ Copy trading cancelled by user');
          return;
        }

        // Mark conflicting positions to be skipped
        positionsToSkip = new Set(conflicts);
        console.log('⚠️ Will skip conflicting positions:', [...positionsToSkip]);
      } else {
        // Warn if user has positions but no conflicts
        const proceed = confirm(
          `⚠️ Warning: You have ${userPositions.length} open position(s): ${[...userSymbols].join(', ')}\n\n` +
          `These don't conflict with trader's positions, but may affect your available balance.\n\n` +
          `Do you want to continue?`
        );

        if (!proceed) {
          console.log('❌ Copy trading cancelled by user');
          return;
        }
      }
    }
    console.log('✅ Position check complete - proceeding with copy trading');

    // Fetch latest prices if enabled (before confirmation)
    let latestPrices = null;
    if (config.useLatestPrice) {
      console.log('📊 Fetching latest market prices for confirmation...');
      latestPrices = await fetchLatestPricesForConfirmation(config.userApiKey);
    }

    // Show confirmation dialog before starting
    console.log('Requesting user confirmation...');
    const result = await confirmCopyTradingSession({
      traderAddress: config.traderAddress,
      copyBalance: config.copyBalance,
      apiKey: config.userApiKey,
      latestPrices: latestPrices,
      positionsToSkip: positionsToSkip, // Pass conflicting symbols to skip
    });

    if (!result.confirmed) {
      console.log('❌ Copy trading cancelled by user');
      return;
    }

    console.log('✅ User confirmed, starting copy trading...');
    console.log(
      `📊 Scaling factor: ${result.scalingFactor.toFixed(4)} (${(result.scalingFactor * 100).toFixed(1)}%)`
    );
    console.log(`📊 Initial positions to open: ${result.initialPositions.length}`);

    // Ensure current configuration is saved and tracked as last monitored wallet
    console.log('💾 Saving current configuration before starting...');
    saveSettings(config);

    // Update UI state
    setCopyTradingActive(true);
    elements.startButton.disabled = true;
    elements.stopButton.disabled = false;
    setFormDisabled(true);

    // Start trading service with order callback, scaling factor, and initial positions (US3 + US4 integration)
    await startTradingService(
      {
        ...config,
        scalingFactor: result.scalingFactor,
        initialPositions: result.initialPositions,
      },
      (order) => {
        addOrder(elements, order); // Add order to display list (US4)
      }
    );

    console.log('✅ Copy trading started successfully');
    console.log(`📡 Now monitoring wallet: ${config.traderAddress}`);
  } catch (error) {
    console.error('❌ Failed to start copy trading:', error);

    // Revert UI state on error
    setCopyTradingActive(false);
    elements.startButton.disabled = false;
    elements.stopButton.disabled = true;
    setFormDisabled(false);

    alert('Failed to start copy trading. Check console for details.');
  }
}

/**
 * Stop copy trading (US2/US3)
 */
async function stopCopyTrading() {
  console.log('Stopping copy trading...');

  try {
    // Stop trading service (closes WebSocket connections)
    await stopTradingService();

    // Update UI state
    setCopyTradingActive(false);
    elements.startButton.disabled = false;
    elements.stopButton.disabled = true;
    setFormDisabled(false);

    // Re-enable form validation
    checkValidity(elements, isCopyTradingActive);

    console.log('✅ Copy trading stopped successfully');
  } catch (error) {
    // ExchangeClosedByUser is expected when stopping, not an error
    if (
      error.constructor?.name === 'ExchangeClosedByUser' ||
      error.message?.includes('closedByUser')
    ) {
      console.log('✅ Copy trading stopped successfully');
    } else {
      console.error('❌ Error stopping copy trading:', error);
    }

    // Update UI state anyway (stop succeeded even if cleanup had issues)
    setCopyTradingActive(false);
    elements.startButton.disabled = false;
    elements.stopButton.disabled = true;
    setFormDisabled(false);
    checkValidity(elements, isCopyTradingActive);
  }
}

/**
 * Add order to display list (US4)
 * FIFO: max 6 orders, remove oldest when exceeding
 * @param {{ symbol: string, side: string, amount: number, price: number, timestamp: number }} order
 */

/**
 * Setup collapsible sections with localStorage persistence
 */

/**
 * Setup trade history panel listeners
 */
/**
 * Fetch balance for a specific address using Hyperliquid Direct API
 * Works without API key - uses public API endpoint
 */
/**
 * Fetch LATEST open positions for a specific address
 * Always fetches fresh data from Hyperliquid API - no caching
 * @param {string} address - Wallet address to query
 * @returns {Promise<Array>} Array of current open position objects
 */
/**
 * Render balance for selected wallet in history panel
 */
/**
 * Render positions for selected wallet in history panel (table view)
 */
/**
 * Render monitoring wallets table (similar to leaderboard)
 */
/**
 * Refresh wallet info for your wallet
 */
/**
 * Load custom wallet by address input
 * Query balance and positions without needing API key
 */
/**
 * Load wallet by address directly (for "My Wallet & Positions" section)
 * Query balance and positions without needing API key
 */
/**
 * Display wallet info in "My Wallet & Positions" section
 * @param {object} balance - Balance object
 * @param {Array} positions - Positions array
 */
/**
 * Fetch and display your wallet info
 */
/**
 * Render positions table (for Your Wallet section)
 */

/**
 * Wrapper function for checkFormValidity for backward compatibility
 */
function checkFormValidity() {
  checkValidity(elements, isCopyTradingActive);
}

/**
 * Wrapper functions for order management (backward compatibility)
 */
function addOrderWrapper(order) {
  addOrder(elements, order);
}

function renderOrderListWrapper() {
  renderOrderList(elements);
}

// Export functions for use in other modules
export {
  config,
  isCopyTradingActive,
  orderList,
  elements,
  addOrderWrapper as addOrder,
  renderOrderListWrapper as renderOrderList,
  setFormDisabled,
  checkFormValidity,
  clearSavedSettings,
  saveSettings,
};

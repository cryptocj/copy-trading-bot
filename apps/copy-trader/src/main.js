/**
 * Main entry point for Hyperliquid Copy Trading app
 * Initializes UI, handles events, coordinates services
 */

// CCXT library loaded via script tag in HTML (global variable)
// Available as window.ccxt

// Import services and utilities
import {
  validateAddress,
  validateApiKey,
  validateTradeValue,
  validateLeverage,
} from './services/validation.js';
import {
  formatNumber,
  formatTimestamp,
  truncateAddress,
} from './utils/format.js';
import {
  fetchLeaderboard,
  renderLeaderboardTable,
  showLeaderboardError,
  hideLeaderboardError,
} from './services/leaderboard.js';
import {
  startCopyTrading as startTradingService,
  stopCopyTrading as stopTradingService,
} from './services/trading.js';
import {
  fetchTradeHistory,
  renderTradeHistoryTable,
} from './services/tradeHistory.js';

// Global state
let config = {
  traderAddress: '',
  userApiKey: '',
  tradeValue: 0,
  maxLeverage: 1,
};

let isCopyTradingActive = false;
let orderList = []; // Max 6 orders (FIFO)
let leaderboardTraders = [];

// localStorage keys
const STORAGE_KEYS = {
  TRADER_ADDRESS: 'copyTrading.traderAddress',
  TRADE_VALUE: 'copyTrading.tradeValue',
  MAX_LEVERAGE: 'copyTrading.maxLeverage',
  API_KEY: 'copyTrading.apiKey',
  SAVE_API_KEY: 'copyTrading.saveApiKey',
};

// DOM elements (will be initialized after DOM loads)
let elements = {};

/**
 * Initialize app when DOM is ready
 */
document.addEventListener('DOMContentLoaded', () => {
  console.log('Initializing Hyperliquid Copy Trading app...');

  // Cache DOM elements
  elements = {
    // Leaderboard
    leaderboardBody: document.getElementById('leaderboard-body'),
    leaderboardError: document.getElementById('leaderboard-error'),

    // Form inputs
    traderAddressInput: document.getElementById('trader-address'),
    apiKeyInput: document.getElementById('api-key'),
    tradeValueInput: document.getElementById('trade-value'),
    maxLeverageInput: document.getElementById('max-leverage'),

    // Validation errors
    traderAddressError: document.getElementById('trader-address-error'),
    apiKeyError: document.getElementById('api-key-error'),
    tradeValueError: document.getElementById('trade-value-error'),
    maxLeverageError: document.getElementById('max-leverage-error'),

    // Buttons
    startButton: document.getElementById('start-button'),
    stopButton: document.getElementById('stop-button'),

    // Orders
    ordersBody: document.getElementById('orders-body'),

    // Trade History Panel
    historyPlaceholder: document.getElementById('history-placeholder'),
    historyLoading: document.getElementById('history-loading'),
    historyError: document.getElementById('history-error'),
    historyContent: document.getElementById('history-content'),
    historyAddress: document.getElementById('history-address'),
    historyBody: document.getElementById('history-body'),
  };

  // Initialize validation listeners
  setupValidationListeners();

  // Initialize button listeners
  setupButtonListeners();

  // Initialize history panel listeners
  setupHistoryPanelListeners();

  // Load saved settings from localStorage
  loadSavedSettings();

  // Load leaderboard on page load (US1)
  loadLeaderboard();

  // Expose utility functions to console for debugging
  window.copyTrading = {
    clearSavedSettings,
    saveSettings,
    config,
    viewSavedSettings: () => {
      console.log('Saved Settings:', {
        traderAddress: localStorage.getItem(STORAGE_KEYS.TRADER_ADDRESS),
        tradeValue: localStorage.getItem(STORAGE_KEYS.TRADE_VALUE),
        maxLeverage: localStorage.getItem(STORAGE_KEYS.MAX_LEVERAGE),
        apiKeySaved: localStorage.getItem(STORAGE_KEYS.SAVE_API_KEY) === 'true',
      });
    },
  };

  console.log('App initialized successfully.');
  console.log('💾 Settings auto-save enabled. Use copyTrading.clearSavedSettings() to clear.');
});

/**
 * Load saved settings from localStorage
 */
function loadSavedSettings() {
  console.log('Loading saved settings from localStorage...');

  // Load trader address
  const savedTraderAddress = localStorage.getItem(STORAGE_KEYS.TRADER_ADDRESS);
  if (savedTraderAddress) {
    elements.traderAddressInput.value = savedTraderAddress;
    config.traderAddress = savedTraderAddress;
  }

  // Load trade value
  const savedTradeValue = localStorage.getItem(STORAGE_KEYS.TRADE_VALUE);
  if (savedTradeValue) {
    elements.tradeValueInput.value = savedTradeValue;
    config.tradeValue = parseFloat(savedTradeValue);
  }

  // Load max leverage
  const savedMaxLeverage = localStorage.getItem(STORAGE_KEYS.MAX_LEVERAGE);
  if (savedMaxLeverage) {
    elements.maxLeverageInput.value = savedMaxLeverage;
    config.maxLeverage = parseInt(savedMaxLeverage);
  }

  // Load API key only if user opted in
  const saveApiKey = localStorage.getItem(STORAGE_KEYS.SAVE_API_KEY) === 'true';
  const saveApiKeyCheckbox = document.getElementById('save-api-key');
  if (saveApiKeyCheckbox) {
    saveApiKeyCheckbox.checked = saveApiKey;
  }

  let savedApiKey = null;
  if (saveApiKey) {
    savedApiKey = localStorage.getItem(STORAGE_KEYS.API_KEY);
    if (savedApiKey) {
      elements.apiKeyInput.value = savedApiKey;
      config.userApiKey = savedApiKey;
    }
  }

  // Check form validity after loading
  checkFormValidity();

  console.log('Settings loaded:', {
    traderAddress: savedTraderAddress ? '✓' : '✗',
    tradeValue: savedTradeValue ? '✓' : '✗',
    maxLeverage: savedMaxLeverage ? '✓' : '✗',
    apiKey: saveApiKey && savedApiKey ? '✓' : '✗',
  });
}

/**
 * Save settings to localStorage
 */
function saveSettings() {
  // Always save these
  if (config.traderAddress) {
    localStorage.setItem(STORAGE_KEYS.TRADER_ADDRESS, config.traderAddress);
  }
  if (config.tradeValue) {
    localStorage.setItem(STORAGE_KEYS.TRADE_VALUE, config.tradeValue.toString());
  }
  if (config.maxLeverage) {
    localStorage.setItem(STORAGE_KEYS.MAX_LEVERAGE, config.maxLeverage.toString());
  }

  // Only save API key if user opted in
  const saveApiKeyCheckbox = document.getElementById('save-api-key');
  if (saveApiKeyCheckbox && saveApiKeyCheckbox.checked) {
    localStorage.setItem(STORAGE_KEYS.SAVE_API_KEY, 'true');
    if (config.userApiKey) {
      localStorage.setItem(STORAGE_KEYS.API_KEY, config.userApiKey);
    }
  } else {
    localStorage.setItem(STORAGE_KEYS.SAVE_API_KEY, 'false');
    localStorage.removeItem(STORAGE_KEYS.API_KEY);
  }
}

/**
 * Clear all saved settings
 */
function clearSavedSettings() {
  Object.values(STORAGE_KEYS).forEach(key => {
    localStorage.removeItem(key);
  });
  console.log('All saved settings cleared');
}

/**
 * Setup validation listeners for all form inputs
 */
function setupValidationListeners() {
  // Save API key checkbox listener
  const saveApiKeyCheckbox = document.getElementById('save-api-key');
  if (saveApiKeyCheckbox) {
    saveApiKeyCheckbox.addEventListener('change', () => {
      saveSettings(); // Update storage when checkbox changes
      if (!saveApiKeyCheckbox.checked) {
        console.log('API key will not be saved (more secure)');
      } else {
        console.log('API key will be saved in localStorage (less secure)');
      }
    });
  }

  // Trader address validation
  elements.traderAddressInput.addEventListener('blur', () => {
    const result = validateAddress(elements.traderAddressInput.value);
    displayValidationError('trader-address', result);
    if (result.valid) {
      config.traderAddress = result.address;
      saveSettings(); // Auto-save on valid input
    }
    checkFormValidity();
  });

  // API key validation
  elements.apiKeyInput.addEventListener('blur', () => {
    const result = validateApiKey(elements.apiKeyInput.value);
    displayValidationError('api-key', result);
    if (result.valid) {
      config.userApiKey = result.key;
      saveSettings(); // Auto-save on valid input
    }
    checkFormValidity();
  });

  // Trade value validation
  elements.tradeValueInput.addEventListener('blur', () => {
    const result = validateTradeValue(elements.tradeValueInput.value);
    displayValidationError('trade-value', result);
    if (result.valid) {
      config.tradeValue = result.value;
      saveSettings(); // Auto-save on valid input
    }
    checkFormValidity();
  });

  // Max leverage validation
  elements.maxLeverageInput.addEventListener('blur', () => {
    const result = validateLeverage(elements.maxLeverageInput.value);
    displayValidationError('max-leverage', result);
    if (result.valid) {
      config.maxLeverage = result.leverage;
      saveSettings(); // Auto-save on valid input
    }
    checkFormValidity();
  });
}

/**
 * Display validation error message for a field
 * @param {string} fieldId - Field identifier (without '-error' suffix)
 * @param {{ valid: boolean, error?: string }} result - Validation result
 */
function displayValidationError(fieldId, result) {
  const errorElement = elements[`${fieldId}Error`];
  if (!errorElement) return;

  if (result.valid) {
    errorElement.textContent = '';
  } else {
    errorElement.textContent = result.error || 'Invalid input';
  }
}

/**
 * Check if all form fields are valid and enable/disable Start button
 */
function checkFormValidity() {
  const addressValid = validateAddress(elements.traderAddressInput.value).valid;
  const apiKeyValid = validateApiKey(elements.apiKeyInput.value).valid;
  const tradeValueValid = validateTradeValue(elements.tradeValueInput.value).valid;
  const leverageValid = validateLeverage(elements.maxLeverageInput.value).valid;

  const allValid = addressValid && apiKeyValid && tradeValueValid && leverageValid;

  // Enable Start button only if all fields valid and not currently active
  elements.startButton.disabled = !allValid || isCopyTradingActive;
}

/**
 * Setup button click listeners
 */
function setupButtonListeners() {
  elements.startButton.addEventListener('click', startCopyTrading);
  elements.stopButton.addEventListener('click', stopCopyTrading);
}

/**
 * Load leaderboard data and render table (US1)
 */
async function loadLeaderboard() {
  console.log('Loading leaderboard...');

  try {
    const traders = await fetchLeaderboard();

    if (traders.length === 0) {
      showLeaderboardError(
        elements.leaderboardError,
        'Failed to load leaderboard. You can still enter a trader address manually below.'
      );
    } else {
      hideLeaderboardError(elements.leaderboardError);
    }

    // Store traders in global state
    leaderboardTraders.length = 0;
    leaderboardTraders.push(...traders);

    // Render table with click handlers
    renderLeaderboardTable(traders, elements.leaderboardBody, handleTraderSelect, showHistoryPanel);

    console.log(`Leaderboard loaded: ${traders.length} traders`);
  } catch (error) {
    console.error('Error loading leaderboard:', error);
    showLeaderboardError(
      elements.leaderboardError,
      'Failed to load leaderboard. You can still enter a trader address manually below.'
    );
  }
}

/**
 * Handle trader selection from leaderboard (US1)
 * @param {string} address - Selected trader's wallet address
 */
function handleTraderSelect(address) {
  console.log('Trader selected:', address);

  // Auto-fill trader address input
  elements.traderAddressInput.value = address;

  // Trigger validation
  const result = validateAddress(address);
  displayValidationError('trader-address', result);
  if (result.valid) {
    config.traderAddress = result.address;
  }

  // Check form validity to enable/disable Start button
  checkFormValidity();
}

/**
 * Enable or disable all form inputs
 * @param {boolean} disabled - Whether to disable inputs
 */
function setFormDisabled(disabled) {
  elements.traderAddressInput.disabled = disabled;
  elements.apiKeyInput.disabled = disabled;
  elements.tradeValueInput.disabled = disabled;
  elements.maxLeverageInput.disabled = disabled;
}

/**
 * Start copy trading (US2/US3)
 */
async function startCopyTrading() {
  console.log('Starting copy trading...', config);

  try {
    // Update UI state
    isCopyTradingActive = true;
    elements.startButton.disabled = true;
    elements.stopButton.disabled = false;
    setFormDisabled(true);

    // Start trading service with order callback (US3 + US4 integration)
    await startTradingService(config, (order) => {
      addOrder(order); // Add order to display list (US4)
    });

    console.log('Copy trading started successfully');
  } catch (error) {
    console.error('Failed to start copy trading:', error);

    // Revert UI state on error
    isCopyTradingActive = false;
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
    isCopyTradingActive = false;
    elements.startButton.disabled = false;
    elements.stopButton.disabled = true;
    setFormDisabled(false);

    // Re-enable form validation
    checkFormValidity();

    console.log('✅ Copy trading stopped successfully');
  } catch (error) {
    // ExchangeClosedByUser is expected when stopping, not an error
    if (error.constructor?.name === 'ExchangeClosedByUser' || error.message?.includes('closedByUser')) {
      console.log('✅ Copy trading stopped successfully');
    } else {
      console.error('❌ Error stopping copy trading:', error);
    }

    // Update UI state anyway (stop succeeded even if cleanup had issues)
    isCopyTradingActive = false;
    elements.startButton.disabled = false;
    elements.stopButton.disabled = true;
    setFormDisabled(false);
    checkFormValidity();
  }
}

/**
 * Add order to display list (US4)
 * FIFO: max 6 orders, remove oldest when exceeding
 * @param {{ symbol: string, side: string, amount: number, price: number, timestamp: number }} order
 */
function addOrder(order) {
  orderList.unshift(order); // Add to front
  if (orderList.length > 6) {
    orderList.pop(); // Remove oldest
  }
  renderOrderList();
}

/**
 * Render order list in UI (US4)
 */
function renderOrderList() {
  if (orderList.length === 0) {
    elements.ordersBody.innerHTML = '';
    return;
  }

  const html = orderList
    .map(
      (order) => `
        <tr>
            <td>${order.symbol}</td>
            <td class="${order.side}">${order.side.toUpperCase()}</td>
            <td>${formatNumber(order.amount, 6)}</td>
            <td>$${formatNumber(order.price, 2)}</td>
            <td>${formatTimestamp(order.timestamp)}</td>
        </tr>
    `
    )
    .join('');

  elements.ordersBody.innerHTML = html;
}

/**
 * Setup trade history panel listeners
 */
function setupHistoryPanelListeners() {
  // Delegate click event for trader links (stop row selection)
  document.addEventListener('click', (e) => {
    const traderLink = e.target.closest('.trader-link');
    if (traderLink) {
      e.stopPropagation(); // Prevent row selection
      console.log('Trader link clicked - opening Hyperliquid');
    }
  });
}

/**
 * Show trade history in right panel
 */
async function showHistoryPanel(address) {
  console.log('showHistoryPanel called with address:', address);

  // Reset state - hide all panels
  elements.historyPlaceholder.style.display = 'none';
  elements.historyLoading.style.display = 'block';
  elements.historyError.style.display = 'none';
  elements.historyContent.style.display = 'none';

  // Set address display
  elements.historyAddress.textContent = truncateAddress(address);
  elements.historyAddress.title = address;

  try {
    console.log('Fetching order history...');
    // Fetch order history (aggregated from fills)
    const orders = await fetchTradeHistory(address, 200);
    console.log('Order history fetched:', orders.length, 'orders');

    // Hide loading, show content
    elements.historyLoading.style.display = 'none';
    elements.historyContent.style.display = 'block';

    // Render orders
    renderTradeHistoryTable(orders, elements.historyBody);

    console.log(`Displayed ${orders.length} orders for ${address}`);
  } catch (error) {
    console.error('Error in showHistoryPanel:', error);
    // Show error
    elements.historyLoading.style.display = 'none';
    elements.historyError.style.display = 'block';
    elements.historyError.textContent = `Failed to load order history: ${error.message}`;
  }
}

// Export functions for use in other modules
export {
  config,
  isCopyTradingActive,
  orderList,
  leaderboardTraders,
  elements,
  addOrder,
  renderOrderList,
  setFormDisabled,
  checkFormValidity,
  clearSavedSettings,
  saveSettings,
};

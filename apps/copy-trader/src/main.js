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
import { truncateAddress } from './utils/format.js';
import {
  startCopyTrading as startTradingService,
  stopCopyTrading as stopTradingService,
} from './services/trading.js';
import { fetchTradeHistory, renderTradeHistoryTable } from './services/tradeHistory.js';

// Global state
let config = {
  traderAddress: '',
  userApiKey: '',
  tradeValue: 0,
  maxLeverage: 1,
};

let isCopyTradingActive = false;
let orderList = []; // Max 6 orders (FIFO)

// Monitoring wallets (pre-configured)
const monitoringWallets = [
  { label: 'DeepSeek', address: '0xC20aC4Dc4188660cBF555448AF52694CA62b0734' },
  { label: 'Grok', address: '0x56D652e62998251b56C8398FB11fcFe464c08F84' },
  { label: 'Claude', address: '0x59fA085d106541A834017b97060bcBBb0aa82869' },
  { label: 'GPT', address: '0x67293D914eAFb26878534571add81F6Bd2D9fE06' },
  { label: 'Gemini', address: '0x1b7A7D099a670256207a30dD0AE13D35f278010f' },
];

// localStorage keys
const STORAGE_KEYS = {
  TRADER_ADDRESS: 'copyTrading.traderAddress',
  TRADE_VALUE: 'copyTrading.tradeValue',
  MAX_LEVERAGE: 'copyTrading.maxLeverage',
  API_KEY: 'copyTrading.apiKey',
  SAVE_API_KEY: 'copyTrading.saveApiKey',
  HISTORY_COLLAPSED: 'copyTrading.historyCollapsed',
  WALLETS_COLLAPSED: 'copyTrading.walletsCollapsed',
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
    testOrderButton: document.getElementById('test-order-button'),

    // Orders
    ordersBody: document.getElementById('orders-body'),

    // Collapsible sections
    walletsToggle: document.getElementById('wallets-toggle'),
    walletsContent: document.getElementById('wallets-content'),
    historyToggle: document.getElementById('history-toggle'),
    historyContentWrapper: document.getElementById('history-content-wrapper'),

    // Trade History Panel
    historyPlaceholder: document.getElementById('history-placeholder'),
    historyLoading: document.getElementById('history-loading'),
    historyError: document.getElementById('history-error'),
    historyContent: document.getElementById('history-content'),
    historyAddress: document.getElementById('history-address'),
    historyBody: document.getElementById('history-body'),

    // Test Order Modal
    testOrderModal: document.getElementById('test-order-modal'),
    testModalClose: document.getElementById('test-modal-close'),
    testModalRandom: document.getElementById('test-modal-random'),
    testModalSubmit: document.getElementById('test-modal-submit'),
    testSymbol: document.getElementById('test-symbol'),
    testSide: document.getElementById('test-side'),
    testAmount: document.getElementById('test-amount'),
    testPrice: document.getElementById('test-price'),
    testLeverage: document.getElementById('test-leverage'),

    // Monitoring Wallets
    walletsBody: document.getElementById('wallets-body'),
  };

  // Initialize validation listeners
  setupValidationListeners();

  // Initialize button listeners
  setupButtonListeners();

  // Initialize history panel listeners
  setupHistoryPanelListeners();

  // Initialize collapsible sections
  setupCollapsibleSections();

  // Initialize test order modal
  setupTestOrderModal();

  // Render monitoring wallets table
  renderWalletsTable();

  // Load saved settings from localStorage
  loadSavedSettings();

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
  Object.values(STORAGE_KEYS).forEach((key) => {
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
  elements.testOrderButton.addEventListener('click', createTestOrder);
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
    if (
      error.constructor?.name === 'ExchangeClosedByUser' ||
      error.message?.includes('closedByUser')
    ) {
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
 * Open test order modal
 */
function createTestOrder() {
  // Fill with random values by default
  fillRandomTestValues();

  // Show modal
  elements.testOrderModal.style.display = 'flex';
}

/**
 * Close test order modal
 */
function closeTestOrderModal() {
  elements.testOrderModal.style.display = 'none';
}

/**
 * Fill test order form with random values
 */
function fillRandomTestValues() {
  // Random symbol
  const symbols = ['BTC/USD:USD', 'ETH/USD:USD', 'SOL/USD:USD', 'ARB/USD:USD', 'AVAX/USD:USD'];
  elements.testSymbol.value = symbols[Math.floor(Math.random() * symbols.length)];

  // Random side
  elements.testSide.value = Math.random() > 0.5 ? 'buy' : 'sell';

  // Random amount (0.1 to 10)
  elements.testAmount.value = (Math.random() * 10 + 0.1).toFixed(4);

  // Random price (1000 to 51000)
  elements.testPrice.value = (Math.random() * 50000 + 1000).toFixed(2);

  // Random leverage (1 to 20)
  elements.testLeverage.value = Math.floor(Math.random() * 20 + 1);
}

/**
 * Submit test order from modal
 */
function submitTestOrder() {
  const symbol = elements.testSymbol.value;
  const side = elements.testSide.value;
  const amount = parseFloat(elements.testAmount.value);
  const price = parseFloat(elements.testPrice.value);
  const leverage = elements.testLeverage.value ? parseInt(elements.testLeverage.value) : null;

  // Validation
  if (!amount || amount <= 0) {
    alert('Please enter a valid amount');
    return;
  }
  if (!price || price <= 0) {
    alert('Please enter a valid price');
    return;
  }

  const testOrder = {
    symbol,
    side,
    amount: amount.toFixed(4),
    price: price.toFixed(2),
    timestamp: Date.now(),
    leverage, // Store for display/logging
  };

  addOrder(testOrder);
  console.log('🧪 Test order created:', testOrder);

  // Close modal
  closeTestOrderModal();
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
            <td>${Number(order.amount).toFixed(6)}</td>
            <td>$${Number(order.price).toFixed(2)}</td>
            <td>${new Date(order.timestamp).toLocaleString()}</td>
        </tr>
    `
    )
    .join('');

  elements.ordersBody.innerHTML = html;
}

/**
 * Setup collapsible sections with localStorage persistence
 */
function setupCollapsibleSections() {
  // Restore saved collapsed states
  const historyCollapsed = localStorage.getItem(STORAGE_KEYS.HISTORY_COLLAPSED) === 'true';
  const walletsCollapsed = localStorage.getItem(STORAGE_KEYS.WALLETS_COLLAPSED) === 'true';

  if (historyCollapsed) {
    toggleSection('history', true);
  }
  if (walletsCollapsed) {
    toggleSection('wallets', true);
  }

  // Add event listeners
  elements.historyToggle.addEventListener('click', () => {
    const isCollapsed = elements.historyContentWrapper.classList.contains('collapsed');
    toggleSection('history', !isCollapsed);
    localStorage.setItem(STORAGE_KEYS.HISTORY_COLLAPSED, (!isCollapsed).toString());
  });

  elements.walletsToggle.addEventListener('click', () => {
    const isCollapsed = elements.walletsContent.classList.contains('collapsed');
    toggleSection('wallets', !isCollapsed);
    localStorage.setItem(STORAGE_KEYS.WALLETS_COLLAPSED, (!isCollapsed).toString());
  });
}

/**
 * Toggle section collapsed state
 * @param {string} section - 'history' or 'wallets'
 * @param {boolean} collapsed - Whether to collapse or expand
 */
function toggleSection(section, collapsed) {
  if (section === 'history') {
    const icon = elements.historyToggle.querySelector('.collapse-icon');
    if (collapsed) {
      elements.historyContentWrapper.classList.add('collapsed');
      icon.textContent = '+';
    } else {
      elements.historyContentWrapper.classList.remove('collapsed');
      icon.textContent = '−';
    }
  } else if (section === 'wallets') {
    const icon = elements.walletsToggle.querySelector('.collapse-icon');
    if (collapsed) {
      elements.walletsContent.classList.add('collapsed');
      icon.textContent = '+';
    } else {
      elements.walletsContent.classList.remove('collapsed');
      icon.textContent = '−';
    }
  }
}

/**
 * Setup test order modal listeners
 */
function setupTestOrderModal() {
  // Close button
  elements.testModalClose.addEventListener('click', closeTestOrderModal);

  // Close on background click
  elements.testOrderModal.addEventListener('click', (e) => {
    if (e.target === elements.testOrderModal) {
      closeTestOrderModal();
    }
  });

  // Random values button
  elements.testModalRandom.addEventListener('click', fillRandomTestValues);

  // Submit button
  elements.testModalSubmit.addEventListener('click', submitTestOrder);

  // Close on Escape key
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && elements.testOrderModal.style.display === 'flex') {
      closeTestOrderModal();
    }
  });
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

/**
 * Render monitoring wallets table (similar to leaderboard)
 */
function renderWalletsTable() {
  const html = monitoringWallets
    .map((wallet) => {
      const displayAddress = truncateAddress(wallet.address);
      return `
        <tr data-address="${wallet.address}">
          <td>${wallet.label}</td>
          <td title="${wallet.address}">${displayAddress}</td>
        </tr>
      `;
    })
    .join('');

  elements.walletsBody.innerHTML = html;

  // Add row click event (similar to leaderboard selection)
  const rows = elements.walletsBody.querySelectorAll('tr');
  rows.forEach((row) => {
    row.addEventListener('click', () => {
      // Remove selected class from all wallet rows
      rows.forEach((r) => r.classList.remove('selected'));
      // Add selected class to clicked row
      row.classList.add('selected');

      // Auto-fill trader address
      const address = row.getAttribute('data-address');
      elements.traderAddressInput.value = address;
      config.traderAddress = address;

      // Trigger validation
      const result = validateAddress(address);
      displayValidationError('trader-address', result);
      checkFormValidity();

      // Load order history (same as leaderboard)
      showHistoryPanel(address);
    });
  });
}

// Export functions for use in other modules
export {
  config,
  isCopyTradingActive,
  orderList,
  elements,
  addOrder,
  renderOrderList,
  setFormDisabled,
  checkFormValidity,
  clearSavedSettings,
  saveSettings,
};

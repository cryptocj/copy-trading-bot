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
import { truncateAddress, formatNumber } from './utils/format.js';
import {
  startCopyTrading as startTradingService,
  stopCopyTrading as stopTradingService,
} from './services/trading.js';
import { fetchTradeHistory, renderTradeHistoryTable } from './services/tradeHistory.js';
import { fetchWalletInfo, fetchPositions, fetchWalletBalance } from './services/wallet.js';

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

    // Selected Wallet Positions (in history panel)
    selectedPositionsSection: document.getElementById('selected-positions-section'),
    selectedPositionsLoading: document.getElementById('selected-positions-loading'),
    selectedPositionsError: document.getElementById('selected-positions-error'),
    selectedPositionsContent: document.getElementById('selected-positions-content'),

    // Selected Wallet Balance (in history panel)
    selectedBalanceSection: document.getElementById('selected-balance-section'),
    selectedBalanceLoading: document.getElementById('selected-balance-loading'),
    selectedBalanceError: document.getElementById('selected-balance-error'),
    selectedBalanceContent: document.getElementById('selected-balance-content'),

    // Monitoring Wallets
    walletsBody: document.getElementById('wallets-body'),

    // Wallet Info
    refreshWalletButton: document.getElementById('refresh-wallet-button'),

    // Your Wallet
    yourWalletPlaceholder: document.getElementById('your-wallet-placeholder'),
    yourWalletLoading: document.getElementById('your-wallet-loading'),
    yourWalletError: document.getElementById('your-wallet-error'),
    yourWalletContent: document.getElementById('your-wallet-content'),
    yourBalanceFree: document.getElementById('your-balance-free'),
    yourBalanceUsed: document.getElementById('your-balance-used'),
    yourBalanceTotal: document.getElementById('your-balance-total'),
    yourPositionValue: document.getElementById('your-position-value'),
    yourUnrealizedPnl: document.getElementById('your-unrealized-pnl'),
    yourPositionsBody: document.getElementById('your-positions-body'),

    // Monitored Wallet
    monitoredWalletPlaceholder: document.getElementById('monitored-wallet-placeholder'),
    monitoredWalletLoading: document.getElementById('monitored-wallet-loading'),
    monitoredWalletError: document.getElementById('monitored-wallet-error'),
    monitoredWalletContent: document.getElementById('monitored-wallet-content'),
    monitoredWalletAddress: document.getElementById('monitored-wallet-address'),
    monitoredBalanceFree: document.getElementById('monitored-balance-free'),
    monitoredBalanceUsed: document.getElementById('monitored-balance-used'),
    monitoredBalanceTotal: document.getElementById('monitored-balance-total'),
    monitoredPositionValue: document.getElementById('monitored-position-value'),
    monitoredUnrealizedPnl: document.getElementById('monitored-unrealized-pnl'),
    monitoredPositionsBody: document.getElementById('monitored-positions-body'),
  };

  // Initialize validation listeners
  setupValidationListeners();

  // Initialize button listeners
  setupButtonListeners();

  // Initialize history panel listeners
  setupHistoryPanelListeners();

  // Initialize collapsible sections
  setupCollapsibleSections();

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

  // Automatically load user's wallet if API key is saved
  if (saveApiKey && savedApiKey) {
    console.log('API key found, automatically loading wallet info...');
    // Use setTimeout to ensure DOM is fully initialized
    setTimeout(() => {
      refreshWalletInfo().catch(error => {
        console.error('Failed to auto-load wallet:', error);
      });
    }, 100);
  }
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

  // Enable Refresh Wallet button if API key is valid
  elements.refreshWalletButton.disabled = !apiKeyValid;
}

/**
 * Setup button click listeners
 */
function setupButtonListeners() {
  elements.startButton.addEventListener('click', startCopyTrading);
  elements.stopButton.addEventListener('click', stopCopyTrading);
  elements.refreshWalletButton.addEventListener('click', refreshWalletInfo);
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
 * Show positions and trade history in right panel
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
    console.log('Fetching balance, positions and order history...');

    // Fetch balance, positions and order history in parallel
    const [balance, positions, orders] = await Promise.all([
      fetchBalanceForAddress(address),
      fetchPositionsForAddress(address),
      fetchTradeHistory(address, 200)
    ]);

    console.log('Data fetched:', 'balance:', balance, positions.length, 'positions,', orders.length, 'orders');

    // Hide loading, show content
    elements.historyLoading.style.display = 'none';
    elements.historyContent.style.display = 'block';

    // Render balance
    renderSelectedWalletBalance(balance);

    // Render positions
    renderSelectedWalletPositions(positions);

    // Render orders
    renderTradeHistoryTable(orders, elements.historyBody);

    console.log(`Displayed balance, ${positions.length} positions and ${orders.length} orders for ${address}`);
  } catch (error) {
    console.error('Error in showHistoryPanel:', error);
    // Show error
    elements.historyLoading.style.display = 'none';
    elements.historyError.style.display = 'block';
    elements.historyError.textContent = `Failed to load data: ${error.message}`;
  }
}

/**
 * Fetch balance for a specific address
 */
async function fetchBalanceForAddress(address) {
  try {
    // CCXT's fetchBalance works with user parameter (unlike fetchPositions)
    // Need to create exchange instance with user's API key to query other wallets
    const { userApiKey } = config;
    if (!userApiKey) {
      console.warn('No API key available, cannot fetch balance for monitored wallet');
      return { total: 0, free: 0, used: 0, assets: {} };
    }

    const wallet = new ethers.Wallet(userApiKey);
    const walletAddress = wallet.address;

    const exchange = new ccxt.hyperliquid({
      privateKey: userApiKey,
      walletAddress: walletAddress,
    });

    await exchange.loadMarkets();
    const balance = await fetchWalletBalance(exchange, address);
    await exchange.close();

    return balance;
  } catch (error) {
    console.error('Failed to fetch balance for address:', error);
    return { total: 0, free: 0, used: 0, assets: {} };
  }
}

/**
 * Fetch positions for a specific address
 */
async function fetchPositionsForAddress(address) {
  try {
    // fetchPositions from wallet.js uses direct API when userAddress is provided
    // We don't need an exchange instance for querying other wallets
    const positions = await fetchPositions(null, address);
    return positions;
  } catch (error) {
    console.error('Failed to fetch positions for address:', error);
    return [];
  }
}

/**
 * Render balance for selected wallet in history panel
 */
function renderSelectedWalletBalance(balance) {
  // Hide loading and error
  elements.selectedBalanceLoading.style.display = 'none';
  elements.selectedBalanceError.style.display = 'none';

  if (!balance || balance.total === 0) {
    elements.selectedBalanceContent.innerHTML = '<p style="text-align:center; padding:20px; color:#666;">No balance information available</p>';
    return;
  }

  // Render balance summary in grid layout
  const balanceHtml = `
    <div style="background-color:#0f1420; padding:20px; border-radius:6px; border:1px solid #2a3550;">
      <div style="display:grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap:20px;">
        <div>
          <div style="color:#888; font-size:0.9em; margin-bottom:5px;">Available</div>
          <div style="color:#e0e0e0; font-size:1.3em; font-weight:600;">$${formatNumber(balance.free, 2)}</div>
        </div>
        <div>
          <div style="color:#888; font-size:0.9em; margin-bottom:5px;">In Use</div>
          <div style="color:#e0e0e0; font-size:1.3em; font-weight:600;">$${formatNumber(balance.used, 2)}</div>
        </div>
        <div>
          <div style="color:#888; font-size:0.9em; margin-bottom:5px;">Total Balance</div>
          <div style="color:#e0e0e0; font-size:1.3em; font-weight:600;">$${formatNumber(balance.total, 2)}</div>
        </div>
      </div>
    </div>
  `;

  elements.selectedBalanceContent.innerHTML = balanceHtml;
}

/**
 * Render positions for selected wallet in history panel (table view)
 */
function renderSelectedWalletPositions(positions) {
  // Hide loading and error
  elements.selectedPositionsLoading.style.display = 'none';
  elements.selectedPositionsError.style.display = 'none';

  if (!positions || positions.length === 0) {
    elements.selectedPositionsContent.innerHTML = '<p style="text-align:center; padding:20px; color:#666;">No open positions</p>';
    return;
  }

  // Calculate totals
  const totalPositionValue = positions.reduce((sum, pos) => sum + (pos.size * pos.markPrice), 0);
  const totalUnrealizedPnl = positions.reduce((sum, pos) => sum + pos.unrealizedPnl, 0);

  // Render summary card
  const pnlClass = totalUnrealizedPnl >= 0 ? 'positive' : 'negative';
  const pnlSign = totalUnrealizedPnl >= 0 ? '+' : '';

  const summaryHtml = `
    <div style="background-color:#0f1420; padding:15px; border-radius:6px; margin-bottom:15px; border:1px solid #2a3550;">
      <div style="display:flex; justify-content:space-between; gap:20px;">
        <div>
          <div style="color:#888; font-size:0.9em; margin-bottom:5px;">Total Position Value</div>
          <div style="color:#e0e0e0; font-size:1.3em; font-weight:600;">$${formatNumber(totalPositionValue, 2)}</div>
        </div>
        <div>
          <div style="color:#888; font-size:0.9em; margin-bottom:5px;">Unrealized PnL</div>
          <div class="${pnlClass}" style="font-size:1.3em; font-weight:600;">${pnlSign}$${formatNumber(totalUnrealizedPnl, 2)}</div>
        </div>
      </div>
    </div>
  `;

  // Render positions table
  const tableRowsHtml = positions
    .map((pos) => {
      const sideClass = pos.side === 'long' ? 'buy' : 'sell';
      const pnlClass = pos.unrealizedPnl >= 0 ? 'positive' : 'negative';
      const pnlSign = pos.unrealizedPnl >= 0 ? '+' : '';
      const posValue = pos.size * pos.markPrice;

      return `
        <tr>
          <td>${pos.symbol.replace('/USDC:USDC', '')}</td>
          <td><span class="${sideClass}">${pos.side.toUpperCase()}</span></td>
          <td>${formatNumber(pos.size, 4)}</td>
          <td>$${formatNumber(pos.entryPrice, 2)}</td>
          <td>$${formatNumber(pos.markPrice, 2)}</td>
          <td>$${formatNumber(posValue, 2)}</td>
          <td><span class="balance-value ${pnlClass}">${pnlSign}$${formatNumber(pos.unrealizedPnl, 2)}</span></td>
          <td>${pos.leverage}x</td>
          <td>$${formatNumber(pos.liquidationPrice, 2)}</td>
        </tr>
      `;
    })
    .join('');

  const tableHtml = `
    <div class="table-container">
      <table>
        <thead>
          <tr>
            <th>Symbol</th>
            <th>Side</th>
            <th>Size</th>
            <th>Entry Price</th>
            <th>Mark Price</th>
            <th>Position Value</th>
            <th>Unrealized PnL</th>
            <th>Leverage</th>
            <th>Liquidation</th>
          </tr>
        </thead>
        <tbody>
          ${tableRowsHtml}
        </tbody>
      </table>
    </div>
  `;

  elements.selectedPositionsContent.innerHTML = summaryHtml + tableHtml;
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

/**
 * Refresh wallet info for your wallet
 */
async function refreshWalletInfo() {
  console.log('Refreshing wallet info...');

  const { userApiKey } = config;

  // Validate inputs
  if (!userApiKey) {
    alert('Please enter your API key first');
    return;
  }

  try {
    // Derive wallet address from private key
    const wallet = new ethers.Wallet(userApiKey);
    const walletAddress = wallet.address;

    // Create exchange instance for querying
    const exchange = new ccxt.hyperliquid({
      privateKey: userApiKey,
      walletAddress: walletAddress,
    });

    // Load markets once (required by CCXT for fetchBalance and fetchPositions)
    console.log('Loading markets...');
    await exchange.loadMarkets();
    console.log('Markets loaded successfully');

    // Fetch your wallet info
    await fetchAndDisplayYourWallet(exchange);

  } catch (error) {
    console.error('Failed to refresh wallet info:', error);
    alert(`Failed to refresh wallet info: ${error.message}`);
  }
}

/**
 * Fetch and display your wallet info
 */
async function fetchAndDisplayYourWallet(exchange) {
  try {
    // Show loading
    elements.yourWalletPlaceholder.style.display = 'none';
    elements.yourWalletLoading.style.display = 'block';
    elements.yourWalletError.style.display = 'none';
    elements.yourWalletContent.style.display = 'none';

    // Fetch wallet info
    const walletInfo = await fetchWalletInfo(exchange);

    // Hide loading, show content
    elements.yourWalletLoading.style.display = 'none';
    elements.yourWalletContent.style.display = 'block';

    // Display balance
    elements.yourBalanceFree.textContent = `$${formatNumber(walletInfo.balance.free, 2)}`;
    elements.yourBalanceUsed.textContent = `$${formatNumber(walletInfo.balance.used, 2)}`;
    elements.yourBalanceTotal.textContent = `$${formatNumber(walletInfo.balance.total, 2)}`;
    elements.yourPositionValue.textContent = `$${formatNumber(walletInfo.totalPositionValue, 2)}`;

    // Display unrealized PnL with color
    const pnlElement = elements.yourUnrealizedPnl;
    const pnl = walletInfo.totalUnrealizedPnl;
    pnlElement.textContent = `${pnl >= 0 ? '+' : ''}$${formatNumber(pnl, 2)}`;
    pnlElement.classList.remove('positive', 'negative');
    pnlElement.classList.add(pnl >= 0 ? 'positive' : 'negative');

    // Render positions
    renderPositions(walletInfo.positions, elements.yourPositionsBody);

    console.log('Your wallet info displayed successfully');
  } catch (error) {
    console.error('Failed to fetch your wallet info:', error);
    elements.yourWalletLoading.style.display = 'none';
    elements.yourWalletError.style.display = 'block';
    elements.yourWalletError.textContent = `Failed to load: ${error.message}`;
  }
}

/**
 * Render positions table (for Your Wallet section)
 */
function renderPositions(positions, container) {
  if (!positions || positions.length === 0) {
    container.innerHTML = '<p style="text-align:center; padding:20px; color:#666;">No open positions</p>';
    return;
  }

  const tableRowsHtml = positions
    .map((pos) => {
      const sideClass = pos.side === 'long' ? 'buy' : 'sell';
      const pnlClass = pos.unrealizedPnl >= 0 ? 'positive' : 'negative';
      const pnlSign = pos.unrealizedPnl >= 0 ? '+' : '';
      const posValue = pos.size * pos.markPrice;

      return `
        <tr>
          <td>${pos.symbol.replace('/USDC:USDC', '')}</td>
          <td><span class="${sideClass}">${pos.side.toUpperCase()}</span></td>
          <td>${formatNumber(pos.size, 4)}</td>
          <td>$${formatNumber(pos.entryPrice, 2)}</td>
          <td>$${formatNumber(pos.markPrice, 2)}</td>
          <td>$${formatNumber(posValue, 2)}</td>
          <td><span class="balance-value ${pnlClass}">${pnlSign}$${formatNumber(pos.unrealizedPnl, 2)}</span></td>
          <td>${pos.leverage}x</td>
          <td>$${formatNumber(pos.liquidationPrice, 2)}</td>
        </tr>
      `;
    })
    .join('');

  const tableHtml = `
    <div class="table-container">
      <table>
        <thead>
          <tr>
            <th>Symbol</th>
            <th>Side</th>
            <th>Size</th>
            <th>Entry Price</th>
            <th>Mark Price</th>
            <th>Position Value</th>
            <th>Unrealized PnL</th>
            <th>Leverage</th>
            <th>Liquidation</th>
          </tr>
        </thead>
        <tbody>
          ${tableRowsHtml}
        </tbody>
      </table>
    </div>
  `;

  container.innerHTML = tableHtml;
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

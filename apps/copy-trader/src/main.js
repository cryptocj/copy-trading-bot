/**
 * Main entry point for Hyperliquid Copy Trading app
 * Initializes UI, handles events, coordinates services
 */

// CCXT library loaded via script tag in HTML (global variable)
// Available as window.ccxt

// Import services and utilities
import { validateAddress, validateApiKey, validateCopyBalance } from './services/validation.js';
import { truncateAddress, formatNumber } from './utils/format.js';
import { calculateInitialPositions } from './utils/positionCalculator.js';
import {
  startCopyTrading as startTradingService,
  stopCopyTrading as stopTradingService,
  setDryRunMode,
  isDryRunMode,
} from './services/trading.js';
import { fetchTradeHistory, renderTradeHistoryTable } from './services/tradeHistory.js';
import { fetchWalletInfo, fetchPositions, fetchWalletBalance } from './services/wallet.js';
import { loadSessionState, initializeTabId } from './services/sessionPersistence.js';

// Global state
let config = {
  traderAddress: '',
  userApiKey: '',
  copyBalance: 0, // Total balance for copying (replaces tradeValue and maxLeverage)
  useLatestPrice: false, // Use latest market price instead of trader's entry price
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
  // Wallet-specific configuration (per monitored wallet)
  getTraderAddressKey: (wallet) => `copyTrading.traderAddress.${wallet}`,
  getCopyBalanceKey: (wallet) => `copyTrading.copyBalance.${wallet}`,
  LAST_MONITORED_WALLET: 'copyTrading.lastMonitoredWallet', // Track last active wallet

  // Global settings (shared across tabs)
  API_KEY: 'copyTrading.apiKey',
  SAVE_API_KEY: 'copyTrading.saveApiKey',
  HISTORY_COLLAPSED: 'copyTrading.historyCollapsed',
  WALLETS_COLLAPSED: 'copyTrading.walletsCollapsed',
  MY_WALLET_ADDRESS: 'copyTrading.myWalletAddress', // Custom wallet address for "My Wallet"
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
    copyBalanceInput: document.getElementById('copy-balance'),

    // Validation errors
    traderAddressError: document.getElementById('trader-address-error'),
    apiKeyError: document.getElementById('api-key-error'),
    copyBalanceError: document.getElementById('copy-balance-error'),

    // Buttons and controls
    testCalculationButton: document.getElementById('test-calculation-button'),
    startButton: document.getElementById('start-button'),
    stopButton: document.getElementById('stop-button'),
    calculationTestResults: document.getElementById('calculation-test-results'),
    loadCustomWalletButton: document.getElementById('load-custom-wallet-button'),
    customWalletAddress: document.getElementById('custom-wallet-address'),
    loadMyWalletButton: document.getElementById('load-my-wallet-button'),
    myWalletAddress: document.getElementById('my-wallet-address'),
    dryRunModeCheckbox: document.getElementById('dry-run-mode'),
    useLatestPriceCheckbox: document.getElementById('use-latest-price'),

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

  // Restore active session if exists (T015 - US1: Automatic Session Recovery)
  // Non-blocking: runs in background, UI remains responsive
  restoreActiveSession().catch((error) => {
    console.error('Error during session restoration:', error);
  });

  // Expose utility functions to console for debugging
  window.copyTrading = {
    clearSavedSettings,
    saveSettings,
    config,
    viewSavedSettings: () => {
      console.log('═══════════════════════════════════════════════════════');
      console.log('📊 COPY TRADING STORAGE OVERVIEW');
      console.log('═══════════════════════════════════════════════════════');

      const lastWallet = localStorage.getItem(STORAGE_KEYS.LAST_MONITORED_WALLET);
      console.log(`\n🏷️  Last Monitored Wallet: ${lastWallet || 'none'}`);

      if (lastWallet) {
        console.log(`\n📋 Current Wallet Configuration:`);
        console.log(
          `  - Trader Address: ${localStorage.getItem(STORAGE_KEYS.getTraderAddressKey(lastWallet)) || 'not set'}`
        );
        console.log(
          `  - Copy Balance: $${localStorage.getItem(STORAGE_KEYS.getCopyBalanceKey(lastWallet)) || 'not set'}`
        );
      }

      // Find all wallet-specific configurations
      console.log(`\n💼 All Wallet Configurations in Storage:`);
      const walletConfigs = {};
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith('copyTrading.traderAddress.')) {
          const wallet = key.replace('copyTrading.traderAddress.', '');
          const balance = localStorage.getItem(STORAGE_KEYS.getCopyBalanceKey(wallet));
          walletConfigs[wallet] = {
            address: localStorage.getItem(key),
            balance: balance || 'not set',
          };
        }
      }

      if (Object.keys(walletConfigs).length > 0) {
        Object.entries(walletConfigs).forEach(([wallet, config], index) => {
          console.log(`\n  ${index + 1}. Wallet: ${wallet}`);
          console.log(`     - Address: ${config.address}`);
          console.log(`     - Balance: $${config.balance}`);
        });
      } else {
        console.log('  No wallet configurations found');
      }

      console.log(`\n🔐 Global Settings:`);
      console.log(
        `  - API Key Saved: ${localStorage.getItem(STORAGE_KEYS.SAVE_API_KEY) === 'true' ? 'Yes' : 'No'}`
      );
      console.log(
        `  - History Collapsed: ${localStorage.getItem(STORAGE_KEYS.HISTORY_COLLAPSED) === 'true' ? 'Yes' : 'No'}`
      );
      console.log(
        `  - Wallets Collapsed: ${localStorage.getItem(STORAGE_KEYS.WALLETS_COLLAPSED) === 'true' ? 'Yes' : 'No'}`
      );

      console.log(`\n═══════════════════════════════════════════════════════`);
    },
  };

  console.log('App initialized successfully.');
  console.log('💾 Settings auto-save enabled with wallet-specific storage.');
  console.log('🔍 Debug utilities available:');
  console.log('   - copyTrading.viewSavedSettings() - View all saved configurations');
  console.log('   - copyTrading.clearSavedSettings() - Clear all saved settings');
});

/**
 * Load saved settings from localStorage
 * Now supports wallet-specific configuration storage
 */
function loadSavedSettings() {
  console.log('📥 Loading saved settings from localStorage...');

  // Load last monitored wallet
  const lastWallet = localStorage.getItem(STORAGE_KEYS.LAST_MONITORED_WALLET);
  console.log(`📋 Last monitored wallet: ${lastWallet || 'none'}`);

  let savedTraderAddress = null;
  let savedCopyBalance = null;

  // If we have a last monitored wallet, load its specific configuration
  if (lastWallet) {
    const traderAddressKey = STORAGE_KEYS.getTraderAddressKey(lastWallet);
    const copyBalanceKey = STORAGE_KEYS.getCopyBalanceKey(lastWallet);

    savedTraderAddress = localStorage.getItem(traderAddressKey);
    savedCopyBalance = localStorage.getItem(copyBalanceKey);

    console.log(`🔑 Loading config with keys:`);
    console.log(`  - traderAddressKey: ${traderAddressKey}`);
    console.log(`  - copyBalanceKey: ${copyBalanceKey}`);
    console.log(`  - traderAddress: ${savedTraderAddress || 'not found'}`);
    console.log(`  - copyBalance: ${savedCopyBalance || 'not found'}`);

    if (savedTraderAddress) {
      elements.traderAddressInput.value = savedTraderAddress;
      config.traderAddress = savedTraderAddress;
    }

    if (savedCopyBalance) {
      elements.copyBalanceInput.value = savedCopyBalance;
      config.copyBalance = parseFloat(savedCopyBalance);
    }

    console.log(`✅ Loaded configuration for wallet: ${lastWallet}`);
  } else {
    console.log('⚠️ No last monitored wallet found');
  }

  // Load API key only if user opted in (global setting)
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

  // Load saved custom wallet address for "My Wallet" section
  const savedMyWalletAddress = localStorage.getItem(STORAGE_KEYS.MY_WALLET_ADDRESS);
  if (savedMyWalletAddress) {
    elements.myWalletAddress.value = savedMyWalletAddress;
    console.log(`📍 Loaded saved wallet address: ${savedMyWalletAddress}`);
  }

  console.log('Settings loaded:', {
    lastMonitoredWallet: lastWallet || 'none',
    traderAddress: savedTraderAddress ? '✓' : '✗',
    copyBalance: savedCopyBalance ? '✓' : '✗',
    apiKey: saveApiKey && savedApiKey ? '✓' : '✗',
    myWalletAddress: savedMyWalletAddress ? '✓' : '✗',
  });

  // Automatically load user's wallet if custom address is saved
  if (savedMyWalletAddress) {
    console.log('📍 Saved wallet address found, automatically loading wallet info...');
    // Use setTimeout to ensure DOM is fully initialized
    setTimeout(() => {
      refreshWalletInfo().catch((error) => {
        console.error('Failed to auto-load wallet by address:', error);
      });
    }, 100);
  } else if (saveApiKey && savedApiKey) {
    // Fall back to API key if no custom address saved
    console.log('API key found, automatically loading wallet info...');
    // Use setTimeout to ensure DOM is fully initialized
    setTimeout(() => {
      refreshWalletInfo().catch((error) => {
        console.error('Failed to auto-load wallet:', error);
      });
    }, 100);
  }
}

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
    isCopyTradingActive = true;

    console.log('Restoring copy trading session...');

    // Start trading service with resumeState parameter
    await startTradingService(
      config,
      (order) => {
        addOrder(order); // Add order to display list
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
    isCopyTradingActive = false;
    elements.startButton.disabled = false;
    elements.stopButton.disabled = true;
    setFormDisabled(false);
    checkFormValidity();

    alert(`Failed to restore copy trading session: ${error.message}\n\nPlease start manually.`);
  }
}

/**
 * Save settings to localStorage
 * Now supports wallet-specific configuration storage
 */
function saveSettings() {
  console.log('💾 Saving settings to localStorage...');

  // Save wallet-specific configuration using traderAddress as key
  if (config.traderAddress) {
    // Use traderAddress as the wallet identifier
    const walletKey = config.traderAddress;

    const traderAddressKey = STORAGE_KEYS.getTraderAddressKey(walletKey);
    const copyBalanceKey = STORAGE_KEYS.getCopyBalanceKey(walletKey);

    // Save trader address with wallet-specific key
    localStorage.setItem(traderAddressKey, config.traderAddress);

    // Save copy balance with wallet-specific key
    if (config.copyBalance) {
      localStorage.setItem(copyBalanceKey, config.copyBalance.toString());
    }

    // Track this as the last monitored wallet
    localStorage.setItem(STORAGE_KEYS.LAST_MONITORED_WALLET, walletKey);

    console.log(`🔑 Saved config with keys:`);
    console.log(`  - walletKey: ${walletKey}`);
    console.log(`  - traderAddressKey: ${traderAddressKey}`);
    console.log(`  - copyBalanceKey: ${copyBalanceKey}`);
    console.log(`  - traderAddress: ${config.traderAddress}`);
    console.log(`  - copyBalance: ${config.copyBalance || 'not set'}`);
    console.log(`✅ Configuration saved for wallet: ${walletKey}`);
  } else {
    console.log('⚠️ No trader address to save');
  }

  // Save global settings (API key - shared across all wallets)
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
 * Clears both global settings and all wallet-specific configurations
 */
function clearSavedSettings() {
  // Clear global settings
  localStorage.removeItem(STORAGE_KEYS.API_KEY);
  localStorage.removeItem(STORAGE_KEYS.SAVE_API_KEY);
  localStorage.removeItem(STORAGE_KEYS.HISTORY_COLLAPSED);
  localStorage.removeItem(STORAGE_KEYS.WALLETS_COLLAPSED);
  localStorage.removeItem(STORAGE_KEYS.LAST_MONITORED_WALLET);

  // Clear all wallet-specific configurations
  // Search for all keys matching our wallet-specific patterns
  const keysToRemove = [];
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (
      key &&
      (key.startsWith('copyTrading.traderAddress.') ||
        key.startsWith('copyTrading.copyBalance.') ||
        key.startsWith('copyTrading.session.'))
    ) {
      keysToRemove.push(key);
    }
  }

  // Remove all wallet-specific keys
  keysToRemove.forEach((key) => localStorage.removeItem(key));

  console.log('All saved settings cleared (including all wallet configurations)');
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

  // Dry-run mode checkbox listener
  if (elements.dryRunModeCheckbox) {
    elements.dryRunModeCheckbox.addEventListener('change', () => {
      const enabled = elements.dryRunModeCheckbox.checked;
      setDryRunMode(enabled);

      // Update button text to indicate mode
      const startButtonText = enabled
        ? 'Start Copy Trading (DRY RUN)'
        : 'Start Copy Trading (LIVE)';
      elements.startButton.textContent = startButtonText;

      console.log(`🧪 Dry-run mode ${enabled ? 'enabled' : 'disabled'} - orders will ${enabled ? 'NOT' : ''} be placed on exchange`);
    });

    // Set initial mode based on checkbox state
    setDryRunMode(elements.dryRunModeCheckbox.checked);
    const initialButtonText = elements.dryRunModeCheckbox.checked
      ? 'Start Copy Trading (DRY RUN)'
      : 'Start Copy Trading (LIVE)';
    elements.startButton.textContent = initialButtonText;
  }

  // Use latest price checkbox listener
  if (elements.useLatestPriceCheckbox) {
    elements.useLatestPriceCheckbox.addEventListener('change', () => {
      config.useLatestPrice = elements.useLatestPriceCheckbox.checked;
      console.log(`📊 Use latest price: ${config.useLatestPrice ? 'enabled' : 'disabled'} - initial positions will use ${config.useLatestPrice ? 'current market price with tick offset' : "trader's entry price"}`);
    });

    // Set initial state
    config.useLatestPrice = elements.useLatestPriceCheckbox.checked;
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
  elements.copyBalanceInput.addEventListener('blur', () => {
    const result = validateCopyBalance(elements.copyBalanceInput.value);
    displayValidationError('copy-balance', result);
    if (result.valid) {
      config.copyBalance = result.balance;
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
  const copyBalanceValid = validateCopyBalance(elements.copyBalanceInput.value).valid;

  const allValid = addressValid && apiKeyValid && copyBalanceValid;

  // Enable Start button only if all fields valid and not currently active
  elements.startButton.disabled = !allValid || isCopyTradingActive;

  // Enable Refresh Wallet button if API key is valid
  elements.refreshWalletButton.disabled = !apiKeyValid;
}

/**
 * Test position calculation with current form values
 */
async function testPositionCalculation() {
  console.log('Test Position Calculation button clicked');

  // Validate trader address
  const traderAddress = elements.traderAddressInput.value.trim();
  const addressValidation = validateAddress(traderAddress);
  if (!addressValidation.valid) {
    elements.calculationTestResults.style.display = 'block';
    elements.calculationTestResults.innerHTML = `
      <div class="error-message">
        ❌ Please enter a valid trader address: ${addressValidation.error || 'Invalid format'}
      </div>
    `;
    return;
  }

  // Validate copy balance
  const copyBalance = parseFloat(elements.copyBalanceInput.value);
  if (isNaN(copyBalance) || copyBalance < 50) {
    elements.calculationTestResults.style.display = 'block';
    elements.calculationTestResults.innerHTML = `
      <div class="error-message">
        ❌ Please enter a valid copy balance (minimum $50)
      </div>
    `;
    return;
  }

  // Show loading state
  elements.calculationTestResults.style.display = 'block';
  elements.calculationTestResults.innerHTML = `
    <div style="text-align:center; padding:40px; color:#888;">
      Loading trader positions...
    </div>
  `;

  try {
    // Fetch trader's positions
    const traderPositions = await fetchPositionsForAddress(traderAddress);

    if (!traderPositions || traderPositions.length === 0) {
      elements.calculationTestResults.innerHTML = `
        <div style="padding:15px; background-color:#1a2332; border-radius:4px; border-left:3px solid #888; text-align:center;">
          <span style="color:#888;">No open positions found for this trader</span>
        </div>
      `;
      return;
    }

    // Calculate what positions would be opened
    const calculation = calculateInitialPositions(traderPositions, copyBalance);
    console.log('Position calculation:', calculation);

    // Build results display
    const {
      positions,
      totalEstimatedCost,
      totalMarketValue,
      feasible,
      warnings,
      utilizationPercent,
      wasScaled,
      scalingFactor,
      originalTotalCost,
      originalTotalValue,
    } = calculation;

    // Show scaling info if positions were scaled
    let scalingInfoHtml = '';
    if (wasScaled) {
      scalingInfoHtml = `
        <div style="margin-bottom:15px; padding:12px; background-color:#2a3550; border-radius:4px; border-left:3px solid #ffaa00;">
          <div style="color:#ffaa00; font-weight:600; margin-bottom:8px;">📉 Positions Scaled Down</div>
          <div style="display:grid; grid-template-columns: 140px 1fr; gap:8px; font-size:0.9em;">
            <div style="color:#888;">Scaling Factor:</div>
            <div style="color:#e0e0e0; font-weight:600;">${(scalingFactor * 100).toFixed(1)}%</div>

            <div style="color:#888;">Original Required:</div>
            <div style="color:#888;">$${originalTotalCost.toFixed(2)}</div>

            <div style="color:#888;">Scaled to Fit:</div>
            <div style="color:#4a9eff; font-weight:600;">$${totalEstimatedCost.toFixed(2)}</div>
          </div>
        </div>
      `;
    }

    // Test calculation doesn't fetch real-time prices (would be too slow for preview)
    const latestPrices = new Map();

    // Build position table with comparison if scaled
    const positionsTableHtml = positions
      .map((pos, index) => {
        const sideColor = pos.side === 'long' ? '#2a9d5f' : '#d94848';
        const originalPos = traderPositions[index];

        // Get latest price info for this symbol
        const priceInfo = latestPrices.get(pos.symbol);
        const hasLatestPrice = priceInfo && config.useLatestPrice;
        const displayPrice = hasLatestPrice ? priceInfo.orderPrice : pos.entryPrice;
        const priceChange = hasLatestPrice ? ((priceInfo.orderPrice - pos.entryPrice) / pos.entryPrice * 100) : 0;

        if (wasScaled && originalPos) {
          // Show comparison: Original → Scaled
          return `
          <tr style="border-bottom:1px solid #2a3550;">
            <td style="padding:8px; color:#e0e0e0; font-weight:600;">${pos.symbol}</td>
            <td style="padding:8px; color:${sideColor}; font-weight:600; text-transform:uppercase;">${pos.side}</td>
            <td style="padding:8px; color:#e0e0e0;">
              <div style="color:#888; font-size:0.85em;">${originalPos.size.toFixed(4)}</div>
              <div style="color:#4a9eff; font-weight:600;">→ ${pos.size.toFixed(4)}</div>
            </td>
            <td style="padding:8px;">
              ${hasLatestPrice ? `
                <div style="color:#888; font-size:0.75em;">Trader: $${pos.entryPrice.toFixed(4)}</div>
                <div style="color:#4a9eff; font-weight:600; margin-top:2px;">Order: $${displayPrice.toFixed(4)}</div>
                <div style="color:${priceChange >= 0 ? '#2a9d5f' : '#d94848'}; font-size:0.75em;">(${priceChange >= 0 ? '+' : ''}${priceChange.toFixed(2)}%)</div>
              ` : `
                <div style="color:#e0e0e0;">$${pos.entryPrice.toFixed(4)}</div>
              `}
            </td>
            <td style="padding:8px; color:#888;">${pos.leverage}x</td>
            <td style="padding:8px; color:#e0e0e0;">
              <div style="color:#888; font-size:0.85em;">$${(originalPos.size * originalPos.entryPrice).toFixed(2)}</div>
              <div style="color:#4a9eff; font-weight:600;">→ $${pos.marketValue.toFixed(2)}</div>
            </td>
            <td style="padding:8px; color:#4a9eff; font-weight:600;">
              <div style="color:#888; font-size:0.85em;">$${((originalPos.size * originalPos.entryPrice) / pos.leverage).toFixed(2)}</div>
              <div style="color:#4a9eff; font-weight:600;">→ $${pos.estimatedCost.toFixed(2)}</div>
            </td>
          </tr>
        `;
        } else {
          // Show single row when not scaled
          return `
          <tr style="border-bottom:1px solid #2a3550;">
            <td style="padding:8px; color:#e0e0e0; font-weight:600;">${pos.symbol}</td>
            <td style="padding:8px; color:${sideColor}; font-weight:600; text-transform:uppercase;">${pos.side}</td>
            <td style="padding:8px; color:#e0e0e0;">${pos.size.toFixed(4)}</td>
            <td style="padding:8px;">
              ${hasLatestPrice ? `
                <div style="color:#888; font-size:0.75em;">Trader: $${pos.entryPrice.toFixed(4)}</div>
                <div style="color:#4a9eff; font-weight:600; margin-top:2px;">Order: $${displayPrice.toFixed(4)}</div>
                <div style="color:${priceChange >= 0 ? '#2a9d5f' : '#d94848'}; font-size:0.75em;">(${priceChange >= 0 ? '+' : ''}${priceChange.toFixed(2)}%)</div>
              ` : `
                <div style="color:#e0e0e0;">$${pos.entryPrice.toFixed(4)}</div>
              `}
            </td>
            <td style="padding:8px; color:#888;">${pos.leverage}x</td>
            <td style="padding:8px; color:#e0e0e0;">$${pos.marketValue.toFixed(2)}</td>
            <td style="padding:8px; color:#4a9eff; font-weight:600;">$${pos.estimatedCost.toFixed(2)}</td>
          </tr>
        `;
        }
      })
      .join('');

    const totalRowHtml = `
      <tr style="background-color:#1a2137; font-weight:700;">
        <td colspan="5" style="padding:8px; color:#888; text-align:right;">TOTAL:</td>
        <td style="padding:8px; color:#e0e0e0;">$${totalMarketValue.toFixed(2)}</td>
        <td style="padding:8px; color:#4a9eff;">$${totalEstimatedCost.toFixed(2)}</td>
      </tr>
    `;

    const feasibilityColor = '#2a9d5f'; // Always green after scaling
    const feasibilityIcon = '✅';
    const feasibilityText = wasScaled ? 'Feasible (Scaled)' : 'Feasible';
    const utilizationColor = utilizationPercent > 80 ? '#ffaa00' : '#2a9d5f';

    let warningsHtml = '';
    if (warnings.length > 0) {
      warningsHtml = `
        <div style="margin-top:10px; padding:10px; background-color:#3a1a1a; border-radius:4px; border-left:3px solid #ff4a4a;">
          <div style="color:#ff4a4a; font-weight:600; margin-bottom:5px;">⚠️ Warnings:</div>
          ${warnings.map((warning) => `<div style="color:#ffaa00; font-size:0.85em; margin-left:20px;">• ${warning}</div>`).join('')}
        </div>
      `;
    }

    elements.calculationTestResults.innerHTML = `
      <h3 style="color:#4a9eff; margin-top:0; margin-bottom:15px; font-size:1.1em;">📊 Position Calculation Test Results</h3>

      <div style="margin-bottom:15px; padding:12px; background-color:#1a2332; border-radius:4px; border-left:3px solid #4a9eff;">
        <div style="display:grid; grid-template-columns: 140px 1fr; gap:8px; font-size:0.9em;">
          <div style="color:#888;">Trader Address:</div>
          <div style="color:#e0e0e0; word-break:break-all; font-family:monospace; font-size:0.85em;">${traderAddress}</div>

          <div style="color:#888;">Copy Balance:</div>
          <div style="color:#4a9eff; font-weight:600;">$${copyBalance.toFixed(2)}</div>
        </div>
      </div>

      ${scalingInfoHtml}

      <h4 style="color:#4a9eff; margin-bottom:10px; font-size:1em;">Initial Positions to Copy (${positions.length})</h4>
      <div style="background-color:#0a0e1a; border-radius:6px; border:1px solid #2a3550; overflow:hidden;">
        <table style="width:100%; border-collapse:collapse; font-size:0.85em;">
          <thead style="background-color:#1a2137;">
            <tr>
              <th style="padding:8px; text-align:left; color:#888;">Symbol</th>
              <th style="padding:8px; text-align:left; color:#888;">Side</th>
              <th style="padding:8px; text-align:left; color:#888;">Size</th>
              <th style="padding:8px; text-align:left; color:#888;">Price</th>
              <th style="padding:8px; text-align:left; color:#888;">Leverage</th>
              <th style="padding:8px; text-align:left; color:#888;">Market Value</th>
              <th style="padding:8px; text-align:left; color:#888;">Required Margin</th>
            </tr>
          </thead>
          <tbody>
            ${positionsTableHtml}
            ${totalRowHtml}
          </tbody>
        </table>
      </div>

      <div style="margin-top:10px; padding:12px; background-color:#1a2332; border-radius:4px; border-left:3px solid ${feasibilityColor};">
        <div style="display:grid; grid-template-columns: 140px 1fr; gap:8px; font-size:0.9em;">
          <div style="color:#888;">Status:</div>
          <div style="color:${feasibilityColor}; font-weight:600;">${feasibilityIcon} ${feasibilityText}</div>

          <div style="color:#888;">Balance Utilization:</div>
          <div style="color:${utilizationColor}; font-weight:600;">${utilizationPercent.toFixed(1)}%</div>
        </div>
      </div>

      ${warningsHtml}
    `;
  } catch (error) {
    console.error('Position calculation test failed:', error);
    elements.calculationTestResults.innerHTML = `
      <div class="error-message">
        ❌ Failed to load trader positions: ${error.message}
      </div>
    `;
  }
}

/**
 * Setup button click listeners
 */
function setupButtonListeners() {
  elements.testCalculationButton.addEventListener('click', testPositionCalculation);
  elements.startButton.addEventListener('click', startCopyTrading);
  elements.stopButton.addEventListener('click', stopCopyTrading);
  elements.refreshWalletButton.addEventListener('click', refreshWalletInfo);
  elements.loadCustomWalletButton.addEventListener('click', loadCustomWallet);
  elements.loadMyWalletButton.addEventListener('click', loadMyWalletByAddress);
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
    saveSettings();

    // Update UI state
    isCopyTradingActive = true;
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
        addOrder(order); // Add order to display list (US4)
      }
    );

    console.log('✅ Copy trading started successfully');
    console.log(`📡 Now monitoring wallet: ${config.traderAddress}`);
  } catch (error) {
    console.error('❌ Failed to start copy trading:', error);

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
  console.log('========================================');
  console.log('[showHistoryPanel] FUNCTION CALLED');
  console.log('[showHistoryPanel] Address:', address);
  console.log('[showHistoryPanel] Timestamp:', new Date().toISOString());
  console.log('========================================');

  // Reset state - hide all panels
  elements.historyPlaceholder.style.display = 'none';
  elements.historyLoading.style.display = 'block';
  elements.historyError.style.display = 'none';
  elements.historyContent.style.display = 'none';

  // Set address display
  elements.historyAddress.textContent = truncateAddress(address);
  elements.historyAddress.title = address;

  try {
    console.log('[showHistoryPanel] Step 1: Starting data fetch...');

    // Fetch balance, positions and order history in parallel
    const [balance, positions, orders] = await Promise.all([
      fetchBalanceForAddress(address),
      fetchPositionsForAddress(address),
      fetchTradeHistory(address, 200),
    ]);

    console.log('[showHistoryPanel] Step 2: Data fetched successfully');
    console.log('[showHistoryPanel] Step 2: Balance:', balance);
    console.log('[showHistoryPanel] Step 2: Positions count:', positions.length);
    console.log('[showHistoryPanel] Step 2: Orders count:', orders.length);

    // Hide loading, show content
    elements.historyLoading.style.display = 'none';
    elements.historyContent.style.display = 'block';

    // Render balance
    console.log('[showHistoryPanel] Step 3: Rendering balance...');
    renderSelectedWalletBalance(balance);

    // Render positions
    console.log('[showHistoryPanel] Step 3: Rendering positions...');
    renderSelectedWalletPositions(positions);

    // Render orders in history panel
    console.log(`[showHistoryPanel] Step 4: Rendering ${orders.length} orders in history panel`);
    console.log(`[showHistoryPanel] Step 4: historyBody element:`, elements.historyBody);
    console.log(`[showHistoryPanel] Step 4: historyBody exists:`, !!elements.historyBody);

    try {
      renderTradeHistoryTable(orders, elements.historyBody);
      console.log(`[showHistoryPanel] Step 4: History panel updated successfully`);
    } catch (err) {
      console.error(`[showHistoryPanel] Step 4: Error rendering history table:`, err);
    }

    // Also update the "Recent Orders" section at the bottom to show selected wallet's orders
    console.log(`[showHistoryPanel] Step 5: Updating Recent Orders section`);
    console.log(`[showHistoryPanel] - Total orders: ${orders.length}`);
    console.log(`[showHistoryPanel] - Orders to display: ${Math.min(orders.length, 6)}`);
    console.log(`[showHistoryPanel] - Target element:`, elements.ordersBody);
    console.log(`[showHistoryPanel] - Element exists:`, !!elements.ordersBody);
    console.log(`[showHistoryPanel] - Element ID should be:`, 'orders-body');

    try {
      renderTradeHistoryTable(orders.slice(0, 6), elements.ordersBody);
      console.log(`[showHistoryPanel] Step 5: Recent Orders section updated successfully`);
    } catch (err) {
      console.error(`[showHistoryPanel] Step 5: Error rendering orders table:`, err);
    }

    console.log(
      `[showHistoryPanel] ✅ Complete: Displayed balance, ${positions.length} positions and ${orders.length} orders for ${address}`
    );
  } catch (error) {
    console.error('Error in showHistoryPanel:', error);
    // Show error
    elements.historyLoading.style.display = 'none';
    elements.historyError.style.display = 'block';
    elements.historyError.textContent = `Failed to load data: ${error.message}`;
  }
}

/**
 * Fetch balance for a specific address using Hyperliquid Direct API
 * Works without API key - uses public API endpoint
 */
async function fetchBalanceForAddress(address) {
  try {
    console.log(`[fetchBalance] Querying balance for ${address}`);

    // Use Hyperliquid direct API (same as positions)
    const response = await fetch('https://api.hyperliquid.xyz/info', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: 'clearinghouseState',
        user: address,
      }),
    });

    if (!response.ok) {
      throw new Error(`Hyperliquid API error: ${response.status}`);
    }

    const data = await response.json();
    console.log(`[fetchBalance] Full API response:`, JSON.stringify(data, null, 2));

    // Extract balance from marginSummary
    const marginSummary = data.marginSummary || {};
    console.log(`[fetchBalance] marginSummary:`, marginSummary);

    // Hyperliquid balance structure:
    // - accountValue: Account equity (raw USD + unrealized PnL)
    // - totalMarginUsed: Margin currently locked in positions
    // - totalRawUsd: Raw USD balance (collateral value before PnL)
    // - withdrawable: Amount that can be withdrawn
    // - totalNtlPos: Total notional position value
    const accountValue = parseFloat(marginSummary.accountValue || 0);
    const totalMarginUsed = parseFloat(marginSummary.totalMarginUsed || 0);
    const totalRawUsd = parseFloat(marginSummary.totalRawUsd || 0);
    const withdrawable = parseFloat(data.withdrawable || 0);

    // Balance calculations for display:
    // - Total: Raw USD balance (collateral before PnL) = totalRawUsd
    // - Used: Margin locked in positions = totalMarginUsed
    // - Available: Free margin for new positions = totalRawUsd - totalMarginUsed
    const balance = {
      total: totalRawUsd, // Raw collateral
      used: totalMarginUsed, // Margin in use
      free: totalRawUsd - totalMarginUsed, // Available margin
      accountValue: accountValue, // Equity (with PnL)
      withdrawable: withdrawable, // Withdrawable amount
      assets: {
        USDC: {
          total: totalRawUsd,
          used: totalMarginUsed,
          free: totalRawUsd - totalMarginUsed,
        },
      },
    };

    console.log(`[fetchBalance] Calculated balance:`, balance);
    console.log(`[fetchBalance] - Total (Raw USD): $${totalRawUsd.toFixed(2)}`);
    console.log(`[fetchBalance] - Margin Used: $${totalMarginUsed.toFixed(2)}`);
    console.log(`[fetchBalance] - Available: $${(totalRawUsd - totalMarginUsed).toFixed(2)}`);
    console.log(`[fetchBalance] - Account Value (Equity): $${accountValue.toFixed(2)}`);
    console.log(`[fetchBalance] - Withdrawable: $${withdrawable.toFixed(2)}`);
    return balance;
  } catch (error) {
    console.error('[fetchBalance] Failed to fetch balance:', error);
    return { total: 0, free: 0, used: 0, assets: {} };
  }
}

/**
 * Fetch LATEST open positions for a specific address
 * Always fetches fresh data from Hyperliquid API - no caching
 * @param {string} address - Wallet address to query
 * @returns {Promise<Array>} Array of current open position objects
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
    elements.selectedBalanceContent.innerHTML =
      '<p style="text-align:center; padding:20px; color:#666;">No balance information available</p>';
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
    elements.selectedPositionsContent.innerHTML =
      '<p style="text-align:center; padding:20px; color:#666;">No open positions</p>';
    return;
  }

  // Calculate totals
  const totalPositionValue = positions.reduce((sum, pos) => sum + pos.size * pos.markPrice, 0);
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
    row.addEventListener('click', async () => {
      console.log('[WALLET CLICK] Event triggered!');

      try {
        // Remove selected class from all wallet rows
        rows.forEach((r) => r.classList.remove('selected'));
        // Add selected class to clicked row
        row.classList.add('selected');

        // Auto-fill trader address
        const address = row.getAttribute('data-address');
        console.log(`[WALLET CLICK] 👆 Wallet selected: ${address}`);

        elements.traderAddressInput.value = address;
        config.traderAddress = address;

        // Load wallet-specific copy balance (if exists)
        const savedCopyBalance = localStorage.getItem(STORAGE_KEYS.getCopyBalanceKey(address));
        if (savedCopyBalance) {
          console.log(`📂 Loading saved copy balance for this wallet: $${savedCopyBalance}`);
          elements.copyBalanceInput.value = savedCopyBalance;
          config.copyBalance = parseFloat(savedCopyBalance);
        } else {
          console.log(
            `⚠️ No saved copy balance for this wallet, keeping current value: $${config.copyBalance}`
          );
        }

        // Trigger validation
        const result = validateAddress(address);
        displayValidationError('trader-address', result);
        checkFormValidity();

        // Save settings with wallet-specific configuration
        if (result.valid) {
          console.log(`📝 Auto-saving configuration for selected wallet`);
          saveSettings();
        }

        // Load order history (same as leaderboard) - await to catch errors
        console.log(`🔄 Loading history panel for ${address}...`);
        await showHistoryPanel(address);
      } catch (error) {
        console.error('Error in wallet row click handler:', error);
        alert(`Failed to load wallet data: ${error.message}`);
      }
    });
  });
}

/**
 * Refresh wallet info for your wallet
 */
async function refreshWalletInfo() {
  console.log('Refreshing wallet info...');

  // Check for saved custom wallet address first
  const savedAddress = localStorage.getItem(STORAGE_KEYS.MY_WALLET_ADDRESS);

  if (savedAddress) {
    console.log(`🔄 Using saved wallet address: ${savedAddress}`);

    try {
      // Show loading state
      elements.yourWalletPlaceholder.style.display = 'none';
      elements.yourWalletError.style.display = 'none';
      elements.yourWalletContent.style.display = 'none';
      elements.yourWalletLoading.style.display = 'block';

      // Fetch balance and positions using saved address
      const [balance, positions] = await Promise.all([
        fetchBalanceForAddress(savedAddress),
        fetchPositionsForAddress(savedAddress),
      ]);

      // Display in "My Wallet & Positions" section
      displayYourWalletInfo(balance, positions);

      console.log(`✅ Wallet ${savedAddress} refreshed successfully`);
    } catch (error) {
      console.error('Failed to refresh wallet by address:', error);

      // Show error
      elements.yourWalletPlaceholder.style.display = 'none';
      elements.yourWalletLoading.style.display = 'none';
      elements.yourWalletContent.style.display = 'none';
      elements.yourWalletError.style.display = 'block';
      elements.yourWalletError.textContent = `Failed to refresh wallet: ${error.message}`;
    }
    return;
  }

  // Fall back to API key derivation if no saved address
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
 * Load custom wallet by address input
 * Query balance and positions without needing API key
 */
async function loadCustomWallet() {
  console.log('Loading custom wallet...');

  const address = elements.customWalletAddress.value.trim();

  // Validate address format (basic Ethereum address check)
  if (!address) {
    alert('Please enter a wallet address');
    return;
  }

  if (!address.match(/^0x[a-fA-F0-9]{40}$/)) {
    alert('Invalid wallet address format. Must be 40 hex characters starting with 0x');
    return;
  }

  try {
    console.log(`Loading wallet data for ${address}...`);

    // Load wallet data in history panel (balance + positions + orders)
    await showHistoryPanel(address);

    // Optionally auto-fill trader address input
    elements.traderAddressInput.value = address;
    config.traderAddress = address;

    // Trigger validation
    const result = validateAddress(address);
    displayValidationError('trader-address', result);
    checkFormValidity();

    console.log(`Custom wallet ${address} loaded successfully`);
  } catch (error) {
    console.error('Failed to load custom wallet:', error);
    alert(`Failed to load wallet: ${error.message}`);
  }
}

/**
 * Load wallet by address directly (for "My Wallet & Positions" section)
 * Query balance and positions without needing API key
 */
async function loadMyWalletByAddress() {
  console.log('Loading wallet by address...');

  const address = elements.myWalletAddress.value.trim();

  // Validate address format (basic Ethereum address check)
  if (!address) {
    alert('Please enter a wallet address');
    return;
  }

  if (!address.match(/^0x[a-fA-F0-9]{40}$/)) {
    alert('Invalid wallet address format. Must be 40 hex characters starting with 0x');
    return;
  }

  try {
    console.log(`Loading wallet data for ${address}...`);

    // Show loading state
    elements.yourWalletPlaceholder.style.display = 'none';
    elements.yourWalletError.style.display = 'none';
    elements.yourWalletContent.style.display = 'none';
    elements.yourWalletLoading.style.display = 'block';

    // Fetch balance and positions using direct API (no CCXT exchange needed)
    const [balance, positions] = await Promise.all([
      fetchBalanceForAddress(address),
      fetchPositionsForAddress(address),
    ]);

    // Display in "My Wallet & Positions" section
    displayYourWalletInfo(balance, positions);

    // Save wallet address to localStorage for auto-load on refresh
    localStorage.setItem(STORAGE_KEYS.MY_WALLET_ADDRESS, address);
    console.log(`✅ Saved wallet address to localStorage: ${address}`);

    console.log(`Wallet ${address} loaded successfully`);
    console.log(`Balance:`, balance);
    console.log(`Positions:`, positions);
  } catch (error) {
    console.error('Failed to load wallet by address:', error);

    // Show error
    elements.yourWalletPlaceholder.style.display = 'none';
    elements.yourWalletLoading.style.display = 'none';
    elements.yourWalletContent.style.display = 'none';
    elements.yourWalletError.style.display = 'block';
    elements.yourWalletError.textContent = `Failed to load wallet: ${error.message}`;
  }
}

/**
 * Display wallet info in "My Wallet & Positions" section
 * @param {object} balance - Balance object
 * @param {Array} positions - Positions array
 */
function displayYourWalletInfo(balance, positions) {
  // Hide loading and errors
  elements.yourWalletPlaceholder.style.display = 'none';
  elements.yourWalletLoading.style.display = 'none';
  elements.yourWalletError.style.display = 'none';

  // Show content
  elements.yourWalletContent.style.display = 'block';

  // Update balance display (use direct values from balance object)
  const free = balance?.free || 0;
  const used = balance?.used || 0;
  const total = balance?.total || 0;

  // Calculate position value and unrealized PnL
  let totalPositionValue = 0;
  let totalUnrealizedPnl = 0;

  if (positions && positions.length > 0) {
    positions.forEach((pos) => {
      totalPositionValue += Math.abs(pos.notional || 0);
      totalUnrealizedPnl += pos.unrealizedPnl || 0;
    });
  }

  // Update balance elements
  elements.yourBalanceFree.textContent = `$${free.toFixed(2)}`;
  elements.yourBalanceUsed.textContent = `$${used.toFixed(2)}`;
  elements.yourBalanceTotal.textContent = `$${total.toFixed(2)}`;
  elements.yourPositionValue.textContent = `$${totalPositionValue.toFixed(2)}`;

  // Update unrealized PnL with color
  const pnlElement = elements.yourUnrealizedPnl;
  pnlElement.textContent = `$${totalUnrealizedPnl >= 0 ? '+' : ''}${totalUnrealizedPnl.toFixed(2)}`;
  pnlElement.classList.remove('positive', 'negative');
  if (totalUnrealizedPnl > 0) {
    pnlElement.classList.add('positive');
  } else if (totalUnrealizedPnl < 0) {
    pnlElement.classList.add('negative');
  }

  // Render positions
  renderPositions(positions, elements.yourPositionsBody);

  console.log(`Displayed balance and ${positions?.length || 0} positions`);
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
    container.innerHTML =
      '<p style="text-align:center; padding:20px; color:#666;">No open positions</p>';
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

/**
 * Show session confirmation modal and wait for user response
 * @param {{ traderAddress: string, copyBalance: number, apiKey: string }} sessionConfig
 * @returns {Promise<boolean>} True if confirmed, false if cancelled
 */
async function confirmCopyTradingSession(sessionConfig) {
  const modal = document.getElementById('trade-confirm-modal');
  const detailsDiv = document.getElementById('trade-confirm-details');
  const confirmButton = document.getElementById('trade-confirm-execute');
  const cancelButton = document.getElementById('trade-confirm-cancel');

  // Mask API key (show first 6 and last 4 characters)
  const maskedApiKey =
    sessionConfig.apiKey.length > 10
      ? `${sessionConfig.apiKey.substring(0, 6)}...${sessionConfig.apiKey.substring(sessionConfig.apiKey.length - 4)}`
      : '******';

  // Show loading state
  detailsDiv.innerHTML = `
    <div style="text-align:center; padding:40px; color:#888;">
      Loading trader positions...
    </div>
  `;
  modal.style.display = 'flex';

  // Fetch trader's current positions
  let traderPositions = [];
  let positionCalculation = null;

  try {
    traderPositions = await fetchPositionsForAddress(sessionConfig.traderAddress);
    console.log('Trader positions loaded:', traderPositions);

    // Filter out positions to skip (conflicting with user's existing positions)
    if (sessionConfig.positionsToSkip && sessionConfig.positionsToSkip.size > 0) {
      const beforeFilter = traderPositions.length;
      traderPositions = traderPositions.filter(pos => !sessionConfig.positionsToSkip.has(pos.symbol));
      console.log(`⚠️ Filtered out ${beforeFilter - traderPositions.length} conflicting position(s)`);
      console.log(`Remaining positions to copy: ${traderPositions.length}`);
    }

    // Calculate what positions would be opened
    if (traderPositions.length > 0) {
      positionCalculation = calculateInitialPositions(traderPositions, sessionConfig.copyBalance);
      console.log('Position calculation:', positionCalculation);
    }
  } catch (error) {
    console.error('Failed to load trader positions:', error);
  }

  // Build positions display HTML with calculation results
  let positionsHtml = '';
  if (positionCalculation && positionCalculation.positions.length > 0) {
    const {
      positions,
      totalEstimatedCost,
      totalMarketValue,
      feasible,
      warnings,
      utilizationPercent,
      wasScaled,
      scalingFactor,
      originalTotalCost,
      originalTotalValue,
    } = positionCalculation;

    // Show scaling info if positions were scaled
    let scalingInfoHtml = '';
    if (wasScaled) {
      scalingInfoHtml = `
        <div style="margin-bottom:15px; padding:12px; background-color:#2a3550; border-radius:4px; border-left:3px solid #ffaa00;">
          <div style="color:#ffaa00; font-weight:600; margin-bottom:8px;">📉 Positions Scaled Down</div>
          <div style="display:grid; grid-template-columns: 140px 1fr; gap:8px; font-size:0.9em;">
            <div style="color:#888;">Scaling Factor:</div>
            <div style="color:#e0e0e0; font-weight:600;">${(scalingFactor * 100).toFixed(1)}%</div>

            <div style="color:#888;">Original Required:</div>
            <div style="color:#888;">$${originalTotalCost.toFixed(2)}</div>

            <div style="color:#888;">Scaled to Fit:</div>
            <div style="color:#4a9eff; font-weight:600;">$${totalEstimatedCost.toFixed(2)}</div>
          </div>
        </div>
      `;
    }

    // Get latest prices from sessionConfig if available
    const latestPrices = sessionConfig.latestPrices || new Map();

    // Build position table with comparison if scaled
    const positionsTableHtml = positions
      .map((pos, index) => {
        const sideColor = pos.side === 'long' ? '#2a9d5f' : '#d94848';
        const originalPos = traderPositions[index];

        // Get latest price info for this symbol
        const priceInfo = latestPrices.get(pos.symbol);
        const hasLatestPrice = priceInfo && config.useLatestPrice;
        const displayPrice = hasLatestPrice ? priceInfo.orderPrice : pos.entryPrice;
        const priceChange = hasLatestPrice ? ((priceInfo.orderPrice - pos.entryPrice) / pos.entryPrice * 100) : 0;

        if (wasScaled && originalPos) {
          // Show comparison: Original → Scaled
          return `
          <tr style="border-bottom:1px solid #2a3550;">
            <td style="padding:8px; color:#e0e0e0; font-weight:600;">${pos.symbol}</td>
            <td style="padding:8px; color:${sideColor}; font-weight:600; text-transform:uppercase;">${pos.side}</td>
            <td style="padding:8px; color:#e0e0e0;">
              <div style="color:#888; font-size:0.85em;">${originalPos.size.toFixed(4)}</div>
              <div style="color:#4a9eff; font-weight:600;">→ ${pos.size.toFixed(4)}</div>
            </td>
            <td style="padding:8px;">
              ${hasLatestPrice ? `
                <div style="color:#888; font-size:0.75em;">Trader: $${pos.entryPrice.toFixed(4)}</div>
                <div style="color:#4a9eff; font-weight:600; margin-top:2px;">Order: $${displayPrice.toFixed(4)}</div>
                <div style="color:${priceChange >= 0 ? '#2a9d5f' : '#d94848'}; font-size:0.75em;">(${priceChange >= 0 ? '+' : ''}${priceChange.toFixed(2)}%)</div>
              ` : `
                <div style="color:#e0e0e0;">$${pos.entryPrice.toFixed(4)}</div>
              `}
            </td>
            <td style="padding:8px; color:#888;">${pos.leverage}x</td>
            <td style="padding:8px; color:#e0e0e0;">
              <div style="color:#888; font-size:0.85em;">$${(originalPos.size * originalPos.entryPrice).toFixed(2)}</div>
              <div style="color:#4a9eff; font-weight:600;">→ $${pos.marketValue.toFixed(2)}</div>
            </td>
            <td style="padding:8px; color:#4a9eff; font-weight:600;">
              <div style="color:#888; font-size:0.85em;">$${((originalPos.size * originalPos.entryPrice) / pos.leverage).toFixed(2)}</div>
              <div style="color:#4a9eff; font-weight:600;">→ $${pos.estimatedCost.toFixed(2)}</div>
            </td>
          </tr>
        `;
        } else {
          // Show single row when not scaled
          return `
          <tr style="border-bottom:1px solid #2a3550;">
            <td style="padding:8px; color:#e0e0e0; font-weight:600;">${pos.symbol}</td>
            <td style="padding:8px; color:${sideColor}; font-weight:600; text-transform:uppercase;">${pos.side}</td>
            <td style="padding:8px; color:#e0e0e0;">${pos.size.toFixed(4)}</td>
            <td style="padding:8px;">
              ${hasLatestPrice ? `
                <div style="color:#888; font-size:0.75em;">Trader: $${pos.entryPrice.toFixed(4)}</div>
                <div style="color:#4a9eff; font-weight:600; margin-top:2px;">Order: $${displayPrice.toFixed(4)}</div>
                <div style="color:${priceChange >= 0 ? '#2a9d5f' : '#d94848'}; font-size:0.75em;">(${priceChange >= 0 ? '+' : ''}${priceChange.toFixed(2)}%)</div>
              ` : `
                <div style="color:#e0e0e0;">$${pos.entryPrice.toFixed(4)}</div>
              `}
            </td>
            <td style="padding:8px; color:#888;">${pos.leverage}x</td>
            <td style="padding:8px; color:#e0e0e0;">$${pos.marketValue.toFixed(2)}</td>
            <td style="padding:8px; color:#4a9eff; font-weight:600;">$${pos.estimatedCost.toFixed(2)}</td>
          </tr>
        `;
        }
      })
      .join('');

    // Total row
    const totalRowHtml = `
      <tr style="background-color:#1a2137; font-weight:700;">
        <td colspan="5" style="padding:8px; color:#888; text-align:right;">TOTAL:</td>
        <td style="padding:8px; color:#e0e0e0;">$${totalMarketValue.toFixed(2)}</td>
        <td style="padding:8px; color:#4a9eff;">$${totalEstimatedCost.toFixed(2)}</td>
      </tr>
    `;

    // Feasibility status (always green after scaling)
    const feasibilityColor = '#2a9d5f'; // Always green after scaling
    const feasibilityIcon = '✅';
    const feasibilityText = wasScaled ? 'Feasible (Scaled)' : 'Feasible';

    const utilizationColor = utilizationPercent > 80 ? '#ffaa00' : '#2a9d5f';

    // Warnings section
    let warningsHtml = '';
    if (warnings.length > 0) {
      warningsHtml = `
        <div style="margin-top:10px; padding:10px; background-color:#3a1a1a; border-radius:4px; border-left:3px solid #ff4a4a;">
          <div style="color:#ff4a4a; font-weight:600; margin-bottom:5px;">⚠️ Warnings:</div>
          ${warnings.map((warning) => `<div style="color:#ffaa00; font-size:0.85em; margin-left:20px;">• ${warning}</div>`).join('')}
        </div>
      `;
    }

    positionsHtml = `
      <div style="margin-top:20px;">
        ${scalingInfoHtml}

        <div style="background-color:#0f1420; padding:15px; border-radius:6px; border:1px solid #2a3550;">
          <h4 style="color:#4a9eff; margin:0 0 12px 0; font-size:1em;">📊 Initial Positions Summary</h4>
          <div style="display:grid; grid-template-columns: 160px 1fr; gap:10px; font-size:0.9em;">
            <div style="color:#888;">Positions to Copy:</div>
            <div style="color:#e0e0e0; font-weight:600;">${positions.length} position${positions.length !== 1 ? 's' : ''}</div>

            <div style="color:#888;">Total Market Value:</div>
            <div style="color:#4a9eff; font-weight:600;">$${totalMarketValue.toFixed(2)}</div>

            <div style="color:#888;">Required Margin:</div>
            <div style="color:#e0e0e0; font-weight:600;">$${totalEstimatedCost.toFixed(2)}</div>

            <div style="color:#888;">Balance Utilization:</div>
            <div style="color:${utilizationColor}; font-weight:600;">${utilizationPercent.toFixed(1)}%</div>

            <div style="color:#888;">Status:</div>
            <div style="color:${feasibilityColor}; font-weight:600;">${feasibilityIcon} ${feasibilityText}</div>
          </div>
        </div>

        ${warningsHtml}

        <div style="margin-top:10px; padding:10px; background-color:#1a2332; border-radius:4px; border-left:3px solid #4a9eff;">
          <span style="color:#4a9eff; font-size:0.85em;">💡 View full position details in the right panel</span>
        </div>
      </div>
    `;
  } else {
    positionsHtml = `
      <div style="margin-top:20px; padding:15px; background-color:#1a2332; border-radius:4px; border-left:3px solid #888; text-align:center;">
        <span style="color:#888; font-size:0.9em;">No open positions found for this trader</span>
      </div>
    `;
  }

  // Populate modal with session configuration and positions
  detailsDiv.innerHTML = `
    <div style="background-color:#0f1420; padding:20px; border-radius:6px; border:1px solid #2a3550;">
      <div style="display:grid; grid-template-columns: 140px 1fr; gap:12px; font-size:0.95em;">
        <div style="color:#888;">Trader Address:</div>
        <div style="color:#e0e0e0; font-weight:600; word-break:break-all;">${sessionConfig.traderAddress}</div>

        <div style="color:#888;">Copy Balance:</div>
        <div style="color:#4a9eff; font-weight:600;">$${sessionConfig.copyBalance.toFixed(2)}</div>

        <div style="color:#888;">API Key:</div>
        <div style="color:#888; font-family:monospace;">${maskedApiKey}</div>

        <div style="color:#888;">Max Leverage:</div>
        <div style="color:#e0e0e0;">10x (per symbol)</div>

        <div style="color:#888;">Trading Mode:</div>
        <div style="color:${isDryRunMode() ? '#4a9eff' : '#ffa726'}; font-weight:600;">
          ${isDryRunMode() ? '🧪 DRY RUN (Simulated)' : '🚀 LIVE TRADING'}
        </div>

        <div style="color:#888;">Order Pricing:</div>
        <div style="color:${config.useLatestPrice ? '#4a9eff' : '#e0e0e0'}; font-weight:600;">
          ${config.useLatestPrice ? '📊 Latest Market Price' : '📍 Trader\'s Entry Price'}
        </div>
      </div>
      ${config.useLatestPrice ? `
      <div style="margin-top:12px; padding:10px; background-color:#1a2332; border-left:3px solid #4a9eff; border-radius:4px;">
        <div style="color:#4a9eff; font-size:0.85em; font-weight:600;">📊 Latest Market Price Mode:</div>
        <div style="color:#bbb; font-size:0.85em; margin-top:4px;">
          • Exact order prices will be calculated when orders are placed<br>
          • Buy orders: Use bid price (or last - 0.01% tick offset)<br>
          • Sell orders: Use ask price (or last + 0.01% tick offset)<br>
          • Check console logs for actual prices used
        </div>
      </div>
      ` : ''}
    </div>
    ${positionsHtml}
    ${isDryRunMode() ? `
    <div style="margin-top:15px; padding:12px; background-color:#1a2332; border-left:3px solid #4a9eff; border-radius:4px;">
      <span style="color:#4a9eff; font-weight:600;">🧪 Dry Run Mode:</span>
      <span style="color:#bbb; font-size:0.9em;"> Orders will be simulated and logged but NOT sent to the exchange. Safe for testing.</span>
    </div>
    ` : `
    <div style="margin-top:15px; padding:12px; background-color:#1a2332; border-left:3px solid #ffa726; border-radius:4px;">
      <span style="color:#ffa726; font-weight:600;">⚠️ LIVE Mode Warning:</span>
      <span style="color:#bbb; font-size:0.9em;"> Real orders will be placed on Hyperliquid. All detected trades will be automatically copied. Make sure you trust this trader.</span>
    </div>
    `}
  `;

  // Return promise for user response with scaling factor and initial positions
  return new Promise((resolve) => {
    // Handle confirm - return confirmation, scaling factor, and positions
    const handleConfirm = () => {
      cleanup();
      resolve({
        confirmed: true,
        scalingFactor: positionCalculation?.scalingFactor || 1.0,
        initialPositions: positionCalculation?.positions || [],
      });
    };

    // Handle cancel
    const handleCancel = () => {
      cleanup();
      resolve({
        confirmed: false,
        scalingFactor: 1.0,
        initialPositions: [],
      });
    };

    // Cleanup function
    const cleanup = () => {
      modal.style.display = 'none';
      confirmButton.removeEventListener('click', handleConfirm);
      cancelButton.removeEventListener('click', handleCancel);
    };

    // Add event listeners
    confirmButton.addEventListener('click', handleConfirm);
    cancelButton.addEventListener('click', handleCancel);

    // Close modal on ESC key
    const handleEsc = (e) => {
      if (e.key === 'Escape') {
        document.removeEventListener('keydown', handleEsc);
        handleCancel();
      }
    };
    document.addEventListener('keydown', handleEsc);
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

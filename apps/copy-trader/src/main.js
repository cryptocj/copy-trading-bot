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
  setDryRunMode,
} from './services/trading.js';
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
  getApiKey,
} from './state/appState.js';
import { initializeElements } from './dom/elements.js';
import {
  setupValidationListeners as setupValidation,
  checkFormValidity as checkValidity,
  initializeDryRunMode,
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
  loadMyWalletByAddress,
} from './controllers/walletController.js';
import { confirmCopyTradingSession } from './controllers/tradingController.js';
import { testPositionCalculation } from './utils/testCalculation.js';
import { fetchLatestPricesForConfirmation } from './services/priceService.js';
import { initMonitoringStatus, showProgress, hideProgress } from './services/monitoringStatus.js';

// DOM elements (will be initialized after DOM loads)
let elements = {};

/**
 * Initialize app when DOM is ready
 */
document.addEventListener('DOMContentLoaded', () => {
  console.log('Initializing Hyperliquid Copy Trading app...');

  // Cache DOM elements
  elements = initializeElements();

  // Initialize monitoring status service
  initMonitoringStatus(elements);

  // Initialize validation listeners
  setupValidation(elements, () => checkValidity(elements, isCopyTradingActive));

  // Initialize button listeners
  setupButtonListeners();

  // Initialize platform selector listener (also handles initial UI setup)
  setupPlatformSelector();

  // Initialize history panel listeners
  setupHistoryPanelListeners();

  // Initialize collapsible sections
  setupCollapsibleSections(elements);

  // Render monitoring wallets table
  renderWalletsTable(elements, (address) => showHistoryPanel(elements, address), () => checkValidity(elements, isCopyTradingActive));

  // Load saved settings from localStorage
  loadSavedSettings(elements, config, checkFormValidity, () => refreshWalletInfo(elements, isCopyTradingActive));

  // Initialize dry run mode after settings are loaded (to sync button text with loaded state)
  initializeDryRunMode(elements);

  // After settings are loaded, derive wallet address if Moonlander is selected
  console.log(`🔍 Checking initialization: platform=${config.executionPlatform}, hasPrivateKey=${!!config.moonlander.privateKey}`);
  if (config.executionPlatform === 'moonlander' && config.moonlander.privateKey) {
    console.log('🔄 Deriving wallet address from loaded Moonlander private key...');
    console.log(`🔑 Private key preview: ${config.moonlander.privateKey.substring(0, 10)}...`);
    deriveMoonlanderWalletAddress(config.moonlander.privateKey).then(derivedAddress => {
      if (derivedAddress) {
        console.log(`✅ Wallet address derived on load: ${derivedAddress}`);
        // Refresh wallet display
        refreshWalletInfo(elements, isCopyTradingActive).catch(err => {
          console.error('Failed to refresh wallet info after derivation:', err);
        });
      } else {
        console.log('⚠️ Derivation returned null');
      }
    }).catch(err => {
      console.error('❌ Failed to derive wallet address on load:', err);
    });
  } else {
    console.log('⏭️ Skipping wallet derivation - conditions not met');
  }

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

  // Validate the appropriate API key based on platform
  const apiKeyToValidate = savedConfig.executionPlatform === 'moonlander'
    ? savedConfig.monitoringApiKey
    : savedConfig.hyperliquidApiKey;
  const apiKeyValidation = validateApiKey(apiKeyToValidate);

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
  console.log('[SessionRestore] savedConfig.isDryRun:', savedConfig.isDryRun);
  console.log('[SessionRestore] savedConfig.useLatestPrice:', savedConfig.useLatestPrice);

  config.traderAddress = savedConfig.traderAddress;
  config.executionPlatform = savedConfig.executionPlatform || 'hyperliquid';
  config.hyperliquidApiKey = savedConfig.hyperliquidApiKey || '';
  config.monitoringApiKey = savedConfig.monitoringApiKey || '';
  config.copyBalance = savedConfig.copyBalance;
  config.useLatestPrice = savedConfig.useLatestPrice ?? false;
  config.isDryRun = savedConfig.isDryRun ?? true;

  console.log('[SessionRestore] Restored config.isDryRun:', config.isDryRun);
  console.log('[SessionRestore] Restored config.useLatestPrice:', config.useLatestPrice);
  console.log('[SessionRestore] Restored config.executionPlatform:', config.executionPlatform);

  // Restore UI form values (T017)
  if (elements.traderAddressInput) {
    elements.traderAddressInput.value = savedConfig.traderAddress;
  }

  // Restore the correct API key field based on platform
  if (config.executionPlatform === 'moonlander') {
    if (elements.monitoringApiKeyInput) {
      elements.monitoringApiKeyInput.value = savedConfig.monitoringApiKey || '';
    }
  } else {
    if (elements.hyperliquidApiKeyInput) {
      elements.hyperliquidApiKeyInput.value = savedConfig.hyperliquidApiKey || '';
    }
  }

  if (elements.copyBalanceInput) {
    elements.copyBalanceInput.value = savedConfig.copyBalance;
  }

  // Restore checkbox states
  if (elements.useLatestPriceCheckbox) {
    elements.useLatestPriceCheckbox.checked = config.useLatestPrice;
    console.log('[SessionRestore] useLatestPrice checkbox set to:', config.useLatestPrice);
  }
  if (elements.dryRunModeCheckbox) {
    elements.dryRunModeCheckbox.checked = config.isDryRun;
    console.log('[SessionRestore] isDryRun checkbox set to:', config.isDryRun);
    // Also update the trading.js module state
    setDryRunMode(config.isDryRun);
    // Update button text
    const buttonText = config.isDryRun ? 'Start Copy Trading (DRY RUN)' : 'Start Copy Trading (LIVE)';
    elements.startButton.textContent = buttonText;
    console.log('[SessionRestore] Button text set to:', buttonText);
  }

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
  elements.loadMyWalletButton.addEventListener('click', () => loadMyWalletByAddress(elements));

  // Refresh derived wallet button (for Moonlander mode)
  if (elements.refreshDerivedWalletButton) {
    elements.refreshDerivedWalletButton.addEventListener('click', async () => {
      if (config.moonlander.privateKey) {
        const derivedAddress = await deriveMoonlanderWalletAddress(config.moonlander.privateKey);
        if (derivedAddress) {
          await refreshWalletInfo(elements, isCopyTradingActive);
        }
      } else {
        alert('Please enter your Moonlander private key first');
      }
    });
  }

  // Close all positions button (for Moonlander mode)
  if (elements.closeAllPositionsButton) {
    elements.closeAllPositionsButton.addEventListener('click', async () => {
      await closeAllMoonlanderPositions();
    });
  }
}

/**
 * Setup platform selector to show/hide Moonlander configuration and API key fields
 */
function setupPlatformSelector() {
  elements.executionPlatformSelect.addEventListener('change', async (e) => {
    const platform = e.target.value;

    if (platform === 'moonlander') {
      // Show Moonlander config and monitoring API key
      elements.moonlanderConfig?.classList.remove('hidden');
      elements.hyperliquidApiKeyField?.classList.add('hidden');
      elements.monitoringApiKeyField?.classList.remove('hidden');

      // Show derived wallet display, hide manual input
      elements.derivedWalletDisplay?.classList.remove('hidden');
      elements.manualWalletInput?.classList.add('hidden');
    } else {
      // Show Hyperliquid API key only
      elements.moonlanderConfig?.classList.add('hidden');
      elements.hyperliquidApiKeyField?.classList.remove('hidden');
      elements.monitoringApiKeyField?.classList.add('hidden');

      // Show manual wallet input, hide derived display
      elements.derivedWalletDisplay?.classList.add('hidden');
      elements.manualWalletInput?.classList.remove('hidden');
    }

    // Update config
    config.executionPlatform = platform;
    console.log(`Execution platform changed to: ${platform}`);

    // Refresh wallet info to show correct data for the new platform
    console.log('🔄 Refreshing wallet info after platform switch...');
    try {
      await refreshWalletInfo(elements, isCopyTradingActive);
    } catch (error) {
      console.error('Failed to refresh wallet info after platform switch:', error);
    }

    // Recheck form validity since different platforms require different API keys
    checkFormValidity();
  });

  // Initialize on page load with default moonlander
  config.executionPlatform = elements.executionPlatformSelect.value || 'moonlander';

  // Trigger initial display based on default platform
  const initialPlatform = config.executionPlatform;
  if (initialPlatform === 'moonlander') {
    elements.moonlanderConfig?.classList.remove('hidden');
    elements.hyperliquidApiKeyField?.classList.add('hidden');
    elements.monitoringApiKeyField?.classList.remove('hidden');

    // Show derived wallet display, hide manual input
    elements.derivedWalletDisplay?.classList.remove('hidden');
    elements.manualWalletInput?.classList.add('hidden');
  } else {
    // Show manual wallet input, hide derived display
    elements.derivedWalletDisplay?.classList.add('hidden');
    elements.manualWalletInput?.classList.remove('hidden');
  }

  // Setup API key input listeners
  elements.hyperliquidApiKeyInput?.addEventListener('blur', () => {
    config.hyperliquidApiKey = elements.hyperliquidApiKeyInput.value;
    saveSettings(config);
  });

  elements.monitoringApiKeyInput?.addEventListener('blur', () => {
    config.monitoringApiKey = elements.monitoringApiKeyInput.value;
    saveSettings(config);
  });

  // Setup Moonlander private key input listener
  elements.moonlanderPrivateKeyInput?.addEventListener('blur', async () => {
    console.log('🔑 Moonlander private key input blur event triggered');
    const privateKey = elements.moonlanderPrivateKeyInput.value;
    console.log(`🔑 Private key length: ${privateKey?.length || 0} characters`);
    config.moonlander.privateKey = privateKey;

    // Derive wallet address from private key and auto-save it
    console.log('🔄 Calling deriveMoonlanderWalletAddress...');
    const derivedAddress = await deriveMoonlanderWalletAddress(privateKey);
    console.log(`🔄 Derivation result: ${derivedAddress || 'null'}`);
    if (derivedAddress) {
      // Refresh wallet display to show the derived address
      console.log('🔄 Refreshing wallet info...');
      await refreshWalletInfo(elements, isCopyTradingActive);
    }

    saveSettings(config);
    checkFormValidity();
  });

  // Setup Moonlander network selector
  if (elements.moonlanderNetworkSelect) {
    elements.moonlanderNetworkSelect.addEventListener('change', async (e) => {
      const network = e.target.value;
      config.moonlander.network = network;
      saveSettings(config);
    });

    // Initialize network config on page load
    const initialNetwork = elements.moonlanderNetworkSelect.value || 'testnet';
    config.moonlander.network = initialNetwork;
  }

  // Note: Wallet address derivation is handled after settings are loaded in main initialization

  // Trigger initial form validity check
  checkFormValidity();
}

/**
 * Derive and save wallet address from Moonlander private key
 * @param {string} privateKey - Moonlander private key
 * @returns {Promise<string|null>} Derived wallet address or null if failed
 */
async function deriveMoonlanderWalletAddress(privateKey) {
  if (!privateKey || privateKey.trim() === '') {
    console.log('⚠️ No private key provided');
    if (elements.derivedWalletAddress) {
      elements.derivedWalletAddress.textContent = 'Not derived yet';
      elements.derivedWalletAddress.classList.remove('text-red-400', 'text-primary');
      elements.derivedWalletAddress.classList.add('text-gray-500');
    }
    return null;
  }

  try {
    // Normalize private key - add 0x prefix if missing
    let normalizedKey = privateKey.trim();
    if (!normalizedKey.startsWith('0x')) {
      normalizedKey = '0x' + normalizedKey;
      console.log('🔧 Added 0x prefix to private key');
    }

    const wallet = new ethers.Wallet(normalizedKey);
    const derivedAddress = wallet.address;

    // Auto-save this as "My Wallet Address"
    localStorage.setItem(STORAGE_KEYS.MY_WALLET_ADDRESS, derivedAddress);

    // Update UI to show the derived address
    if (elements.derivedWalletAddress) {
      elements.derivedWalletAddress.textContent = derivedAddress;
      elements.derivedWalletAddress.title = derivedAddress; // Full address on hover
      elements.derivedWalletAddress.classList.remove('text-red-400', 'text-gray-500');
      elements.derivedWalletAddress.classList.add('text-primary');
    }

    console.log(`🔑 Moonlander wallet address derived: ${derivedAddress}`);

    return derivedAddress;
  } catch (error) {
    console.error('❌ Failed to derive wallet address from Moonlander private key:', error);

    // Update UI to show error
    if (elements.derivedWalletAddress) {
      elements.derivedWalletAddress.textContent = `Invalid private key: ${error.message}`;
      elements.derivedWalletAddress.classList.remove('text-primary', 'text-gray-500');
      elements.derivedWalletAddress.classList.add('text-red-400');
    }

    return null;
  }
}

/**
 * Close all current Moonlander positions
 */
async function closeAllMoonlanderPositions() {
  try {
    // Verify Moonlander is selected and configured
    if (config.executionPlatform !== 'moonlander') {
      alert('This feature is only available in Moonlander mode');
      return;
    }

    if (!config.moonlander.privateKey) {
      alert('Please enter your Moonlander private key first');
      return;
    }

    // Confirmation dialog
    const proceed = confirm(
      '⚠️ Close All Positions\n\n' +
      'This will request closure for ALL your current Moonlander positions.\n\n' +
      'Are you sure you want to continue?'
    );

    if (!proceed) {
      console.log('❌ Close all cancelled by user');
      return;
    }

    console.log('🌙 Initializing Moonlander exchange to close all positions...');

    // Initialize Moonlander exchange
    const { MoonlanderExchange } = await import('./services/moonlander-browser.js');
    const { getMoonlanderConfig } = await import('./config/moonlander.js');
    const moonlanderConfig = getMoonlanderConfig(config.moonlander.network);

    const exchange = new MoonlanderExchange({
      privateKey: config.moonlander.privateKey,
      ...moonlanderConfig,
    });
    await exchange.initialize();

    // Fetch current positions
    console.log('📊 Fetching current positions...');
    const positions = await exchange.fetchPositions();

    if (!positions || positions.length === 0) {
      alert('No open positions found');
      console.log('ℹ️ No positions to close');
      return;
    }

    console.log(`📋 Found ${positions.length} position(s) to close`);
    console.log(`🔄 Closing positions sequentially (blockchain nonce management)...`);

    // Show initial progress in UI and alert
    showProgress('Closing positions', 0, positions.length);
    const progressMsg = `Closing ${positions.length} position(s)...\n\nThis will take approximately ${positions.length * 2} seconds.\nWatch the status indicator for progress.`;
    alert(progressMsg);

    // Close positions sequentially to avoid nonce conflicts
    // Blockchain transactions must maintain proper nonce ordering
    const results = [];
    let successCount = 0;
    let failCount = 0;

    for (let i = 0; i < positions.length; i++) {
      const position = positions[i];
      console.log(`\n🔄 [${i + 1}/${positions.length}] Closing position: ${position.symbol}`);

      // Update progress in UI
      showProgress('Closing positions', i, positions.length);

      try {
        const result = await exchange.closeTrade(position.tradeHash);
        console.log(`✅ Position ${position.symbol} close requested: ${result.txHash}`);
        results.push({ symbol: position.symbol, success: true, txHash: result.txHash });
        successCount++;

        // Show progress in console and UI
        const progress = `Progress: ${i + 1}/${positions.length} closed (${Math.round(((i + 1) / positions.length) * 100)}%)`;
        console.log(`📊 ${progress}`);
        showProgress('Closing positions', i + 1, positions.length);

        // Wait for transaction to be mined before sending next one (avoid nonce issues)
        if (i < positions.length - 1) {
          console.log('⏳ Waiting 2s for transaction to be mined...');
          await new Promise(resolve => setTimeout(resolve, 2000));
        }
      } catch (error) {
        console.error(`❌ Failed to close position ${position.symbol}:`, error);
        results.push({ symbol: position.symbol, success: false, error: error.message });
        failCount++;
      }
    }

    // Hide progress indicator
    hideProgress();

    // Show results summary
    const summary =
      `Close All Positions Complete\n\n` +
      `✅ Successfully closed: ${successCount}\n` +
      `❌ Failed: ${failCount}\n\n` +
      results.map(r =>
        r.success
          ? `✅ ${r.symbol}: ${r.txHash.slice(0, 10)}...`
          : `❌ ${r.symbol}: ${r.error}`
      ).join('\n');

    alert(summary);
    console.log('\n📊 Close all positions summary:', { successCount, failCount, results });

    // Refresh wallet info to show updated positions
    if (successCount > 0) {
      console.log('🔄 Refreshing wallet info...');
      await refreshWalletInfo(elements, isCopyTradingActive);
    }

  } catch (error) {
    console.error('❌ Failed to close all positions:', error);
    alert(`Error: ${error.message}\n\nCheck console for details.`);
  }
}

/**
 * Enable or disable all form inputs
 * @param {boolean} disabled - Whether to disable inputs
 */
function setFormDisabled(disabled) {
  if (elements.traderAddressInput) {
    elements.traderAddressInput.disabled = disabled;
  }

  // Disable the appropriate API key field based on platform
  if (config.executionPlatform === 'moonlander') {
    if (elements.monitoringApiKeyInput) {
      elements.monitoringApiKeyInput.disabled = disabled;
    }
    if (elements.moonlanderPrivateKeyInput) {
      elements.moonlanderPrivateKeyInput.disabled = disabled;
    }
  } else {
    if (elements.hyperliquidApiKeyInput) {
      elements.hyperliquidApiKeyInput.disabled = disabled;
    }
  }

  if (elements.copyBalanceInput) {
    elements.copyBalanceInput.disabled = disabled;
  }

  if (elements.executionPlatformSelect) {
    elements.executionPlatformSelect.disabled = disabled;
  }
}

/**
 * Start copy trading (US2/US3)
 */
async function startCopyTrading() {
  const startTime = performance.now();
  const getTimestamp = () => new Date().toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit', fractionalSecondDigits: 3 });

  console.log(`🚀 [${getTimestamp()}] Preparing to start copy trading...`);
  console.log(`📊 Configuration:`);
  console.log(`  - Trader Address: ${config.traderAddress}`);
  console.log(`  - Copy Balance: $${config.copyBalance}`);
  console.log(`  - Use Latest Price: ${config.useLatestPrice}`);

  try {
    // Check for position conflicts between user and trader
    console.log(`\n🔍 [${getTimestamp()}] Step 1: Checking for existing positions and conflicts...`);

    // Get wallet address - use custom saved address if available, otherwise derive from API key
    const savedMyWalletAddress = localStorage.getItem(STORAGE_KEYS.MY_WALLET_ADDRESS);
    let myWalletAddress;

    if (savedMyWalletAddress) {
      myWalletAddress = savedMyWalletAddress;
      console.log('  - Using saved wallet address:', myWalletAddress);
    } else {
      const apiKey = getApiKey();
      const userWallet = new ethers.Wallet(apiKey);
      myWalletAddress = userWallet.address;
      console.log('  - Using wallet derived from API key:', myWalletAddress);
    }

    // Fetch user's and trader's positions in parallel for better performance
    console.log('🔄 Fetching positions in parallel...');

    const fetchUserPositions = async () => {
      if (config.executionPlatform === 'moonlander') {
        console.log('🌙 Fetching user positions from Moonlander...');
        if (config.moonlander.privateKey) {
          try {
            const { MoonlanderExchange } = await import('./services/moonlander-browser.js');
            const { getMoonlanderConfig } = await import('./config/moonlander.js');
            const moonlanderConfig = getMoonlanderConfig(config.moonlander.network);

            const exchange = new MoonlanderExchange({
              privateKey: config.moonlander.privateKey,
              ...moonlanderConfig,
            });
            await exchange.initialize();

            const positions = await exchange.fetchPositions();
            console.log(`  - Moonlander user positions: ${positions.length}`);
            return positions;
          } catch (error) {
            console.error('Failed to fetch Moonlander user positions:', error);
            return [];
          }
        }
        return [];
      } else {
        console.log('⚡ Fetching user positions from Hyperliquid...');
        const positions = await fetchPositionsForAddress(myWalletAddress);
        console.log(`  - Hyperliquid user positions: ${positions.length}`);
        return positions;
      }
    };

    const fetchTraderPositions = async () => {
      console.log('⚡ Fetching trader positions from Hyperliquid...');
      const positions = await fetchPositionsForAddress(config.traderAddress);
      console.log('  - Trader positions:', positions.length);
      return positions;
    };

    // Execute both fetches in parallel
    const [userPositions, traderPositions] = await Promise.all([
      fetchUserPositions(),
      fetchTraderPositions(),
    ]);

    const step1End = performance.now();
    console.log(`⏱️ [${getTimestamp()}] Step 1 completed: ${(step1End - startTime).toFixed(0)}ms (cumulative from start)`);

    // Check for conflicts and prepare filtered list
    console.log(`\n🔍 [${getTimestamp()}] Step 2: Checking for position conflicts...`);
    let positionsToSkip = new Set();

    if (userPositions.length > 0) {
      console.log('  - Your open positions:', userPositions.map(p => ({ symbol: p.symbol, side: p.side, size: p.size })));

      // Normalize symbol format for comparison
      // Hyperliquid: BTC/USDC:USDC, BTC/USD:USD, BTC/USDCC
      // Moonlander: BTC/USD
      // Normalize to: BTC
      const normalizeSymbol = (symbol) => {
        return symbol
          .replace('/USDC:USDC', '')
          .replace('/USD:USD', '')
          .replace('/USDCC', '')
          .replace('/USD', '')
          .replace('/USDC', '');
      };

      // Create maps with normalized symbols for comparison
      const userSymbolMap = new Map();
      userPositions.forEach(p => {
        const normalized = normalizeSymbol(p.symbol);
        userSymbolMap.set(normalized, p.symbol);
      });

      const traderSymbolMap = new Map();
      traderPositions.forEach(p => {
        const normalized = normalizeSymbol(p.symbol);
        traderSymbolMap.set(normalized, p.symbol);
      });

      // Find overlapping symbols (using normalized keys)
      const userSymbols = new Set([...userSymbolMap.values()]);
      const traderSymbols = new Set([...traderSymbolMap.values()]);

      // Find extra positions (positions user has that trader doesn't)
      const extraPositionsNormalized = [...userSymbolMap.keys()].filter(normalized =>
        !traderSymbolMap.has(normalized)
      );

      // Close extra positions if found
      if (extraPositionsNormalized.length > 0) {
        const extraSymbols = extraPositionsNormalized.map(n => userSymbolMap.get(n));

        const proceed = confirm(
          `📋 Portfolio Sync\n\n` +
          `You have ${extraPositionsNormalized.length} position(s) that trader doesn't have:\n` +
          `${extraSymbols.join(', ')}\n\n` +
          `Do you want to close these positions to match trader's portfolio?`
        );

        if (proceed) {
          console.log('🔄 Closing extra positions to match trader portfolio...');

          try {
            // Get extra positions to close
            const positionsToClose = userPositions.filter(p => {
              const normalized = normalizeSymbol(p.symbol);
              return extraPositionsNormalized.includes(normalized);
            });

            console.log('📊 Extra positions to close:', positionsToClose.map(p => ({ symbol: p.symbol, side: p.side, size: p.size })));

            // Close positions based on platform
            if (config.executionPlatform === 'moonlander') {
              // Initialize Moonlander exchange
              const { MoonlanderExchange } = await import('./services/moonlander-browser.js');
              const { getMoonlanderConfig } = await import('./config/moonlander.js');
              const moonlanderConfig = getMoonlanderConfig(config.moonlander.network);

              const exchange = new MoonlanderExchange({
                privateKey: config.moonlander.privateKey,
                ...moonlanderConfig,
              });
              await exchange.initialize();

              // Close each position sequentially (blockchain nonce management)
              for (let i = 0; i < positionsToClose.length; i++) {
                const position = positionsToClose[i];
                try {
                  console.log(`🔄 [${i + 1}/${positionsToClose.length}] Closing ${position.symbol}...`);
                  await exchange.closeTrade(position.tradeHash);
                  console.log(`✅ [${i + 1}/${positionsToClose.length}] Closed ${position.symbol}`);

                  // Wait for transaction to be mined before sending next one (avoid nonce issues)
                  if (i < positionsToClose.length - 1) {
                    console.log('⏳ Waiting 2s for transaction to be mined...');
                    await new Promise(resolve => setTimeout(resolve, 2000));
                  }
                } catch (error) {
                  console.error(`❌ Failed to close ${position.symbol}:`, error.message);
                }
              }
            } else {
              // Hyperliquid: Use CCXT exchange
              const apiKey = getApiKey();
              const wallet = new ethers.Wallet(apiKey);
              const walletAddress = wallet.address;

              const exchange = new ccxt.hyperliquid({
                privateKey: apiKey,
                walletAddress: walletAddress,
              });

              await exchange.loadMarkets();

              // Close each position
              for (const position of positionsToClose) {
                try {
                  console.log(`🔄 Closing ${position.symbol}...`);

                  // Determine order side (opposite of position side)
                  const side = position.side === 'long' ? 'sell' : 'buy';

                  await exchange.createMarketOrder(
                    position.symbol,
                    side,
                    Math.abs(position.size),
                    undefined,
                    { reduceOnly: true }
                  );

                  console.log(`✅ Closed ${position.symbol}`);
                } catch (error) {
                  console.error(`❌ Failed to close ${position.symbol}:`, error.message);
                }
              }
            }

            console.log('✅ Extra positions closed successfully');

            // Refresh user positions after closing
            userPositions.length = 0; // Clear array
            const freshUserPositions = await fetchUserPositions();
            userPositions.push(...freshUserPositions);

            // Rebuild userSymbolMap with fresh data
            userSymbolMap.clear();
            userPositions.forEach(p => {
              const normalized = normalizeSymbol(p.symbol);
              userSymbolMap.set(normalized, p.symbol);
            });

            console.log('🔄 User positions refreshed after closing extras');
          } catch (error) {
            console.error('❌ Failed to close extra positions:', error);
            alert(`Failed to close some positions: ${error.message}\n\nYou can continue, but some positions may remain open.`);
          }
        }
      }

      // Find conflicts by comparing normalized symbols
      const conflictingNormalized = [...userSymbolMap.keys()].filter(normalized =>
        traderSymbolMap.has(normalized)
      );

      // Convert back to original symbols for display and skipping
      const conflicts = conflictingNormalized.map(normalized => traderSymbolMap.get(normalized));

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
    const step2End = performance.now();
    console.log(`⏱️ [${getTimestamp()}] Step 2 completed: ${(step2End - startTime).toFixed(0)}ms (cumulative from start)`);
    console.log('✅ Position check complete - proceeding with copy trading');

    // Fetch latest prices if enabled (before confirmation)
    console.log(`\n📊 [${getTimestamp()}] Step 3: Fetching latest market prices...`);
    let latestPrices = null;
    if (config.useLatestPrice) {
      const apiKey = getApiKey();
      latestPrices = await fetchLatestPricesForConfirmation(apiKey, config.traderAddress);
    } else {
      console.log('  - Skipped (useLatestPrice is disabled)');
    }
    const step3End = performance.now();
    console.log(`⏱️ [${getTimestamp()}] Step 3 completed: ${(step3End - startTime).toFixed(0)}ms (cumulative from start)`);

    // Show confirmation dialog before starting
    console.log(`\n💬 [${getTimestamp()}] Step 4: Requesting user confirmation...`);
    const apiKey = getApiKey();
    const result = await confirmCopyTradingSession({
      traderAddress: config.traderAddress,
      copyBalance: config.copyBalance,
      apiKey: apiKey,
      latestPrices: latestPrices,
      positionsToSkip: positionsToSkip, // Pass conflicting symbols to skip
      traderPositions: traderPositions, // Pass already-fetched positions to avoid duplicate fetch
    });

    if (!result.confirmed) {
      console.log(`❌ [${getTimestamp()}] Copy trading cancelled by user`);
      return;
    }
    const step4End = performance.now();
    console.log(`⏱️ [${getTimestamp()}] Step 4 completed: ${(step4End - startTime).toFixed(0)}ms (cumulative from start)`);

    console.log(`\n✅ [${getTimestamp()}] User confirmed, starting copy trading...`);
    console.log(
      `📊 Scaling factor: ${result.scalingFactor.toFixed(4)} (${(result.scalingFactor * 100).toFixed(1)}%)`
    );
    console.log(`📊 Initial positions to open: ${result.initialPositions.length}`);

    // Ensure current configuration is saved and tracked as last monitored wallet
    console.log(`\n💾 [${getTimestamp()}] Step 5: Saving current configuration...`);
    saveSettings(config);
    const step5End = performance.now();
    console.log(`⏱️ [${getTimestamp()}] Step 5 completed: ${(step5End - startTime).toFixed(0)}ms (cumulative from start)`);

    // Update UI state
    setCopyTradingActive(true);
    elements.startButton.disabled = true;
    elements.stopButton.disabled = false;
    setFormDisabled(true);

    // Start trading service with order callback, scaling factor, and initial positions (US3 + US4 integration)
    console.log(`\n🚀 [${getTimestamp()}] Step 6: Starting trading service...`);
    await startTradingService(
      {
        ...config,
        scalingFactor: result.scalingFactor,
        initialPositions: result.initialPositions, // Pre-calculated positions from confirmation
        traderOriginalPositions: result.traderOriginalPositions, // ALL trader positions (for counting)
        traderFilteredPositions: result.traderFilteredPositions, // Filtered RAW positions (for recalculation)
      },
      (order) => {
        addOrder(elements, order); // Add order to display list (US4)
      }
    );
    const step6End = performance.now();
    console.log(`⏱️ [${getTimestamp()}] Step 6 completed: ${(step6End - startTime).toFixed(0)}ms (cumulative from start)`);

    console.log(`\n⏱️ ========================================`);
    console.log(`⏱️ [${getTimestamp()}] TOTAL STARTUP TIME: ${(step6End - startTime).toFixed(0)}ms`);
    console.log(`⏱️ ========================================\n`);

    console.log(`✅ [${getTimestamp()}] Copy trading started successfully`);
    console.log(`📡 Now monitoring wallet: ${config.traderAddress}`);
  } catch (error) {
    console.error(`❌ [${getTimestamp()}] Failed to start copy trading:`, error);

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

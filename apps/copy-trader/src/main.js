/**
 * Main entry point for Hyperliquid Copy Trading app
 * Initializes UI, handles events, coordinates services
 */

// CCXT library loaded via script tag in HTML (global variable)
// Available as window.ccxt

// Import services and utilities
import { validateAddress, validateApiKey, validateCopyBalance } from './services/validation.js';
import { calculateInitialPositions } from './utils/positionCalculator.js';
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
  loadSavedSettings(elements, config, checkFormValidity, refreshWalletInfo);

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
      displayYourWalletInfo(elements, balance, positions);

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
    await fetchAndDisplayYourWallet(elements, exchange);
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
    await showHistoryPanel(elements, address);

    // Optionally auto-fill trader address input
    elements.traderAddressInput.value = address;
    config.traderAddress = address;

    // Trigger validation
    const result = validateAddress(address);
    displayValidationError('trader-address', result);
    checkValidity(elements, isCopyTradingActive);

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
/**
 * Fetch and display your wallet info
 */
/**
 * Render positions table (for Your Wallet section)
 */
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

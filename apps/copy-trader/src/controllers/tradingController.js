/**
 * Trading controller
 * Handles copy trading start/stop and session confirmation
 */

import { config } from '../state/appState.js';
import { STORAGE_KEYS } from '../services/storage.js';
import { calculateInitialPositions } from '../utils/positionCalculator.js';
import { isDryRunMode } from '../services/trading.js';
import { fetchPositions } from '../services/wallet.js';
import { fetchPositionsForAddress } from '../rendering/wallet.js';

/**
 * Show session confirmation modal and wait for user response
 * @param {object} sessionConfig - Session configuration
 * @param {string} sessionConfig.traderAddress - Trader's wallet address
 * @param {number} sessionConfig.copyBalance - Balance to use for copying
 * @param {string} sessionConfig.apiKey - User's API key
 * @param {Map} sessionConfig.latestPrices - Map of latest prices (optional)
 * @param {Set} sessionConfig.positionsToSkip - Set of symbols to skip (optional)
 * @returns {Promise<{confirmed: boolean, scalingFactor: number, initialPositions: array, traderOriginalPositions: array, traderFilteredPositions: array}>}
 */
export async function confirmCopyTradingSession(sessionConfig) {
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

  // Fetch trader's current positions (or use already-fetched ones)
  let traderPositions = [];
  let traderOriginalPositions = []; // Store ALL original positions before filtering
  let traderFilteredPositions = []; // Store filtered RAW positions (for recalculation)
  let positionCalculation = null;

  try {
    // Use pre-fetched positions if available to avoid duplicate API call
    if (sessionConfig.traderPositions && sessionConfig.traderPositions.length >= 0) {
      traderPositions = sessionConfig.traderPositions;
      console.log('✅ Using pre-fetched trader positions:', traderPositions.length);
    } else {
      traderPositions = await fetchPositionsForAddress(sessionConfig.traderAddress);
      console.log('Trader positions loaded:', traderPositions.length);
    }

    // Store original positions before filtering (for proportional balance calculation)
    traderOriginalPositions = [...traderPositions];

    // Filter out positions to skip (conflicting with user's existing positions)
    if (sessionConfig.positionsToSkip && sessionConfig.positionsToSkip.size > 0) {
      const beforeFilter = traderPositions.length;
      traderPositions = traderPositions.filter(pos => !sessionConfig.positionsToSkip.has(pos.symbol));
      console.log(`⚠️ Filtered out ${beforeFilter - traderPositions.length} conflicting position(s)`);
      console.log(`Remaining positions to copy: ${traderPositions.length}`);
    }

    // Store filtered RAW positions (for recalculation with actual balance in trading.js)
    traderFilteredPositions = [...traderPositions];

    // Calculate what positions would be opened
    if (traderPositions.length > 0) {
      positionCalculation = calculateInitialPositions(traderPositions, sessionConfig.copyBalance);
      console.log('Position calculation:', positionCalculation);
    }
  } catch (error) {
    console.error('Failed to load trader positions:', error);
  }

  // Build positions display HTML with calculation results
  const positionsHtml = buildPositionsDisplayHtml(
    positionCalculation,
    traderPositions,
    sessionConfig.latestPrices
  );

  // Populate modal with session configuration and positions
  detailsDiv.innerHTML = buildModalContent(sessionConfig, maskedApiKey, positionsHtml);

  // Return promise for user response with scaling factor and initial positions
  return new Promise((resolve) => {
    // Handle confirm - return confirmation, scaling factor, and positions
    const handleConfirm = () => {
      cleanup();
      resolve({
        confirmed: true,
        scalingFactor: positionCalculation?.scalingFactor || 1.0,
        initialPositions: positionCalculation?.positions || [],
        traderOriginalPositions: traderOriginalPositions, // ALL positions (for counting/proportional calc)
        traderFilteredPositions: traderFilteredPositions, // Filtered RAW positions (for recalculation)
      });
    };

    // Handle cancel
    const handleCancel = () => {
      cleanup();
      resolve({
        confirmed: false,
        scalingFactor: 1.0,
        initialPositions: [],
        traderOriginalPositions: [],
        traderFilteredPositions: [],
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
 * Build positions display HTML
 * @private
 */
function buildPositionsDisplayHtml(positionCalculation, traderPositions, latestPrices) {
  if (!positionCalculation || positionCalculation.positions.length === 0) {
    return `
      <div style="margin-top:20px; padding:15px; background-color:#1a2332; border-radius:4px; border-left:3px solid #888; text-align:center;">
        <span style="color:#888; font-size:0.9em;">No open positions found for this trader</span>
      </div>
    `;
  }

  const {
    positions,
    totalEstimatedCost,
    totalMarketValue,
    warnings,
    utilizationPercent,
    wasScaled,
    scalingFactor,
    originalTotalCost,
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

  // Build position summary
  const feasibilityColor = '#2a9d5f';
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

  return `
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
}

/**
 * Build modal content HTML
 * @private
 */
function buildModalContent(sessionConfig, maskedApiKey, positionsHtml) {
  return `
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
}

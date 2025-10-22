/**
 * Test calculation utilities
 * Provides UI for testing position calculations without starting trading
 */

import { validateAddress, validateCopyBalance } from '../services/validation.js';
import { calculateInitialPositions } from './positionCalculator.js';
import { fetchPositionsForAddress } from '../rendering/wallet.js';

/**
 * Test position calculation with current form values
 * Displays results in the calculationTestResults element
 * @param {Object} elements - DOM elements object
 * @param {Object} config - App configuration object
 */
export async function testPositionCalculation(elements, config) {
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

    // Build and display results
    const resultsHtml = buildTestResultsHtml(
      traderAddress,
      copyBalance,
      calculation,
      traderPositions,
      config
    );

    elements.calculationTestResults.innerHTML = resultsHtml;
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
 * Build HTML for test results display
 * @param {string} traderAddress - Trader's wallet address
 * @param {number} copyBalance - Copy balance amount
 * @param {Object} calculation - Position calculation results
 * @param {Array} traderPositions - Original trader positions
 * @param {Object} config - App configuration
 * @returns {string} HTML string
 */
function buildTestResultsHtml(traderAddress, copyBalance, calculation, traderPositions, config) {
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
  const scalingInfoHtml = buildScalingInfoHtml(
    wasScaled,
    scalingFactor,
    originalTotalCost,
    totalEstimatedCost
  );

  // Test calculation doesn't fetch real-time prices (would be too slow for preview)
  const latestPrices = new Map();

  // Build position table with comparison if scaled
  const positionsTableHtml = buildPositionsTableHtml(
    positions,
    traderPositions,
    wasScaled,
    latestPrices,
    config
  );

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

  return `
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
}

/**
 * Build scaling info HTML section
 * @param {boolean} wasScaled - Whether positions were scaled
 * @param {number} scalingFactor - Scaling factor applied
 * @param {number} originalTotalCost - Original total cost
 * @param {number} totalEstimatedCost - Scaled total cost
 * @returns {string} HTML string
 */
function buildScalingInfoHtml(wasScaled, scalingFactor, originalTotalCost, totalEstimatedCost) {
  if (!wasScaled) {
    return '';
  }

  return `
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

/**
 * Build positions table HTML
 * @param {Array} positions - Calculated positions
 * @param {Array} traderPositions - Original trader positions
 * @param {boolean} wasScaled - Whether positions were scaled
 * @param {Map} latestPrices - Map of latest prices (symbol -> price info)
 * @param {Object} config - App configuration
 * @returns {string} HTML string
 */
function buildPositionsTableHtml(positions, traderPositions, wasScaled, latestPrices, config) {
  return positions
    .map((pos, index) => {
      const sideColor = pos.side === 'long' ? '#2a9d5f' : '#d94848';
      const originalPos = traderPositions[index];

      // Get latest price info for this symbol
      const priceInfo = latestPrices.get(pos.symbol);
      const hasLatestPrice = priceInfo && config.useLatestPrice;
      const displayPrice = hasLatestPrice ? priceInfo.orderPrice : pos.entryPrice;
      const priceChange = hasLatestPrice
        ? ((priceInfo.orderPrice - pos.entryPrice) / pos.entryPrice) * 100
        : 0;

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
            ${
              hasLatestPrice
                ? `
              <div style="color:#888; font-size:0.75em;">Trader: $${pos.entryPrice.toFixed(4)}</div>
              <div style="color:#4a9eff; font-weight:600; margin-top:2px;">Order: $${displayPrice.toFixed(4)}</div>
              <div style="color:${priceChange >= 0 ? '#2a9d5f' : '#d94848'}; font-size:0.75em;">(${priceChange >= 0 ? '+' : ''}${priceChange.toFixed(2)}%)</div>
            `
                : `
              <div style="color:#e0e0e0;">$${pos.entryPrice.toFixed(4)}</div>
            `
            }
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
            ${
              hasLatestPrice
                ? `
              <div style="color:#888; font-size:0.75em;">Trader: $${pos.entryPrice.toFixed(4)}</div>
              <div style="color:#4a9eff; font-weight:600; margin-top:2px;">Order: $${displayPrice.toFixed(4)}</div>
              <div style="color:${priceChange >= 0 ? '#2a9d5f' : '#d94848'}; font-size:0.75em;">(${priceChange >= 0 ? '+' : ''}${priceChange.toFixed(2)}%)</div>
            `
                : `
              <div style="color:#e0e0e0;">$${pos.entryPrice.toFixed(4)}</div>
            `
            }
          </td>
          <td style="padding:8px; color:#888;">${pos.leverage}x</td>
          <td style="padding:8px; color:#e0e0e0;">$${pos.marketValue.toFixed(2)}</td>
          <td style="padding:8px; color:#4a9eff; font-weight:600;">$${pos.estimatedCost.toFixed(2)}</td>
        </tr>
      `;
      }
    })
    .join('');
}

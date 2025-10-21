/**
 * Position Calculator - Pure functions for calculating copy trading positions
 * Testable logic separated from UI concerns
 */

/**
 * Detect decimal precision from a number
 * @param {number} num - Number to analyze
 * @returns {number} - Number of decimal places
 * @example
 * getDecimalPrecision(0.12) → 2
 * getDecimalPrecision(28000) → 0
 * getDecimalPrecision(1.234) → 3
 */
function getDecimalPrecision(num) {
  const str = num.toString();
  const decimalIndex = str.indexOf('.');

  if (decimalIndex === -1) {
    return 0; // No decimal point, integer
  }

  return str.length - decimalIndex - 1;
}

/**
 * Round number to specified decimal places
 * @param {number} num - Number to round
 * @param {number} decimals - Number of decimal places
 * @returns {number} - Rounded number
 */
function roundToDecimals(num, decimals) {
  const factor = 10 ** decimals;
  return Math.round(num * factor) / factor;
}

/**
 * Calculate initial positions to copy based on trader's LATEST open positions and user's balance
 *
 * Important: This function expects CURRENT positions from the trader (fetched fresh from API)
 *
 * Strategy: Copy trader's exact position sizes (1:1 ratio)
 * - Uses trader's exact size and entryPrice (preserves precision)
 * - User's copy balance determines maximum total exposure
 * - Auto-scales positions proportionally if balance insufficient
 *
 * @param {Array<{symbol: string, side: string, size: number, entryPrice: number, notional: number, leverage: number}>} traderPositions - Trader's CURRENT open positions (must be fresh data)
 * @param {number} userCopyBalance - User's total balance for copying (USD)
 * @returns {{
 *   positions: Array<{
 *     symbol: string,
 *     side: string,
 *     size: number,
 *     entryPrice: number,
 *     estimatedCost: number,
 *     leverage: number,
 *     marketValue: number
 *   }>,
 *   totalEstimatedCost: number,
 *   totalMarketValue: number,
 *   feasible: boolean,
 *   warnings: string[],
 *   utilizationPercent: number,
 *   wasScaled: boolean,
 *   scalingFactor: number,
 *   originalTotalCost: number,
 *   originalTotalValue: number
 * }}
 */
export function calculateInitialPositions(traderPositions, userCopyBalance) {
  // Validate inputs
  if (!Array.isArray(traderPositions)) {
    throw new Error('traderPositions must be an array');
  }

  if (typeof userCopyBalance !== 'number' || userCopyBalance <= 0) {
    throw new Error('userCopyBalance must be a positive number');
  }

  // If no positions, return empty result
  if (traderPositions.length === 0) {
    return {
      positions: [],
      totalEstimatedCost: 0,
      totalMarketValue: 0,
      feasible: true,
      warnings: [],
      utilizationPercent: 0
    };
  }

  const warnings = [];
  const calculatedPositions = [];
  let totalEstimatedCost = 0;
  let totalMarketValue = 0;

  // Calculate positions - copy trader's exact sizes (no rounding, use exact values)
  for (const traderPos of traderPositions) {
    const {
      symbol,
      side,
      size,
      entryPrice,
      leverage = 20, // Default max leverage
    } = traderPos;

    // Validate position data
    if (!symbol || !side || typeof size !== 'number' || typeof entryPrice !== 'number') {
      warnings.push(`Skipping invalid position: ${symbol || 'unknown'}`);
      continue;
    }

    // Calculate position value and required margin
    const marketValue = size * entryPrice; // Total position value
    const requiredMargin = marketValue / leverage; // Margin required (with leverage)

    calculatedPositions.push({
      symbol,
      side,
      size,  // Use trader's exact size
      entryPrice,  // Use trader's exact price
      estimatedCost: requiredMargin,
      leverage,
      marketValue
    });

    totalEstimatedCost += requiredMargin;
    totalMarketValue += marketValue;
  }

  // Check if total cost exceeds user's balance
  const feasible = totalEstimatedCost <= userCopyBalance;
  let utilizationPercent = (totalEstimatedCost / userCopyBalance) * 100;

  // If not feasible, scale down positions proportionally
  let scaledPositions = calculatedPositions;
  let scaledTotalCost = totalEstimatedCost;
  let scaledTotalValue = totalMarketValue;
  let scalingFactor = 1.0;

  if (!feasible) {
    // Calculate scaling factor to fit within 80% of balance (safety margin)
    scalingFactor = (userCopyBalance * 0.8) / totalEstimatedCost;

    // Scale down all positions proportionally, preserving original precision
    scaledPositions = calculatedPositions.map(pos => {
      // Detect precision from trader's original size
      const sizePrecision = getDecimalPrecision(pos.size);

      // Scale size and round to original precision
      const scaledSize = roundToDecimals(pos.size * scalingFactor, sizePrecision);

      return {
        symbol: pos.symbol,
        side: pos.side,
        size: scaledSize,  // Scaled size with original precision
        entryPrice: pos.entryPrice,  // Keep trader's exact entry price
        estimatedCost: pos.estimatedCost * scalingFactor,
        leverage: pos.leverage,
        marketValue: pos.marketValue * scalingFactor
      };
    });

    scaledTotalCost = totalEstimatedCost * scalingFactor;
    scaledTotalValue = totalMarketValue * scalingFactor;
    utilizationPercent = (scaledTotalCost / userCopyBalance) * 100;

    warnings.push(
      `Positions scaled down by ${(scalingFactor * 100).toFixed(1)}% to fit within your balance. Original requirement: $${totalEstimatedCost.toFixed(2)}.`
    );
  }

  if (utilizationPercent > 80 && feasible) {
    warnings.push(
      `High balance utilization (${utilizationPercent.toFixed(1)}%). Consider increasing copy balance for safety margin.`
    );
  }

  return {
    positions: scaledPositions,
    totalEstimatedCost: scaledTotalCost,
    totalMarketValue: scaledTotalValue,
    feasible: true, // Always feasible after scaling
    warnings,
    utilizationPercent,
    wasScaled: !feasible,
    scalingFactor,
    originalTotalCost: totalEstimatedCost,
    originalTotalValue: totalMarketValue
  };
}

/**
 * Format position calculation result for display
 * Converts calculation result into human-readable strings
 *
 * @param {object} calculation - Result from calculateInitialPositions
 * @returns {{
 *   summary: string,
 *   positionSummaries: string[],
 *   warnings: string[]
 * }}
 */
export function formatPositionCalculation(calculation) {
  const {
    positions,
    totalEstimatedCost,
    totalMarketValue,
    feasible,
    warnings,
    utilizationPercent
  } = calculation;

  const summary = positions.length > 0
    ? `${positions.length} position(s) | Total Margin: $${totalEstimatedCost.toFixed(2)} | Total Value: $${totalMarketValue.toFixed(2)} | Utilization: ${utilizationPercent.toFixed(1)}%`
    : 'No positions to copy';

  const positionSummaries = positions.map(pos =>
    `${pos.symbol} ${pos.side.toUpperCase()} ${pos.size.toFixed(4)} @ $${pos.entryPrice.toFixed(2)} (Margin: $${pos.estimatedCost.toFixed(2)}, ${pos.leverage}x)`
  );

  return {
    summary,
    positionSummaries,
    warnings: feasible ? warnings : ['⚠️ Insufficient balance', ...warnings]
  };
}

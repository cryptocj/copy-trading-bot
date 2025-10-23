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
      utilizationPercent: 0,
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
      leverage = 10, // Default max leverage
    } = traderPos;

    // Validate position data
    if (!symbol || !side || typeof size !== 'number' || typeof entryPrice !== 'number') {
      warnings.push(`Skipping invalid position: ${symbol || 'unknown'}`);
      continue;
    }

    // Calculate position value and required margin
    const marketValue = size * entryPrice; // Total position value
    const requiredMargin = marketValue / leverage; // Margin required (with leverage)

    // Convert position side to order side for CCXT
    // 'long' position → 'buy' order, 'short' position → 'sell' order
    const orderSide = side === 'long' ? 'buy' : 'sell';

    calculatedPositions.push({
      symbol,
      side: orderSide, // Use CCXT-compatible order side ('buy' or 'sell')
      size, // Use trader's exact size
      entryPrice, // Use trader's exact price
      estimatedCost: requiredMargin,
      leverage,
      marketValue,
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
    scaledPositions = calculatedPositions.map((pos) => {
      // Detect precision from trader's original size
      const sizePrecision = getDecimalPrecision(pos.size);

      // Scale size and round to original precision
      const scaledSize = roundToDecimals(pos.size * scalingFactor, sizePrecision);

      return {
        symbol: pos.symbol,
        side: pos.side, // Already converted to 'buy'/'sell' in calculatedPositions
        size: scaledSize, // Scaled size with original precision
        entryPrice: pos.entryPrice, // Keep trader's exact entry price
        estimatedCost: pos.estimatedCost * scalingFactor,
        leverage: pos.leverage,
        marketValue: pos.marketValue * scalingFactor,
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
    originalTotalValue: totalMarketValue,
  };
}

/**
 * Scale a single trade amount using the same rules as initial position calculation
 * - Detects precision from trader's original amount
 * - Applies scaling factor
 * - Preserves original precision
 *
 * @param {number} traderAmount - Trader's original trade amount
 * @param {number} scalingFactor - Scaling factor (0.0 to 1.0)
 * @returns {number} - Scaled amount with preserved precision
 * @example
 * scaleTrade(0.12, 0.833) → 0.10 (preserves 2 decimals)
 * scaleTrade(28000, 0.5) → 14000 (preserves 0 decimals)
 */
export function scaleTrade(traderAmount, scalingFactor) {
  // Validate inputs
  if (typeof traderAmount !== 'number' || traderAmount <= 0) {
    throw new Error('traderAmount must be a positive number');
  }

  if (typeof scalingFactor !== 'number' || scalingFactor <= 0 || scalingFactor > 1) {
    throw new Error('scalingFactor must be between 0 and 1');
  }

  // If no scaling needed (factor = 1.0), return original
  if (scalingFactor === 1.0) {
    return traderAmount;
  }

  // Detect precision from trader's original amount
  const precision = getDecimalPrecision(traderAmount);

  // Scale and round to original precision
  const scaledAmount = roundToDecimals(traderAmount * scalingFactor, precision);

  return scaledAmount;
}

/**
 * Calculate scaled trade amount based on available margin
 * Checks if sufficient margin is available and scales down if needed
 *
 * @param {{
 *   amount: number,
 *   price: number,
 *   leverage: number,
 *   freeMargin: number,
 *   scalingFactor: number,
 *   safetyBuffer: number
 * }} params
 * @returns {{
 *   scaledAmount: number,
 *   finalAmount: number,
 *   marginRequired: number,
 *   marginAvailable: number,
 *   wasAdjusted: boolean,
 *   adjustmentFactor: number
 * }}
 */
export function scaleTradeWithMargin({
  amount,
  price,
  leverage,
  freeMargin,
  scalingFactor = 1.0,
  safetyBuffer = 0.8
}) {
  // Validate inputs
  if (typeof amount !== 'number' || amount <= 0) {
    throw new Error('amount must be a positive number');
  }
  if (typeof price !== 'number' || price <= 0) {
    throw new Error('price must be a positive number');
  }
  if (typeof leverage !== 'number' || leverage <= 0) {
    throw new Error('leverage must be a positive number');
  }
  if (typeof freeMargin !== 'number' || freeMargin < 0) {
    throw new Error('freeMargin must be a non-negative number');
  }
  if (typeof scalingFactor !== 'number' || scalingFactor <= 0 || scalingFactor > 1) {
    throw new Error('scalingFactor must be between 0 and 1');
  }
  if (typeof safetyBuffer !== 'number' || safetyBuffer <= 0 || safetyBuffer > 1) {
    throw new Error('safetyBuffer must be between 0 and 1');
  }

  // Apply initial scaling factor
  const scaledAmount = scaleTrade(amount, scalingFactor);

  // Calculate margin requirements
  const marketValue = scaledAmount * price;
  const marginRequired = marketValue / leverage;
  const marginAvailable = freeMargin * safetyBuffer;

  // Check if additional adjustment needed
  let finalAmount = scaledAmount;
  let wasAdjusted = false;
  let adjustmentFactor = 1.0;

  if (marginRequired > marginAvailable) {
    // Scale down to fit available margin
    adjustmentFactor = marginAvailable / marginRequired;
    const precision = getDecimalPrecision(scaledAmount);
    finalAmount = roundToDecimals(scaledAmount * adjustmentFactor, precision);
    wasAdjusted = true;
  }

  return {
    scaledAmount, // Amount after initial scaling
    finalAmount, // Final amount after margin adjustment
    marginRequired, // Margin required for scaled amount
    marginAvailable, // Available margin with safety buffer
    wasAdjusted, // Whether margin adjustment was needed
    adjustmentFactor // Adjustment factor applied (1.0 if no adjustment)
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
    utilizationPercent,
  } = calculation;

  const summary =
    positions.length > 0
      ? `${positions.length} position(s) | Total Margin: $${totalEstimatedCost.toFixed(2)} | Total Value: $${totalMarketValue.toFixed(2)} | Utilization: ${utilizationPercent.toFixed(1)}%`
      : 'No positions to copy';

  const positionSummaries = positions.map(
    (pos) =>
      `${pos.symbol} ${pos.side.toUpperCase()} ${pos.size.toFixed(4)} @ $${pos.entryPrice.toFixed(2)} (Margin: $${pos.estimatedCost.toFixed(2)}, ${pos.leverage}x)`
  );

  return {
    summary,
    positionSummaries,
    warnings: feasible ? warnings : ['⚠️ Insufficient balance', ...warnings],
  };
}

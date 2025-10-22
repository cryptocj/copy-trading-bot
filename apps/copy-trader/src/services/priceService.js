/**
 * Price fetching service
 * Handles market price retrieval and order price calculation
 */

/**
 * Fetch latest ticker price for a symbol
 * @param {object} exchange - CCXT exchange instance
 * @param {string} symbol - Trading symbol
 * @returns {Promise<{bid: number, ask: number, last: number}>}
 */
export async function fetchLatestPrice(exchange, symbol) {
  try {
    const ticker = await exchange.fetchTicker(symbol);
    return {
      bid: ticker.bid || ticker.last,
      ask: ticker.ask || ticker.last,
      last: ticker.last,
    };
  } catch (error) {
    console.error(`Failed to fetch latest price for ${symbol}:`, error.message);
    throw error;
  }
}

/**
 * Calculate order price with tick offset
 * Buy orders: use bid price (or last - small offset)
 * Sell orders: use ask price (or last + small offset)
 * @param {object} priceInfo - {bid, ask, last}
 * @param {string} side - 'buy' or 'sell' (or 'long'/'short' for positions)
 * @param {number} basePrice - Base price for percentage calculation
 * @returns {number} - Order price with tick offset
 */
export function calculateOrderPrice(priceInfo, side, basePrice) {
  const TICK_OFFSET_PERCENT = 0.0001; // 0.01% offset for better fill rate

  // Normalize side to buy/sell
  const normalizedSide = side === 'long' ? 'buy' : side === 'short' ? 'sell' : side;

  if (normalizedSide === 'buy') {
    // Buy: use bid price, or last - offset if no bid
    const tickOffset = basePrice * TICK_OFFSET_PERCENT;
    return priceInfo.bid || (priceInfo.last - tickOffset);
  } else {
    // Sell: use ask price, or last + offset if no ask
    const tickOffset = basePrice * TICK_OFFSET_PERCENT;
    return priceInfo.ask || (priceInfo.last + tickOffset);
  }
}

/**
 * Fetch latest market prices for all trader positions (for confirmation display)
 * @param {string} apiKey - User's API key
 * @param {string} traderAddress - Trader's wallet address
 * @returns {Promise<Map<string, {bid: number, ask: number, last: number, orderPrice: number, traderEntry: number}>>}
 */
export async function fetchLatestPricesForConfirmation(apiKey, traderAddress) {
  try {
    // Initialize exchange
    const wallet = new ethers.Wallet(apiKey);
    const exchange = new ccxt.hyperliquid({
      privateKey: apiKey,
      walletAddress: wallet.address,
    });

    await exchange.loadMarkets();

    // Get trader positions (using the wallet service)
    const { fetchPositions } = await import('./wallet.js');
    const traderPositions = await fetchPositions(exchange, traderAddress);

    const pricesMap = new Map();

    // Fetch ticker for each symbol
    for (const pos of traderPositions) {
      try {
        const priceInfo = await fetchLatestPrice(exchange, pos.symbol);
        const orderPrice = calculateOrderPrice(priceInfo, pos.side, pos.entryPrice);

        pricesMap.set(pos.symbol, {
          bid: priceInfo.bid,
          ask: priceInfo.ask,
          last: priceInfo.last,
          orderPrice,
          traderEntry: pos.entryPrice,
        });

        console.log(
          `  ${pos.symbol}: Trader=$${pos.entryPrice.toFixed(2)} → Order=$${orderPrice.toFixed(2)} (${((orderPrice - pos.entryPrice) / pos.entryPrice * 100).toFixed(2)}%)`
        );
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

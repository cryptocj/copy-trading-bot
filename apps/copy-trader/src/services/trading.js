/**
 * Trading service for WebSocket monitoring and order execution
 * US3: Auto-Copy Trader Positions
 */

// CCXT library loaded via script tag in HTML (global variable)
// Available as window.ccxt

// Active trading session state
let session = null;

/**
 * Start copy trading session
 * @param {{ traderAddress: string, userApiKey: string, tradeValue: number, maxLeverage: number }} config
 * @param {Function} onOrderExecuted - Callback when order is executed (receives order object)
 * @returns {Promise<void>}
 */
export async function startCopyTrading(config, onOrderExecuted) {
    console.log('Initializing copy trading session...', {
        trader: config.traderAddress,
        tradeValue: config.tradeValue,
        maxLeverage: config.maxLeverage
    });

    try {
        // Initialize CCXT instances
        const monitorExchange = new ccxt.pro.hyperliquid({
            apiKey: config.userApiKey,
            secret: config.userApiKey, // Hyperliquid uses same value for both
        });

        const executeExchange = new ccxt.hyperliquid({
            apiKey: config.userApiKey,
            secret: config.userApiKey,
        });

        // Create session
        session = {
            monitorExchange,
            executeExchange,
            activationTimestamp: Date.now(),
            leverageCache: new Map(), // symbol → leverage mapping
            isRunning: true,
            config,
            onOrderExecuted
        };

        console.log('CCXT instances created, starting monitoring loop...');

        // Start monitoring loop (async, non-blocking)
        monitoringLoop().catch(error => {
            console.error('Monitoring loop error:', error);
        });

    } catch (error) {
        console.error('Failed to start copy trading:', error);
        throw error;
    }
}

/**
 * Stop copy trading session
 * @returns {Promise<void>}
 */
export async function stopCopyTrading() {
    if (!session) {
        console.log('No active session to stop');
        return;
    }

    console.log('Stopping copy trading session...');

    // Stop monitoring loop
    session.isRunning = false;

    try {
        // Close WebSocket connection
        if (session.monitorExchange && typeof session.monitorExchange.close === 'function') {
            try {
                await session.monitorExchange.close();
                console.log('✅ WebSocket connection closed');
            } catch (closeError) {
                // ExchangeClosedByUser is expected, not an error
                if (closeError.constructor.name === 'ExchangeClosedByUser' || closeError.message?.includes('closedByUser')) {
                    console.log('✅ WebSocket connection closed by user');
                } else {
                    console.warn('⚠️ Warning while closing WebSocket:', closeError.message);
                }
            }
        }

        // Close REST API connection
        if (session.executeExchange && typeof session.executeExchange.close === 'function') {
            try {
                await session.executeExchange.close();
                console.log('✅ REST API connection closed');
            } catch (closeError) {
                // ExchangeClosedByUser is expected, not an error
                if (closeError.constructor.name === 'ExchangeClosedByUser' || closeError.message?.includes('closedByUser')) {
                    console.log('✅ REST API connection closed by user');
                } else {
                    console.warn('⚠️ Warning while closing REST API:', closeError.message);
                }
            }
        }

        // Clear leverage cache
        session.leverageCache.clear();

        // Clear session
        session = null;

        console.log('✅ Copy trading session stopped successfully');
    } catch (error) {
        console.error('❌ Unexpected error stopping copy trading:', error);
        session = null; // Clear session anyway
    }
}

/**
 * Main monitoring loop (runs until session.isRunning = false)
 * Watches trader's trades via WebSocket and executes copy trades
 */
async function monitoringLoop() {
    if (!session) {
        console.error('No active session in monitoring loop');
        return;
    }

    const { monitorExchange, config, activationTimestamp } = session;

    console.log(`Monitoring trader: ${config.traderAddress}`);

    while (session && session.isRunning) {
        try {
            // Watch trader's trades via WebSocket
            // Pass trader address in params for Hyperliquid
            const trades = await monitorExchange.watchMyTrades(undefined, undefined, undefined, {
                user: config.traderAddress
            });

            for (const trade of trades) {
                // Skip historical trades (before activation)
                if (trade.timestamp < activationTimestamp) {
                    continue;
                }

                console.log('New trade detected:', {
                    symbol: trade.symbol,
                    side: trade.side,
                    price: trade.price,
                    amount: trade.amount,
                    timestamp: trade.timestamp
                });

                // Execute copy trade
                await executeCopyTrade(trade);
            }
        } catch (error) {
            console.error('Monitor error:', error);

            // Reset activation timestamp to prevent copying stale trades after reconnect
            if (session) {
                session.activationTimestamp = Date.now();
            }

            // Wait 5 seconds before retry
            await sleep(5000);
        }
    }

    console.log('Monitoring loop exited');
}

/**
 * Execute copy trade based on trader's trade
 * @param {{ symbol: string, side: string, price: number, amount: number }} trade - Trader's trade
 */
async function executeCopyTrade(trade) {
    if (!session) {
        console.error('No active session for trade execution');
        return;
    }

    const { executeExchange, config, leverageCache, onOrderExecuted } = session;
    const { symbol, side, price } = trade;

    try {
        // Calculate position size: tradeValue / price
        const amount = config.tradeValue / price;

        console.log(`Executing copy trade: ${side} ${amount} ${symbol} @ ${price}`);

        // Set leverage if first time for this symbol
        if (!leverageCache.has(symbol)) {
            await setLeverageIfNeeded(symbol);
        }

        // Execute limit order at trader's exact price
        const order = await executeExchange.createLimitOrder(symbol, side, amount, price);

        console.log('✅ Order executed successfully:', {
            orderId: order.id,
            symbol: order.symbol,
            side: order.side,
            amount: order.amount,
            price: order.price,
            cost: order.cost,
            status: order.status,
            timestamp: new Date(order.timestamp).toLocaleString()
        });

        // Notify callback with order details
        if (onOrderExecuted) {
            onOrderExecuted({
                symbol,
                side,
                amount,
                price,
                timestamp: Date.now()
            });
        }

    } catch (error) {
        console.error('Order execution failed:', error.message, {
            symbol,
            side,
            amount: config.tradeValue / price,
            price
        });

        // Continue monitoring - don't stop copy trading on order failure
    }
}

/**
 * Set leverage for symbol (once per symbol)
 * Uses minimum of (user max leverage, exchange symbol max leverage)
 * @param {string} symbol - Trading pair
 */
async function setLeverageIfNeeded(symbol) {
    if (!session) return;

    const { executeExchange, config, leverageCache } = session;

    try {
        console.log(`Setting leverage for ${symbol}...`);

        // Fetch market info to get symbol's max leverage
        const market = await executeExchange.fetchMarket(symbol);

        if (!market || !market.limits || !market.limits.leverage) {
            console.warn(`No leverage info for ${symbol}, using user max: ${config.maxLeverage}x`);
            leverageCache.set(symbol, config.maxLeverage);
            return;
        }

        // Use minimum of user max and exchange max
        const exchangeMaxLeverage = market.limits.leverage.max || 50;
        const leverage = Math.min(config.maxLeverage, exchangeMaxLeverage);

        console.log(`Leverage for ${symbol}: ${leverage}x (user: ${config.maxLeverage}x, exchange: ${exchangeMaxLeverage}x)`);

        // Set cross margin mode with leverage
        await executeExchange.setMarginMode('cross', symbol, { leverage });

        // Cache leverage to avoid redundant calls
        leverageCache.set(symbol, leverage);

        console.log(`Leverage set for ${symbol}: ${leverage}x`);
    } catch (error) {
        console.error(`Failed to set leverage for ${symbol}:`, error.message);

        // Cache user's max leverage as fallback
        leverageCache.set(symbol, config.maxLeverage);
    }
}

/**
 * Sleep utility for retry delays
 * @param {number} ms - Milliseconds to sleep
 * @returns {Promise<void>}
 */
function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Check if copy trading is currently active
 * @returns {boolean}
 */
export function isCopyTradingActive() {
    return session !== null && session.isRunning;
}

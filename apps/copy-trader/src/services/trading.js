/**
 * Trading service for WebSocket monitoring and order execution
 * US3: Auto-Copy Trader Positions
 * US1 (004): Automatic Session Recovery via localStorage persistence
 */

// CCXT library loaded via script tag in HTML (global variable)
// Available as window.ccxt
// Ethers.js library loaded via script tag in HTML (global variable)
// Available as window.ethers

// Import session persistence functions (T010-T013)
import {
  saveSessionState,
  clearSessionState,
  createEmptySessionState,
  claimSessionForCurrentTab
} from './sessionPersistence.js';

// Import position scaling helper
import { scaleTrade } from '../utils/positionCalculator.js';

// Import price fetching utilities
import { fetchLatestPrice, calculateOrderPrice } from './priceService.js';

// Import monitoring status service
import {
  showMonitoringStatus,
  hideMonitoringStatus,
  setStatusActive,
  setStatusReconnecting,
  updateLastActivity,
  recordTradeDetected
} from './monitoringStatus.js';

// Active trading session state
let session = null;

// Trade counter for this session
let tradeCounter = 0;

// Default maximum leverage (10x for safer trading)
const DEFAULT_MAX_LEVERAGE = 10;

// Dry-run mode flag (controlled by UI toggle)
let DRY_RUN_MODE = true;

/**
 * Set dry-run mode (controlled by UI toggle)
 * @param {boolean} enabled - Enable/disable dry-run mode
 */
export function setDryRunMode(enabled) {
    DRY_RUN_MODE = enabled;
    console.log(`🧪 Dry-run mode ${enabled ? 'ENABLED' : 'DISABLED'}`);
}

/**
 * Get current dry-run mode status
 * @returns {boolean}
 */
export function isDryRunMode() {
    return DRY_RUN_MODE;
}

/**
 * Start copy trading session
 * @param {{ traderAddress: string, userApiKey: string, copyBalance: number, initialPositions?: Array }} config
 * @param {Function} onOrderExecuted - Callback when order is executed (receives order object)
 * @param {object} [resumeState] - Optional: resume from saved session state (T010)
 * @returns {Promise<void>}
 */
export async function startCopyTrading(config, onOrderExecuted, resumeState = null) {
    if (DRY_RUN_MODE) {
        console.log('🧪🧪🧪 DRY RUN MODE ENABLED - NO REAL ORDERS WILL BE PLACED 🧪🧪🧪');
    }

    console.log('Initializing copy trading session...', {
        trader: config.traderAddress,
        copyBalance: config.copyBalance,
        resuming: !!resumeState,
        dryRunMode: DRY_RUN_MODE
    });

    try {
        // Derive wallet address from private key
        // ethers.js is loaded via CDN and available as window.ethers
        const wallet = new ethers.Wallet(config.userApiKey);
        const walletAddress = wallet.address;
        console.log('Wallet address:', walletAddress);

        // Initialize CCXT instances
        // Hyperliquid uses Ethereum-style wallet authentication
        const monitorExchange = new ccxt.pro.hyperliquid({
            privateKey: config.userApiKey, // Ethereum wallet private key
            walletAddress: walletAddress,   // Derived from private key
        });

        const executeExchange = new ccxt.hyperliquid({
            privateKey: config.userApiKey, // Ethereum wallet private key
            walletAddress: walletAddress,   // Derived from private key
        });

        // Initialize trade counter from resume state or start fresh (T010)
        tradeCounter = resumeState ? (resumeState.tradeCounter || 0) : 0;
        const startTime = resumeState ? resumeState.startTime : Date.now();
        const scalingFactor = resumeState ? (resumeState.scalingFactor || 1.0) : (config.scalingFactor || 1.0);
        const initialPositionsOpened = resumeState ? (resumeState.initialPositionsOpened || false) : false;

        // Create session with scaling factor
        session = {
            monitorExchange,
            executeExchange,
            activationTimestamp: Date.now(), // Always use current time for filtering new trades
            leverageCache: new Map(), // symbol → leverage mapping
            scalingFactor: scalingFactor, // Store scaling factor from resume state or config
            isRunning: true,
            config,
            onOrderExecuted,
            startTime // Track original session start time
        };

        console.log('CCXT instances created');
        console.log(`Trade counter initialized: ${tradeCounter}`);
        console.log(`Scaling factor: ${session.scalingFactor.toFixed(4)} (${(session.scalingFactor * 100).toFixed(1)}%)`);

        // Claim session for current tab (T009)
        claimSessionForCurrentTab();

        // Save initial session state to localStorage (T011)
        const sessionState = createEmptySessionState();
        sessionState.isActive = true;
        sessionState.startTime = startTime;
        sessionState.tradeCounter = tradeCounter;
        sessionState.config = config;
        sessionState.monitoredWallet = config.traderAddress;
        sessionState.scalingFactor = scalingFactor;
        sessionState.initialPositionsOpened = initialPositionsOpened;
        saveSessionState(sessionState, config.traderAddress); // Pass monitored wallet for multi-tab support

        console.log('Session state saved to localStorage');

        // Open initial positions if provided (copy trader's existing positions)
        // Skip if already opened in previous session (on refresh/resume)
        if (config.initialPositions && config.initialPositions.length > 0 && !initialPositionsOpened) {
            console.log(`\n📊 Opening ${config.initialPositions.length} initial positions...`);
            console.log(`📋 Trader's original positions (before scaling):`, config.traderOriginalPositions);
            console.log(`📐 Scaled positions to open:`, config.initialPositions);
            console.log(`📊 Scaling factor: ${scalingFactor.toFixed(4)} (${(scalingFactor * 100).toFixed(1)}%)\n`);

            const positionsOpened = await openInitialPositions(config.initialPositions);

            // Update session state only if positions were successfully opened
            if (positionsOpened) {
                console.log('✅ Initial positions opened successfully');
            } else {
                console.log('⚠️ Failed to open initial positions, will retry on next session');
            }
        } else if (initialPositionsOpened) {
            console.log('✅ Initial positions already opened in previous session, skipping...');
        }

        // Start monitoring loop (async, non-blocking)
        console.log('Starting monitoring loop for new trades...');

        // Show monitoring status indicator (pass trade counter for session restoration)
        showMonitoringStatus(tradeCounter);

        monitoringLoop().catch(error => {
            console.error('Monitoring loop error:', error);
        });

    } catch (error) {
        console.error('Failed to start copy trading:', error);
        throw error;
    }
}

/**
 * Open initial positions (copy trader's existing positions)
 * Places orders for all positions calculated from trader's current holdings
 * @param {Array<{symbol: string, side: string, size: number, entryPrice: number, leverage: number}>} positions - Scaled positions to open
 * @returns {Promise<boolean>} - Returns true if at least one position was successfully opened
 */
async function openInitialPositions(positions) {
    if (!session) {
        console.error('No active session for opening initial positions');
        return false;
    }

    const { executeExchange, leverageCache, onOrderExecuted } = session;
    let successCount = 0;
    let failCount = 0;

    for (const pos of positions) {
        const { symbol, side, size, entryPrice, leverage } = pos;

        try {
            // Use trader's actual leverage if available, otherwise use default
            const targetLeverage = leverage || DEFAULT_MAX_LEVERAGE;

            // Determine order price: use latest market price or trader's entry price
            let orderPrice = entryPrice;
            const useLatestPrice = session.config.useLatestPrice || false;

            if (useLatestPrice) {
                try {
                    console.log(`  📊 Fetching latest market price for ${symbol}...`);
                    const priceInfo = await fetchLatestPrice(executeExchange, symbol);
                    orderPrice = calculateOrderPrice(priceInfo, side, entryPrice);

                    console.log(`  💹 Price decision:`, {
                        traderEntry: entryPrice.toFixed(4),
                        latestBid: priceInfo.bid?.toFixed(4),
                        latestAsk: priceInfo.ask?.toFixed(4),
                        latestLast: priceInfo.last?.toFixed(4),
                        orderPrice: orderPrice.toFixed(4),
                        priceChange: (((orderPrice - entryPrice) / entryPrice) * 100).toFixed(2) + '%'
                    });
                } catch (priceError) {
                    console.warn(`  ⚠️ Failed to fetch latest price, using trader's entry price:`, priceError.message);
                    orderPrice = entryPrice;
                }
            }

            console.log(`\n📌 Opening initial position: ${side.toUpperCase()} ${size.toFixed(4)} ${symbol} @ $${orderPrice.toFixed(4)}`);
            console.log(`  📊 Position details from calculation:`, {
                symbol,
                side,
                size,
                traderEntryPrice: entryPrice,
                orderPrice: orderPrice,
                usingLatestPrice: useLatestPrice,
                traderLeverage: leverage,
                targetLeverage: targetLeverage,
                marketValue: (size * orderPrice).toFixed(2),
                marginRequired: ((size * orderPrice) / targetLeverage).toFixed(2)
            });

            // Set leverage if first time for this symbol OR if leverage changed
            const cachedLeverage = leverageCache.get(symbol);
            if (!cachedLeverage || cachedLeverage !== targetLeverage) {
                await setLeverageIfNeeded(symbol, targetLeverage);
            }

            // Get leverage for this symbol (should match target)
            const actualLeverage = leverageCache.get(symbol) || targetLeverage;
            console.log(`  ⚙️ Using ${actualLeverage}x leverage (cached: ${!!cachedLeverage}, matches trader: ${actualLeverage === leverage})`);

            if (DRY_RUN_MODE) {
                // DRY RUN: Log what would be executed without placing order
                console.log(`  🧪 DRY RUN: Would place order:`, {
                    exchange: 'Hyperliquid',
                    method: 'createLimitOrder',
                    symbol,
                    side,
                    size,
                    orderPrice,
                    traderEntryPrice: entryPrice,
                    leverage: actualLeverage,
                    estimatedCost: ((size * orderPrice) / actualLeverage).toFixed(2)
                });

                // Simulate successful order
                const simulatedOrder = {
                    id: `DRY_RUN_${Date.now()}_${symbol}`,
                    status: 'simulated',
                    amount: size,
                    price: orderPrice,
                    symbol,
                    side
                };

                console.log(`  ✅ DRY RUN: Simulated order:`, simulatedOrder);

                // Notify callback with simulated order
                if (onOrderExecuted) {
                    onOrderExecuted({
                        symbol,
                        side,
                        amount: size,
                        price: orderPrice,
                        timestamp: Date.now(),
                        dryRun: true
                    });
                }

                successCount++;
            } else {
                // LIVE MODE: Place actual order
                console.log(`  🚀 LIVE: Placing limit order at $${orderPrice.toFixed(4)}...`);
                const order = await executeExchange.createLimitOrder(symbol, side, size, orderPrice);

                console.log(`  ✅ Order placed successfully:`, {
                    orderId: order.id,
                    status: order.status,
                    amount: order.amount,
                    price: order.price,
                    cost: order.cost,
                    filled: order.filled,
                    remaining: order.remaining
                });

                // Notify callback
                if (onOrderExecuted) {
                    onOrderExecuted({
                        symbol,
                        side,
                        amount: size,
                        price: orderPrice,
                        timestamp: Date.now()
                    });
                }

                successCount++;
            }

            // Increment trade counter
            tradeCounter++;

        } catch (error) {
            console.error(`  ❌ Failed to open position for ${symbol}:`, error.message);
            console.error(`  📋 Error details:`, {
                symbol,
                side,
                size,
                entryPrice,
                errorName: error.name,
                errorMessage: error.message,
                errorStack: error.stack?.split('\n').slice(0, 3).join('\n')
            });
            failCount++;
            // Continue with other positions even if one fails
        }

        // Small delay between orders to avoid rate limits
        await sleep(500);
    }

    console.log(`\n📊 Initial positions summary: ${successCount} successful, ${failCount} failed`);

    // In dry-run mode or after successful orders, verify positions
    if (successCount > 0 && !DRY_RUN_MODE) {
        console.log(`\n🔍 Verifying opened positions...`);
        try {
            // Wait a moment for orders to settle
            await sleep(2000);

            // Fetch current positions from exchange
            const currentPositions = await executeExchange.fetchPositions();
            const openPositions = currentPositions.filter(pos => Math.abs(pos.contracts || 0) > 0);

            console.log(`\n📋 Current open positions on exchange (${openPositions.length}):`,
                openPositions.map(pos => ({
                    symbol: pos.symbol,
                    side: pos.side,
                    size: pos.contracts,
                    entryPrice: pos.entryPrice,
                    leverage: pos.leverage,
                    unrealizedPnl: pos.unrealizedPnl
                }))
            );

            // Compare with expected positions
            console.log(`\n🔎 Comparing expected vs actual positions:`);
            for (const expectedPos of positions) {
                const actualPos = openPositions.find(p => p.symbol === expectedPos.symbol);

                if (!actualPos) {
                    console.warn(`⚠️ Missing position: ${expectedPos.symbol} ${expectedPos.side} ${expectedPos.size}`);
                } else {
                    const sizeMatch = Math.abs(actualPos.contracts - expectedPos.size) < 0.01;
                    const sideMatch = actualPos.side === expectedPos.side;
                    const leverageMatch = Math.abs(actualPos.leverage - (expectedPos.leverage || DEFAULT_MAX_LEVERAGE)) <= 1;

                    console.log(`${sizeMatch && sideMatch && leverageMatch ? '✅' : '⚠️'} ${expectedPos.symbol}:`, {
                        expected: { side: expectedPos.side, size: expectedPos.size, leverage: expectedPos.leverage },
                        actual: { side: actualPos.side, size: actualPos.contracts, leverage: actualPos.leverage },
                        matches: { size: sizeMatch, side: sideMatch, leverage: leverageMatch }
                    });
                }
            }
        } catch (verifyError) {
            console.error(`❌ Position verification failed:`, verifyError.message);
        }
    } else if (DRY_RUN_MODE) {
        console.log(`\n🧪 DRY RUN: Skipping position verification (no real orders placed)`);
    }

    // Save updated trade counter and mark initial positions as opened (only if successful)
    if (successCount > 0) {
        const sessionState = createEmptySessionState();
        sessionState.isActive = true;
        sessionState.startTime = session.startTime;
        sessionState.tradeCounter = tradeCounter;
        sessionState.config = session.config;
        sessionState.monitoredWallet = session.config.traderAddress;
        sessionState.scalingFactor = session.scalingFactor;
        sessionState.initialPositionsOpened = true; // Mark as opened to prevent re-opening on refresh
        saveSessionState(sessionState, session.config.traderAddress);

        return true; // Success
    }

    return false; // All positions failed
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

    // Hide monitoring status indicator
    hideMonitoringStatus();

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

        // Clear session state from localStorage (T013)
        clearSessionState(session.config.traderAddress); // Pass monitored wallet for multi-tab support
        console.log('Session state cleared from localStorage');

        // Reset trade counter
        tradeCounter = 0;

        // Clear session
        session = null;

        console.log('✅ Copy trading session stopped successfully');
    } catch (error) {
        console.error('❌ Unexpected error stopping copy trading:', error);
        // Clear session state anyway
        clearSessionState();
        tradeCounter = 0;
        session = null;
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

            // Update status to show active monitoring
            setStatusActive();

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

                // Update trade counter and status
                tradeCounter++;
                recordTradeDetected(tradeCounter);

                // Execute copy trade
                await executeCopyTrade(trade);
            }

            // Update last activity timestamp
            updateLastActivity();

        } catch (error) {
            console.error('Monitor error:', error);

            // Update status to reconnecting
            setStatusReconnecting();

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

    const { executeExchange, config, leverageCache, scalingFactor, onOrderExecuted } = session;
    const { symbol, side, price, amount } = trade;

    try {
        // Apply scaling to trade amount (preserves trader's original precision)
        const scaledAmount = scaleTrade(amount, scalingFactor);

        console.log(`\n📡 New trade detected from trader:`);
        console.log(`  Symbol: ${symbol}`);
        console.log(`  Side: ${side}`);
        console.log(`  Price: ${price}`);
        console.log(`  Original amount: ${amount.toFixed(4)}`);
        console.log(`  Scaled amount:   ${scaledAmount.toFixed(4)} (${(scalingFactor * 100).toFixed(1)}%)`);

        // Set leverage if first time for this symbol (use default for live trades)
        if (!leverageCache.has(symbol)) {
            await setLeverageIfNeeded(symbol, DEFAULT_MAX_LEVERAGE);
        }

        // Get leverage for this symbol (or default)
        const leverage = leverageCache.get(symbol) || DEFAULT_MAX_LEVERAGE;

        console.log(`  Leverage: ${leverage}x (cached: ${leverageCache.has(symbol)})`);

        if (DRY_RUN_MODE) {
            // DRY RUN: Log what would be executed
            console.log(`  🧪 DRY RUN: Would place order:`, {
                exchange: 'Hyperliquid',
                method: 'createLimitOrder',
                symbol,
                side,
                scaledAmount,
                price,
                leverage
            });

            // Simulate successful order
            console.log('  ✅ DRY RUN: Order simulated successfully');
        } else {
            // LIVE MODE: Execute order
            console.log(`  🚀 LIVE: Executing order with ${leverage}x leverage...`);

            // Execute limit order at trader's exact price with scaled amount
            const order = await executeExchange.createLimitOrder(symbol, side, scaledAmount, price);

            console.log('  ✅ Order executed successfully:', {
                orderId: order.id,
                symbol: order.symbol,
                side: order.side,
                amount: order.amount,
                price: order.price,
                cost: order.cost,
                status: order.status,
                timestamp: new Date(order.timestamp).toLocaleString()
            });
        }

        // Notify callback with order details (use scaled amount)
        if (onOrderExecuted) {
            onOrderExecuted({
                symbol,
                side,
                amount: scaledAmount, // Use scaled amount for display
                price,
                timestamp: Date.now()
            });
        }

        // Increment trade counter and save to localStorage (T012)
        tradeCounter++;
        const sessionState = createEmptySessionState();
        sessionState.isActive = true;
        sessionState.startTime = session.startTime;
        sessionState.tradeCounter = tradeCounter;
        sessionState.config = config;
        sessionState.monitoredWallet = config.traderAddress;
        sessionState.scalingFactor = session.scalingFactor;
        sessionState.initialPositionsOpened = true; // Initial positions already opened if we're executing trades
        saveSessionState(sessionState, config.traderAddress); // Pass monitored wallet for multi-tab support

        console.log(`Trade counter updated: ${tradeCounter}`);

    } catch (error) {
        console.error('Order execution failed:', error.message, {
            symbol,
            side,
            amount,
            price
        });

        // Continue monitoring - don't stop copy trading on order failure
    }
}

/**
 * Set leverage for symbol (once per symbol or when leverage changes)
 * Uses trader's actual leverage or default max leverage
 * @param {string} symbol - Trading pair
 * @param {number} leverage - Target leverage (from trader's position or default)
 */
async function setLeverageIfNeeded(symbol, leverage = DEFAULT_MAX_LEVERAGE) {
    if (!session) return;

    const { executeExchange, leverageCache } = session;

    try {
        console.log(`Setting leverage for ${symbol} to ${leverage}x...`);

        if (DRY_RUN_MODE) {
            console.log(`  🧪 DRY RUN: Would set leverage to ${leverage}x (skipping actual API call)`);
            // Cache leverage in dry-run mode
            leverageCache.set(symbol, leverage);
            console.log(`  ✅ DRY RUN: Leverage cached for ${symbol}: ${leverage}x`);
        } else {
            // Set cross margin mode with leverage
            // Hyperliquid will enforce its own per-symbol limits automatically
            await executeExchange.setMarginMode('cross', symbol, { leverage: leverage });

            // Cache leverage to avoid redundant calls
            leverageCache.set(symbol, leverage);

            console.log(`✅ Leverage set for ${symbol}: ${leverage}x`);
        }
    } catch (error) {
        console.error(`Failed to set leverage for ${symbol}:`, error.message);

        // Cache requested leverage even if set failed (to avoid repeated attempts)
        leverageCache.set(symbol, leverage);
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

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

// Active trading session state
let session = null;

// Trade counter for this session
let tradeCounter = 0;

// Default maximum leverage (20x is reasonable for Hyperliquid)
const DEFAULT_MAX_LEVERAGE = 20;

/**
 * Start copy trading session
 * @param {{ traderAddress: string, userApiKey: string, copyBalance: number, initialPositions?: Array }} config
 * @param {Function} onOrderExecuted - Callback when order is executed (receives order object)
 * @param {object} [resumeState] - Optional: resume from saved session state (T010)
 * @returns {Promise<void>}
 */
export async function startCopyTrading(config, onOrderExecuted, resumeState = null) {
    console.log('Initializing copy trading session...', {
        trader: config.traderAddress,
        copyBalance: config.copyBalance,
        resuming: !!resumeState
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
            console.log(`📊 Opening ${config.initialPositions.length} initial positions...`);
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
        const { symbol, side, size, entryPrice } = pos;

        try {
            console.log(`\n📌 Opening initial position: ${side.toUpperCase()} ${size.toFixed(4)} ${symbol} @ $${entryPrice.toFixed(4)}`);

            // Set leverage if first time for this symbol
            if (!leverageCache.has(symbol)) {
                await setLeverageIfNeeded(symbol);
            }

            // Get leverage for this symbol (or default)
            const actualLeverage = leverageCache.get(symbol) || DEFAULT_MAX_LEVERAGE;
            console.log(`  Using ${actualLeverage}x leverage`);

            // Place limit order at trader's entry price
            const order = await executeExchange.createLimitOrder(symbol, side, size, entryPrice);

            console.log(`  ✅ Order placed successfully:`, {
                orderId: order.id,
                status: order.status,
                amount: order.amount,
                price: order.price
            });

            // Notify callback
            if (onOrderExecuted) {
                onOrderExecuted({
                    symbol,
                    side,
                    amount: size,
                    price: entryPrice,
                    timestamp: Date.now()
                });
            }

            successCount++;

            // Increment trade counter
            tradeCounter++;

        } catch (error) {
            console.error(`  ❌ Failed to open position for ${symbol}:`, error.message);
            failCount++;
            // Continue with other positions even if one fails
        }

        // Small delay between orders to avoid rate limits
        await sleep(500);
    }

    console.log(`\n📊 Initial positions summary: ${successCount} successful, ${failCount} failed`);

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

    const { executeExchange, config, leverageCache, scalingFactor, onOrderExecuted } = session;
    const { symbol, side, price, amount } = trade;

    try {
        // Apply scaling to trade amount (preserves trader's original precision)
        const scaledAmount = scaleTrade(amount, scalingFactor);

        console.log(`Preparing copy trade: ${side} ${symbol} @ ${price}`);
        console.log(`  Original amount: ${amount.toFixed(4)}`);
        console.log(`  Scaled amount:   ${scaledAmount.toFixed(4)} (${(scalingFactor * 100).toFixed(1)}%)`);

        // Set leverage if first time for this symbol
        if (!leverageCache.has(symbol)) {
            await setLeverageIfNeeded(symbol);
        }

        // Get leverage for this symbol (or default)
        const leverage = leverageCache.get(symbol) || DEFAULT_MAX_LEVERAGE;

        console.log(`Executing order with ${leverage}x leverage...`);

        // Execute limit order at trader's exact price with scaled amount
        const order = await executeExchange.createLimitOrder(symbol, side, scaledAmount, price);

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
 * Set leverage for symbol (once per symbol)
 * Uses default max leverage (Hyperliquid will enforce its own limits)
 * @param {string} symbol - Trading pair
 */
async function setLeverageIfNeeded(symbol) {
    if (!session) return;

    const { executeExchange, leverageCache } = session;

    try {
        console.log(`Setting leverage for ${symbol} to ${DEFAULT_MAX_LEVERAGE}x...`);

        // Set cross margin mode with leverage
        // Hyperliquid will enforce its own per-symbol limits automatically
        await executeExchange.setMarginMode('cross', symbol, { leverage: DEFAULT_MAX_LEVERAGE });

        // Cache leverage to avoid redundant calls
        leverageCache.set(symbol, DEFAULT_MAX_LEVERAGE);

        console.log(`✅ Leverage set for ${symbol}: ${DEFAULT_MAX_LEVERAGE}x`);
    } catch (error) {
        console.error(`Failed to set leverage for ${symbol}:`, error.message);

        // Cache default leverage even if set failed (to avoid repeated attempts)
        leverageCache.set(symbol, DEFAULT_MAX_LEVERAGE);
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

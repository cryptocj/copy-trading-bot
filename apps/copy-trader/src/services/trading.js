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

// Import position scaling helpers
import { calculateInitialPositions, scaleTradeWithMargin } from '../utils/positionCalculator.js';

// Import price fetching utilities
import { fetchLatestPrice, calculateOrderPrice } from './priceService.js';

// Import balance fetching utility
import { fetchBalanceForAddress } from '../rendering/wallet.js';

// Import storage keys
import { STORAGE_KEYS } from './storage.js';

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
 * Get market precision and limits for a symbol
 * @param {object} exchange - CCXT exchange instance or MoonlanderExchange
 * @param {string} symbol - Trading symbol (e.g., 'BTC/USD:USD' or 'BTC/USD')
 * @returns {object} Market info with precision and limits
 */
function getMarketInfo(exchange, symbol) {
    // Check if this is a MoonlanderExchange (has pairAddresses property)
    const isMoonlander = exchange.pairAddresses !== undefined;

    if (isMoonlander) {
        // Moonlander: Use fixed precision (similar to their platform)
        return {
            precision: { amount: 4, price: 4 }, // 4 decimals for both
            limits: { amount: { min: 0.0001 }, price: { min: 0.0001 } }
        };
    }

    // CCXT Hyperliquid: Use market info
    const market = exchange.markets[symbol];
    if (!market) {
        console.warn(`Market info not found for ${symbol}, using defaults`);
        return {
            precision: { amount: 1, price: 4 }, // Default: 1 decimal for amount, 4 for price
            limits: { amount: { min: 1 }, price: { min: 0.0001 } }
        };
    }

    // Convert precision to decimal places
    // CCXT can return precision as either decimal places (e.g., 4) or tick size (e.g., 0.0001)
    const convertPrecision = (value) => {
        if (!value) return 1;

        // If precision is < 1, it's a tick size (e.g., 0.0001), convert to decimal places
        if (value < 1) {
            // Count decimal places: 0.0001 -> 4, 0.01 -> 2, 0.1 -> 1
            const decimals = -Math.floor(Math.log10(value));
            return Math.max(0, decimals);
        }

        // Otherwise it's already decimal places
        return Math.round(value);
    };

    const amountPrecision = convertPrecision(market.precision?.amount);
    const pricePrecision = convertPrecision(market.precision?.price);

    // Override if precision is 0 (whole numbers only) - use sensible defaults for crypto
    const finalAmountPrecision = amountPrecision === 0 ? 1 : amountPrecision;
    const finalPricePrecision = pricePrecision === 0 ? 4 : pricePrecision;

    return {
        precision: {
            amount: finalAmountPrecision,
            price: finalPricePrecision
        },
        limits: market.limits || { amount: { min: 1 }, price: { min: 0.0001 } },
        contractSize: market.contractSize || 1
    };
}

/**
 * Round amount to market precision
 * @param {number} amount - Amount to round
 * @param {number} precision - Decimal places
 * @returns {number} Rounded amount
 */
function roundToTickSize(amount, precision) {
    return parseFloat(amount.toFixed(precision));
}

/**
 * Execute order on the appropriate platform (CCXT Hyperliquid or Moonlander)
 * @param {object} exchange - Exchange instance (CCXT or MoonlanderExchange)
 * @param {string} symbol - Trading symbol
 * @param {string} side - Order side ('buy' or 'sell')
 * @param {number} amount - Order amount (position size)
 * @param {number} price - Order price
 * @param {number} leverage - Leverage for the position
 * @returns {Promise<object>} Order result
 */
async function executeOrder(exchange, symbol, side, amount, price, leverage) {
    // Check if this is a MoonlanderExchange
    const isMoonlander = exchange.pairAddresses !== undefined;

    if (isMoonlander) {
        // Moonlander: Use createMarketOrder method
        console.log(`  🌙 Executing Moonlander order: ${side} ${amount} ${symbol} @ ${price} (${leverage}x)`);

        // Convert symbol format for Moonlander
        // Hyperliquid formats: 'BTC/USD:USD', 'BTC/USDCC', 'ETH/USD:USD'
        // Moonlander expects: 'BTC/USD', 'ETH/USD', 'SOL/USD', 'CRO/USD'
        const moonlanderSymbol = symbol
            .replace(':USD', '')      // Remove :USD suffix
            .replace('/USDCC', '/USD'); // Convert USDCC to USD

        console.log(`  🔄 Symbol conversion: ${symbol} → ${moonlanderSymbol}`);

        // Verify pair is supported on Moonlander
        if (!exchange.pairAddresses[moonlanderSymbol]) {
            const availablePairs = Object.keys(exchange.pairAddresses).join(', ');
            throw new Error(
                `Pair ${moonlanderSymbol} not available on Moonlander. ` +
                `Available pairs: ${availablePairs}. ` +
                `Original symbol: ${symbol}`
            );
        }

        // Calculate margin required: (position_size * price) / leverage
        const marginRequired = (amount * price) / leverage;

        console.log(`  📊 Moonlander order details:`, {
            symbol: moonlanderSymbol,
            side,
            positionSize: amount,
            price,
            leverage,
            marginRequired: marginRequired.toFixed(2)
        });

        // Execute order via Moonlander
        const order = await exchange.createMarketOrder({
            pairBase: moonlanderSymbol,
            side,
            amount: marginRequired.toFixed(6), // Margin in USD (string)
            qty: amount.toFixed(10), // Position quantity (string)
            stopLoss: null, // Optional: Can add stop loss logic
            takeProfit: null, // Optional: Can add take profit logic
            broker: 1, // Default broker
        });

        console.log(`  ✅ Moonlander order placed:`, order);

        return order;
    } else {
        // CCXT Hyperliquid: Use createLimitOrder
        console.log(`  ⚡ Executing Hyperliquid order: ${side} ${amount} ${symbol} @ ${price}`);

        const order = await exchange.createLimitOrder(symbol, side, amount, price);

        console.log(`  ✅ Hyperliquid order placed:`, order);

        return order;
    }
}


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
 * @param {{ traderAddress: string, hyperliquidApiKey?: string, monitoringApiKey?: string, executionPlatform: string, copyBalance: number, initialPositions?: Array }} config
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
        // Determine wallet addresses based on execution platform
        let userWalletAddress; // Wallet address for balance queries
        let apiKey; // API key for Hyperliquid monitoring
        let executionPrivateKey; // Private key for trade execution

        if (config.executionPlatform === 'moonlander') {
            // Moonlander mode: Use Moonlander private key for execution
            executionPrivateKey = config.moonlander?.privateKey;
            if (!executionPrivateKey) {
                throw new Error('Moonlander private key not configured');
            }

            // Derive wallet address from Moonlander private key
            const executionWallet = new ethers.Wallet(executionPrivateKey);
            userWalletAddress = executionWallet.address;

            // Use monitoring API key for Hyperliquid monitoring
            apiKey = config.monitoringApiKey;
            if (!apiKey) {
                throw new Error('Monitoring API key not configured for Moonlander mode');
            }

            console.log('🌙 Moonlander mode:');
            console.log('  - Execution wallet (from Moonlander private key):', userWalletAddress);
            console.log('  - Monitoring via Hyperliquid');
        } else {
            // Hyperliquid mode: Use Hyperliquid API key for both monitoring and execution
            apiKey = config.hyperliquidApiKey;
            if (!apiKey) {
                throw new Error('Hyperliquid API key not configured');
            }

            // Can use saved wallet address or derive from API key
            const savedWalletAddress = localStorage.getItem(STORAGE_KEYS.MY_WALLET_ADDRESS);
            if (savedWalletAddress) {
                userWalletAddress = savedWalletAddress;
            } else {
                // Derive from API key
                const wallet = new ethers.Wallet(apiKey);
                userWalletAddress = wallet.address;
            }

            executionPrivateKey = apiKey; // Same key for execution

            console.log('⚡ Hyperliquid mode:');
            console.log('  - Wallet address:', userWalletAddress);
        }

        // Derive API key wallet address from API key (for Hyperliquid monitoring)
        const monitoringWallet = new ethers.Wallet(apiKey);
        const apiKeyWalletAddress = monitoringWallet.address;

        console.log('Execution platform:', config.executionPlatform);
        console.log('User wallet address (for balance queries):', userWalletAddress);
        console.log('Monitoring wallet address:', apiKeyWalletAddress);

        // Initialize monitoring exchange (always Hyperliquid for now)
        const monitorExchange = new ccxt.pro.hyperliquid({
            privateKey: apiKey, // Ethereum wallet private key
            walletAddress: apiKeyWalletAddress, // API key wallet for monitoring
        });

        // Initialize execution exchange based on platform
        let executeExchange;

        if (config.executionPlatform === 'moonlander') {
            console.log('🌙 Initializing Moonlander exchange for order execution...');

            // Dynamically import MoonlanderExchange (browser version)
            const { MoonlanderExchange } = await import('../services/moonlander-browser.js');
            const { getMoonlanderConfig } = await import('../config/moonlander.js');

            // Get Moonlander config
            const moonlanderConfig = getMoonlanderConfig(config.moonlander.network);

            // Create Moonlander exchange instance
            executeExchange = new MoonlanderExchange({
                privateKey: executionPrivateKey,
                ...moonlanderConfig,
            });

            // Initialize contracts (loads ABIs)
            await executeExchange.initialize();

            console.log('✅ Moonlander exchange initialized');
            console.log('  - Wallet address:', executeExchange.walletAddress);
            console.log('  - Diamond contract:', moonlanderConfig.diamondAddress);
            console.log('  - Network:', config.moonlander.network);
        } else {
            console.log('⚡ Initializing Hyperliquid exchange for order execution...');

            executeExchange = new ccxt.hyperliquid({
                privateKey: executionPrivateKey,
                walletAddress: apiKeyWalletAddress,
            });

            // Load markets to get precision and limits info (CCXT only)
            console.log('Loading market data...');
            await executeExchange.loadMarkets();
            console.log('Markets loaded:', Object.keys(executeExchange.markets).length, 'symbols');
        }

        // Initialize trade counter from resume state or start fresh (T010)
        tradeCounter = resumeState ? (resumeState.tradeCounter || 0) : 0;
        const startTime = resumeState ? resumeState.startTime : Date.now();
        const scalingFactor = resumeState ? (resumeState.scalingFactor || 1.0) : (config.scalingFactor || 1.0);
        const initialPositionsOpened = resumeState ? (resumeState.initialPositionsOpened || false) : false;

        // Create session with both wallet addresses
        session = {
            monitorExchange,
            executeExchange,
            userWalletAddress, // User's wallet address for balance queries
            apiKeyWalletAddress, // API key wallet for trade execution
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
            console.log(`\n💰 Fetching actual available margin from user's wallet: ${session.userWalletAddress}`);

            // Fetch balance - platform-aware
            let balance;
            if (config.executionPlatform === 'moonlander') {
                // Moonlander: Use executeExchange.fetchBalance() (queries blockchain + API)
                console.log('🌙 Fetching balance from Moonlander...');
                balance = await executeExchange.fetchBalance();
            } else {
                // Hyperliquid: Use fetchBalanceForAddress (queries Hyperliquid API)
                console.log('⚡ Fetching balance from Hyperliquid...');
                balance = await fetchBalanceForAddress(session.userWalletAddress);
            }

            const freeMargin = balance.free; // Available margin (accountValue - totalMarginUsed)
            const totalBalance = balance.total; // Total account value
            const usedMargin = balance.used; // Margin locked in positions

            console.log('📊 Balance fetched:', { totalBalance, usedMargin, freeMargin });

            if (freeMargin <= 0) {
                console.error(`❌ Insufficient margin available: $${freeMargin.toFixed(2)}`);
                throw new Error(`No available margin to open positions. Free: $${freeMargin.toFixed(2)}, Used: $${usedMargin.toFixed(2)}`);
            }

            console.log(`\n📊 Balance comparison:`);
            console.log(`  Configured copyBalance: $${config.copyBalance.toFixed(2)}`);
            console.log(`  Actual free margin: $${freeMargin.toFixed(2)}`);
            console.log(`  Total balance: $${totalBalance.toFixed(2)}`);
            console.log(`  Used margin: $${usedMargin.toFixed(2)}`);

            // Calculate proportional balance for missing positions
            // If user has existing positions, we need to allocate balance proportionally
            let effectiveBalance;

            if (config.traderOriginalPositions && config.traderOriginalPositions.length > 0) {
                const totalTraderPositions = config.traderOriginalPositions.length;
                const missingPositions = config.initialPositions.length; // Positions we need to open
                const existingPositions = totalTraderPositions - missingPositions;

                if (existingPositions > 0) {
                    // User has some positions already, calculate proportional allocation
                    const proportionalBalance = (config.copyBalance * missingPositions) / totalTraderPositions;
                    effectiveBalance = Math.min(proportionalBalance, freeMargin);

                    console.log(`\n🔄 Proportional balance calculation:`);
                    console.log(`  Total trader positions: ${totalTraderPositions}`);
                    console.log(`  Your existing positions: ${existingPositions}`);
                    console.log(`  Missing positions to open: ${missingPositions}`);
                    console.log(`  Proportional allocation: $${proportionalBalance.toFixed(2)} (${(missingPositions / totalTraderPositions * 100).toFixed(1)}% of ${config.copyBalance.toFixed(2)})`);
                    console.log(`  Effective balance (min of proportional and free): $${effectiveBalance.toFixed(2)}`);
                } else {
                    // No existing positions, use configured balance vs free margin
                    effectiveBalance = Math.min(config.copyBalance, freeMargin);
                    console.log(`  No existing positions - using min of configured and free margin: $${effectiveBalance.toFixed(2)}`);
                }
            } else {
                // No trader original positions provided, fallback to simple comparison
                effectiveBalance = Math.min(config.copyBalance, freeMargin);
                console.log(`  No trader original positions - using min of configured and free margin: $${effectiveBalance.toFixed(2)}`);
            }

            // Recalculate scaling with effective balance
            // Use traderFilteredPositions (filtered RAW positions) for recalculation
            if (config.traderFilteredPositions && config.traderFilteredPositions.length > 0) {
                console.log(`\n🔄 Re-calculating position scaling with effective balance...`);

                // Recalculate using filtered RAW positions (not pre-calculated positions)
                // This ensures we recalculate with the actual available balance
                const recalcResult = calculateInitialPositions(config.traderFilteredPositions, effectiveBalance);

                console.log(`\n📊 Re-scaling results:`, {
                    originalScaling: `${(scalingFactor * 100).toFixed(1)}%`,
                    newScaling: `${(recalcResult.scalingFactor * 100).toFixed(1)}%`,
                    originalCost: config.initialPositions.reduce((sum, p) => sum + (p.size * p.entryPrice / p.leverage), 0).toFixed(2),
                    recalculatedCost: recalcResult.totalEstimatedCost.toFixed(2),
                    effectiveBalance: effectiveBalance.toFixed(2)
                });

                if (recalcResult.warnings.length > 0) {
                    console.log('\n⚠️ Scaling warnings:');
                    recalcResult.warnings.forEach(w => console.log(`  - ${w}`));
                }

                // Use recalculated positions
                config.initialPositions = recalcResult.positions;
                session.scalingFactor = recalcResult.scalingFactor;
            }

            console.log(`\n📊 Opening ${config.initialPositions.length} initial positions...`);
            console.log(`📋 Trader's original positions (before scaling):`, config.traderOriginalPositions);
            console.log(`📐 Scaled positions to open:`, config.initialPositions);
            console.log(`📊 Final scaling factor: ${session.scalingFactor.toFixed(4)} (${(session.scalingFactor * 100).toFixed(1)}%)\n`);

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

            // Apply market precision to size and price
            const marketInfo = getMarketInfo(executeExchange, symbol);
            const roundedSize = roundToTickSize(size, marketInfo.precision.amount);
            const roundedPrice = roundToTickSize(orderPrice, marketInfo.precision.price);

            console.log(`  📏 Market precision applied:`, {
                originalSize: size,
                roundedSize,
                sizePrecision: marketInfo.precision.amount,
                originalPrice: orderPrice,
                roundedPrice,
                pricePrecision: marketInfo.precision.price,
                minAmount: marketInfo.limits.amount.min
            });

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
                console.log(`  🚀 LIVE: Placing order at $${roundedPrice.toFixed(4)}...`);
                const order = await executeOrder(executeExchange, symbol, side, roundedSize, roundedPrice, actualLeverage);

                console.log(`  ✅ Order placed successfully:`, order);

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

    // Check if this is a MoonlanderExchange
    const isMoonlander = executeExchange.pairAddresses !== undefined;

    // In dry-run mode or after successful orders, verify positions
    if (successCount > 0 && !DRY_RUN_MODE && !isMoonlander) {
        console.log(`\n🔍 Verifying opened positions...`);
        try {
            // Wait a moment for orders to settle
            await sleep(2000);

            // Fetch current positions from exchange (Hyperliquid only)
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
    } else if (isMoonlander) {
        console.log(`\n🌙 Moonlander: Position verification via blockchain (check wallet for transaction confirmations)`);
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

    const { executeExchange, userWalletAddress, config, leverageCache, scalingFactor, onOrderExecuted } = session;
    const { symbol, side, price, amount } = trade;

    try {
        console.log(`\n📡 New trade detected from trader:`);
        console.log(`  Symbol: ${symbol}`);
        console.log(`  Side: ${side}`);
        console.log(`  Price: ${price}`);
        console.log(`  Original amount: ${amount.toFixed(4)}`);

        // Set leverage if first time for this symbol (use default for live trades)
        if (!leverageCache.has(symbol)) {
            await setLeverageIfNeeded(symbol, DEFAULT_MAX_LEVERAGE);
        }

        // Get leverage for this symbol (or default)
        const leverage = leverageCache.get(symbol) || DEFAULT_MAX_LEVERAGE;
        console.log(`  Leverage: ${leverage}x (cached: ${leverageCache.has(symbol)})`);

        // Fetch current available margin before placing order - platform-aware
        console.log(`  💰 Checking available margin for user's wallet: ${userWalletAddress}`);
        let balance;
        if (config.executionPlatform === 'moonlander') {
            // Moonlander: Use executeExchange.fetchBalance()
            balance = await executeExchange.fetchBalance();
        } else {
            // Hyperliquid: Use fetchBalanceForAddress
            balance = await fetchBalanceForAddress(userWalletAddress);
        }
        const freeMargin = balance.free; // Available margin
        const totalBalance = balance.total;
        const usedMargin = balance.used;

        // Use unified scaling function with margin check
        const scalingResult = scaleTradeWithMargin({
            amount,
            price,
            leverage,
            freeMargin,
            scalingFactor,
            safetyBuffer: 0.8
        });

        console.log(`  📊 Scaling result:`, {
            originalAmount: amount.toFixed(4),
            scaledAmount: scalingResult.scaledAmount.toFixed(4),
            finalAmount: scalingResult.finalAmount.toFixed(4),
            scalingFactor: (scalingFactor * 100).toFixed(1) + '%',
            marginRequired: scalingResult.marginRequired.toFixed(2),
            marginAvailable: scalingResult.marginAvailable.toFixed(2),
            freeMargin: freeMargin.toFixed(2),
            usedMargin: usedMargin.toFixed(2),
            totalBalance: totalBalance.toFixed(2),
            wasAdjusted: scalingResult.wasAdjusted
        });

        if (scalingResult.wasAdjusted) {
            console.log(`  ⚠️ Trade scaled down by ${(scalingResult.adjustmentFactor * 100).toFixed(1)}% due to insufficient margin`);
        }

        // Apply market precision to final amount and price
        const marketInfo = getMarketInfo(executeExchange, symbol);
        const roundedAmount = roundToTickSize(scalingResult.finalAmount, marketInfo.precision.amount);
        const roundedPrice = roundToTickSize(price, marketInfo.precision.price);

        console.log(`  📏 Market precision:`, {
            originalAmount: scalingResult.finalAmount,
            roundedAmount,
            amountPrecision: marketInfo.precision.amount,
            originalPrice: price,
            roundedPrice,
            pricePrecision: marketInfo.precision.price
        });

        if (DRY_RUN_MODE) {
            // DRY RUN: Log what would be executed
            console.log(`  🧪 DRY RUN: Would place order:`, {
                exchange: 'Hyperliquid',
                method: 'createLimitOrder',
                symbol,
                side,
                amount: roundedAmount,
                price: roundedPrice,
                leverage
            });

            // Simulate successful order
            console.log('  ✅ DRY RUN: Order simulated successfully');
        } else {
            // LIVE MODE: Execute order
            console.log(`  🚀 LIVE: Executing order with ${leverage}x leverage...`);

            // Execute order at trader's exact price with scaled amount
            const order = await executeOrder(executeExchange, symbol, side, roundedAmount, roundedPrice, leverage);

            console.log('  ✅ Order executed successfully:', order);
        }

        // Notify callback with order details (use rounded amount)
        if (onOrderExecuted) {
            onOrderExecuted({
                symbol,
                side,
                amount: roundedAmount, // Use rounded amount for display
                price: roundedPrice,
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
 * Note: Moonlander sets leverage per-order, so this only applies to Hyperliquid
 * @param {string} symbol - Trading pair
 * @param {number} leverage - Target leverage (from trader's position or default)
 */
async function setLeverageIfNeeded(symbol, leverage = DEFAULT_MAX_LEVERAGE) {
    if (!session) return;

    const { executeExchange, leverageCache } = session;

    // Check if this is a MoonlanderExchange (sets leverage per-order)
    const isMoonlander = executeExchange.pairAddresses !== undefined;

    if (isMoonlander) {
        // Moonlander: Leverage is set per-order, just cache it
        console.log(`  🌙 Moonlander: Leverage ${leverage}x will be set per-order`);
        leverageCache.set(symbol, leverage);
        return;
    }

    try {
        console.log(`Setting leverage for ${symbol} to ${leverage}x...`);

        if (DRY_RUN_MODE) {
            console.log(`  🧪 DRY RUN: Would set leverage to ${leverage}x (skipping actual API call)`);
            // Cache leverage in dry-run mode
            leverageCache.set(symbol, leverage);
            console.log(`  ✅ DRY RUN: Leverage cached for ${symbol}: ${leverage}x`);
        } else {
            // Set cross margin mode with leverage (Hyperliquid only)
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

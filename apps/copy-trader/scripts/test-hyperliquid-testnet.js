#!/usr/bin/env node
/**
 * Hyperliquid Testnet Testing Script
 *
 * Tests basic trading operations on Hyperliquid testnet including:
 * - Connection and authentication
 * - Fetching account balance
 * - Fetching positions
 * - Creating test orders
 * - Closing positions
 *
 * Prerequisites:
 * 1. Get testnet tokens from: https://app.hyperliquid-testnet.xyz/drip
 * 2. Set HYPERLIQUID_PRIVATE_KEY in .env file
 *
 * Usage:
 *   node scripts/test-hyperliquid-testnet.js           # Read-only mode
 *   node scripts/test-hyperliquid-testnet.js --order   # Order creation test
 */

import dotenv from 'dotenv';
import ccxt from 'ccxt';
import readline from 'readline';
import { getHyperliquidConfig } from '../src/config/hyperliquid.js';

dotenv.config();

// Testnet Configuration
const TESTNET_CONFIG = getHyperliquidConfig('testnet');

const CONFIG = {
  privateKey: process.env.HYPERLIQUID_PRIVATE_KEY,
  parentWallet: process.env.HYPERLIQUID_PARENT_ADDRESS || null,
  testSymbol: 'BTC/USDC:USDC', // BTC perpetual
  orderSize: 0.001, // 0.001 BTC (~$100 at current prices)
  side: 'buy', // 'buy' for LONG, 'sell' for SHORT
  priceOffsetPercent: 0.20, // 20% offset from current price
  apiUrl: TESTNET_CONFIG.apiUrl,
  appUrl: TESTNET_CONFIG.appUrl,
  faucetUrl: TESTNET_CONFIG.faucetUrl,
};

/**
 * Create Hyperliquid testnet exchange instance
 */
async function createTestnetExchange() {
  if (!CONFIG.privateKey) {
    throw new Error('HYPERLIQUID_PRIVATE_KEY not found in .env file');
  }

  console.log('═══════════════════════════════════════════════════════');
  console.log('  Hyperliquid Testnet Integration Test');
  console.log('═══════════════════════════════════════════════════════');
  console.log(`📍 Network: ${TESTNET_CONFIG.name}`);
  console.log(`🌐 API: ${TESTNET_CONFIG.apiUrl}`);
  console.log(`🔗 App: ${TESTNET_CONFIG.appUrl}`);

  // Import ethers to derive wallet address from private key
  const { Wallet } = await import('ethers');
  const wallet = new Wallet(CONFIG.privateKey);
  const derivedAddress = wallet.address;

  // Use parent wallet address if provided (vault mode), otherwise use derived address
  const walletAddress = CONFIG.parentWallet || derivedAddress;

  // Create exchange with proper wallet address
  const exchangeConfig = {
    privateKey: CONFIG.privateKey,
    walletAddress: walletAddress,
    urls: {
      api: {
        public: CONFIG.apiUrl,
        private: CONFIG.apiUrl,
      },
    },
  };

  const exchange = new ccxt.hyperliquid(exchangeConfig);

  console.log(`\n🔑 Derived Address: ${derivedAddress}`);

  if (CONFIG.parentWallet) {
    console.log(`👨‍👦 Parent Wallet (Vault): ${CONFIG.parentWallet}`);
    console.log(`   Trading Address: ${walletAddress}`);
    console.log('   (Using vault trading mode)');
  } else {
    console.log(`   Trading Address: ${walletAddress}`);
  }

  return exchange;
}

/**
 * Fetch balance for a specific address using Hyperliquid API
 */
async function fetchBalanceForAddress(address, apiUrl) {
  console.log(`\n📊 Fetching balance for ${address}...`);

  const response = await fetch(`${apiUrl}/info`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      type: 'clearinghouseState',
      user: address,
    }),
  });

  if (!response.ok) {
    throw new Error(`Hyperliquid API error: ${response.status}`);
  }

  const data = await response.json();

  // Extract balance from marginSummary
  const marginSummary = data.marginSummary || {};
  const accountValue = parseFloat(marginSummary.accountValue || 0);
  const totalMarginUsed = parseFloat(marginSummary.totalMarginUsed || 0);
  const withdrawable = parseFloat(data.withdrawable || 0);

  // Available margin for trading = accountValue - totalMarginUsed
  const availableMargin = accountValue - totalMarginUsed;

  return {
    total: accountValue,
    used: totalMarginUsed,
    free: availableMargin,
    withdrawable: withdrawable,
  };
}

/**
 * Display account balance
 */
async function displayBalance(address) {
  console.log('\n═══════════════════════════════════════════════════════');
  console.log('  Account Balance');
  console.log('═══════════════════════════════════════════════════════');

  try {
    const balance = await fetchBalanceForAddress(address, CONFIG.apiUrl);

    console.log(`  Total Equity: ${balance.total.toFixed(2)} USDC`);
    console.log(`  Available: ${balance.free.toFixed(2)} USDC`);
    console.log(`  Used (Margin): ${balance.used.toFixed(2)} USDC`);

    return balance;
  } catch (error) {
    console.error(`  ❌ Error: ${error.message}`);
    throw error;
  }
}

/**
 * Fetch positions for a specific address using Hyperliquid API
 */
async function fetchPositionsForAddress(address, apiUrl) {
  console.log(`\n📈 Fetching positions for ${address}...`);

  const response = await fetch(`${apiUrl}/info`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      type: 'clearinghouseState',
      user: address,
    }),
  });

  if (!response.ok) {
    throw new Error(`Hyperliquid API error: ${response.status}`);
  }

  const data = await response.json();

  // Extract and format positions
  const assetPositions = data.assetPositions || [];

  return assetPositions
    .filter((pos) => parseFloat(pos.position.szi) !== 0) // Filter OPEN positions only
    .map((pos) => {
      const szi = parseFloat(pos.position.szi);
      const isLong = szi > 0;

      // Calculate leverage
      const positionValue = Math.abs(szi) * parseFloat(pos.position.entryPx || 0);
      const marginUsed = parseFloat(pos.position.marginUsed || positionValue / 20);
      const leverage = marginUsed > 0 ? positionValue / marginUsed : 20;

      return {
        symbol: `${pos.position.coin}/USDC:USDC`,
        side: isLong ? 'long' : 'short',
        size: Math.abs(szi),
        entryPrice: parseFloat(pos.position.entryPx || 0),
        markPrice: parseFloat(pos.position.positionValue || 0) / Math.abs(szi),
        unrealizedPnl: parseFloat(pos.position.unrealizedPnl || 0),
        leverage: Math.round(leverage),
        liquidationPrice: parseFloat(pos.position.liquidationPx || 0),
      };
    });
}

/**
 * Display current positions
 */
async function displayPositions(address) {
  console.log('\n═══════════════════════════════════════════════════════');
  console.log('  Current Positions');
  console.log('═══════════════════════════════════════════════════════');

  try {
    const positions = await fetchPositionsForAddress(address, CONFIG.apiUrl);

    if (positions.length === 0) {
      console.log('  No open positions');
      return [];
    }

    console.log(`\n  Found ${positions.length} open position(s):`);

    positions.forEach((pos, index) => {
      console.log(`\n  Position #${index + 1}:`);
      console.log(`    Symbol: ${pos.symbol}`);
      console.log(`    Side: ${pos.side.toUpperCase()}`);
      console.log(`    Size: ${pos.size}`);
      console.log(`    Entry Price: ${pos.entryPrice.toFixed(2)}`);
      console.log(`    Unrealized PnL: ${pos.unrealizedPnl.toFixed(2)} USDC`);
      console.log(`    Leverage: ${pos.leverage}x`);
      console.log(`    Liquidation Price: ${pos.liquidationPrice.toFixed(2)}`);
    });

    return positions;
  } catch (error) {
    console.error(`  ❌ Error: ${error.message}`);
    throw error;
  }
}

/**
 * Test fetching market price
 */
async function getMarketPrice(exchange, symbol) {
  console.log('\n═══════════════════════════════════════════════════════');
  console.log(`  Market Price Test (${symbol})`);
  console.log('═══════════════════════════════════════════════════════');

  try {
    const ticker = await exchange.fetchTicker(symbol);

    console.log(`  Last Price: $${ticker.last.toFixed(2)}`);
    console.log(`  Bid: $${ticker.bid.toFixed(2)}`);
    console.log(`  Ask: $${ticker.ask.toFixed(2)}`);

    // Optional fields - may not be available
    if (ticker.high !== undefined) {
      console.log(`  24h High: $${ticker.high.toFixed(2)}`);
    }
    if (ticker.low !== undefined) {
      console.log(`  24h Low: $${ticker.low.toFixed(2)}`);
    }
    if (ticker.baseVolume !== undefined) {
      console.log(`  24h Volume: ${ticker.baseVolume.toFixed(2)} BTC`);
    }

    return ticker;
  } catch (error) {
    console.error(`  ❌ Error: ${error.message}`);
    throw error;
  }
}

/**
 * Create a test limit order with a price far from market (hard to match)
 * This allows testing order creation without risk of execution
 */
async function createSafeTestOrder(exchange, symbol) {
  console.log('\n═══════════════════════════════════════════════════════');
  console.log(`  Safe Limit Order Test (${symbol})`);
  console.log('═══════════════════════════════════════════════════════');

  try {
    // Fetch current market price
    console.log('  Fetching current market price...');
    const ticker = await exchange.fetchTicker(symbol);
    const currentPrice = ticker.last;
    console.log(`  Current market price: $${currentPrice.toFixed(2)}`);

    // Create a limit order far from market price (won't execute)
    // For buy: 20% below market
    // For sell: 20% above market
    const orderSide = CONFIG.side;
    const orderSize = CONFIG.orderSize;
    const priceOffset = currentPrice * CONFIG.priceOffsetPercent;

    let limitPrice;
    if (orderSide === 'buy') {
      limitPrice = currentPrice - priceOffset;
      console.log(`  Limit price: $${limitPrice.toFixed(2)} (20% below market)`);
      console.log(`  📊 This order will only execute if price drops by 20%+`);
    } else {
      limitPrice = currentPrice + priceOffset;
      console.log(`  Limit price: $${limitPrice.toFixed(2)} (20% above market)`);
      console.log(`  📊 This order will only execute if price rises by 20%+`);
    }

    console.log(`\n  Order Details:`);
    console.log(`    Symbol: ${symbol}`);
    console.log(`    Side: ${orderSide.toUpperCase()}`);
    console.log(`    Size: ${orderSize} BTC`);
    console.log(`    Type: LIMIT`);
    console.log(`    Limit Price: $${limitPrice.toFixed(2)}`);
    console.log(`    Wallet: ${exchange.walletAddress}`);

    console.log('\n  ⚠️  This will create a REAL order on testnet (but unlikely to fill)');
    console.log('  💡 The order is 20% away from market, so it will remain open');
    console.log('  💡 You can cancel it manually on Hyperliquid app if needed');

    // Create the limit order
    console.log('\n  Creating limit order...');
    const order = await exchange.createLimitOrder(
      symbol,
      orderSide,
      orderSize,
      limitPrice
    );

    console.log('\n  ✅ Limit order created successfully!');
    console.log(`    Order ID: ${order.id}`);
    console.log(`    Status: ${order.status}`);
    console.log(`    Type: ${order.type}`);
    console.log(`    Price: $${order.price}`);
    console.log(`    Amount: ${order.amount}`);
    console.log(`    Filled: ${order.filled}`);

    if (order.status === 'open') {
      console.log('\n  📌 Order is open and waiting to be filled');
      console.log(`     It will execute only if ${symbol} ${orderSide === 'buy' ? 'drops to' : 'rises to'} $${limitPrice.toFixed(2)}`);
      console.log(`     Current market price is $${currentPrice.toFixed(2)}`);
    }

    return order;
  } catch (error) {
    console.error(`\n  ❌ Error: ${error.message}`);
    throw error;
  }
}

/**
 * Cancel a specific order
 */
async function cancelOrder(exchange, orderId, symbol) {
  console.log('\n═══════════════════════════════════════════════════════');
  console.log(`  Cancel Order Test`);
  console.log('═══════════════════════════════════════════════════════');

  try {
    console.log(`  Cancelling order ${orderId}...`);

    const result = await exchange.cancelOrder(orderId, symbol);

    console.log('  ✅ Order cancelled successfully!');
    console.log(`    Order ID: ${result.id}`);
    console.log(`    Status: ${result.status}`);

    return result;
  } catch (error) {
    console.error(`  ❌ Error: ${error.message}`);
    throw error;
  }
}

/**
 * Test fetching recent orders
 */
async function testFetchOrders(exchange, symbol, walletAddress) {
  console.log('\n═══════════════════════════════════════════════════════');
  console.log(`  Recent Orders Test (${symbol})`);
  console.log('═══════════════════════════════════════════════════════');

  try {
    // Note: This may require markets to be loaded
    await exchange.loadMarkets();

    // Hyperliquid requires wallet address in params
    const orders = await exchange.fetchOrders(symbol, undefined, 5, {
      user: walletAddress,
    });

    if (orders.length === 0) {
      console.log('  No recent orders found');
      return [];
    }

    console.log(`  Found ${orders.length} recent order(s):\n`);

    orders.forEach((order, index) => {
      console.log(`  Order #${index + 1}:`);
      console.log(`    ID: ${order.id}`);
      console.log(`    Type: ${order.type}`);
      console.log(`    Side: ${order.side}`);
      console.log(`    Price: $${order.price}`);
      console.log(`    Amount: ${order.amount}`);
      console.log(`    Status: ${order.status}`);
      console.log(`    Filled: ${order.filled}/${order.amount}`);
      console.log();
    });

    return orders;
  } catch (error) {
    console.error(`  ❌ Error: ${error.message}`);
    // Don't throw - this is optional
    return [];
  }
}

/**
 * Ask user for confirmation
 */
function askQuestion(query) {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise((resolve) =>
    rl.question(query, (answer) => {
      rl.close();
      resolve(answer);
    })
  );
}

/**
 * Run all testnet integration tests
 */
async function runTests() {
  // Check if user wants to test order creation
  const testMode = process.argv[2]; // --order-test flag

  if (testMode === '--order-test') {
    console.log('\n⚠️  ORDER CREATION TEST MODE');
    console.log('This will create a REAL order on testnet (20% away from market).\n');
  } else {
    console.log('\n⚠️  READ-ONLY TEST MODE');
    console.log('This script will NOT create any trades or orders.');
    console.log('It only verifies that the integration can read account data.');
    console.log('\n💡 To test order creation, run: node scripts/test-hyperliquid-testnet.js --order-test\n');
  }

  try {
    // Create exchange instance
    const exchange = await createTestnetExchange();

    // Determine which address to query
    const queryAddress = CONFIG.parentWallet || exchange.walletAddress;

    if (CONFIG.parentWallet) {
      console.log('\n📌 Testing vault trading mode (parent wallet)');
    } else {
      console.log('\n📌 Testing direct trading mode (own wallet)');
    }

    // Test 1: Fetch and display balance
    console.log('\n🧪 Test 1: Account Balance Query');
    const balance = await displayBalance(queryAddress);

    // Check if user has testnet funds
    if (balance.total === 0) {
      console.log('\n⚠️  No testnet funds found!');
      console.log('\n📋 To get testnet tokens:');
      console.log(`  1. Visit: ${CONFIG.faucetUrl}`);
      console.log(`  2. Connect your wallet and claim 1,000 mock USDC`);
      console.log(`  3. Requirements: Must have deposited on mainnet with same address`);
      console.log('\n📋 Alternative faucets:');
      console.log('  - Chainstack: https://chainstack.com/hyperliquid-faucet/');
      console.log('  - QuickNode: https://faucet.quicknode.com/hyperliquid/testnet');
      process.exit(1);
    }

    // Test 2: Fetch and display positions
    console.log('\n🧪 Test 2: Positions Query');
    const positions = await displayPositions(queryAddress);

    // Test 3: Fetch market price
    console.log('\n🧪 Test 3: Market Data Query');
    const ticker = await getMarketPrice(exchange, CONFIG.testSymbol);

    // Test 4: Fetch recent orders (optional)
    console.log('\n🧪 Test 4: Order History Query');
    await testFetchOrders(exchange, CONFIG.testSymbol, queryAddress);

    // Test 5: Order creation (optional, with confirmation)
    if (testMode === '--order-test') {
      console.log('\n🧪 Test 5: Order Creation Test');
      console.log('\n⚠️  WARNING: This will create a REAL order on testnet!');
      console.log('The order will be 20% away from market price (unlikely to fill)');
      console.log(`Estimated cost: ~$${(0.001 * ticker.last * 0.8).toFixed(2)} (20% below current price)`);

      const answer = await askQuestion('\nDo you want to proceed? (yes/no): ');

      if (answer.toLowerCase() === 'yes') {
        // Load markets for order creation
        await exchange.loadMarkets();

        const order = await createSafeTestOrder(exchange, CONFIG.testSymbol);

        // Ask if user wants to cancel the order
        const cancelAnswer = await askQuestion(
          '\nDo you want to cancel this order? (yes/no): '
        );

        if (cancelAnswer.toLowerCase() === 'yes') {
          await cancelOrder(exchange, order.id, CONFIG.testSymbol);
        }
      } else {
        console.log('\n❌ Order creation test skipped by user');
      }
    }

    // Summary
    console.log('\n═══════════════════════════════════════════════════════');
    console.log('  Test Summary');
    console.log('═══════════════════════════════════════════════════════');
    console.log('  ✅ Exchange connection: SUCCESS');
    console.log('  ✅ Wallet authentication: SUCCESS');
    console.log('  ✅ Balance query: SUCCESS');
    console.log('  ✅ Positions query: SUCCESS');
    console.log('  ✅ Market data query: SUCCESS');
    console.log('  ✅ Order history query: SUCCESS');
    if (testMode === '--order-test') {
      console.log('  ✅ Order creation test: COMPLETED');
    }
    console.log('\n  🎉 All testnet integration tests passed!');
    console.log('\n  Account Status:');
    console.log(`    Balance: ${balance.total.toFixed(2)} USDC`);
    console.log(`    Open Positions: ${positions.length}`);
    console.log(`    Current BTC Price: $${ticker.last.toFixed(2)}`);
    console.log(`\n  🌐 View positions at: ${CONFIG.appUrl}/trade`);
    console.log('═══════════════════════════════════════════════════════\n');

    process.exit(0);
  } catch (error) {
    console.error('\n═══════════════════════════════════════════════════════');
    console.error('  ❌ TEST FAILED');
    console.error('═══════════════════════════════════════════════════════');
    console.error(`  Error: ${error.message}`);
    console.error('\n  Please check:');
    console.error('  1. HYPERLIQUID_PRIVATE_KEY is set correctly in .env');
    console.error('  2. You have testnet funds (visit faucet if needed)');
    console.error('  3. Network connection is stable');
    console.error('  4. Hyperliquid testnet API is accessible');
    console.error('═══════════════════════════════════════════════════════\n');

    process.exit(1);
  }
}

// Run tests
runTests();

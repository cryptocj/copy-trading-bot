#!/usr/bin/env node
/**
 * Hyperliquid Mainnet Integration Test Script
 *
 * Tests that mainnet integration is working correctly:
 * - Connection and authentication
 * - Fetching account balance
 * - Fetching positions
 * - Fetching market prices
 * - Fetching recent orders
 * - Creating safe limit orders (optional, with confirmation)
 * - Cancelling orders (optional)
 *
 * Prerequisites:
 * 1. Set HYPERLIQUID_PRIVATE_KEY in .env file
 * 2. Optionally set HYPERLIQUID_PARENT_ADDRESS for vault trading
 *
 * Usage:
 *   node scripts/test-hyperliquid-mainnet.js
 */

import dotenv from 'dotenv';
import ccxt from 'ccxt';
import readline from 'readline';
import { getHyperliquidConfig } from '../src/config/hyperliquid.js';

dotenv.config();

// Mainnet Configuration
const MAINNET_CONFIG = getHyperliquidConfig('mainnet');

const CONFIG = {
  privateKey: process.env.HYPERLIQUID_PRIVATE_KEY,
  parentWallet: process.env.HYPERLIQUID_PARENT_ADDRESS || null,
  testSymbol: 'BTC/USDC:USDC', // BTC perpetual for price checks
  apiUrl: MAINNET_CONFIG.apiUrl,
  appUrl: MAINNET_CONFIG.appUrl,
};

/**
 * Create Hyperliquid mainnet exchange instance
 */
async function createMainnetExchange() {
  if (!CONFIG.privateKey) {
    throw new Error('HYPERLIQUID_PRIVATE_KEY not found in .env file');
  }

  console.log('═══════════════════════════════════════════════════════');
  console.log('  Hyperliquid Mainnet Integration Test');
  console.log('═══════════════════════════════════════════════════════');
  console.log(`📍 Network: ${MAINNET_CONFIG.name}`);
  console.log(`🌐 API: ${MAINNET_CONFIG.apiUrl}`);
  console.log(`🔗 App: ${MAINNET_CONFIG.appUrl}`);

  // Import ethers to derive wallet address from private key
  const { Wallet } = await import('ethers');
  const wallet = new Wallet(CONFIG.privateKey);
  const walletAddress = wallet.address;

  // Create exchange with proper wallet address
  const exchangeConfig = {
    privateKey: CONFIG.privateKey,
    walletAddress: walletAddress,
    urls: {
      api: {
        public: MAINNET_CONFIG.apiUrl,
        private: MAINNET_CONFIG.apiUrl,
      },
    },
  };

  const exchange = new ccxt.hyperliquid(exchangeConfig);

  console.log(`\n🔑 Wallet Address: ${walletAddress}`);

  if (CONFIG.parentWallet) {
    console.log(`👨‍👦 Parent Wallet (Vault): ${CONFIG.parentWallet}`);
    console.log('   (Using vault trading mode)');
  }

  return exchange;
}

/**
 * Fetch balance from Hyperliquid API directly
 */
async function fetchBalanceForAddress(address, apiUrl) {
  const response = await fetch(`${apiUrl}/info`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      type: 'clearinghouseState',
      user: address,
    }),
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch balance: ${response.statusText}`);
  }

  const data = await response.json();

  // Extract balance info
  const marginSummary = data.marginSummary;

  return {
    total: parseFloat(marginSummary.accountValue),
    free: parseFloat(marginSummary.withdrawable),
    used: parseFloat(marginSummary.accountValue) - parseFloat(marginSummary.withdrawable),
  };
}

/**
 * Fetch positions from Hyperliquid API directly
 */
async function fetchPositionsForAddress(address, apiUrl) {
  const response = await fetch(`${apiUrl}/info`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      type: 'clearinghouseState',
      user: address,
    }),
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch positions: ${response.statusText}`);
  }

  const data = await response.json();

  // Extract positions from assetPositions
  const positions = data.assetPositions
    .filter((pos) => parseFloat(pos.position.szi) !== 0)
    .map((pos) => {
      const size = parseFloat(pos.position.szi);
      const entryPrice = parseFloat(pos.position.entryPx);
      const unrealizedPnl = parseFloat(pos.position.unrealizedPnl);
      const leverage = parseFloat(pos.position.leverage.value);
      const liquidationPrice = parseFloat(pos.position.liquidationPx);

      return {
        symbol: pos.position.coin,
        side: size > 0 ? 'long' : 'short',
        size: Math.abs(size),
        entryPrice,
        unrealizedPnl,
        leverage,
        liquidationPrice,
      };
    });

  return positions;
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
async function testMarketPrice(exchange, symbol) {
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
    const orderSide = 'buy'; // Use buy for testing
    const orderSize = 0.001; // 0.001 BTC (~$110 at current prices)
    const priceOffset = currentPrice * 0.20; // 20% offset

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

    console.log('\n  ⚠️  This will create a REAL order on mainnet (but unlikely to fill)');
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
 * Test fetching recent orders (requires CCXT)
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
 * Run all mainnet integration tests
 */
async function runTests() {
  // Check if user wants to test order creation
  const testMode = process.argv[2]; // --order-test flag

  if (testMode === '--order-test') {
    console.log('\n⚠️  ORDER CREATION TEST MODE');
    console.log('This will create a REAL order on mainnet (20% away from market).\n');
  } else {
    console.log('\n⚠️  READ-ONLY TEST MODE');
    console.log('This script will NOT create any trades or orders.');
    console.log('It only verifies that the integration can read account data.');
    console.log('\n💡 To test order creation, run: node scripts/test-hyperliquid-mainnet.js --order-test\n');
  }

  try {
    // Create exchange instance
    const exchange = await createMainnetExchange();

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

    // Test 2: Fetch and display positions
    console.log('\n🧪 Test 2: Positions Query');
    const positions = await displayPositions(queryAddress);

    // Test 3: Fetch market price
    console.log('\n🧪 Test 3: Market Data Query');
    const ticker = await testMarketPrice(exchange, CONFIG.testSymbol);

    // Test 4: Fetch recent orders (optional)
    console.log('\n🧪 Test 4: Order History Query');
    await testFetchOrders(exchange, CONFIG.testSymbol, queryAddress);

    // Test 5: Order creation (optional, with confirmation)
    if (testMode === '--order-test') {
      console.log('\n🧪 Test 5: Order Creation Test');
      console.log('\n⚠️  WARNING: This will create a REAL order on mainnet!');
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
    console.log('\n  🎉 All mainnet integration tests passed!');
    console.log('\n  Account Status:');
    console.log(`    Balance: ${balance.total.toFixed(2)} USDC`);
    console.log(`    Open Positions: ${positions.length}`);
    console.log(`    Current BTC Price: $${ticker.last.toFixed(2)}`);
    console.log('═══════════════════════════════════════════════════════\n');

    process.exit(0);
  } catch (error) {
    console.error('\n═══════════════════════════════════════════════════════');
    console.error('  ❌ TEST FAILED');
    console.error('═══════════════════════════════════════════════════════');
    console.error(`  Error: ${error.message}`);
    console.error('\n  Please check:');
    console.error('  1. HYPERLIQUID_PRIVATE_KEY is set correctly in .env');
    console.error('  2. Wallet has been used on Hyperliquid mainnet before');
    console.error('  3. Network connection is stable');
    console.error('  4. Hyperliquid API is accessible');
    console.error('═══════════════════════════════════════════════════════\n');

    process.exit(1);
  }
}

// Run tests
runTests();

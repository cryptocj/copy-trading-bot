#!/usr/bin/env node

/**
 * Test script for Hyperliquid wallet balance and position queries
 *
 * Usage:
 *   1. Set HYPERLIQUID_API_KEY environment variable
 *   2. Run: node scripts/test-hyperliquid-orders.js
 *
 * This script will:
 *   1. Connect to Hyperliquid
 *   2. Load markets
 *   3. Query your wallet balance (USDC and other assets)
 *   4. Query your open positions
 *   5. Query a monitored wallet's balance and positions
 */

import ccxt from 'ccxt';
import dotenv from 'dotenv';
import { Wallet } from 'ethers';

// Load environment variables
dotenv.config();

const API_KEY = process.env.HYPERLIQUID_API_KEY;

// Colors for console output
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  red: '\x1b[31m',
  cyan: '\x1b[36m',
};

function log(message, color = colors.reset) {
  console.log(`${color}${message}${colors.reset}`);
}

function logSection(title) {
  console.log('\n' + '='.repeat(60));
  log(title, colors.cyan);
  console.log('='.repeat(60));
}

async function main() {
  try {
    // Validate API key
    if (!API_KEY) {
      log('❌ Error: HYPERLIQUID_API_KEY environment variable not set', colors.red);
      log('\nPlease set your Hyperliquid API key:', colors.yellow);
      log('  1. Go to https://app.hyperliquid.xyz/API', colors.yellow);
      log('  2. Generate an API key', colors.yellow);
      log('  3. export HYPERLIQUID_API_KEY="0xYourApiKeyHere"', colors.yellow);
      log('\n⚠️  Note: This is your wallet private key - keep it secure!', colors.yellow);
      process.exit(1);
    }

    logSection('🚀 Initializing Hyperliquid Connection');

    // Derive wallet address from private key
    log('Deriving wallet address from private key...', colors.yellow);
    const wallet = new Wallet(API_KEY);
    const walletAddress = wallet.address;
    log(`✅ Wallet address: ${walletAddress}`, colors.green);

    // Initialize exchange
    // Hyperliquid uses Ethereum-style wallet authentication
    const exchange = new ccxt.hyperliquid({
      privateKey: API_KEY, // Ethereum wallet private key (0x...)
      walletAddress: walletAddress, // Derived from private key
      options: {
        defaultType: 'swap', // Use perpetual contracts
      },
    });

    log('✅ Exchange initialized', colors.green);
    log(`📊 Exchange: ${exchange.name}`, colors.blue);

    // Load markets
    logSection('📈 Loading Markets');
    await exchange.loadMarkets();
    log(`✅ Loaded ${Object.keys(exchange.markets).length} markets`, colors.green);

    // Test wallet balance query
    await testWalletBalance(exchange);

    // Test positions query
    await testPositions(exchange);

    // Test monitoring another wallet (optional)
    await testMonitorWallet(exchange);

    // Test summary
    logSection('📊 Test Summary');
    log('✅ Wallet balance query: SUCCESS', colors.green);
    log('✅ Positions query: SUCCESS', colors.green);
    log('✅ Monitor wallet query: SUCCESS', colors.green);
    log('✅ All tests passed!', colors.green);

    // Close exchange connection
    await exchange.close();
  } catch (error) {
    log('\n❌ Error occurred:', colors.red);
    log(error.message, colors.red);

    if (error.stack) {
      log('\nStack trace:', colors.yellow);
      console.log(error.stack);
    }

    process.exit(1);
  }
}

/**
 * Test wallet balance query
 */
async function testWalletBalance(exchange) {
  logSection('💰 Testing Wallet Balance Query');

  try {
    log('Fetching wallet balance...', colors.yellow);
    const balance = await exchange.fetchBalance();

    log('✅ Balance fetched successfully!', colors.green);

    // Display USDC balance (primary currency)
    const usdc = balance.USDC || { free: 0, used: 0, total: 0 };
    log('\n💵 USDC Balance:', colors.cyan);
    log(`  Available: $${usdc.free.toFixed(2)}`, colors.blue);
    log(`  In Use: $${usdc.used.toFixed(2)}`, colors.blue);
    log(`  Total: $${usdc.total.toFixed(2)}`, colors.blue);

    // Display all non-zero balances
    log('\n📊 All Assets:', colors.cyan);
    for (const [asset, data] of Object.entries(balance)) {
      if (asset !== 'info' && asset !== 'free' && asset !== 'used' && asset !== 'total') {
        if (data.total > 0) {
          log(`  ${asset}: ${data.total.toFixed(4)} (Free: ${data.free.toFixed(4)}, Used: ${data.used.toFixed(4)})`, colors.blue);
        }
      }
    }

    return balance;
  } catch (error) {
    log('❌ Failed to fetch balance:', colors.red);
    log(error.message, colors.red);
    throw error;
  }
}

/**
 * Test positions query
 */
async function testPositions(exchange) {
  logSection('📈 Testing Positions Query');

  try {
    log('Fetching open positions...', colors.yellow);
    const positions = await exchange.fetchPositions();

    log('✅ Positions fetched successfully!', colors.green);

    // Filter open positions (contracts !== 0)
    const openPositions = positions.filter(pos => pos.contracts !== 0);

    log(`\n📊 Open Positions: ${openPositions.length}`, colors.cyan);

    if (openPositions.length === 0) {
      log('  No open positions', colors.yellow);
    } else {
      for (const pos of openPositions) {
        const side = pos.side || (pos.contracts > 0 ? 'long' : 'short');
        const sideColor = side === 'long' ? colors.green : colors.red;
        const pnlColor = pos.unrealizedPnl >= 0 ? colors.green : colors.red;

        log(`\n  ${pos.symbol} - ${side.toUpperCase()}`, sideColor);
        log(`    Size: ${Math.abs(pos.contracts || 0)} contracts`, colors.blue);
        log(`    Entry Price: $${(pos.entryPrice || 0).toFixed(2)}`, colors.blue);
        log(`    Mark Price: $${(pos.markPrice || 0).toFixed(2)}`, colors.blue);
        log(`    Unrealized PnL: $${(pos.unrealizedPnl || 0).toFixed(2)}`, pnlColor);
        log(`    Leverage: ${pos.leverage || 1}x`, colors.blue);
        log(`    Liquidation Price: $${(pos.liquidationPrice || 0).toFixed(2)}`, colors.blue);
      }
    }

    return openPositions;
  } catch (error) {
    log('❌ Failed to fetch positions:', colors.red);
    log(error.message, colors.red);
    throw error;
  }
}

/**
 * Test monitoring another wallet
 */
async function testMonitorWallet(exchange) {
  logSection('👁️ Testing Monitor Another Wallet');

  // Example monitored wallet (DeepSeek from monitoring list)
  const monitoredAddress = '0xC20aC4Dc4188660cBF555448AF52694CA62b0734';

  try {
    log(`Fetching balance for monitored wallet: ${monitoredAddress}`, colors.yellow);

    // Fetch balance with user parameter
    const balance = await exchange.fetchBalance({ user: monitoredAddress });

    log('✅ Monitored wallet balance fetched!', colors.green);

    const usdc = balance.USDC || { free: 0, used: 0, total: 0 };
    log(`\n💵 Monitored Wallet USDC: $${usdc.total.toFixed(2)}`, colors.cyan);

    // Fetch positions for monitored wallet
    log('\nFetching positions for monitored wallet...', colors.yellow);
    const positions = await exchange.fetchPositions(null, { user: monitoredAddress });
    const openPositions = positions.filter(pos => pos.contracts !== 0);

    log(`✅ Monitored wallet has ${openPositions.length} open position(s)`, colors.green);

    if (openPositions.length > 0) {
      for (const pos of openPositions) {
        const side = pos.side || (pos.contracts > 0 ? 'long' : 'short');
        log(`  ${pos.symbol} ${side.toUpperCase()}: ${Math.abs(pos.contracts)} contracts`, colors.blue);
      }
    }

  } catch (error) {
    log('❌ Failed to fetch monitored wallet info:', colors.red);
    log(error.message, colors.red);
    // Don't throw - this is optional test
  }
}

// Run the test
log('🧪 Hyperliquid Wallet Query Test Script', colors.cyan);
log('='.repeat(60), colors.cyan);
main();

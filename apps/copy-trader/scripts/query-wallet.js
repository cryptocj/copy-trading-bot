#!/usr/bin/env node

/**
 * Query wallet balance and positions for any Hyperliquid address
 *
 * Usage:
 *   1. Set HYPERLIQUID_API_KEY environment variable (your key to authenticate)
 *   2. Run: node scripts/query-wallet.js [address]
 *
 * Example:
 *   node scripts/query-wallet.js 0xC20aC4Dc4188660cBF555448AF52694CA62b0734
 */

import ccxt from 'ccxt';
import dotenv from 'dotenv';
import { Wallet } from 'ethers';

// Load environment variables
dotenv.config();

const API_KEY = process.env.HYPERLIQUID_API_KEY;

// Get wallet address from command line or use default (DeepSeek)
const QUERY_ADDRESS = process.argv[2] || '0xC20aC4Dc4188660cBF555448AF52694CA62b0734';

// Hyperliquid API endpoint
const HYPERLIQUID_API_URL = 'https://api.hyperliquid.xyz/info';

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

/**
 * Fetch positions directly from Hyperliquid API
 */
async function fetchPositionsDirectAPI(userAddress) {
  const response = await fetch(HYPERLIQUID_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      type: 'clearinghouseState',
      user: userAddress,
    }),
  });

  if (!response.ok) {
    throw new Error(`Hyperliquid API error: ${response.status} ${response.statusText}`);
  }

  const data = await response.json();

  // Extract and format positions
  const assetPositions = data.assetPositions || [];

  return assetPositions
    .filter(pos => parseFloat(pos.position.szi) !== 0) // Filter open positions
    .map(pos => {
      const szi = parseFloat(pos.position.szi);
      const isLong = szi > 0;

      return {
        symbol: `${pos.position.coin}/USDC:USDC`,
        side: isLong ? 'long' : 'short',
        size: Math.abs(szi),
        entryPrice: parseFloat(pos.position.entryPx || 0),
        markPrice: parseFloat(pos.position.positionValue || 0) / Math.abs(szi),
        unrealizedPnl: parseFloat(pos.position.unrealizedPnl || 0),
        leverage: parseFloat(pos.position.leverage?.value || 1),
        liquidationPrice: parseFloat(pos.position.liquidationPx || 0),
      };
    });
}

async function main() {
  try {
    // Validate API key
    if (!API_KEY) {
      log('❌ Error: HYPERLIQUID_API_KEY environment variable not set', colors.red);
      log('\nYou need an API key to authenticate with Hyperliquid:', colors.yellow);
      log('  1. Go to https://app.hyperliquid.xyz/API', colors.yellow);
      log('  2. Generate an API key', colors.yellow);
      log('  3. export HYPERLIQUID_API_KEY="0xYourApiKeyHere"', colors.yellow);
      log('\n⚠️  Note: You can query ANY wallet, but need YOUR key to authenticate', colors.yellow);
      process.exit(1);
    }

    logSection('🔍 Querying Hyperliquid Wallet');
    log(`Target Address: ${QUERY_ADDRESS}`, colors.cyan);

    // Derive your wallet address from private key (for authentication)
    const wallet = new Wallet(API_KEY);
    const yourWalletAddress = wallet.address;
    log(`Your Address: ${yourWalletAddress}`, colors.blue);

    // Initialize exchange
    log('\nInitializing connection...', colors.yellow);
    const exchange = new ccxt.hyperliquid({
      privateKey: API_KEY,
      walletAddress: yourWalletAddress,
    });

    // Load markets
    log('Loading markets...', colors.yellow);
    await exchange.loadMarkets();
    log(`✅ Connected (${Object.keys(exchange.markets).length} markets loaded)`, colors.green);

    // Query balance
    logSection('💰 Wallet Balance');
    try {
      const balance = await exchange.fetchBalance({ user: QUERY_ADDRESS });

      // Collect all assets with non-zero balances
      const assets = [];
      for (const [asset, data] of Object.entries(balance)) {
        if (asset !== 'info' && asset !== 'free' && asset !== 'used' && asset !== 'total') {
          if (data.total > 0) {
            assets.push({
              Asset: asset,
              Available: `$${data.free.toFixed(2)}`,
              'In Use': `$${data.used.toFixed(2)}`,
              Total: `$${data.total.toFixed(2)}`
            });
          }
        }
      }

      if (assets.length === 0) {
        log('No assets found', colors.yellow);
      } else {
        console.table(assets);
      }
    } catch (error) {
      log(`❌ Failed to fetch balance: ${error.message}`, colors.red);
    }

    // Query positions
    logSection('📈 Open Positions');
    try {
      log('Fetching positions via Hyperliquid API...', colors.yellow);
      const openPositions = await fetchPositionsDirectAPI(QUERY_ADDRESS);

      if (openPositions.length === 0) {
        log('No open positions', colors.yellow);
      } else {
        log(`Found ${openPositions.length} open position(s):\n`, colors.green);

        // Prepare table data
        const tableData = openPositions.map(pos => {
          const posValue = pos.size * pos.markPrice;
          return {
            Symbol: pos.symbol.replace('/USDC:USDC', ''),
            Side: pos.side.toUpperCase(),
            Size: pos.size.toFixed(4),
            'Entry Price': `$${pos.entryPrice.toFixed(2)}`,
            'Mark Price': `$${pos.markPrice.toFixed(2)}`,
            'Position Value': `$${posValue.toFixed(2)}`,
            'Unrealized PnL': `$${pos.unrealizedPnl.toFixed(2)}`,
            Leverage: `${pos.leverage}x`,
            'Liquidation': `$${pos.liquidationPrice.toFixed(2)}`
          };
        });

        // Display table
        console.table(tableData);

        // Calculate and display summary
        const totalPositionValue = openPositions.reduce((sum, pos) => sum + (pos.size * pos.markPrice), 0);
        const totalUnrealizedPnl = openPositions.reduce((sum, pos) => sum + pos.unrealizedPnl, 0);

        log('\nSummary:', colors.cyan);
        log(`  Total Position Value: $${totalPositionValue.toFixed(2)}`, colors.blue);
        const pnlColor = totalUnrealizedPnl >= 0 ? colors.green : colors.red;
        const pnlSign = totalUnrealizedPnl >= 0 ? '+' : '';
        log(`  Total Unrealized PnL: ${pnlSign}$${totalUnrealizedPnl.toFixed(2)}`, pnlColor);
      }
    } catch (error) {
      log(`❌ Failed to fetch positions: ${error.message}`, colors.red);
      log(`Error details: ${error.constructor.name}`, colors.yellow);
      if (error.stack) {
        log('Stack trace:', colors.yellow);
        console.log(error.stack);
      }
    }

    // Close connection
    await exchange.close();

    logSection('✅ Query Complete');
    log(`Successfully queried wallet: ${QUERY_ADDRESS}`, colors.green);

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

// Run the query
log('🔍 Hyperliquid Wallet Query Tool', colors.cyan);
log('='.repeat(60), colors.cyan);
main();

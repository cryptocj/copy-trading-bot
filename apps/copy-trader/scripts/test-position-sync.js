#!/usr/bin/env node
/**
 * Test Position Synchronization
 *
 * Tests the position syncer service that periodically syncs positions.
 * This approach is more reliable than trade-by-trade copying.
 *
 * Usage:
 *   node scripts/test-position-sync.js [options]
 *
 * Options:
 *   --execute         Execute actual trades (default: dry-run only)
 *   --moonlander      Use Moonlander for execution (default: testnet)
 *   --mainnet         Use Moonlander mainnet (requires --moonlander)
 *
 * Environment Variables:
 *   HYPERLIQUID_PRIVATE_KEY - Your trading private key
 *   TRADER_WALLET_ADDRESS - Wallet to copy from
 *   COPY_BALANCE - Balance to use for copying (e.g., 100 = $100)
 *   SYNC_INTERVAL - Sync interval in seconds (default: 30)
 */

import dotenv from 'dotenv';
import ccxt from 'ccxt';
import { createPositionSyncer } from '../src/services/positionSyncer.js';
import { getHyperliquidConfig } from '../src/config/hyperliquid.js';
import { createMoonlanderExchange } from '../src/services/moonlander.js';
import { getMoonlanderConfig } from '../src/config/moonlander.js';
import {
  calculatePositionDiff,
  formatPositionActions,
  getDirection,
} from '../src/utils/positionDiff.js';

dotenv.config();

// Parse command line arguments
const args = process.argv.slice(2);
const executeMode = args.includes('--execute');
const useMoonlander = args.includes('--moonlander');
const useMainnet = args.includes('--mainnet');

// Configuration
const CONFIG = {
  hyperliquidPrivateKey: process.env.HYPERLIQUID_PRIVATE_KEY,
  moonlanderPrivateKey: process.env.MOONLANDER_PRIVATE_KEY,
  traderAddress: process.env.TRADER_WALLET_ADDRESS || process.env.HYPERLIQUID_PARENT_ADDRESS,
  copyBalance: parseFloat(process.env.COPY_BALANCE || '100'), // $100 default
  syncInterval: parseInt(process.env.SYNC_INTERVAL || '30') * 1000, // 30s default
  monitorNetwork: 'mainnet', // Always monitor Hyperliquid mainnet
  executeNetwork: useMoonlander ? (useMainnet ? 'mainnet' : 'testnet') : 'mainnet',
  dryRun: !executeMode, // Dry-run by default unless --execute flag
  useMoonlander,
};

// State
let monitorExchange = null;
let executeExchange = null;
let syncer = null;
let lastTraderPositions = null; // Track previous trader positions

/**
 * Create exchanges
 */
async function createExchanges() {
  console.log('📦 Setting up exchanges...\n');

  // Get network configs
  const monitorConfig = getHyperliquidConfig(CONFIG.monitorNetwork);

  // Derive wallet address
  const { Wallet } = await import('ethers');
  const wallet = new Wallet(CONFIG.hyperliquidPrivateKey);
  const walletAddress = wallet.address;

  console.log(`  Hyperliquid Wallet: ${walletAddress}`);
  console.log(`  Trader Wallet: ${CONFIG.traderAddress}`);
  console.log(`  Copy Balance: $${CONFIG.copyBalance}`);
  console.log(`  Monitor Network: ${monitorConfig.name}`);
  console.log(`  Mode: ${CONFIG.dryRun ? 'DRY RUN (no actual trades)' : 'LIVE EXECUTION'}`);

  // Create monitor exchange (for fetching trader positions - always Hyperliquid)
  console.log('\n📡 Creating monitor exchange (Hyperliquid)...');
  monitorExchange = new ccxt.hyperliquid({
    privateKey: CONFIG.hyperliquidPrivateKey,
    walletAddress,
    urls: {
      api: {
        public: monitorConfig.apiUrl,
        private: monitorConfig.apiUrl,
      },
    },
  });
  console.log('   ✅ Monitor exchange ready');

  // Create execute exchange
  if (CONFIG.useMoonlander) {
    console.log(`\n🌙 Creating Moonlander exchange (${CONFIG.executeNetwork})...`);
    const moonlanderConfig = getMoonlanderConfig(CONFIG.executeNetwork);

    executeExchange = createMoonlanderExchange({
      privateKey: CONFIG.moonlanderPrivateKey,
      ...moonlanderConfig,
    });

    console.log(`   ✅ Moonlander exchange ready`);
    console.log(`   Network: ${moonlanderConfig.name}`);
    console.log(`   Wallet: ${executeExchange.walletAddress}`);
  } else {
    console.log('\n💱 Creating execute exchange (Hyperliquid)...');
    const executeConfig = getHyperliquidConfig(CONFIG.executeNetwork);

    executeExchange = new ccxt.hyperliquid({
      privateKey: CONFIG.hyperliquidPrivateKey,
      walletAddress,
      urls: {
        api: {
          public: executeConfig.apiUrl,
          private: executeConfig.apiUrl,
        },
      },
    });

    // Load markets
    // console.log('📚 Loading markets...');
    // await executeExchange.loadMarkets();
    // console.log(`   ✅ Loaded ${Object.keys(executeExchange.markets).length} markets`);
  }

  console.log('');
}

// ANSI colors for output
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m',
  red: '\x1b[31m',
};

/**
 * Detect changes in trader positions
 */
function detectTraderChanges(current, previous) {
  if (!previous) {
    return { hasChanges: true, message: 'First sync - no previous data' };
  }

  const changes = calculatePositionDiff(previous, current);

  if (
    changes.toAdd.length === 0 &&
    changes.toRemove.length === 0 &&
    changes.toFlip.length === 0 &&
    changes.toAdjust.length === 0
  ) {
    return { hasChanges: false, message: 'No changes detected' };
  }

  const messages = [];
  if (changes.toAdd.length > 0) {
    messages.push(`${changes.toAdd.length} new position(s)`);
  }
  if (changes.toRemove.length > 0) {
    messages.push(`${changes.toRemove.length} closed position(s)`);
  }
  if (changes.toFlip.length > 0) {
    messages.push(`${changes.toFlip.length} flipped position(s)`);
  }
  if (changes.toAdjust.length > 0) {
    messages.push(`${changes.toAdjust.length} adjusted position(s)`);
  }

  return {
    hasChanges: true,
    message: messages.join(', '),
    changes,
  };
}

/**
 * Display sync results
 */
function onSync(data) {
  const { traderPositions, userPositions, targetPositions, stats } = data;

  // Detect if trader positions changed
  const traderChanges = detectTraderChanges(traderPositions, lastTraderPositions);

  console.log('═'.repeat(80));
  console.log('\n📊 Sync Results\n');
  console.log('═'.repeat(80));

  // Show trader position change status
  if (traderChanges.hasChanges) {
    console.log(
      `\n${colors.yellow}⚠️  Trader Position Changes Detected: ${traderChanges.message}${colors.reset}`
    );
  } else {
    console.log(
      `\n${colors.green}✅ No Trader Position Changes: ${traderChanges.message}${colors.reset}`
    );
  }

  console.log(`\n${colors.cyan}👤 Trader Positions: ${traderPositions.length}${colors.reset}`);
  if (traderPositions.length > 0) {
    traderPositions.forEach((p) => {
      const direction = getDirection(p.side);
      const margin = (p.size * p.entryPrice) / p.leverage;

      // Mark positions that changed
      let changeMarker = '';
      if (lastTraderPositions && traderChanges.changes) {
        const prevPos = lastTraderPositions.find((prev) => prev.symbol === p.symbol);
        if (!prevPos) {
          changeMarker = ` ${colors.green}[NEW]${colors.reset}`;
        } else if (Math.abs(prevPos.size - p.size) > p.size * 0.01) {
          changeMarker = ` ${colors.yellow}[ADJUSTED]${colors.reset}`;
        }
      }

      console.log(
        `   ${p.symbol}: ${direction} ${p.size} @ $${p.entryPrice.toLocaleString()} (${p.leverage}x) - Margin: $${margin.toFixed(2)}${changeMarker}`
      );
    });

    // Show closed positions
    if (lastTraderPositions) {
      lastTraderPositions.forEach((prev) => {
        const exists = traderPositions.find((p) => p.symbol === prev.symbol);
        if (!exists) {
          console.log(`   ${prev.symbol}: ${colors.red}[CLOSED]${colors.reset}`);
        }
      });
    }
  } else {
    console.log('   (No positions)');
  }

  // Update last known trader positions
  lastTraderPositions = traderPositions.map((p) => ({ ...p }));

  console.log(`\n${colors.cyan}📍 Your Current Positions: ${userPositions.length}${colors.reset}`);
  if (userPositions.length > 0) {
    userPositions.forEach((p) => {
      const direction = getDirection(p.side);
      const margin = (p.size * p.entryPrice) / p.leverage;
      console.log(
        `   ${p.symbol}: ${direction} ${p.size} @ $${p.entryPrice.toLocaleString()} (${p.leverage}x) - Margin: $${margin.toFixed(2)}`
      );
    });
  } else {
    console.log('   (No positions)');
  }

  console.log(`\n${colors.cyan}🎯 Target Positions: ${targetPositions.length}${colors.reset}`);
  if (targetPositions.length > 0) {
    targetPositions.forEach((p) => {
      const direction = getDirection(p.side);
      const margin = (p.size * p.entryPrice) / p.leverage;
      console.log(
        `   ${p.symbol}: ${direction} ${p.size} @ $${p.entryPrice.toLocaleString()} (${p.leverage}x) - Margin: $${margin.toFixed(2)}`
      );
    });
  } else {
    console.log('   (No positions)');
  }

  // Calculate and display required actions using shared logic
  console.log(`\n${colors.yellow}🔄 Required Actions:${colors.reset}`);
  console.log('─'.repeat(80));

  // Only show actions if trader positions actually changed
  if (!traderChanges.hasChanges && stats.syncsCompleted > 1) {
    console.log(
      `\n${colors.green}✅ No actions needed - trader positions unchanged${colors.reset}`
    );
  } else {
    const actions = calculatePositionDiff(userPositions, targetPositions);
    const actionLines = formatPositionActions(actions, colors);
    actionLines.forEach((line) => console.log(line));

    // Show recommendation
    if (traderChanges.hasChanges) {
      console.log(
        `\n${colors.yellow}💡 Recommendation: Execute these actions to sync with trader${colors.reset}`
      );
    }
  }

  console.log('\n' + '─'.repeat(80));

  // Display statistics
  console.log(`\n${colors.cyan}📈 Statistics:${colors.reset}`);
  console.log(`   Syncs Completed: ${stats.syncsCompleted}`);
  console.log(`   Positions Added: ${stats.positionsAdded}`);
  console.log(`   Positions Removed: ${stats.positionsRemoved}`);
  console.log(`   Positions Adjusted: ${stats.positionsAdjusted}`);
  console.log(`   Errors: ${stats.errors}`);
  console.log(`   Scaling Factor: ${(stats.scalingFactor * 100).toFixed(2)}%`);

  console.log('\n' + '═'.repeat(80) + '\n');
}

/**
 * Handle position changes
 */
function onPositionChange(data) {
  const { action, position, adjustment } = data;

  switch (action) {
    case 'add':
      console.log(`\n  ➕ Would open: ${position.side} ${position.size} ${position.symbol}`);
      break;
    case 'remove':
      console.log(`\n  ➖ Would close: ${position.symbol}`);
      break;
    case 'adjust':
      console.log(`\n  🔄 Would adjust: ${adjustment.symbol} by ${adjustment.sizeDiff.toFixed(4)}`);
      break;
  }
}

/**
 * Start position syncing
 */
async function start() {
  console.log('═══════════════════════════════════════════════════════');
  console.log('  Position Synchronization');
  console.log('═══════════════════════════════════════════════════════');
  console.log(`📡 Monitor: Hyperliquid ${CONFIG.monitorNetwork}`);
  console.log(
    `💱 Execute: ${CONFIG.useMoonlander ? 'Moonlander' : 'Hyperliquid'} ${CONFIG.executeNetwork}`
  );
  console.log(`💰 Copy Balance: $${CONFIG.copyBalance}`);
  console.log(`⏱️  Sync Interval: ${CONFIG.syncInterval / 1000}s`);
  console.log(
    `${CONFIG.dryRun ? '🔍 Mode: DRY RUN (simulation only)' : '⚠️  Mode: LIVE EXECUTION'}`
  );
  if (!CONFIG.dryRun) {
    console.log(`${colors.red}   WARNING: Real trades will be executed!${colors.reset}`);
  }
  console.log('═══════════════════════════════════════════════════════\n');

  try {
    // Create exchanges
    await createExchanges();

    // Create position syncer
    console.log('📊 Creating position syncer...');
    syncer = createPositionSyncer({
      monitorExchange,
      executeExchange,
      traderAddress: CONFIG.traderAddress,
      userAddress: executeExchange.walletAddress,
      copyBalance: CONFIG.copyBalance,
      syncInterval: CONFIG.syncInterval,
      dryRun: CONFIG.dryRun,
      onSync,
      onPositionChange,
    });

    // Start syncing
    console.log('\n🚀 Starting position syncer...');
    console.log('   This will sync positions every 30 seconds');
    console.log('   Press Ctrl+C to stop\n');

    await syncer.start();

    console.log('✅ Position syncer running!\n');
    console.log('   - Positions are detected and compared');
    console.log('   - Changes are calculated and displayed');
    console.log('   - But NO actual trades are executed');
    console.log('   - To enable execution, integrate with trading logic\n');
  } catch (error) {
    console.error('❌ Failed to start:', error);
    throw error;
  }
}

/**
 * Cleanup and exit
 */
async function cleanup() {
  console.log('\n\n🛑 Shutting down...');

  if (syncer) {
    syncer.stop();
    console.log('✅ Syncer stopped');
  }

  // Display final stats
  if (syncer) {
    const stats = syncer.getStats();
    console.log('\n══════════════════════════════════════════��════════════');
    console.log('  Final Statistics');
    console.log('═══════════════════════════════════════════════════════');
    console.log(`  Syncs Completed: ${stats.syncsCompleted}`);
    console.log(`  Positions Added: ${stats.positionsAdded}`);
    console.log(`  Positions Removed: ${stats.positionsRemoved}`);
    console.log(`  Positions Adjusted: ${stats.positionsAdjusted}`);
    console.log(`  Errors: ${stats.errors}`);
    console.log(`  Scaling Factor: ${(stats.scalingFactor * 100).toFixed(2)}%`);
    console.log('═══════════════════════════════════════════════════════\n');
  }

  process.exit(0);
}

/**
 * Main function
 */
async function main() {
  // Validate config
  if (!CONFIG.hyperliquidPrivateKey) {
    console.error('❌ HYPERLIQUID_PRIVATE_KEY not found in .env');
    process.exit(1);
  }

  if (!CONFIG.traderAddress) {
    console.error('❌ TRADER_WALLET_ADDRESS not found in .env');
    process.exit(1);
  }

  if (CONFIG.copyBalance <= 0) {
    console.error('❌ Invalid COPY_BALANCE (must be > 0)');
    process.exit(1);
  }

  // Setup signal handlers
  process.on('SIGINT', cleanup);
  process.on('SIGTERM', cleanup);

  try {
    await start();
  } catch (error) {
    console.error('\n❌ Fatal error:', error);
    await cleanup();
  }
}

// Run
main();

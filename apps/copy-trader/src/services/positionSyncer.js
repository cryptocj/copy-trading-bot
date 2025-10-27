/**
 * Position Synchronization Service
 *
 * Periodically syncs user positions with trader positions.
 * This is more reliable than trade-by-trade copying because:
 * 1. Handles partial fills naturally
 * 2. Avoids rounding issues from small trades
 * 3. Self-correcting - always converges to target state
 * 4. Simpler logic - just compare desired vs actual state
 *
 * Usage:
 *   const syncer = createPositionSyncer(config);
 *   await syncer.start();
 */

import { calculateInitialPositions } from '../utils/positionCalculator.js';
import { convertSymbolToMoonlander } from '../config/moonlander.js';

/**
 * Position Syncer class
 * Periodically fetches trader positions and syncs user positions
 */
export class PositionSyncer {
  /**
   * Create position syncer
   * @param {object} config - Syncer configuration
   * @param {object} config.monitorExchange - Exchange for monitoring trader
   * @param {object} config.executeExchange - Exchange for executing trades
   * @param {string} config.traderAddress - Trader wallet address
   * @param {string} config.userAddress - User wallet address
   * @param {number} config.copyBalance - Total balance to use for copying
   * @param {number} [config.syncInterval=30000] - Sync interval in ms (default 30s)
   * @param {number} [config.minPositionSize=0.0001] - Minimum position size
   * @param {Function} [config.onSync] - Callback when sync completes
   * @param {Function} [config.onPositionChange] - Callback when position changes
   */
  constructor(config) {
    this.config = {
      syncInterval: 30000, // 30 seconds default
      minPositionSize: 0.0001,
      ...config,
    };

    // Validate required config
    if (!this.config.monitorExchange) throw new Error('monitorExchange required');
    if (!this.config.executeExchange) throw new Error('executeExchange required');
    if (!this.config.traderAddress) throw new Error('traderAddress required');
    if (!this.config.userAddress) throw new Error('userAddress required');
    if (!this.config.copyBalance) throw new Error('copyBalance required');

    // State
    this.isRunning = false;
    this.syncTimer = null;
    this.lastTraderPositions = new Map(); // symbol → position
    this.lastUserPositions = new Map(); // symbol → position
    this.scalingFactor = 1.0;

    // Stats
    this.stats = {
      syncsCompleted: 0,
      positionsAdded: 0,
      positionsRemoved: 0,
      positionsAdjusted: 0,
      errors: 0,
      lastSyncTime: null,
    };

    console.log('📊 Position Syncer initialized');
    console.log(`  Trader: ${this.config.traderAddress}`);
    console.log(`  User: ${this.config.userAddress}`);
    console.log(`  Copy Balance: $${this.config.copyBalance}`);
    console.log(`  Sync Interval: ${this.config.syncInterval / 1000}s`);
  }

  /**
   * Start periodic syncing
   */
  async start() {
    if (this.isRunning) {
      console.warn('Position syncer already running');
      return;
    }

    console.log('🚀 Starting position syncer...');
    this.isRunning = true;

    // Do first sync immediately
    await this.syncPositions();

    // Schedule periodic syncs
    this.syncTimer = setInterval(() => {
      this.syncPositions().catch((error) => {
        console.error('Sync error:', error);
        this.stats.errors++;
      });
    }, this.config.syncInterval);

    console.log('✅ Position syncer started');
  }

  /**
   * Stop syncing
   */
  stop() {
    if (!this.isRunning) {
      console.warn('Position syncer not running');
      return;
    }

    console.log('🛑 Stopping position syncer...');
    this.isRunning = false;

    if (this.syncTimer) {
      clearInterval(this.syncTimer);
      this.syncTimer = null;
    }

    console.log('✅ Position syncer stopped');
  }

  /**
   * Main sync logic
   * Compares trader positions with user positions and adjusts
   */
  async syncPositions() {
    if (!this.isRunning) return;

    console.log('\n═══════════════════════════════════════════════════════');
    console.log('🔄 Starting position sync...');
    console.log(`  Time: ${new Date().toLocaleString()}`);
    console.log('═══════════════════════════════════════════════════════');

    try {
      // Step 1: Fetch trader positions
      console.log('\n📊 Fetching trader positions...');
      const traderPositions = await this.fetchTraderPositions();
      console.log(`  Found ${traderPositions.length} trader positions`);

      // Step 2: Fetch user positions
      console.log('\n📊 Fetching user positions...');
      const userPositions = await this.fetchUserPositions();
      console.log(`  Found ${userPositions.length} user positions`);

      // Step 3: Calculate scaling factor based on copy balance
      console.log('\n📐 Calculating scaling factor...');
      const scalingResult = calculateInitialPositions(traderPositions, this.config.copyBalance);

      // Check if result is valid
      if (!scalingResult || !scalingResult.positions) {
        throw new Error('Invalid result from calculateInitialPositions');
      }

      this.scalingFactor = scalingResult.scalingFactor || 1.0;

      console.log(`  Scaling Factor: ${(this.scalingFactor * 100).toFixed(2)}%`);
      console.log(
        `  Original Trader Margin: $${(scalingResult.originalTotalCost || 0).toFixed(2)}`
      );
      console.log(
        `  Scaled Estimated Cost: $${(scalingResult.totalEstimatedCost || 0).toFixed(2)}`
      );
      console.log(`  Balance Utilization: ${(scalingResult.utilizationPercent || 0).toFixed(1)}%`);

      // Step 4: Calculate target positions (scaled trader positions)
      const targetPositions = scalingResult.positions;

      // Step 5: Calculate differences
      const { toAdd, toRemove, toAdjust } = this.calculateDifferences(
        targetPositions,
        userPositions
      );

      console.log('\n📋 Position Changes:');
      console.log(`  To Add: ${toAdd.length}`);
      console.log(`  To Remove: ${toRemove.length}`);
      console.log(`  To Adjust: ${toAdjust.length}`);

      // Step 6: Execute changes
      if (toRemove.length > 0) {
        await this.removePositions(toRemove);
        this.stats.positionsRemoved += toRemove.length;
      }

      if (toAdd.length > 0) {
        await this.addPositions(toAdd);
        this.stats.positionsAdded += toAdd.length;
      }

      if (toAdjust.length > 0) {
        await this.adjustPositions(toAdjust);
        this.stats.positionsAdjusted += toAdjust.length;
      }

      // Update stats
      this.stats.syncsCompleted++;
      this.stats.lastSyncTime = Date.now();

      // Update cached positions
      this.lastTraderPositions = new Map(traderPositions.map((p) => [p.symbol, p]));
      this.lastUserPositions = new Map(userPositions.map((p) => [p.symbol, p]));

      // Notify callback
      if (this.config.onSync) {
        this.config.onSync({
          traderPositions,
          userPositions,
          targetPositions,
          changes: { toAdd, toRemove, toAdjust },
          stats: this.getStats(),
        });
      }

      console.log('\n✅ Sync completed successfully');
      console.log('═══════════════════════════════════════════════════════\n');
    } catch (error) {
      console.error('❌ Sync failed:', error);
      this.stats.errors++;
      throw error;
    }
  }

  /**
   * Fetch trader's current positions
   */
  async fetchTraderPositions() {
    // Fetch positions via Hyperliquid API
    const response = await fetch(`${this.config.monitorExchange.urls.api.public}/info`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: 'clearinghouseState',
        user: this.config.traderAddress,
      }),
    });

    const data = await response.json();

    // Convert to standard format
    // Note: calculateInitialPositions expects 'long'/'short', not 'buy'/'sell'
    const positions = data.assetPositions
      .filter((pos) => Math.abs(pos.position.szi) > 0)
      .map((pos) => ({
        symbol: pos.position.coin,
        side: parseFloat(pos.position.szi) > 0 ? 'long' : 'short', // Use 'long'/'short' for calculateInitialPositions
        size: Math.abs(parseFloat(pos.position.szi)),
        entryPrice: parseFloat(pos.position.entryPx),
        leverage: parseFloat(pos.position.leverage.value),
        unrealizedPnl: parseFloat(pos.position.unrealizedPnl),
        margin: parseFloat(pos.position.marginUsed),
      }));

    console.log('  Trader positions:', positions);
    return positions;
  }

  /**
   * Fetch user's current positions
   */
  async fetchUserPositions() {
    const isMoonlander = this.config.executeExchange.pairAddresses !== undefined;

    if (isMoonlander) {
      // Moonlander: Use fetchPositions from smart contract
      const positions = await this.config.executeExchange.fetchPositions();

      return positions
        .map((pos) => ({
          symbol: pos.symbol,
          side: pos.side,
          size: parseFloat(pos.size),
          entryPrice: parseFloat(pos.entryPrice),
          leverage: parseFloat(pos.leverage),
          margin: parseFloat(pos.margin),
          tradeHash: pos.tradeHash, // Keep for closing positions
        }))
        .filter((pos) => {
          // Debug: log all positions before filtering
          // console.log(`  🔍 Position data:`, JSON.stringify(pos, null, 2));

          // Filter out invalid positions (NaN values or invalid data)
          const isValid =
            !Number.isNaN(pos.size) &&
            !Number.isNaN(pos.entryPrice) &&
            !Number.isNaN(pos.leverage) &&
            pos.size > 0 &&
            pos.entryPrice > 0 &&
            pos.leverage > 0 &&
            typeof pos.symbol === 'string' &&
            pos.symbol.length > 0 &&
            !pos.symbol.startsWith('0x'); // Ignore if still showing address

          // if (!isValid) {
          //   console.log(`  ⚠️  Filtering out invalid position: ${JSON.stringify(pos)}`);
          // }

          return isValid;
        });
    } else {
      // Hyperliquid: Use CCXT fetchPositions
      const positions = await this.config.executeExchange.fetchPositions();
      return positions
        .filter((pos) => Math.abs(pos.contracts || 0) > 0)
        .map((pos) => ({
          symbol: pos.symbol,
          side: pos.side,
          size: Math.abs(pos.contracts),
          entryPrice: pos.entryPrice,
          leverage: pos.leverage,
          margin: pos.collateral,
        }));
    }
  }

  /**
   * Normalize symbol for cross-exchange comparison
   * BTC/USD, BTC-USD → BTC
   */
  normalizeSymbol(symbol) {
    if (!symbol) return '';
    return symbol
      .toUpperCase()
      .replace(/[-/:].*$/, '') // Remove everything after -, /, or :
      .replace(/USD$|USDT$|USDC$/, '')
      .trim();
  }

  /**
   * Calculate differences between target and actual positions
   */
  calculateDifferences(targetPositions, userPositions) {
    const toAdd = [];
    const toRemove = [];
    const toAdjust = [];
    const minPositionValue = 200; // $200 minimum position value

    // Filter out small target positions
    const filteredTargets = targetPositions.filter((pos) => {
      const positionValue = pos.size * pos.entryPrice;
      if (positionValue < minPositionValue) {
        console.log(`  ⏭️  Skipping small target position: ${pos.symbol} ($${positionValue.toFixed(2)} < $${minPositionValue})`);
        return false;
      }
      return true;
    });

    // Build maps with normalized symbols for easy lookup
    const targetMap = new Map(
      filteredTargets.map((p) => [this.normalizeSymbol(p.symbol), p])
    );
    const userMap = new Map(
      userPositions.map((p) => [this.normalizeSymbol(p.symbol), p])
    );

    // Find positions to add (in target but not in user)
    for (const target of filteredTargets) {
      const normalizedSymbol = this.normalizeSymbol(target.symbol);
      const user = userMap.get(normalizedSymbol);

      if (!user) {
        // Position missing - add it
        toAdd.push(target);
      } else {
        // Position exists - check if adjustment needed
        const sizeDiff = Math.abs(user.size - target.size);
        const sizeThreshold = target.size * 0.05; // 5% threshold

        if (sizeDiff > sizeThreshold && sizeDiff > this.config.minPositionSize) {
          toAdjust.push({
            symbol: target.symbol,
            currentSize: user.size,
            currentSide: user.side,
            targetSize: target.size,
            targetSide: target.side,
            sizeDiff,
          });
        }
      }
    }

    // Find positions to remove (in user but not in filtered targets)
    // Skip small current positions - let them stay
    for (const user of userPositions) {
      const userValue = user.size * user.entryPrice;

      // Ignore small positions
      if (userValue < minPositionValue) {
        console.log(`  ⏭️  Ignoring small current position: ${user.symbol} ($${userValue.toFixed(2)} < $${minPositionValue})`);
        continue;
      }

      const normalizedSymbol = this.normalizeSymbol(user.symbol);
      if (!targetMap.has(normalizedSymbol)) {
        toRemove.push(user);
      }
    }

    return { toAdd, toRemove, toAdjust };
  }

  /**
   * Add new positions
   */
  async addPositions(positions) {
    console.log(`\n➕ Adding ${positions.length} new positions...`);

    for (const pos of positions) {
      try {
        console.log(
          `  📌 Opening: ${pos.side.toUpperCase()} ${pos.size} ${pos.symbol} @ ${pos.entryPrice} (${pos.leverage}x)`
        );

        // Check if dry-run mode
        if (this.config.dryRun) {
          console.log(`  🔍 [DRY RUN] Would open position`);
        } else {
          // Execute order via Moonlander
          const requiredMargin = (pos.size * pos.entryPrice) / pos.leverage;

          // Convert symbol format for Moonlander (BTC → BTC/USD)
          const moonlanderSymbol = convertSymbolToMoonlander(pos.symbol);

          // Normalize side: handle both 'long'/'short' and 'buy'/'sell' formats
          let orderSide = pos.side.toLowerCase();
          if (orderSide === 'long') orderSide = 'buy';
          if (orderSide === 'short') orderSide = 'sell';

          console.log(`     Symbol: ${moonlanderSymbol}`);
          console.log(`     Side: ${orderSide} (from ${pos.side})`);
          console.log(`     Margin: $${requiredMargin.toFixed(2)}`);
          console.log(`     Size: ${pos.size.toFixed(4)}`);

          const result = await this.config.executeExchange.createMarketOrder({
            pairBase: moonlanderSymbol,
            side: orderSide,
            amount: requiredMargin.toFixed(2), // Margin in USDC
            qty: pos.size.toFixed(4), // Position size
          });

          console.log(`  ✅ Order submitted!`);
          console.log(`     Trade Hash: ${result.tradeHash}`);
          console.log(`     TX Hash: ${result.txHash}`);

          this.stats.positionsAdded++;
        }

        if (this.config.onPositionChange) {
          this.config.onPositionChange({
            action: 'add',
            position: pos,
          });
        }
      } catch (error) {
        console.error(`  ❌ Failed to add position ${pos.symbol}:`, error.message);
        if (error.stack) {
          console.error(`     Stack: ${error.stack.split('\n')[0]}`);
        }
        this.stats.errors++;
      }
    }
  }

  /**
   * Remove positions
   */
  async removePositions(positions) {
    console.log(`\n➖ Removing ${positions.length} positions...`);

    for (const pos of positions) {
      try {
        console.log(`  🔒 Closing: ${pos.symbol} (${pos.size} @ ${pos.entryPrice})`);

        // Check if dry-run mode
        if (this.config.dryRun) {
          console.log(`  🔍 [DRY RUN] Would close position`);
        } else {
          // Close position via Moonlander
          // Note: Moonlander needs tradeHash to close position
          // We need to fetch positions first to get tradeHash
          const userPositions = await this.config.executeExchange.fetchPositions();
          const positionToClose = userPositions.find((p) => p.symbol === pos.symbol);

          if (!positionToClose || !positionToClose.tradeHash) {
            throw new Error(`Position ${pos.symbol} not found or missing tradeHash`);
          }

          const result = await this.config.executeExchange.closePosition(positionToClose.tradeHash);

          console.log(`  ✅ Position closed!`);
          console.log(`     TX Hash: ${result.txHash}`);

          this.stats.positionsRemoved++;
        }

        if (this.config.onPositionChange) {
          this.config.onPositionChange({
            action: 'remove',
            position: pos,
          });
        }
      } catch (error) {
        console.error(`  ❌ Failed to remove position ${pos.symbol}:`, error.message);
        this.stats.errors++;
      }
    }
  }

  /**
   * Adjust existing positions
   */
  async adjustPositions(adjustments) {
    console.log(`\n🔧 Adjusting ${adjustments.length} positions...`);

    for (const adj of adjustments) {
      try {
        const action = adj.targetSize > adj.currentSize ? 'INCREASE' : 'DECREASE';
        const diffSize = Math.abs(adj.targetSize - adj.currentSize);

        console.log(
          `  🔄 ${adj.symbol}: ${action} by ${diffSize.toFixed(4)} (${adj.currentSize.toFixed(4)} → ${adj.targetSize.toFixed(4)})`
        );

        // Check if dry-run mode
        if (this.config.dryRun) {
          console.log(`  🔍 [DRY RUN] Would adjust position`);
        } else {
          // For Moonlander: close old position and open new one
          // Step 1: Fetch current position to get tradeHash
          const userPositions = await this.config.executeExchange.fetchPositions();
          const currentPosition = userPositions.find((p) => p.symbol === adj.symbol);

          if (!currentPosition || !currentPosition.tradeHash) {
            throw new Error(`Position ${adj.symbol} not found or missing tradeHash`);
          }

          // Step 2: Close current position
          console.log(`    Closing old position...`);
          const closeResult = await this.config.executeExchange.closePosition(
            currentPosition.tradeHash
          );
          console.log(`    ✅ Closed (TX: ${closeResult.txHash})`);

          // Step 3: Open new position with target size
          console.log(`    Opening new position with target size...`);
          const requiredMargin =
            (adj.targetSize * currentPosition.entryPrice) / currentPosition.leverage;

          // Convert symbol format for Moonlander (BTC → BTC/USD)
          const moonlanderSymbol = convertSymbolToMoonlander(adj.symbol);

          // Convert side: 'long' → 'buy', 'short' → 'sell'
          const orderSide = adj.targetSide === 'long' ? 'buy' : 'sell';

          const openResult = await this.config.executeExchange.createMarketOrder({
            pairBase: moonlanderSymbol,
            side: orderSide,
            amount: requiredMargin.toFixed(2),
            qty: adj.targetSize.toFixed(4),
          });

          console.log(`  ✅ Position adjusted!`);
          console.log(`     New Trade Hash: ${openResult.tradeHash}`);
          console.log(`     TX Hash: ${openResult.txHash}`);

          this.stats.positionsAdjusted++;
        }

        if (this.config.onPositionChange) {
          this.config.onPositionChange({
            action: 'adjust',
            adjustment: adj,
          });
        }
      } catch (error) {
        console.error(`  ❌ Failed to adjust position ${adj.symbol}:`, error.message);
        this.stats.errors++;
      }
    }
  }

  /**
   * Get current statistics
   */
  getStats() {
    return {
      ...this.stats,
      isRunning: this.isRunning,
      scalingFactor: this.scalingFactor,
    };
  }

  /**
   * Force immediate sync (outside of schedule)
   */
  async forceSyncNow() {
    console.log('🔄 Force sync requested...');
    await this.syncPositions();
  }
}

/**
 * Factory function to create position syncer
 */
export function createPositionSyncer(config) {
  return new PositionSyncer(config);
}

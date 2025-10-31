// ============================================
// SYNC-ENGINE.JS - Position Synchronization Engine
// ============================================

import {
  MIN_POSITION_VALUE,
  SAFETY_BUFFER_PERCENT,
  MAX_SCALING_FACTOR,
  DEFAULT_SYNC_INTERVAL,
  TRADER_POSITION_CHANGE_THRESHOLD,
} from './config.js';
import { state, updateStats, saveTraderPositions } from './state.js';
import { SymbolUtils, log } from './utils.js';
import { elements, updatePositions, updateBalanceInfo, updateActionHistory } from './ui.js';
import { fetchLastTradeTimestamp, fetchTraderPositions } from './hyperliquid-service.js';
import {
  getMoonlanderWallet,
  fetchMoonlanderPositions,
  fetchMoonlanderBalance,
  executeCopyTrade,
} from './moonlander-service.js';

// Module-level variables
let lastTradeTimestamp = null;

// Calculate target positions based on trader positions and available balance
export function calculateTargetPositions(
  traderPositions,
  copyBalance,
  traderAccountData = null,
  userAccountData = null,
  userFreeBalance = null,
  traderFreeBalance = null,
  userPositions = []
) {
  if (!traderPositions || traderPositions.length === 0) return [];

  // Calculate trader's total margin from their actual positions
  const traderTotalMargin = traderPositions.reduce((sum, pos) => {
    return sum + pos.margin;
  }, 0);

  // Use full safety buffer (100%) to allow users to maximize smaller balances
  let dynamicSafetyBuffer = SAFETY_BUFFER_PERCENT;

  if (traderAccountData) {
    const traderTotalBalance = parseFloat(traderAccountData.marginSummary.accountValue);
    const traderMarginRatio = traderTotalBalance > 0 ? traderTotalMargin / traderTotalBalance : 0;

    console.log(
      `📊 Trader margin ratio: ${(traderMarginRatio * 100).toFixed(2)}% ($${traderTotalMargin.toFixed(2)} / $${traderTotalBalance.toFixed(2)})`
    );
    console.log(
      `📊 User safety buffer: ${(dynamicSafetyBuffer * 100).toFixed(2)}% (full balance available)`
    );
  }

  // Scale down using dynamic safety buffer for margin
  let scalingFactor =
    traderTotalMargin > 0 ? (copyBalance * dynamicSafetyBuffer) / traderTotalMargin : 0;
  if (scalingFactor > MAX_SCALING_FACTOR) {
    scalingFactor = MAX_SCALING_FACTOR;
    console.log(
      `⚠️  Scaling capped at ${(MAX_SCALING_FACTOR * 100).toFixed(0)}% (user has more capital than trader)`
    );
  }

  console.log(
    `Scaling factor: ${(scalingFactor * 100).toFixed(2)}% | Trader margin: $${traderTotalMargin.toFixed(2)} | User balance: $${copyBalance.toFixed(2)}`
  );

  const scaledPositions = traderPositions.map((pos) => {
    const traderMargin = pos.margin;
    const copyMargin = traderMargin * scalingFactor;
    const copySize = (copyMargin * pos.leverage) / pos.entryPrice;

    // Ensure copy size never exceeds trader's size
    const finalSize = Math.min(copySize, pos.size);
    const finalMargin = Math.min(copyMargin, traderMargin);

    return {
      symbol: pos.symbol,
      side: pos.side,
      size: finalSize,
      entryPrice: pos.entryPrice,
      leverage: pos.leverage,
      margin: finalMargin,
      stopLoss: pos.stopLoss,
      takeProfit: pos.takeProfit,
    };
  });

  // Filter out positions below minimum margin
  const skippedPositions = [];
  const filteredPositions = scaledPositions.filter((pos) => {
    const positionValue = pos.size * pos.entryPrice;
    const isValid = pos.margin >= MIN_POSITION_VALUE;
    if (!isValid) {
      skippedPositions.push({
        symbol: pos.symbol,
        side: pos.side,
        margin: pos.margin,
        positionValue: positionValue,
        leverage: pos.leverage,
      });
    }
    return isValid;
  });

  // Log skipped positions
  if (skippedPositions.length > 0) {
    log(
      'warning',
      `⏭️  Skipped ${skippedPositions.length} small position${skippedPositions.length > 1 ? 's' : ''} (below $${MIN_POSITION_VALUE} margin minimum):`
    );
    skippedPositions.forEach((pos) => {
      log(
        'info',
        `   • ${pos.symbol} ${pos.side.toUpperCase()}: Margin $${pos.margin.toFixed(2)} (Value: $${pos.positionValue.toFixed(2)}, ${pos.leverage}x leverage)`
      );
    });
  }

  // Update balance info display if account data is provided
  if (traderAccountData && userAccountData) {
    updateBalanceInfo(
      traderAccountData,
      userAccountData,
      traderTotalMargin,
      copyBalance,
      dynamicSafetyBuffer,
      scalingFactor,
      userFreeBalance,
      traderFreeBalance,
      traderPositions,
      userPositions
    );
  }

  return filteredPositions;
}

// Calculate position diff (what to add/remove)
export function calculatePositionDiff(userPositions, targetPositions, currentTraderPositions) {
  const targetMap = new Map(targetPositions.map((p) => [SymbolUtils.normalize(p.symbol), p]));
  const userMap = new Map(userPositions.map((p) => [SymbolUtils.normalize(p.symbol), p]));
  const currentTraderMap = new Map(
    currentTraderPositions.map((p) => [SymbolUtils.normalize(p.symbol), p])
  );

  console.log('🔍 Position Diff Calculation:');
  console.log(
    '  Target positions:',
    targetPositions.map((p) => `${p.symbol}(${p.size.toFixed(4)})`).join(', ')
  );
  console.log(
    '  User positions:',
    userPositions.map((p) => `${p.symbol}(${p.size.toFixed(4)})`).join(', ')
  );
  console.log('  Target symbols (normalized):', Array.from(targetMap.keys()).join(', '));
  console.log('  User symbols (normalized):', Array.from(userMap.keys()).join(', '));

  const toAdd = [];
  const toRemove = [];

  // Get last known trader positions to detect actual trader actions
  const lastTraderMap = new Map(
    (state.lastTraderPositions || []).map((p) => [SymbolUtils.normalize(p.symbol), p])
  );

  for (const target of targetPositions) {
    const normalizedSymbol = SymbolUtils.normalize(target.symbol);
    const user = userMap.get(normalizedSymbol);
    const currentTrader = currentTraderMap.get(normalizedSymbol);
    const lastTrader = lastTraderMap.get(normalizedSymbol);

    if (!user) {
      // Position doesn't exist - add it
      toAdd.push({ ...target, reason: 'Trader opened new position' });
    } else if (lastTrader && currentTrader) {
      // Position exists AND we have trader history - check if trader actually changed position
      const traderSizeChange = Math.abs(currentTrader.size - lastTrader.size);
      const traderChangePercent =
        lastTrader.size > 0 ? (traderSizeChange / lastTrader.size) * 100 : 0;

      // If trader significantly changed their position size, adjust user position
      if (traderChangePercent > TRADER_POSITION_CHANGE_THRESHOLD) {
        const direction = currentTrader.size > lastTrader.size ? 'increased' : 'decreased';
        const reason = `Trader ${direction} position by ${traderChangePercent.toFixed(1)}%`;
        console.log(
          `📈 Trader ${direction} ${target.symbol} by ${traderChangePercent.toFixed(2)}% (${lastTrader.size.toFixed(4)} → ${currentTrader.size.toFixed(4)})`
        );
        console.log(`   Adjusting user position: close and reopen with new size`);
        toRemove.push({ ...user, reason });
        toAdd.push({ ...target, reason });
      }
    }
  }

  for (const user of userPositions) {
    const normalizedSymbol = SymbolUtils.normalize(user.symbol);
    const target = targetMap.get(normalizedSymbol);

    if (!target) {
      // Position should not exist - remove it
      if (!toRemove.find((p) => SymbolUtils.normalize(p.symbol) === normalizedSymbol)) {
        console.log(`  ❌ User position ${user.symbol} should be closed (no matching target)`);
        toRemove.push({ ...user, reason: 'Trader closed position' });
      }
    }
  }

  console.log('📋 Actions Summary:');
  console.log(
    '  To Close:',
    toRemove.map((p) => `${p.symbol}(${p.size.toFixed(4)})`).join(', ') || 'None'
  );
  console.log(
    '  To Open:',
    toAdd.map((p) => `${p.symbol}(${p.size.toFixed(4)})`).join(', ') || 'None'
  );

  return { toAdd, toRemove };
}

// Fetch all positions (trader + user)
export async function fetchAllPositions(traderAddress, balanceInfo) {
  const traderPlatform = elements.traderPlatform.value;

  let traderPositions,
    traderAccountData,
    traderFreeBalance = null;

  // Fetch trader positions based on platform
  if (traderPlatform === 'moonlander') {
    // Fetch from Moonlander trader
    const traderBalanceInfo = await fetchMoonlanderBalance(traderAddress);
    traderPositions = await fetchMoonlanderPositions(traderAddress);
    traderFreeBalance = traderBalanceInfo.freeBalance;

    traderAccountData = {
      marginSummary: {
        accountValue: traderBalanceInfo.totalEquity.toString(),
      },
    };
  } else {
    // Fetch from Hyperliquid trader (default)
    const result = await fetchTraderPositions(traderAddress);
    traderPositions = result.positions;
    traderAccountData = result.accountData;
  }

  const moonlanderKey = elements.moonlanderPrivateKey.value;
  const moonlanderWallet = moonlanderKey ? getMoonlanderWallet(moonlanderKey) : null;

  if (moonlanderWallet) {
    // Fetch positions from API (includes PnL) and contract (includes SL/TP)
    state.userPositions = await fetchMoonlanderPositions(moonlanderWallet.address);
  }

  // Always create user account data structure for balance display
  const userAccountData = {
    marginSummary: {
      accountValue: balanceInfo.totalEquity.toString(),
    },
  };

  return { traderPositions, traderAccountData, userAccountData, traderFreeBalance };
}

// Perform sync - main synchronization loop
export async function performSync() {
  const traderAddress = elements.traderAddress.value;

  try {
    log('info', '🔄 Starting sync...');

    // Fetch user's real-time available balance
    let balanceInfo = {
      freeBalance: state.stats.balance,
      totalEquity: state.stats.balance,
      positionsValue: 0,
    };
    const moonlanderKey = elements.moonlanderPrivateKey.value;
    const moonlanderWallet = moonlanderKey ? getMoonlanderWallet(moonlanderKey) : null;
    if (moonlanderWallet) {
      balanceInfo = await fetchMoonlanderBalance(moonlanderWallet.address);

      // Update stats with total equity for display
      state.stats.balance = balanceInfo.totalEquity;
      elements.copyBalance.value = balanceInfo.totalEquity.toFixed(2);
    }

    // Only check for new trades after the first sync
    if (lastTradeTimestamp !== null) {
      const currentTradeTimestamp = await fetchLastTradeTimestamp(traderAddress);
      const hasNewTrade = currentTradeTimestamp !== lastTradeTimestamp;

      if (!hasNewTrade) {
        // No new trades - just refresh position display
        const { traderPositions, traderAccountData, userAccountData, traderFreeBalance } =
          await fetchAllPositions(traderAddress, balanceInfo);

        // Update position display
        updatePositions(traderPositions, state.userPositions, traderAccountData, userAccountData);

        // Update balance info display
        if (traderAccountData) {
          const traderTotalMargin = traderPositions.reduce((sum, pos) => sum + pos.margin, 0);
          const userMargin = state.userPositions.reduce((sum, pos) => sum + pos.margin, 0);
          updateBalanceInfo(
            traderAccountData,
            userAccountData,
            traderTotalMargin,
            balanceInfo.totalEquity,
            0,
            0,
            balanceInfo.freeBalance,
            traderFreeBalance,
            traderPositions,
            state.userPositions
          );
        }

        log('info', '⏭️  No new trades from trader - skipping adjustment check');
        state.stats.syncs++;
        updateStats();
        return;
      }

      // Update last trade timestamp
      const tradeTime = new Date(currentTradeTimestamp).toLocaleTimeString();
      log('info', `🔔 New trade detected at ${tradeTime}`);
      lastTradeTimestamp = currentTradeTimestamp;
    } else {
      // First sync - just log and set timestamp at the end
      log('info', '🔄 First sync - initializing trade tracking');
    }

    // Fetch current positions for processing
    const { traderPositions, traderAccountData, userAccountData, traderFreeBalance } =
      await fetchAllPositions(traderAddress, balanceInfo);

    // Update lastTraderPositions BEFORE calculateTargetPositions
    state.lastTraderPositions = [...traderPositions];

    // Calculate trader's total margin
    const traderTotalMargin = traderPositions.reduce((sum, pos) => sum + pos.margin, 0);

    // Use total equity for scaling
    log(
      'info',
      `📊 Trader margin: $${traderTotalMargin.toFixed(2)} | User total equity: $${balanceInfo.totalEquity.toFixed(2)}`
    );

    const targetPositions = calculateTargetPositions(
      traderPositions,
      balanceInfo.totalEquity,
      traderAccountData,
      userAccountData,
      balanceInfo.freeBalance,
      traderFreeBalance,
      state.userPositions
    );

    // Calculate required actions
    const actions = calculatePositionDiff(state.userPositions, targetPositions, traderPositions);

    // Execute actions if Moonlander key provided
    if (
      elements.moonlanderPrivateKey.value &&
      (actions.toAdd.length > 0 || actions.toRemove.length > 0)
    ) {
      log(
        'info',
        `📋 Actions needed: Close ${actions.toRemove.length}, Open ${actions.toAdd.length}`
      );
      const moonlanderKey = elements.moonlanderPrivateKey.value;

      // Record actions being executed
      const timestamp = Date.now();
      const executedActions = [];

      for (const pos of actions.toRemove) {
        state.stats.removed++;
        log('warning', `🔄 Closing: ${pos.symbol}`);
        const result = await executeCopyTrade(pos, 'close', moonlanderKey);
        executedActions.push({
          type: 'close',
          symbol: pos.symbol,
          side: pos.side,
          size: pos.size,
          entryPrice: pos.entryPrice,
          reason: pos.reason || 'Position closed',
          timestamp,
          status: result ? 'success' : 'failed'
        });
      }

      for (const pos of actions.toAdd) {
        state.stats.added++;
        const margin = (pos.size * pos.entryPrice) / pos.leverage;
        log(
          'success',
          `🔄 Opening: ${pos.symbol} ${pos.side.toUpperCase()} ${pos.size.toFixed(4)} @ market - Margin: $${margin.toFixed(2)}`
        );
        const result = await executeCopyTrade(pos, 'open', moonlanderKey);
        executedActions.push({
          type: 'open',
          symbol: pos.symbol,
          side: pos.side,
          size: pos.size,
          entryPrice: pos.entryPrice,
          leverage: pos.leverage,
          margin,
          reason: pos.reason || 'Position opened',
          timestamp,
          status: result ? 'success' : 'failed'
        });
      }

      // Add to action history
      state.actionHistory.unshift(...executedActions);
      // Keep only last 50 actions
      if (state.actionHistory.length > 50) {
        state.actionHistory = state.actionHistory.slice(0, 50);
      }

      log('success', '✅ All actions completed');
      updateActionHistory();
    } else if (!elements.moonlanderPrivateKey.value) {
      log('warning', '⚠️  Wallet private key not provided - skipping execution');
      if (actions.toAdd.length > 0 || actions.toRemove.length > 0) {
        log(
          'info',
          `Would close ${actions.toRemove.length}, open ${actions.toAdd.length} positions`
        );
      }
    } else if (actions.toAdd.length === 0 && actions.toRemove.length === 0) {
      log('info', '✅ No actions needed - positions in sync');
    }

    // Save ORIGINAL trader positions (not scaled) for detecting real trader changes next sync
    saveTraderPositions(traderPositions);
    state.stats.syncs++;

    // Set timestamp on first sync
    if (lastTradeTimestamp === null) {
      const currentTradeTimestamp = await fetchLastTradeTimestamp(traderAddress);
      if (currentTradeTimestamp) {
        lastTradeTimestamp = currentTradeTimestamp;
        log(
          'info',
          `📍 Trade tracking initialized at ${new Date(currentTradeTimestamp).toLocaleTimeString()}`
        );
      }
    }

    updatePositions(traderPositions, state.userPositions, traderAccountData, userAccountData);
    updateStats();
  } catch (error) {
    log('error', `❌ Sync failed: ${error.message}`);
    state.stats.errors++;
    updateStats();
  }
}

// Start monitoring
export async function startMonitoring() {
  const traderAddress = elements.traderAddress.value;

  // Track analytics event
  if (typeof gtag !== 'undefined') {
    gtag('event', 'start_monitoring', {
      trader_type: elements.traderSelect.value === 'custom' ? 'custom' : 'preset',
      trader_address: traderAddress.substring(0, 10) + '...',
    });
  }
  const interval = DEFAULT_SYNC_INTERVAL * 1000;

  if (!traderAddress) {
    log('error', '❌ Please select or enter a trader address');
    return;
  }

  try {
    log('info', '🚀 Initializing monitor...');

    // Fetch wallet balance if private key provided
    const moonlanderKey = elements.moonlanderPrivateKey.value;
    const moonlanderWallet = moonlanderKey ? getMoonlanderWallet(moonlanderKey) : null;
    if (moonlanderWallet) {
      const balanceInfo = await fetchMoonlanderBalance(moonlanderWallet.address);
      state.stats.balance = balanceInfo.totalEquity;
      elements.copyBalance.value = balanceInfo.totalEquity.toFixed(2);
    } else {
      state.stats.balance = 50; // Default minimum
      elements.copyBalance.value = '50.00';
    }

    updateStats();

    log('success', '✅ Monitor initialized');
    const traderPlatform = elements.traderPlatform.value;
    const platformEmoji = traderPlatform === 'moonlander' ? '🌙' : '🌊';
    const platformName = traderPlatform === 'moonlander' ? 'Moonlander' : 'Hyperliquid';
    log('info', `${platformEmoji} Trader Platform: ${platformName}`);
    log('info', `👤 Trader: ${traderAddress.slice(0, 6)}...${traderAddress.slice(-4)}`);
    if (moonlanderWallet) {
      log(
        'info',
        `🌙 Your Wallet: ${moonlanderWallet.address.slice(0, 6)}...${moonlanderWallet.address.slice(-4)}`
      );
    }
    log('info', `💰 Copy Balance: $${state.stats.balance.toFixed(2)}`);

    // Start sync loop
    state.isMonitoring = true;
    elements.startButton.disabled = true;
    elements.stopButton.disabled = false;
    elements.statusDisplay.classList.remove('hidden');

    // First sync
    await performSync();

    // Setup interval
    state.syncInterval = setInterval(performSync, interval);
  } catch (error) {
    log('error', `❌ Failed to start: ${error.message}`);
    state.stats.errors++;
    updateStats();
  }
}

// Stop monitoring
export function stopMonitoring() {
  // Track analytics event
  if (typeof gtag !== 'undefined') {
    gtag('event', 'stop_monitoring', {
      total_syncs: state.stats.syncs,
      positions_added: state.stats.added,
      positions_removed: state.stats.removed,
      errors: state.stats.errors,
    });
  }

  if (state.syncInterval) {
    clearInterval(state.syncInterval);
    state.syncInterval = null;
  }

  state.isMonitoring = false;
  elements.startButton.disabled = false;
  elements.stopButton.disabled = true;
  elements.statusDisplay.classList.add('hidden');

  log('warning', '⏸️  Monitoring stopped');
}

#!/usr/bin/env node

// Test script to simulate position diff calculations
// Run with: node apps/copy-trader/test-position-diff.js

// Configuration constant
const TRADER_POSITION_CHANGE_THRESHOLD = 20; // Must match config.js

// Symbol utilities for consistent symbol handling
const SymbolUtils = {
  // Normalize for comparison: "BTC/USD" -> "BTC"
  normalize(symbol) {
    return symbol.replace('/USD', '');
  }
};

// Mock state for last trader positions
const state = {
  lastTraderPositions: []
};

// Calculate position diff (what to add/remove)
function calculatePositionDiff(userPositions, targetPositions, currentTraderPositions) {
  const targetMap = new Map(targetPositions.map((p) => [SymbolUtils.normalize(p.symbol), p]));
  const userMap = new Map(userPositions.map((p) => [SymbolUtils.normalize(p.symbol), p]));
  const currentTraderMap = new Map(
    currentTraderPositions.map((p) => [SymbolUtils.normalize(p.symbol), p])
  );

  console.log('🔍 Position Diff Calculation:');
  console.log('  Target positions:', targetPositions.map(p => `${p.symbol}(${p.size.toFixed(4)})`).join(', '));
  console.log('  User positions:', userPositions.map(p => `${p.symbol}(${p.size.toFixed(4)})`).join(', '));
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
      console.log(`  ✅ Should open ${target.symbol} (trader has it, user doesn't)`);
      toAdd.push(target);
    } else if (lastTrader && currentTrader) {
      // Position exists AND we have trader history - check if trader actually changed position
      const traderSizeChange = Math.abs(currentTrader.size - lastTrader.size);
      const traderChangePercent = lastTrader.size > 0 ? (traderSizeChange / lastTrader.size) * 100 : 0;

      // If trader significantly changed their position size, adjust user position
      if (traderChangePercent > TRADER_POSITION_CHANGE_THRESHOLD) {
        const direction = currentTrader.size > lastTrader.size ? 'increased' : 'decreased';
        console.log(`  📈 Trader ${direction} ${target.symbol} by ${traderChangePercent.toFixed(2)}% (${lastTrader.size.toFixed(4)} → ${currentTrader.size.toFixed(4)})`);
        console.log(`     Adjusting user position: close and reopen with new size`);
        toRemove.push(user);
        toAdd.push(target);
      } else {
        // Trader position unchanged or minor change - don't adjust
        const sizeDiff = Math.abs(user.size - target.size);
        const sizeRatio = target.size > 0 ? sizeDiff / target.size : 0;

        if (sizeRatio > 0.01) {
          console.log(`  ℹ️  ${target.symbol} size difference: ${(sizeRatio * 100).toFixed(2)}% (keeping position, trader unchanged)`);
        }
      }
    } else {
      // No trader history yet - don't adjust on first sync
      console.log(`  ℹ️  ${target.symbol} first sync - keeping existing position`);
    }
  }

  for (const user of userPositions) {
    const normalizedSymbol = SymbolUtils.normalize(user.symbol);
    const target = targetMap.get(normalizedSymbol);
    const currentTrader = currentTraderMap.get(normalizedSymbol);

    if (!target) {
      // Position not in targets - check if trader actually closed it or if it was just filtered out
      if (!currentTrader) {
        // Trader doesn't have this position anymore - close it
        if (!toRemove.find((p) => SymbolUtils.normalize(p.symbol) === normalizedSymbol)) {
          console.log(`  ❌ User position ${user.symbol} should be closed (trader closed position)`);
          toRemove.push(user);
        }
      } else {
        // Trader still has the position but it was filtered out (too small) - keep user's position
        console.log(`  ℹ️  Keeping ${user.symbol} (trader still has it, filtered due to size constraints)`);
      }
    }
  }

  console.log('📋 Actions Summary:');
  console.log('  To Close:', toRemove.map(p => `${p.symbol}(${p.size.toFixed(4)})`).join(', ') || 'None');
  console.log('  To Open:', toAdd.map(p => `${p.symbol}(${p.size.toFixed(4)})`).join(', ') || 'None');

  return { toAdd, toRemove };
}

// Test function to simulate position changes
function testPositionDiff() {
  console.log('🧪 ========== SIMULATION TEST ==========');
  console.log('');

  // Current trader positions (6 positions)
  const traderPositions = [
    { symbol: 'BTC', side: 'long', size: 0.1200, entryPrice: 107343, leverage: 10, margin: 1332.58 },
    { symbol: 'ETH', side: 'long', size: 7.2700, entryPrice: 3776.5, leverage: 10, margin: 2827.63 },
    { symbol: 'SOL', side: 'long', size: 124.6400, entryPrice: 192.803, leverage: 10, margin: 1440.64 },
    { symbol: 'BNB', side: 'long', size: 13.7600, entryPrice: 1084.992, leverage: 10, margin: 1432.21 },
    { symbol: 'DOGE', side: 'long', size: 27858.0000, entryPrice: 0.185, leverage: 10, margin: 415.17 },
    { symbol: 'XRP', side: 'long', size: 3609.0000, entryPrice: 2.445, leverage: 10, margin: 898.20 }
  ];

  // Current user positions (4 positions)
  const userPositions = [
    { symbol: 'BTC/USD', side: 'long', size: 0.0030, entryPrice: 108440.298, leverage: 10.2, margin: 31.66, positionHash: 'hash-btc' },
    { symbol: 'ETH/USD', side: 'long', size: 0.1535, entryPrice: 3822.834, leverage: 10.1, margin: 58.12, positionHash: 'hash-eth' },
    { symbol: 'SOL/USD', side: 'long', size: 1.6674, entryPrice: 185.016, leverage: 9.7, margin: 31.89, positionHash: 'hash-sol' },
    { symbol: 'XRP/USD', side: 'long', size: 83.5667, entryPrice: 2.455, leverage: 10.1, margin: 20.22, positionHash: 'hash-xrp' }
  ];

  console.log('📊 SCENARIO 1: Current State (Trader has 6, User has 4)');
  console.log('Trader:', traderPositions.map(p => p.symbol).join(', '));
  console.log('User:', userPositions.map(p => p.symbol).join(', '));

  // Simulate target positions (scaled versions of trader positions)
  const targetPositionsCurrent = traderPositions.map(p => ({
    symbol: p.symbol,
    side: p.side,
    size: p.size * 0.025, // Scaled down for user
    entryPrice: p.entryPrice,
    leverage: p.leverage,
    margin: p.margin * 0.025
  }));

  const resultCurrent = calculatePositionDiff(userPositions, targetPositionsCurrent, traderPositions);
  console.log('');
  console.log('✅ Expected: Should try to open BNB and DOGE (trader has them, user doesn\'t)');
  console.log('✅ Actual:', resultCurrent.toAdd.map(p => p.symbol).join(', ') || 'None');
  console.log('');

  // SCENARIO 2: Trader closes BTC
  console.log('');
  console.log('📊 SCENARIO 2: After Trader Closes BTC (Trader has 5, User has 4)');
  const traderPositionsWithoutBTC = traderPositions.filter(p => p.symbol !== 'BTC');
  console.log('Trader:', traderPositionsWithoutBTC.map(p => p.symbol).join(', '));
  console.log('User:', userPositions.map(p => p.symbol).join(', '));

  const targetPositionsWithoutBTC = traderPositionsWithoutBTC.map(p => ({
    symbol: p.symbol,
    side: p.side,
    size: p.size * 0.025,
    entryPrice: p.entryPrice,
    leverage: p.leverage,
    margin: p.margin * 0.025
  }));

  const resultWithoutBTC = calculatePositionDiff(userPositions, targetPositionsWithoutBTC, traderPositionsWithoutBTC);
  console.log('');
  console.log('✅ Expected: Should close BTC/USD only (trader closed BTC, user still has it)');
  console.log('✅ Actual close:', resultWithoutBTC.toRemove.map(p => p.symbol).join(', ') || 'None');
  console.log('✅ Expected: Should still try to open BNB and DOGE');
  console.log('✅ Actual open:', resultWithoutBTC.toAdd.map(p => p.symbol).join(', ') || 'None');
  console.log('');

  // SCENARIO 3: Trader closes BTC and ETH
  console.log('');
  console.log('📊 SCENARIO 3: After Trader Closes BTC and ETH (Trader has 4, User has 4)');
  const traderPositionsWithoutBTCETH = traderPositions.filter(p => p.symbol !== 'BTC' && p.symbol !== 'ETH');
  console.log('Trader:', traderPositionsWithoutBTCETH.map(p => p.symbol).join(', '));
  console.log('User:', userPositions.map(p => p.symbol).join(', '));

  const targetPositionsWithoutBTCETH = traderPositionsWithoutBTCETH.map(p => ({
    symbol: p.symbol,
    side: p.side,
    size: p.size * 0.025,
    entryPrice: p.entryPrice,
    leverage: p.leverage,
    margin: p.margin * 0.025
  }));

  const resultWithoutBTCETH = calculatePositionDiff(userPositions, targetPositionsWithoutBTCETH, traderPositionsWithoutBTCETH);
  console.log('');
  console.log('✅ Expected: Should close BTC/USD and ETH/USD (trader closed both)');
  console.log('✅ Actual close:', resultWithoutBTCETH.toRemove.map(p => p.symbol).join(', ') || 'None');
  console.log('✅ Expected: Should try to open BNB and DOGE');
  console.log('✅ Actual open:', resultWithoutBTCETH.toAdd.map(p => p.symbol).join(', ') || 'None');
  console.log('');

  // SCENARIO 4: Trader doubles BTC position (increases by 100%)
  console.log('');
  console.log('📊 SCENARIO 4: Trader Doubles BTC Position (increases by 100%)');

  // Set last trader positions to ORIGINAL trader positions (not scaled)
  state.lastTraderPositions = traderPositions;

  const traderPositionsDoubleBTC = traderPositions.map(p =>
    p.symbol === 'BTC' ? { ...p, size: p.size * 2, margin: p.margin * 2 } : p
  );
  console.log('Last Trader BTC size:', traderPositions.find(p => p.symbol === 'BTC').size);
  console.log('New Trader BTC size:', traderPositionsDoubleBTC.find(p => p.symbol === 'BTC').size);

  const targetPositionsDoubleBTC = traderPositionsDoubleBTC.map(p => ({
    symbol: p.symbol,
    side: p.side,
    size: p.size * 0.025,
    entryPrice: p.entryPrice,
    leverage: p.leverage,
    margin: p.margin * 0.025
  }));
  console.log('New Target BTC size:', targetPositionsDoubleBTC.find(p => p.symbol === 'BTC').size);

  const resultDoubleBTC = calculatePositionDiff(userPositions, targetPositionsDoubleBTC, traderPositionsDoubleBTC);
  console.log('');
  console.log('✅ Expected: Should close and reopen BTC/USD (trader increased >20%)');
  console.log('✅ Actual:', resultDoubleBTC.toRemove.some(p => p.symbol === 'BTC/USD') ? 'Will adjust BTC/USD' : 'No adjustment');
  console.log('');

  // SCENARIO 5: Trader reduces BTC by 10% (minor change)
  console.log('');
  console.log('📊 SCENARIO 5: Trader Reduces BTC by 10% (minor change)');

  // Reset to original trader positions
  state.lastTraderPositions = traderPositions;

  const traderPositionsMinorChange = traderPositions.map(p =>
    p.symbol === 'BTC' ? { ...p, size: p.size * 0.9, margin: p.margin * 0.9 } : p
  );
  console.log('Last Trader BTC size:', traderPositions.find(p => p.symbol === 'BTC').size);
  console.log('New Trader BTC size:', traderPositionsMinorChange.find(p => p.symbol === 'BTC').size);

  const targetPositionsMinorChange = traderPositionsMinorChange.map(p => ({
    symbol: p.symbol,
    side: p.side,
    size: p.size * 0.025,
    entryPrice: p.entryPrice,
    leverage: p.leverage,
    margin: p.margin * 0.025
  }));
  console.log('New Target BTC size:', targetPositionsMinorChange.find(p => p.symbol === 'BTC').size);

  const resultMinorChange = calculatePositionDiff(userPositions, targetPositionsMinorChange, traderPositionsMinorChange);
  console.log('');
  console.log('✅ Expected: Should NOT adjust BTC/USD (change <20%)');
  console.log('✅ Actual:', resultMinorChange.toRemove.some(p => p.symbol === 'BTC/USD') ? 'Will adjust (unexpected)' : 'No adjustment (correct)');
  console.log('');

  console.log('🧪 ========== END OF SIMULATION ==========');

  // Verify expectations
  console.log('');
  console.log('🎯 VERIFICATION:');
  const scenario1Pass = resultCurrent.toAdd.length === 2 &&
                       resultCurrent.toAdd.some(p => p.symbol === 'BNB') &&
                       resultCurrent.toAdd.some(p => p.symbol === 'DOGE');
  console.log(`Scenario 1: ${scenario1Pass ? '✅ PASS' : '❌ FAIL'} - Should open BNB and DOGE`);

  const scenario2Pass = resultWithoutBTC.toRemove.length === 1 &&
                       resultWithoutBTC.toRemove[0].symbol === 'BTC/USD' &&
                       resultWithoutBTC.toAdd.length === 2;
  console.log(`Scenario 2: ${scenario2Pass ? '✅ PASS' : '❌ FAIL'} - Should close BTC/USD only and open BNB, DOGE`);

  const scenario3Pass = resultWithoutBTCETH.toRemove.length === 2 &&
                       resultWithoutBTCETH.toRemove.some(p => p.symbol === 'BTC/USD') &&
                       resultWithoutBTCETH.toRemove.some(p => p.symbol === 'ETH/USD') &&
                       resultWithoutBTCETH.toAdd.length === 2;
  console.log(`Scenario 3: ${scenario3Pass ? '✅ PASS' : '❌ FAIL'} - Should close BTC/USD and ETH/USD, open BNB and DOGE`);

  const scenario4Pass = resultDoubleBTC.toRemove.some(p => p.symbol === 'BTC/USD') &&
                       resultDoubleBTC.toAdd.some(p => p.symbol === 'BTC');
  console.log(`Scenario 4: ${scenario4Pass ? '✅ PASS' : '❌ FAIL'} - Should adjust BTC/USD when trader increases by 100%`);

  const scenario5Pass = !resultMinorChange.toRemove.some(p => p.symbol === 'BTC/USD');
  console.log(`Scenario 5: ${scenario5Pass ? '✅ PASS' : '❌ FAIL'} - Should NOT adjust BTC/USD when trader changes by 10%`);

  return {
    scenario1: resultCurrent,
    scenario2: resultWithoutBTC,
    scenario3: resultWithoutBTCETH,
    scenario4: resultDoubleBTC,
    scenario5: resultMinorChange
  };
}

// Run the test
testPositionDiff();

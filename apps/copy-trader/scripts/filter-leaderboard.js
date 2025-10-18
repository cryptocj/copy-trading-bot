#!/usr/bin/env node

/**
 * Filter leaderboard data to active traders with account value > $50,000
 * Reduces 20MB JSON to small filtered dataset for frontend deployment
 */

const fs = require('fs');

const INPUT_FILE = 'apps/copy-trader/data/leaderboard.json';
const OUTPUT_FILE = 'apps/copy-trader/data/leaderboard-top20.json';

console.log('Reading full leaderboard data...');
const data = JSON.parse(fs.readFileSync(INPUT_FILE, 'utf8'));

console.log(`Processing ${data.leaderboardRows.length} traders...`);

// Parse and filter traders
const traders = data.leaderboardRows
  .map((row) => {
    const monthlyPerf = row.windowPerformances?.find(([period]) => period === 'month');

    if (!monthlyPerf || !monthlyPerf[1]) {
      return null;
    }

    const metrics = monthlyPerf[1];
    const accountValue = parseFloat(row.accountValue) || 0;
    const pnl = parseFloat(metrics.pnl) || 0;
    const volume = parseFloat(metrics.vlm) || 0;
    const roi = parseFloat(metrics.roi) || 0; // Use API's ROI calculation for monthly

    // Filter criteria
    if (accountValue < 50000) return null; // Min $50K account value
    if (volume === 0) return null; // Must have trading volume (active)

    return {
      address: row.ethAddress,
      accountValue: accountValue,
      pnl: pnl,
      roi: roi,
      volume: volume,
      displayName: row.displayName || null
    };
  })
  .filter((trader) => trader !== null);

console.log(`Filtered to ${traders.length} active traders with account value > $50K`);

// Sort by ROI descending
traders.sort((a, b) => b.roi - a.roi);

// Take top 20
const top20 = traders.slice(0, 20);

// Save filtered data
const output = { traders: top20 };
fs.writeFileSync(OUTPUT_FILE, JSON.stringify(output, null, 2));

const inputSize = (fs.statSync(INPUT_FILE).size / 1024 / 1024).toFixed(2);
const outputSize = (fs.statSync(OUTPUT_FILE).size / 1024).toFixed(2);

console.log(`\n✓ Top 20 from ${traders.length} qualified traders`);
console.log(`✓ Input: ${inputSize} MB → Output: ${outputSize} KB`);
console.log(`✓ Saved to: ${OUTPUT_FILE}`);
console.log('\nTop 5 traders:');
top20.slice(0, 5).forEach((trader, i) => {
  console.log(`  ${i + 1}. ${trader.address.slice(0, 10)}... Account: $${trader.accountValue.toLocaleString()} ROI: ${(trader.roi * 100).toFixed(2)}%`);
});

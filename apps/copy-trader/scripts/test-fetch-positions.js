import { MoonlanderExchange } from '../src/services/moonlander.js';
import { getMoonlanderConfig } from '../src/config/moonlander.js';
import dotenv from 'dotenv';

dotenv.config();

async function testFetchPositions() {
  console.log('🚀 Testing Moonlander Mainnet Position Fetching\n');

  // Get mainnet configuration
  const config = getMoonlanderConfig('mainnet');

  // Create exchange instance with full config + private key
  const exchange = new MoonlanderExchange({
    ...config,
    privateKey: process.env.MOONLANDER_PRIVATE_KEY,
  });

  try {
    console.log('📊 Fetching positions...\n');
    const positions = await exchange.fetchPositions();

    console.log(`✅ Found ${positions.length} positions\n`);

    if (positions.length === 0) {
      console.log('No positions found');
      return;
    }

    positions.forEach((pos, index) => {
      console.log(`Position ${index + 1}:`);
      console.log(`  Symbol: ${pos.symbol}`);
      console.log(`  Pair Address: ${pos.pairAddress}`);
      console.log(`  Side: ${pos.side}`);
      console.log(`  Size: ${pos.size}`);
      console.log(`  Entry Price: ${pos.entryPrice}`);
      console.log(`  Leverage: ${pos.leverage}x`);
      console.log(`  Margin: ${pos.margin}`);
      console.log(`  Stop Loss: ${pos.stopLoss}`);
      console.log(`  Take Profit: ${pos.takeProfit}`);
      console.log(`  Trade Hash: ${pos.tradeHash || 'N/A'}`);
      console.log(`  Open Timestamp: ${pos.openTimestamp ? new Date(pos.openTimestamp * 1000).toISOString() : 'N/A'}`);
      console.log();
    });
  } catch (error) {
    console.error('❌ Error fetching positions:', error);
    console.error(error.stack);
  }
}

testFetchPositions();

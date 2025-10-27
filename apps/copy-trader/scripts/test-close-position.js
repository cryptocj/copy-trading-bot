import { MoonlanderExchange } from '../src/services/moonlander.js';
import { getMoonlanderConfig } from '../src/config/moonlander.js';
import dotenv from 'dotenv';

dotenv.config();

async function testClosePosition() {
  console.log('🚀 Testing Moonlander Mainnet Position Closing\n');

  // Get mainnet configuration
  const config = getMoonlanderConfig('mainnet');

  // Create exchange instance
  const exchange = new MoonlanderExchange({
    ...config,
    privateKey: process.env.MOONLANDER_PRIVATE_KEY,
  });

  try {
    // Step 1: Fetch current positions
    console.log('📊 Fetching positions...\n');
    const positions = await exchange.fetchPositions();

    if (positions.length === 0) {
      console.log('❌ No positions found to close');
      return;
    }

    console.log(`✅ Found ${positions.length} positions\n`);

    // Display positions
    positions.forEach((pos, index) => {
      console.log(`Position ${index + 1}:`);
      console.log(`  Symbol: ${pos.symbol}`);
      console.log(`  Side: ${pos.side.toUpperCase()}`);
      console.log(`  Size: ${pos.size}`);
      console.log(`  Entry Price: $${pos.entryPrice.toLocaleString()}`);
      console.log(`  Leverage: ${pos.leverage.toFixed(2)}x`);
      console.log(`  Margin: $${pos.margin.toFixed(2)}`);
      console.log(`  Position Hash: ${pos.tradeHash}`);
      console.log();
    });

    // Step 2: Close the first position
    const positionToClose = positions[0];
    console.log(`\n🔒 Closing position: ${positionToClose.symbol} ${positionToClose.side.toUpperCase()}`);
    console.log(`   Position Hash: ${positionToClose.tradeHash}`);
    console.log(`   Size: ${positionToClose.size}`);
    console.log(`   Entry: $${positionToClose.entryPrice.toLocaleString()}`);
    console.log();

    // Confirm before closing
    console.log('⚠️  This will close the position on MAINNET with REAL funds!');
    console.log('   Press Ctrl+C within 5 seconds to cancel...\n');

    // Wait 5 seconds
    await new Promise(resolve => setTimeout(resolve, 5000));

    // Close the position
    const result = await exchange.closePosition(positionToClose.tradeHash);

    console.log('\n✅ Position closed successfully!');
    console.log(`   Transaction Hash: ${result.txHash}`);
    console.log(`   Status: ${result.status}`);
    console.log(`   View on Cronoscan: https://cronoscan.com/tx/${result.txHash}`);

    // Step 3: Verify position is closed
    console.log('\n🔍 Verifying position is closed...');
    const updatedPositions = await exchange.fetchPositions();
    const stillExists = updatedPositions.find(p => p.tradeHash === positionToClose.tradeHash);

    if (stillExists) {
      console.log('⚠️  Warning: Position still appears in positions list');
    } else {
      console.log('✅ Position successfully removed from positions list');
    }

    console.log(`\n📊 Remaining positions: ${updatedPositions.length}`);

  } catch (error) {
    console.error('\n❌ Error:', error.message);
    console.error(error.stack);
  }
}

testClosePosition();

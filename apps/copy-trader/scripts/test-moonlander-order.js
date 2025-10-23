/**
 * Moonlander Order Creation Test
 * Test creating market orders on Moonlander testnet
 *
 * Setup:
 *   1. Ensure .env has MOONLANDER_PRIVATE_KEY
 *   2. Fund wallet with testnet CRO (for gas)
 *   3. Fund wallet with testnet USDC (for margin)
 *   4. Run: node test-moonlander-order.js
 */

import dotenv from 'dotenv';
import { MoonlanderExchange } from './src/services/moonlander.js';
import { MOONLANDER_TESTNET } from './src/config/moonlander.js';

dotenv.config();

// ============================================
// Configuration
// ============================================
const CONFIG = {
  // From .env
  privateKey: process.env.MOONLANDER_PRIVATE_KEY,

  // Testnet addresses
  diamondAddress:
    process.env.MOONLANDER_DIAMOND_ADDRESS || '0xf8Ac0F8A18c3f63fBd547b4D166945EB4b3D833A',
  usdcAddress: process.env.MOONLANDER_USDC_ADDRESS || '0x01A15d3504446928EB56dbc58D5dDA120D502Be4',

  // Order parameters (SAFE SMALL VALUES FOR TESTING)
  testPair: 'BTC/USD',
  marginAmount: '1000', // $10 USDC margin
  positionSize: '0.01', // 0.001 BTC position size
  side: 'buy', // 'buy' for LONG, 'sell' for SHORT
};

// ============================================
// Main Test
// ============================================

async function testOrderCreation() {
  console.log('🌙 Moonlander Order Creation Test\n');
  console.log('='.repeat(60));

  // Validate
  if (!CONFIG.privateKey) {
    console.error('\n❌ Error: MOONLANDER_PRIVATE_KEY not set in .env\n');
    process.exit(1);
  }

  let exchange;

  try {
    // Initialize exchange
    console.log('\n📌 Step 1: Initialize Moonlander Exchange');
    exchange = new MoonlanderExchange({
      privateKey: CONFIG.privateKey,
      rpcUrl: MOONLANDER_TESTNET.rpcUrl,
      diamondAddress: CONFIG.diamondAddress,
      marginTokenAddress: CONFIG.usdcAddress,
      pythEndpoint: MOONLANDER_TESTNET.pythEndpoint,
      pairAddresses: MOONLANDER_TESTNET.pairAddresses,
    });

    console.log(`✅ Connected to ${MOONLANDER_TESTNET.network}`);
    console.log(`   Wallet: ${exchange.walletAddress}`);

    // Check CRO balance
    console.log('\n📌 Step 2: Check Gas Balance (CRO)');
    const croBalance = await exchange.provider.getBalance(exchange.walletAddress);
    const croBalanceEth = Number(croBalance) / 1e18;
    console.log(`   CRO Balance: ${croBalanceEth.toFixed(4)} CRO`);

    if (croBalanceEth < 0.01) {
      console.warn('   ⚠️  Warning: Low CRO balance, may not be enough for gas');
      console.warn('   Get testnet CRO from: https://cronos.org/faucet\n');
    } else {
      console.log('   ✅ Sufficient CRO for gas\n');
    }

    // Check USDC balance
    console.log('📌 Step 3: Check Margin Balance (USDC)');
    const balance = await exchange.fetchBalance();
    console.log(`   Total: $${balance.total.toFixed(2)}`);
    console.log(`   Available: $${balance.free.toFixed(2)}`);

    const requiredMargin = parseFloat(CONFIG.marginAmount);
    if (balance.free < requiredMargin) {
      console.error(`\n❌ Insufficient USDC balance!`);
      console.error(`   Required: $${requiredMargin}`);
      console.error(`   Available: $${balance.free.toFixed(2)}\n`);
      console.error('💡 You need testnet USDC. Options:');
      console.error('   1. Find a testnet USDC faucet');
      console.error('   2. Swap testnet CRO for USDC on a testnet DEX');
      console.error('   3. Contact Moonlander team for test tokens\n');
      process.exit(1);
    }
    console.log('   ✅ Sufficient USDC for margin\n');

    // Get current price
    // console.log('📌 Step 4: Fetch Current Price');
    // const { price: currentPrice } = await exchange.fetchPrice(CONFIG.testPair);
    // const priceFormatted = Number(currentPrice) / 1e18;
    // console.log(`   ${CONFIG.testPair}: $${priceFormatted.toFixed(2)}`);
    // console.log('   ✅ Price fetched successfully\n');

    // // Show order summary
    // console.log('📌 Step 5: Order Summary');
    // console.log(`   Pair: ${CONFIG.testPair}`);
    // console.log(`   Side: ${CONFIG.side.toUpperCase()} (${CONFIG.side === 'buy' ? 'LONG' : 'SHORT'})`);
    // console.log(`   Margin: $${CONFIG.marginAmount} USDC`);
    // console.log(`   Position Size: ${CONFIG.positionSize} BTC`);
    // console.log(`   Estimated Entry: ~$${priceFormatted.toFixed(2)}`);

    // const notionalValue = parseFloat(CONFIG.positionSize) * priceFormatted;
    // const leverage = notionalValue / parseFloat(CONFIG.marginAmount);
    // console.log(`   Notional Value: $${notionalValue.toFixed(2)}`);
    // console.log(`   Effective Leverage: ${leverage.toFixed(1)}x\n`);

    // // Confirm before placing order
    // console.log('⚠️  REAL ORDER - This will execute on blockchain!');
    // console.log('   - Gas will be deducted from your CRO');
    // console.log('   - Margin will be locked in the contract');
    // console.log('   - Order will be pending until keeper executes\n');

    // Create order
    console.log('📌 Step 6: Creating Market Order...\n');
    console.log('='.repeat(60));

    const result = await exchange.createMarketOrder({
      pairBase: CONFIG.testPair,
      side: CONFIG.side,
      amount: CONFIG.marginAmount,
      qty: CONFIG.positionSize,
      broker: 1,
    });

    console.log('='.repeat(60));
    console.log('\n✅ ORDER CREATED SUCCESSFULLY!\n');
    console.log('📋 Order Details:');
    console.log(`   Trade Hash: ${result.tradeHash}`);
    console.log(`   Transaction: ${result.txHash}`);
    console.log(`   Status: ${result.status.toUpperCase()}`);
    console.log('');
    console.log('⏳ Next Steps:');
    console.log('   1. Order is PENDING - awaiting keeper execution');
    console.log('   2. Keeper will execute within 1-5 minutes typically');
    console.log('   3. Monitor on Cronos testnet explorer:');
    console.log(`      https://explorer.cronos.org/testnet/tx/${result.txHash}`);
    console.log('');

    // Check position after order
    console.log('📌 Step 7: Checking Positions...');
    const positions = await exchange.fetchPositions();

    if (positions.length > 0) {
      console.log(`   Found ${positions.length} position(s):\n`);
      positions.forEach((pos, i) => {
        const posSize = Number(pos.size) / 1e10;
        const posEntry = Number(pos.entryPrice) / 1e18;

        console.log(`   ${i + 1}. ${pos.symbol} ${pos.side.toUpperCase()}`);
        console.log(`      Size: ${posSize}`);
        console.log(`      Entry: $${posEntry.toFixed(2)}`);
        console.log(`      Leverage: ${pos.leverage}x`);
      });
    } else {
      console.log('   No active positions yet (order still pending)');
    }

    console.log('\n' + '='.repeat(60));
    console.log('✨ Test completed successfully!\n');
  } catch (error) {
    console.error('\n❌ Test failed:', error.message);

    if (error.code === 'CALL_EXCEPTION') {
      console.error('\n💡 Possible reasons:');
      console.error('   - Contract function reverted (check parameters)');
      console.error('   - Insufficient token approval');
      console.error('   - Pair not available on Moonlander');
      console.error('   - Margin or size below minimum');
    } else if (error.code === 'INSUFFICIENT_FUNDS') {
      console.error('\n💡 Not enough CRO for gas fees');
      console.error('   Get testnet CRO: https://cronos.org/faucet');
    } else if (error.message?.includes('decimals')) {
      console.error('\n💡 Token contract issue');
      console.error('   Check USDC address is correct for testnet');
    }

    console.error('\nFull error:', error);
    process.exit(1);
  }
}

// ============================================
// Safety Confirmation (optional - comment out to skip)
// ============================================

console.log('\n⚠️  WARNING: This will create a REAL order on testnet\n');
console.log('Order Configuration:');
console.log(`  Pair: ${CONFIG.testPair}`);
console.log(`  Side: ${CONFIG.side.toUpperCase()}`);
console.log(`  Margin: $${CONFIG.marginAmount} USDC`);
console.log(`  Size: ${CONFIG.positionSize} BTC\n`);

// Auto-run after showing config
setTimeout(() => {
  testOrderCreation().catch((error) => {
    console.error('Unhandled error:', error);
    process.exit(1);
  });
}, 2000);

console.log('Starting in 2 seconds...\n');

/**
 * Mint Testnet Tokens Script
 * Mints ERC20 tokens on Cronos testnet for testing Moonlander integration
 *
 * Token: Laika (0xAE5C7652ef20e6C35788B29faB96B5E8C5097503)
 *
 * Setup:
 *   1. Ensure .env has MOONLANDER_PRIVATE_KEY set
 *   2. Run: node mint-testnet-tokens.js
 */

import dotenv from 'dotenv';
import { ethers } from 'ethers';

dotenv.config();

// ============================================
// Configuration
// ============================================

const CONFIG = {
  // Laika ERC20 Token (with mint/burn)
  tokenAddress: '0x01A15d3504446928EB56dbc58D5dDA120D502Be4',

  // Cronos Testnet
  rpcUrl: 'https://evm-t3.cronos.org',
  chainId: 338,

  // From .env
  privateKey: process.env.MOONLANDER_PRIVATE_KEY,

  // Mint parameters
  mintAmount: '10000000000', // 10,000 tokens (assuming 6 decimals)
};

// ERC20 ABI (balanceOf, mint, burn)
const ERC20_MINT_BURN_ABI = [
  // balanceOf
  {
    constant: true,
    inputs: [{ name: 'owner', type: 'address' }],
    name: 'balanceOf',
    outputs: [{ name: '', type: 'uint256' }],
    payable: false,
    stateMutability: 'view',
    type: 'function',
  },
  // mint
  {
    constant: false,
    inputs: [
      { name: 'to', type: 'address' },
      { name: 'value', type: 'uint256' },
    ],
    name: 'mint',
    outputs: [{ name: '', type: 'bool' }],
    payable: false,
    stateMutability: 'nonpayable',
    type: 'function',
  },
  // burn
  {
    constant: false,
    inputs: [{ name: 'value', type: 'uint256' }],
    name: 'burn',
    outputs: [],
    payable: false,
    stateMutability: 'nonpayable',
    type: 'function',
  },
  // decimals (helpful for display)
  {
    constant: true,
    inputs: [],
    name: 'decimals',
    outputs: [{ name: '', type: 'uint8' }],
    payable: false,
    stateMutability: 'view',
    type: 'function',
  },
  // symbol (helpful for display)
  {
    constant: true,
    inputs: [],
    name: 'symbol',
    outputs: [{ name: '', type: 'string' }],
    payable: false,
    stateMutability: 'view',
    type: 'function',
  },
];

// ============================================
// Main Functions
// ============================================

async function mintTokens() {
  console.log('🪙 Testnet Token Minting Script\n');
  console.log('='.repeat(50));

  // Validate config
  if (!CONFIG.privateKey) {
    console.error('\n❌ Error: MOONLANDER_PRIVATE_KEY not set in .env file\n');
    console.error('Setup Instructions:');
    console.error('   1. Copy .env.example to .env');
    console.error('   2. Add your private key to .env');
    console.error('   3. Run: node mint-testnet-tokens.js\n');
    process.exit(1);
  }

  try {
    // Setup provider and signer
    console.log('\n📡 Connecting to Cronos Testnet...');
    const provider = new ethers.JsonRpcProvider(CONFIG.rpcUrl);
    const signer = new ethers.Wallet(CONFIG.privateKey, provider);
    const walletAddress = signer.address;

    // Verify network
    const network = await provider.getNetwork();
    console.log(`✅ Connected to chain ID: ${network.chainId}`);
    console.log(`   Wallet: ${walletAddress}`);

    // Check CRO balance (for gas)
    const croBalance = await provider.getBalance(walletAddress);
    const croBalanceEth = ethers.formatEther(croBalance);
    console.log(`   CRO Balance: ${croBalanceEth} CRO`);

    if (Number(croBalanceEth) < 0.01) {
      console.warn('\n⚠️  Warning: Low CRO balance. You may need testnet CRO for gas.');
      console.warn('   Get testnet CRO from: https://cronos.org/faucet');
    }

    // Setup token contract
    console.log('\n🔗 Connecting to token contract...');
    const token = new ethers.Contract(CONFIG.tokenAddress, ERC20_MINT_BURN_ABI, signer);

    // Get token info
    let symbol, decimals;
    try {
      symbol = await token.symbol();
      decimals = await token.decimals();
      console.log(`✅ Token: ${symbol}`);
      console.log(`   Address: ${CONFIG.tokenAddress}`);
      console.log(`   Decimals: ${decimals}`);
    } catch (error) {
      console.warn(
        '⚠️  Could not read token symbol/decimals (contract may not have these methods)'
      );
      symbol = 'LAIKA';
      decimals = 6; // Assume 6 decimals
    }

    // Check balance before minting
    console.log('\n📊 Balance Before Minting:');
    const balanceBefore = await token.balanceOf(walletAddress);
    const formattedBefore = ethers.formatUnits(balanceBefore, decimals);
    console.log(`   ${formattedBefore} ${symbol}`);

    // Mint tokens
    console.log('\n💰 Minting tokens...');
    const mintAmount = CONFIG.mintAmount;
    console.log(`   Amount: ${ethers.formatUnits(mintAmount, decimals)} ${symbol}`);
    console.log(`   To: ${walletAddress}`);

    const tx = await token.mint(walletAddress, mintAmount, {
      gasLimit: 200000, // Set explicit gas limit
    });

    console.log(`   Transaction sent: ${tx.hash}`);
    console.log('   Waiting for confirmation...');

    const receipt = await tx.wait();
    console.log(`✅ Minted! Block: ${receipt.blockNumber}`);

    // Check balance after minting
    console.log('\n📊 Balance After Minting:');
    const balanceAfter = await token.balanceOf(walletAddress);
    const formattedAfter = ethers.formatUnits(balanceAfter, decimals);
    console.log(`   ${formattedAfter} ${symbol}`);

    const minted = balanceAfter - balanceBefore;
    const formattedMinted = ethers.formatUnits(minted, decimals);
    console.log(`   Minted: +${formattedMinted} ${symbol}`);

    console.log('\n' + '='.repeat(50));
    console.log('✨ Success! Tokens minted to your wallet.\n');
  } catch (error) {
    console.error('\n❌ Error:', error.message);

    if (error.code === 'CALL_EXCEPTION') {
      console.error('\n💡 Possible reasons:');
      console.error('   - Your wallet does not have minting permissions');
      console.error('   - The token contract does not support minting');
      console.error('   - Contract is paused or has restrictions');
    } else if (error.code === 'INSUFFICIENT_FUNDS') {
      console.error('\n💡 Get testnet CRO from: https://cronos.org/faucet');
    } else if (error.code === 'NETWORK_ERROR') {
      console.error('\n💡 Check your internet connection and RPC endpoint');
    }

    console.error('\nFull error:', error);
    process.exit(1);
  }
}

// ============================================
// Run Script
// ============================================

mintTokens();

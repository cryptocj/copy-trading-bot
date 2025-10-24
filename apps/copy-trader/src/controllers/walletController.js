/**
 * Wallet controller
 * Handles wallet loading, refreshing, and display operations
 */

import { config, getApiKey } from '../state/appState.js';
import { STORAGE_KEYS } from '../services/storage.js';
import { validateAddress } from '../services/validation.js';
import { displayValidationError, checkFormValidity } from '../validation/formValidation.js';
import { displayYourWalletInfo, fetchAndDisplayYourWallet, fetchBalanceForAddress, fetchPositionsForAddress } from '../rendering/wallet.js';
import { showHistoryPanel } from '../rendering/history.js';
import { fetchAndDisplayRecentOrders } from '../rendering/orders.js';

/**
 * Refresh wallet info for "My Wallet & Positions" section
 * Uses saved wallet address if available, otherwise derives from API key
 * For Moonlander: Queries Diamond contract directly
 * For Hyperliquid: Uses Hyperliquid API
 * @param {object} elements - DOM element references
 * @param {boolean} isCopyTradingActive - Current trading state
 */
export async function refreshWalletInfo(elements, isCopyTradingActive) {
  console.log('Refreshing wallet info...');

  // Check execution platform to determine which data source to use
  if (config.executionPlatform === 'moonlander') {
    console.log('🌙 Using Moonlander Diamond contract for positions');

    // For Moonlander, we need the private key to initialize the exchange
    if (!config.moonlander?.privateKey) {
      console.log('⚠️ No Moonlander private key configured');
      return;
    }

    try {
      // Show loading state
      elements.yourWalletPlaceholder.style.display = 'none';
      elements.yourWalletError.style.display = 'none';
      elements.yourWalletContent.style.display = 'none';
      elements.yourWalletLoading.style.display = 'block';

      // Normalize private key - add 0x prefix if missing
      let normalizedPrivateKey = config.moonlander.privateKey.trim();
      console.log(`🔍 Raw private key length: ${normalizedPrivateKey.length} characters`);
      console.log(`🔍 Raw private key preview: ${normalizedPrivateKey.substring(0, 10)}...`);
      console.log(`🔍 Last 10 chars: ...${normalizedPrivateKey.substring(Math.max(0, normalizedPrivateKey.length - 10))}`);

      if (!normalizedPrivateKey.startsWith('0x')) {
        normalizedPrivateKey = `0x${normalizedPrivateKey}`;
        console.log(`✅ Added 0x prefix`);
      }

      console.log(`🔍 Normalized private key length: ${normalizedPrivateKey.length} characters (should be 66 with 0x)`);

      // Validate private key format (should be 0x followed by 64 hex characters)
      if (!/^0x[a-fA-F0-9]{64}$/.test(normalizedPrivateKey)) {
        const actualLength = normalizedPrivateKey.length - 2;
        const hasInvalidChars = !/^0x[a-fA-F0-9]+$/.test(normalizedPrivateKey);

        let errorMsg = `Invalid private key format:\n`;
        errorMsg += `- Expected: 64 hex characters (0-9, a-f, A-F)\n`;
        errorMsg += `- Got: ${actualLength} characters\n`;

        if (hasInvalidChars) {
          errorMsg += `- Contains invalid characters (only hex allowed: 0-9, a-f, A-F)\n`;
        }

        if (actualLength < 64) {
          errorMsg += `- Too short by ${64 - actualLength} characters\n`;
        } else if (actualLength > 64) {
          errorMsg += `- Too long by ${actualLength - 64} characters\n`;
        }

        errorMsg += `\nPrivate key preview: ${normalizedPrivateKey.substring(0, Math.min(20, normalizedPrivateKey.length))}...`;

        throw new Error(errorMsg);
      }

      console.log(`✅ Private key validation passed`);

      // Additional check: Try to create a wallet first to verify the key is valid
      let testWallet;
      try {
        testWallet = new ethers.Wallet(normalizedPrivateKey);
        console.log(`✅ Test wallet created successfully: ${testWallet.address}`);
      } catch (testError) {
        console.error('❌ Failed to create test wallet:', testError);
        throw new Error(
          `Private key is correct format but ethers.js rejects it:\n${testError.message}\n\n` +
          `This could mean:\n` +
          `1. The private key contains hidden/invalid characters\n` +
          `2. The private key is not a valid secp256k1 private key\n` +
          `3. Copy-paste introduced encoding issues\n\n` +
          `Try re-entering the private key manually (don't copy-paste).`
        );
      }

      // Dynamically import MoonlanderExchange (browser version) and config
      const { MoonlanderExchange } = await import('../services/moonlander-browser.js');
      const { getMoonlanderConfig } = await import('../config/moonlander.js');

      // Get Moonlander config
      const moonlanderConfig = getMoonlanderConfig(config.moonlander.network);

      console.log('🌙 Loaded Moonlander config:', {
        diamond: moonlanderConfig.diamondAddress,
        usdc: moonlanderConfig.marginTokenAddress,
        pairs: Object.keys(moonlanderConfig.pairAddresses).length,
      });

      // Create and initialize Moonlander exchange instance
      const exchange = new MoonlanderExchange({
        privateKey: normalizedPrivateKey,
        ...moonlanderConfig,
      });

      // Initialize contracts (loads ABIs)
      await exchange.initialize();

      console.log(`📍 Querying positions for wallet: ${exchange.walletAddress}`);

      // Fetch balance and positions from Diamond contract
      const [balance, positions] = await Promise.all([
        exchange.fetchBalance(),
        exchange.fetchPositions(),
      ]);

      console.log('✅ Moonlander data fetched:', { balance, positions });

      // Display in "My Wallet & Positions" section
      displayYourWalletInfo(elements, balance, positions);

      // Note: Recent orders not available for Moonlander yet
      console.log('⚠️ Recent orders not yet implemented for Moonlander');

      console.log(`✅ Moonlander wallet ${exchange.walletAddress} refreshed successfully`);
    } catch (error) {
      console.error('Failed to refresh Moonlander wallet:', error);

      // Show error
      elements.yourWalletPlaceholder.style.display = 'none';
      elements.yourWalletLoading.style.display = 'none';
      elements.yourWalletContent.style.display = 'none';
      elements.yourWalletError.style.display = 'block';
      elements.yourWalletError.textContent = `Failed to refresh Moonlander wallet: ${error.message}`;
    }
    return;
  }

  // Hyperliquid mode: Use saved address or API key
  const savedAddress = localStorage.getItem(STORAGE_KEYS.MY_WALLET_ADDRESS);

  if (savedAddress) {
    console.log(`🔄 Using saved wallet address: ${savedAddress}`);

    try {
      // Show loading state
      elements.yourWalletPlaceholder.style.display = 'none';
      elements.yourWalletError.style.display = 'none';
      elements.yourWalletContent.style.display = 'none';
      elements.yourWalletLoading.style.display = 'block';

      // Fetch balance and positions using saved address from Hyperliquid API
      const [balance, positions] = await Promise.all([
        fetchBalanceForAddress(savedAddress),
        fetchPositionsForAddress(savedAddress),
      ]);

      // Display in "My Wallet & Positions" section
      displayYourWalletInfo(elements, balance, positions);

      // Fetch and display recent orders for this wallet
      await fetchAndDisplayRecentOrders(elements, savedAddress);

      console.log(`✅ Wallet ${savedAddress} refreshed successfully`);
    } catch (error) {
      console.error('Failed to refresh wallet by address:', error);

      // Show error
      elements.yourWalletPlaceholder.style.display = 'none';
      elements.yourWalletLoading.style.display = 'none';
      elements.yourWalletContent.style.display = 'none';
      elements.yourWalletError.style.display = 'block';
      elements.yourWalletError.textContent = `Failed to refresh wallet: ${error.message}`;
    }
    return;
  }

  // Fall back to API key derivation if no saved address
  const apiKey = getApiKey();

  // Validate inputs
  if (!apiKey) {
    alert('Please enter your API key first');
    return;
  }

  try {
    // Derive wallet address from private key
    const wallet = new ethers.Wallet(apiKey);
    const walletAddress = wallet.address;

    // Create exchange instance for querying
    const exchange = new ccxt.hyperliquid({
      privateKey: apiKey,
      walletAddress: walletAddress,
    });

    // Load markets once (required by CCXT for fetchBalance and fetchPositions)
    console.log('Loading markets...');
    await exchange.loadMarkets();
    console.log('Markets loaded successfully');

    // Fetch your wallet info
    await fetchAndDisplayYourWallet(elements, exchange);

    // Fetch and display recent orders for this wallet
    await fetchAndDisplayRecentOrders(elements, walletAddress);
  } catch (error) {
    console.error('Failed to refresh wallet info:', error);
    alert(`Failed to refresh wallet info: ${error.message}`);
  }
}

/**
 * Load custom wallet by address input
 * Query balance and positions without needing API key
 * @param {object} elements - DOM element references
 * @param {boolean} isCopyTradingActive - Current trading state
 */
export async function loadCustomWallet(elements, isCopyTradingActive) {
  console.log('Loading custom wallet...');

  const address = elements.customWalletAddress.value.trim();

  // Validate address format (basic Ethereum address check)
  if (!address) {
    alert('Please enter a wallet address');
    return;
  }

  if (!address.match(/^0x[a-fA-F0-9]{40}$/)) {
    alert('Invalid wallet address format. Must be 40 hex characters starting with 0x');
    return;
  }

  try {
    console.log(`Loading wallet data for ${address}...`);

    // Load wallet data in history panel (balance + positions + orders)
    await showHistoryPanel(elements, address);

    // Optionally auto-fill trader address input
    elements.traderAddressInput.value = address;
    config.traderAddress = address;

    // Trigger validation
    const result = validateAddress(address);
    displayValidationError(elements, 'trader-address', result);
    checkFormValidity(elements, isCopyTradingActive);

    console.log(`Custom wallet ${address} loaded successfully`);
  } catch (error) {
    console.error('Failed to load custom wallet:', error);
    alert(`Failed to load wallet: ${error.message}`);
  }
}

/**
 * Load wallet by address directly (for "My Wallet & Positions" section)
 * Query balance and positions without needing API key
 * @param {object} elements - DOM element references
 */
export async function loadMyWalletByAddress(elements) {
  console.log('Loading wallet by address...');

  const address = elements.myWalletAddress.value.trim();

  // Validate address format (basic Ethereum address check)
  if (!address) {
    alert('Please enter a wallet address');
    return;
  }

  if (!address.match(/^0x[a-fA-F0-9]{40}$/)) {
    alert('Invalid wallet address format. Must be 40 hex characters starting with 0x');
    return;
  }

  try {
    console.log(`Loading wallet data for ${address}...`);

    // Show loading state
    elements.yourWalletPlaceholder.style.display = 'none';
    elements.yourWalletError.style.display = 'none';
    elements.yourWalletContent.style.display = 'none';
    elements.yourWalletLoading.style.display = 'block';

    // Fetch balance and positions using direct API (no CCXT exchange needed)
    const [balance, positions] = await Promise.all([
      fetchBalanceForAddress(address),
      fetchPositionsForAddress(address),
    ]);

    // Display in "My Wallet & Positions" section
    displayYourWalletInfo(elements, balance, positions);

    // Fetch and display recent orders for this wallet
    await fetchAndDisplayRecentOrders(elements, address);

    // Save wallet address to localStorage for auto-load on refresh
    localStorage.setItem(STORAGE_KEYS.MY_WALLET_ADDRESS, address);
    console.log(`✅ Saved wallet address to localStorage: ${address}`);

    console.log(`Wallet ${address} loaded successfully`);
    console.log(`Balance:`, balance);
    console.log(`Positions:`, positions);
  } catch (error) {
    console.error('Failed to load wallet by address:', error);

    // Show error
    elements.yourWalletPlaceholder.style.display = 'none';
    elements.yourWalletLoading.style.display = 'none';
    elements.yourWalletContent.style.display = 'none';
    elements.yourWalletError.style.display = 'block';
    elements.yourWalletError.textContent = `Failed to load wallet: ${error.message}`;
  }
}

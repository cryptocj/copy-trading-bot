/**
 * Wallet controller
 * Handles wallet loading, refreshing, and display operations
 */

import { config } from '../state/appState.js';
import { STORAGE_KEYS } from '../services/storage.js';
import { validateAddress } from '../services/validation.js';
import { displayValidationError, checkFormValidity } from '../validation/formValidation.js';
import { displayYourWalletInfo, fetchAndDisplayYourWallet, fetchBalanceForAddress, fetchPositionsForAddress } from '../rendering/wallet.js';
import { showHistoryPanel } from '../rendering/history.js';

/**
 * Refresh wallet info for "My Wallet & Positions" section
 * Uses saved wallet address if available, otherwise derives from API key
 * @param {object} elements - DOM element references
 * @param {boolean} isCopyTradingActive - Current trading state
 */
export async function refreshWalletInfo(elements, isCopyTradingActive) {
  console.log('Refreshing wallet info...');

  // Check for saved custom wallet address first
  const savedAddress = localStorage.getItem(STORAGE_KEYS.MY_WALLET_ADDRESS);

  if (savedAddress) {
    console.log(`🔄 Using saved wallet address: ${savedAddress}`);

    try {
      // Show loading state
      elements.yourWalletPlaceholder.style.display = 'none';
      elements.yourWalletError.style.display = 'none';
      elements.yourWalletContent.style.display = 'none';
      elements.yourWalletLoading.style.display = 'block';

      // Fetch balance and positions using saved address
      const [balance, positions] = await Promise.all([
        fetchBalanceForAddress(savedAddress),
        fetchPositionsForAddress(savedAddress),
      ]);

      // Display in "My Wallet & Positions" section
      displayYourWalletInfo(elements, balance, positions);

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
  const { userApiKey } = config;

  // Validate inputs
  if (!userApiKey) {
    alert('Please enter your API key first');
    return;
  }

  try {
    // Derive wallet address from private key
    const wallet = new ethers.Wallet(userApiKey);
    const walletAddress = wallet.address;

    // Create exchange instance for querying
    const exchange = new ccxt.hyperliquid({
      privateKey: userApiKey,
      walletAddress: walletAddress,
    });

    // Load markets once (required by CCXT for fetchBalance and fetchPositions)
    console.log('Loading markets...');
    await exchange.loadMarkets();
    console.log('Markets loaded successfully');

    // Fetch your wallet info
    await fetchAndDisplayYourWallet(elements, exchange);
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

/**
 * LocalStorage management service
 * Handles wallet-specific and global settings persistence
 */

// localStorage keys
export const STORAGE_KEYS = {
  // Wallet-specific configuration (per monitored wallet)
  getTraderAddressKey: (wallet) => `copyTrading.traderAddress.${wallet}`,
  getCopyBalanceKey: (wallet) => `copyTrading.copyBalance.${wallet}`,
  LAST_MONITORED_WALLET: 'copyTrading.lastMonitoredWallet', // Track last active wallet

  // Global settings (shared across tabs)
  API_KEY: 'copyTrading.apiKey',
  SAVE_API_KEY: 'copyTrading.saveApiKey',
  HISTORY_COLLAPSED: 'copyTrading.historyCollapsed',
  WALLETS_COLLAPSED: 'copyTrading.walletsCollapsed',
  MY_WALLET_ADDRESS: 'copyTrading.myWalletAddress', // Custom wallet address for "My Wallet"
};

/**
 * Load saved settings from localStorage
 * @param {object} elements - DOM elements object
 * @param {object} config - Application config object
 * @param {Function} checkFormValidityFn - Function to check form validity
 * @param {Function} refreshWalletInfoFn - Function to refresh wallet info
 */
export function loadSavedSettings(elements, config, checkFormValidityFn, refreshWalletInfoFn) {
  console.log('📥 Loading saved settings from localStorage...');

  // Load last monitored wallet
  const lastWallet = localStorage.getItem(STORAGE_KEYS.LAST_MONITORED_WALLET);
  console.log(`📋 Last monitored wallet: ${lastWallet || 'none'}`);

  let savedTraderAddress = null;
  let savedCopyBalance = null;

  // If we have a last monitored wallet, load its specific configuration
  if (lastWallet) {
    const traderAddressKey = STORAGE_KEYS.getTraderAddressKey(lastWallet);
    const copyBalanceKey = STORAGE_KEYS.getCopyBalanceKey(lastWallet);

    savedTraderAddress = localStorage.getItem(traderAddressKey);
    savedCopyBalance = localStorage.getItem(copyBalanceKey);

    console.log(`🔑 Loading config with keys:`);
    console.log(`  - traderAddressKey: ${traderAddressKey}`);
    console.log(`  - copyBalanceKey: ${copyBalanceKey}`);
    console.log(`  - traderAddress: ${savedTraderAddress || 'not found'}`);
    console.log(`  - copyBalance: ${savedCopyBalance || 'not found'}`);

    if (savedTraderAddress) {
      elements.traderAddressInput.value = savedTraderAddress;
      config.traderAddress = savedTraderAddress;
    }

    if (savedCopyBalance) {
      elements.copyBalanceInput.value = savedCopyBalance;
      config.copyBalance = parseFloat(savedCopyBalance);
    }

    console.log(`✅ Loaded configuration for wallet: ${lastWallet}`);
  } else {
    console.log('⚠️ No last monitored wallet found');
  }

  // Load API key only if user opted in (global setting)
  const saveApiKey = localStorage.getItem(STORAGE_KEYS.SAVE_API_KEY) === 'true';
  const saveApiKeyCheckbox = document.getElementById('save-api-key');
  if (saveApiKeyCheckbox) {
    saveApiKeyCheckbox.checked = saveApiKey;
  }

  let savedApiKey = null;
  if (saveApiKey) {
    savedApiKey = localStorage.getItem(STORAGE_KEYS.API_KEY);
    if (savedApiKey) {
      elements.apiKeyInput.value = savedApiKey;
      config.userApiKey = savedApiKey;
    }
  }

  // Check form validity after loading
  checkFormValidityFn();

  // Load saved custom wallet address for "My Wallet" section
  const savedMyWalletAddress = localStorage.getItem(STORAGE_KEYS.MY_WALLET_ADDRESS);
  if (savedMyWalletAddress) {
    elements.myWalletAddress.value = savedMyWalletAddress;
    console.log(`📍 Loaded saved wallet address: ${savedMyWalletAddress}`);
  }

  console.log('Settings loaded:', {
    lastMonitoredWallet: lastWallet || 'none',
    traderAddress: savedTraderAddress ? '✓' : '✗',
    copyBalance: savedCopyBalance ? '✓' : '✗',
    apiKey: saveApiKey && savedApiKey ? '✓' : '✗',
    myWalletAddress: savedMyWalletAddress ? '✓' : '✗',
  });

  // Automatically load user's wallet if custom address is saved
  if (savedMyWalletAddress) {
    console.log('📍 Saved wallet address found, automatically loading wallet info...');
    // Use setTimeout to ensure DOM is fully initialized
    setTimeout(() => {
      refreshWalletInfoFn().catch((error) => {
        console.error('Failed to auto-load wallet by address:', error);
      });
    }, 100);
  } else if (saveApiKey && savedApiKey) {
    // Fall back to API key if no custom address saved
    console.log('API key found, automatically loading wallet info...');
    // Use setTimeout to ensure DOM is fully initialized
    setTimeout(() => {
      refreshWalletInfoFn().catch((error) => {
        console.error('Failed to auto-load wallet:', error);
      });
    }, 100);
  }
}

/**
 * Save settings to localStorage
 * Now supports wallet-specific configuration storage
 * @param {object} config - Application config object
 */
export function saveSettings(config) {
  console.log('💾 Saving settings to localStorage...');

  // Save wallet-specific configuration using traderAddress as key
  if (config.traderAddress) {
    // Use traderAddress as the wallet identifier
    const walletKey = config.traderAddress;

    const traderAddressKey = STORAGE_KEYS.getTraderAddressKey(walletKey);
    const copyBalanceKey = STORAGE_KEYS.getCopyBalanceKey(walletKey);

    // Save trader address with wallet-specific key
    localStorage.setItem(traderAddressKey, config.traderAddress);

    // Save copy balance with wallet-specific key
    if (config.copyBalance) {
      localStorage.setItem(copyBalanceKey, config.copyBalance.toString());
    }

    // Track this as the last monitored wallet
    localStorage.setItem(STORAGE_KEYS.LAST_MONITORED_WALLET, walletKey);

    console.log(`🔑 Saved config with keys:`);
    console.log(`  - walletKey: ${walletKey}`);
    console.log(`  - traderAddressKey: ${traderAddressKey}`);
    console.log(`  - copyBalanceKey: ${copyBalanceKey}`);
    console.log(`  - traderAddress: ${config.traderAddress}`);
    console.log(`  - copyBalance: ${config.copyBalance || 'not set'}`);
    console.log(`✅ Configuration saved for wallet: ${walletKey}`);
  } else {
    console.log('⚠️ No trader address to save');
  }

  // Save global settings (API key - shared across all wallets)
  const saveApiKeyCheckbox = document.getElementById('save-api-key');
  if (saveApiKeyCheckbox && saveApiKeyCheckbox.checked) {
    localStorage.setItem(STORAGE_KEYS.SAVE_API_KEY, 'true');
    if (config.userApiKey) {
      localStorage.setItem(STORAGE_KEYS.API_KEY, config.userApiKey);
    }
  } else {
    localStorage.setItem(STORAGE_KEYS.SAVE_API_KEY, 'false');
    localStorage.removeItem(STORAGE_KEYS.API_KEY);
  }
}

/**
 * Clear all saved settings
 * Clears both global settings and all wallet-specific configurations
 */
export function clearSavedSettings() {
  // Clear global settings
  localStorage.removeItem(STORAGE_KEYS.API_KEY);
  localStorage.removeItem(STORAGE_KEYS.SAVE_API_KEY);
  localStorage.removeItem(STORAGE_KEYS.HISTORY_COLLAPSED);
  localStorage.removeItem(STORAGE_KEYS.WALLETS_COLLAPSED);
  localStorage.removeItem(STORAGE_KEYS.LAST_MONITORED_WALLET);
  localStorage.removeItem(STORAGE_KEYS.MY_WALLET_ADDRESS);

  // Clear all wallet-specific configurations
  // Search for all keys matching our wallet-specific patterns
  const keysToRemove = [];
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (
      key &&
      (key.startsWith('copyTrading.traderAddress.') ||
        key.startsWith('copyTrading.copyBalance.') ||
        key.startsWith('copyTrading.session.'))
    ) {
      keysToRemove.push(key);
    }
  }

  // Remove all wallet-specific keys
  keysToRemove.forEach((key) => localStorage.removeItem(key));

  console.log('All saved settings cleared (including all wallet configurations)');
}

/**
 * View all saved settings (debug utility)
 */
export function viewSavedSettings() {
  console.log('═══════════════════════════════════════════════════════');
  console.log('📊 COPY TRADING STORAGE OVERVIEW');
  console.log('═══════════════════════════════════════════════════════');

  const lastWallet = localStorage.getItem(STORAGE_KEYS.LAST_MONITORED_WALLET);
  console.log(`\n🏷️  Last Monitored Wallet: ${lastWallet || 'none'}`);

  if (lastWallet) {
    console.log(`\n📋 Current Wallet Configuration:`);
    console.log(
      `  - Trader Address: ${localStorage.getItem(STORAGE_KEYS.getTraderAddressKey(lastWallet)) || 'not set'}`
    );
    console.log(
      `  - Copy Balance: $${localStorage.getItem(STORAGE_KEYS.getCopyBalanceKey(lastWallet)) || 'not set'}`
    );
  }

  // Find all wallet-specific configurations
  console.log(`\n💼 All Wallet Configurations in Storage:`);
  const walletConfigs = {};
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key && key.startsWith('copyTrading.traderAddress.')) {
      const wallet = key.replace('copyTrading.traderAddress.', '');
      const balance = localStorage.getItem(STORAGE_KEYS.getCopyBalanceKey(wallet));
      walletConfigs[wallet] = {
        address: localStorage.getItem(key),
        balance: balance || 'not set',
      };
    }
  }

  if (Object.keys(walletConfigs).length > 0) {
    Object.entries(walletConfigs).forEach(([wallet, config], index) => {
      console.log(`\n  ${index + 1}. Wallet: ${wallet}`);
      console.log(`     - Address: ${config.address}`);
      console.log(`     - Balance: $${config.balance}`);
    });
  } else {
    console.log('  No wallet configurations found');
  }

  console.log(`\n🔐 Global Settings:`);
  console.log(
    `  - API Key Saved: ${localStorage.getItem(STORAGE_KEYS.SAVE_API_KEY) === 'true' ? 'Yes' : 'No'}`
  );
  console.log(
    `  - History Collapsed: ${localStorage.getItem(STORAGE_KEYS.HISTORY_COLLAPSED) === 'true' ? 'Yes' : 'No'}`
  );
  console.log(
    `  - Wallets Collapsed: ${localStorage.getItem(STORAGE_KEYS.WALLETS_COLLAPSED) === 'true' ? 'Yes' : 'No'}`
  );
  console.log(
    `  - My Wallet Address: ${localStorage.getItem(STORAGE_KEYS.MY_WALLET_ADDRESS) || 'not set'}`
  );

  console.log(`\n═══════════════════════════════════════════════════════`);
}

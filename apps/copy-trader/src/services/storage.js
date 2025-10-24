/**
 * LocalStorage management service
 * Handles wallet-specific and global settings persistence
 */

// localStorage keys
export const STORAGE_KEYS = {
  // Wallet-specific configuration (per monitored wallet)
  getTraderAddressKey: (wallet) => `copyTrading.traderAddress.${wallet}`,
  getCopyBalanceKey: (wallet) => `copyTrading.copyBalance.${wallet}`,
  getIsDryRunKey: (wallet) => `copyTrading.isDryRun.${wallet}`,
  getUseLatestPriceKey: (wallet) => `copyTrading.useLatestPrice.${wallet}`,
  getExecutionPlatformKey: (wallet) => `copyTrading.executionPlatform.${wallet}`,
  LAST_MONITORED_WALLET: 'copyTrading.lastMonitoredWallet', // Track last active wallet

  // Global settings (shared across tabs)
  HYPERLIQUID_API_KEY: 'copyTrading.hyperliquidApiKey',
  SAVE_HYPERLIQUID_API_KEY: 'copyTrading.saveHyperliquidApiKey',
  MONITORING_API_KEY: 'copyTrading.monitoringApiKey',
  HISTORY_COLLAPSED: 'copyTrading.historyCollapsed',
  WALLETS_COLLAPSED: 'copyTrading.walletsCollapsed',
  MY_WALLET_ADDRESS: 'copyTrading.myWalletAddress', // Custom wallet address for "My Wallet"

  // Moonlander settings (minimal - most config comes from config file)
  MOONLANDER_NETWORK: 'copyTrading.moonlander.network', // 'testnet' or 'mainnet'
  MOONLANDER_PRIVATE_KEY: 'copyTrading.moonlander.privateKey',
  SAVE_MOONLANDER_PRIVATE_KEY: 'copyTrading.moonlander.savePrivateKey',
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
    const isDryRunKey = STORAGE_KEYS.getIsDryRunKey(lastWallet);
    const useLatestPriceKey = STORAGE_KEYS.getUseLatestPriceKey(lastWallet);
    const executionPlatformKey = STORAGE_KEYS.getExecutionPlatformKey(lastWallet);

    savedTraderAddress = localStorage.getItem(traderAddressKey);
    savedCopyBalance = localStorage.getItem(copyBalanceKey);
    const savedIsDryRun = localStorage.getItem(isDryRunKey);
    const savedUseLatestPrice = localStorage.getItem(useLatestPriceKey);
    const savedExecutionPlatform = localStorage.getItem(executionPlatformKey);

    console.log(`🔑 Loading config with keys:`);
    console.log(`  - traderAddressKey: ${traderAddressKey}`);
    console.log(`  - copyBalanceKey: ${copyBalanceKey}`);
    console.log(`  - isDryRunKey: ${isDryRunKey}`);
    console.log(`  - useLatestPriceKey: ${useLatestPriceKey}`);
    console.log(`  - executionPlatformKey: ${executionPlatformKey}`);
    console.log(`  - traderAddress: ${savedTraderAddress || 'not found'}`);
    console.log(`  - copyBalance: ${savedCopyBalance || 'not found'}`);
    console.log(`  - isDryRun: ${savedIsDryRun || 'not found'}`);
    console.log(`  - useLatestPrice: ${savedUseLatestPrice || 'not found'}`);
    console.log(`  - executionPlatform: ${savedExecutionPlatform || 'not found'}`);

    if (savedTraderAddress) {
      elements.traderAddressInput.value = savedTraderAddress;
      config.traderAddress = savedTraderAddress;
    }

    if (savedCopyBalance) {
      elements.copyBalanceInput.value = savedCopyBalance;
      config.copyBalance = parseFloat(savedCopyBalance);
    }

    // Load isDryRun (default to true if not set)
    if (savedIsDryRun !== null) {
      config.isDryRun = savedIsDryRun === 'true';
      if (elements.dryRunModeCheckbox) {
        elements.dryRunModeCheckbox.checked = config.isDryRun;
      }
    }

    // Load useLatestPrice (default to false if not set)
    if (savedUseLatestPrice !== null) {
      config.useLatestPrice = savedUseLatestPrice === 'true';
      if (elements.useLatestPriceCheckbox) {
        elements.useLatestPriceCheckbox.checked = config.useLatestPrice;
      }
    }

    // Load execution platform (default to hyperliquid if not set)
    if (savedExecutionPlatform) {
      config.executionPlatform = savedExecutionPlatform;
      if (elements.executionPlatformSelect) {
        elements.executionPlatformSelect.value = savedExecutionPlatform;
        // Show/hide Moonlander config based on platform
        if (savedExecutionPlatform === 'moonlander') {
          elements.moonlanderConfig?.classList.remove('hidden');
        }
      }
    }

    console.log(`✅ Loaded configuration for wallet: ${lastWallet}`);
  } else {
    console.log('⚠️ No last monitored wallet found');
  }

  // Load Moonlander configuration (global settings)
  const savedMoonlanderNetwork = localStorage.getItem(STORAGE_KEYS.MOONLANDER_NETWORK);
  if (savedMoonlanderNetwork) {
    config.moonlander.network = savedMoonlanderNetwork;
    if (elements.moonlanderNetworkSelect) {
      elements.moonlanderNetworkSelect.value = savedMoonlanderNetwork;
    }
  }

  // Load Moonlander private key (only if save checkbox is checked)
  const saveMoonlanderPrivateKey = localStorage.getItem(STORAGE_KEYS.SAVE_MOONLANDER_PRIVATE_KEY) === 'true';
  if (elements.saveMoonlanderPrivateKeyCheckbox) {
    elements.saveMoonlanderPrivateKeyCheckbox.checked = saveMoonlanderPrivateKey;
  }

  if (saveMoonlanderPrivateKey) {
    const savedMoonlanderPrivateKey = localStorage.getItem(STORAGE_KEYS.MOONLANDER_PRIVATE_KEY);
    if (savedMoonlanderPrivateKey) {
      config.moonlander.privateKey = savedMoonlanderPrivateKey;
      if (elements.moonlanderPrivateKeyInput) {
        elements.moonlanderPrivateKeyInput.value = savedMoonlanderPrivateKey;
      }

      // Trigger wallet derivation if Moonlander is selected
      if (config.executionPlatform === 'moonlander') {
        // Import and call deriveMoonlanderWalletAddress
        // Note: This will be handled by the initialization in main.js
        console.log('🔑 Moonlander private key loaded, will derive wallet address');
      }
    }
  }

  // Load API keys (global settings)
  const saveHyperliquidApiKey = localStorage.getItem(STORAGE_KEYS.SAVE_HYPERLIQUID_API_KEY) === 'true';
  if (elements.saveHyperliquidApiKeyCheckbox) {
    elements.saveHyperliquidApiKeyCheckbox.checked = saveHyperliquidApiKey;
  }

  // Load Hyperliquid API key
  let savedHyperliquidApiKey = null;
  if (saveHyperliquidApiKey) {
    savedHyperliquidApiKey = localStorage.getItem(STORAGE_KEYS.HYPERLIQUID_API_KEY);
    if (savedHyperliquidApiKey) {
      config.hyperliquidApiKey = savedHyperliquidApiKey;
      if (elements.hyperliquidApiKeyInput) {
        elements.hyperliquidApiKeyInput.value = savedHyperliquidApiKey;
      }
    }
  }

  // Load Monitoring API key (for Moonlander mode)
  const savedMonitoringApiKey = localStorage.getItem(STORAGE_KEYS.MONITORING_API_KEY);
  if (savedMonitoringApiKey) {
    config.monitoringApiKey = savedMonitoringApiKey;
    if (elements.monitoringApiKeyInput) {
      elements.monitoringApiKeyInput.value = savedMonitoringApiKey;
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
    hyperliquidApiKey: saveHyperliquidApiKey && savedHyperliquidApiKey ? '✓' : '✗',
    monitoringApiKey: savedMonitoringApiKey ? '✓' : '✗',
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
  } else if (saveHyperliquidApiKey && savedHyperliquidApiKey) {
    // Fall back to Hyperliquid API key if no custom address saved
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
    const isDryRunKey = STORAGE_KEYS.getIsDryRunKey(walletKey);
    const useLatestPriceKey = STORAGE_KEYS.getUseLatestPriceKey(walletKey);

    // Save trader address with wallet-specific key
    localStorage.setItem(traderAddressKey, config.traderAddress);

    // Save copy balance with wallet-specific key
    if (config.copyBalance) {
      localStorage.setItem(copyBalanceKey, config.copyBalance.toString());
    }

    // Save isDryRun with wallet-specific key
    localStorage.setItem(isDryRunKey, config.isDryRun ? 'true' : 'false');

    // Save useLatestPrice with wallet-specific key
    localStorage.setItem(useLatestPriceKey, config.useLatestPrice ? 'true' : 'false');

    // Save execution platform with wallet-specific key
    const executionPlatformKey = STORAGE_KEYS.getExecutionPlatformKey(walletKey);
    localStorage.setItem(executionPlatformKey, config.executionPlatform || 'hyperliquid');

    // Track this as the last monitored wallet
    localStorage.setItem(STORAGE_KEYS.LAST_MONITORED_WALLET, walletKey);

    console.log(`🔑 Saved config with keys:`);
    console.log(`  - walletKey: ${walletKey}`);
    console.log(`  - traderAddressKey: ${traderAddressKey}`);
    console.log(`  - copyBalanceKey: ${copyBalanceKey}`);
    console.log(`  - isDryRunKey: ${isDryRunKey}`);
    console.log(`  - useLatestPriceKey: ${useLatestPriceKey}`);
    console.log(`  - traderAddress: ${config.traderAddress}`);
    console.log(`  - copyBalance: ${config.copyBalance || 'not set'}`);
    console.log(`  - isDryRun: ${config.isDryRun}`);
    console.log(`  - useLatestPrice: ${config.useLatestPrice}`);
    console.log(`✅ Configuration saved for wallet: ${walletKey}`);
  } else {
    console.log('⚠️ No trader address to save');
  }

  // Save global settings (API keys - shared across all wallets)
  const saveHyperliquidApiKeyCheckbox = document.getElementById('save-hyperliquid-api-key');
  if (saveHyperliquidApiKeyCheckbox?.checked) {
    localStorage.setItem(STORAGE_KEYS.SAVE_HYPERLIQUID_API_KEY, 'true');
    if (config.hyperliquidApiKey) {
      localStorage.setItem(STORAGE_KEYS.HYPERLIQUID_API_KEY, config.hyperliquidApiKey);
    }
  } else {
    localStorage.setItem(STORAGE_KEYS.SAVE_HYPERLIQUID_API_KEY, 'false');
    localStorage.removeItem(STORAGE_KEYS.HYPERLIQUID_API_KEY);
  }

  // Save monitoring API key (for Moonlander mode)
  if (config.monitoringApiKey) {
    localStorage.setItem(STORAGE_KEYS.MONITORING_API_KEY, config.monitoringApiKey);
  }

  // Save Moonlander configuration (global settings)
  if (config.moonlander) {
    // Save network selection
    if (config.moonlander.network) {
      localStorage.setItem(STORAGE_KEYS.MOONLANDER_NETWORK, config.moonlander.network);
    }

    // Save private key (only if save checkbox is checked)
    const saveMoonlanderPrivateKeyCheckbox = document.getElementById('save-moonlander-private-key');
    if (saveMoonlanderPrivateKeyCheckbox?.checked) {
      localStorage.setItem(STORAGE_KEYS.SAVE_MOONLANDER_PRIVATE_KEY, 'true');
      if (config.moonlander.privateKey) {
        localStorage.setItem(STORAGE_KEYS.MOONLANDER_PRIVATE_KEY, config.moonlander.privateKey);
      }
    } else {
      localStorage.setItem(STORAGE_KEYS.SAVE_MOONLANDER_PRIVATE_KEY, 'false');
      localStorage.removeItem(STORAGE_KEYS.MOONLANDER_PRIVATE_KEY);
    }
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

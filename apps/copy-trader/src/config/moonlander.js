/**
 * Moonlander Exchange Configuration
 * Contract addresses and network settings for Cronos
 */

// Cronos Mainnet Configuration
export const MOONLANDER_MAINNET = {
  name: 'Moonlander',
  network: 'Cronos Mainnet',
  chainId: 25,
  rpcUrl: 'https://evm.cronos.org',

  // Diamond proxy contract (main trading contract)
  diamondAddress: '0x...', // TODO: Add actual diamond address

  // Supported margin tokens
  marginTokens: {
    USDC: {
      address: '0x...', // TODO: Add USDC address on Cronos
      decimals: 6,
      symbol: 'USDC',
    },
    USDT: {
      address: '0x...', // TODO: Add USDT address on Cronos
      decimals: 6,
      symbol: 'USDT',
    },
  },

  // Pyth oracle endpoint
  pythEndpoint: 'https://hermes.pyth.network',

  // Trading parameters
  defaultBroker: 1,
  defaultSlippage: 10, // 10% slippage tolerance
  gasLimits: {
    openOrder: 800000,
    closeOrder: 600000,
    approval: 100000,
  },
  pythFee: '0.000000001', // ETH fee for Pyth oracle update
};

// Cronos Testnet Configuration
export const MOONLANDER_TESTNET = {
  name: 'Moonlander Testnet',
  network: 'Cronos Testnet',
  chainId: 338,
  rpcUrl: 'https://testnet.cronoslabs.com/v1/55e37d8975113ae7a44603ef8ce460aa',

  diamondAddress: '0xf8Ac0F8A18c3f63fBd547b4D166945EB4b3D833A',

  marginTokens: {
    USDC: {
      address: '0x01A15d3504446928EB56dbc58D5dDA120D502Be4',
      decimals: 6,
      symbol: 'USDC',
    },
  },

  // Pair contract addresses (pairBase parameter in openMarketTradeWithPyth)
  // Source: /Users/jingchen/ai/moonlander-contracts/config/cronos-testnet.ts
  pairAddresses: {
    'BTC/USD': '0xf74fe922B0aC66cdFD7CC3e6DF6Bd44B18d46184',
    'ETH/USD': '0x8eac756B97613c49B7648ef7282181aD57784c84',
    'SOL/USD': '0x570A5D26f7765Ecb712C0924E4De545B89fD43dF',
    'CRO/USD': '0x6a3173618859C7cd40fAF6921b5E9eB6A76f1fD4',
  },

  pythEndpoint: 'https://hermes.pyth.network', // Use mainnet endpoint (Pyth is network-agnostic)
  defaultBroker: 1,
  defaultSlippage: 10,
  gasLimits: {
    openOrder: 800000,
    closeOrder: 600000,
    approval: 100000,
  },
  pythFee: '0.000000001',
};

// Symbol mapping: convert common formats to Moonlander format
export const SYMBOL_MAP = {
  // Crypto pairs
  'BTC/USD': 'BTC/USD',
  'ETH/USD': 'ETH/USD',
  'BTC/USDT': 'BTC/USD',
  'ETH/USDT': 'ETH/USD',

  // Prediction markets (example from the code)
  WILL_PIASTRI_2025_CHAMP: 'will-oscar-piastri-be-the-2025-drivers-champion/USD',

  // Add more mappings as needed
};

/**
 * Convert symbol to Moonlander format
 * @param {string} symbol - Input symbol in various formats
 * @returns {string} Moonlander pair base format
 */
export function convertSymbolToMoonlander(symbol) {
  // Check direct mapping first
  if (SYMBOL_MAP[symbol]) {
    return SYMBOL_MAP[symbol];
  }

  // Try to parse and convert
  // Examples: BTC/USD:USD -> BTC/USD, BTCUSD -> BTC/USD
  let normalized = symbol;

  // Remove perpetual/futures suffix
  normalized = normalized.replace(/:USD$/, '').replace(/-PERP$/, '');

  // Add slash if missing (BTCUSD -> BTC/USD)
  if (!normalized.includes('/') && normalized.length > 3) {
    normalized = `${normalized.slice(0, 3)}/${normalized.slice(3)}`;
  }

  return normalized;
}

/**
 * Get current configuration based on network
 * @param {string} network - 'testnet' or 'mainnet'
 * @returns {object} Configuration object for MoonlanderExchange
 */
export function getMoonlanderConfig(network = 'testnet') {
  const isTestnet = network === 'testnet';
  const baseConfig = isTestnet ? MOONLANDER_TESTNET : MOONLANDER_MAINNET;

  // Extract USDC address from marginTokens for MoonlanderExchange
  const usdcAddress = baseConfig.marginTokens?.USDC?.address;

  return {
    rpcUrl: baseConfig.rpcUrl,
    diamondAddress: baseConfig.diamondAddress,
    marginTokenAddress: usdcAddress, // MoonlanderExchange expects marginTokenAddress (string), not marginTokens (object)
    pythEndpoint: baseConfig.pythEndpoint,
    pairAddresses: baseConfig.pairAddresses || {},
    gasLimits: baseConfig.gasLimits,
    defaultBroker: baseConfig.defaultBroker,
    defaultSlippage: baseConfig.defaultSlippage,
  };
}

/**
 * Load Moonlander configuration for browser environment
 * Since browser can't access .env, private key must come from user input or monitoring API key
 * @param {string} privateKey - User's private key (same as monitoring API key for Moonlander)
 * @param {boolean} useTestnet - Whether to use testnet (default: true for safety)
 * @returns {object} Complete Moonlander configuration
 */
export function loadMoonlanderConfig(privateKey, useTestnet = true) {
  const config = getMoonlanderConfig(useTestnet, privateKey);

  // Validate configuration
  const validation = validateMoonlanderConfig(config);
  if (!validation.valid) {
    console.warn('⚠️ Moonlander configuration warnings:', validation.errors);
  }

  return config;
}

/**
 * Validate Moonlander configuration
 * @param {object} config - Configuration to validate
 * @returns {{valid: boolean, errors: string[]}}
 */
export function validateMoonlanderConfig(config) {
  const errors = [];

  if (!config.diamondAddress || config.diamondAddress === '0x...') {
    errors.push('Diamond contract address not configured');
  }

  if (!config.marginTokens || Object.keys(config.marginTokens).length === 0) {
    errors.push('No margin tokens configured');
  }

  if (!config.rpcUrl) {
    errors.push('RPC URL not configured');
  }

  if (!config.privateKey) {
    errors.push('Private key not provided');
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

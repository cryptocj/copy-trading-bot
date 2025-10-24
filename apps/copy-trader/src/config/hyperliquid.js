/**
 * Hyperliquid Exchange Configuration
 * API endpoints and network settings for mainnet and testnet
 */

// Hyperliquid Mainnet Configuration
export const HYPERLIQUID_MAINNET = {
  name: 'Hyperliquid',
  network: 'Mainnet',

  // API endpoints
  apiUrl: 'https://api.hyperliquid.xyz',
  wsUrl: 'wss://api.hyperliquid.xyz/ws',

  // Trading interface
  appUrl: 'https://app.hyperliquid.xyz',

  // Network configuration
  isTestnet: false,
};

// Hyperliquid Testnet Configuration
export const HYPERLIQUID_TESTNET = {
  name: 'Hyperliquid Testnet',
  network: 'Testnet',

  // API endpoints
  apiUrl: 'https://api.hyperliquid-testnet.xyz',
  wsUrl: 'wss://api.hyperliquid-testnet.xyz/ws',

  // Trading interface
  appUrl: 'https://app.hyperliquid-testnet.xyz',

  // Faucet
  faucetUrl: 'https://app.hyperliquid-testnet.xyz/drip',

  // Network configuration
  isTestnet: true,
};

/**
 * Get Hyperliquid configuration based on network
 * @param {string} network - 'testnet' or 'mainnet'
 * @returns {object} Configuration object
 */
export function getHyperliquidConfig(network = 'mainnet') {
  return network === 'testnet' ? HYPERLIQUID_TESTNET : HYPERLIQUID_MAINNET;
}

/**
 * Create CCXT Hyperliquid exchange instance with testnet support
 * @param {string} privateKey - Wallet private key
 * @param {string} network - 'testnet' or 'mainnet'
 * @returns {object} CCXT exchange configuration
 */
export async function createHyperliquidExchangeConfig(privateKey, network = 'mainnet') {
  const config = getHyperliquidConfig(network);
  const ethers = await import('ethers');
  const wallet = new ethers.Wallet(privateKey);

  return {
    privateKey: privateKey,
    walletAddress: wallet.address,
    urls: {
      api: {
        public: config.apiUrl,
        private: config.apiUrl,
      },
      test: {
        public: HYPERLIQUID_TESTNET.apiUrl,
        private: HYPERLIQUID_TESTNET.apiUrl,
      },
    },
    // Enable testnet mode if using testnet
    options: config.isTestnet ? { defaultType: 'swap' } : undefined,
  };
}

/**
 * Validate Hyperliquid configuration
 * @param {string} privateKey - Private key to validate
 * @returns {{valid: boolean, errors: string[], walletAddress?: string}}
 */
export async function validateHyperliquidConfig(privateKey) {
  const errors = [];

  if (!privateKey) {
    errors.push('Private key not provided');
    return { valid: false, errors };
  }

  try {
    const { ethers } = await import('ethers');
    const wallet = new ethers.Wallet(privateKey);

    return {
      valid: true,
      errors: [],
      walletAddress: wallet.address,
    };
  } catch (error) {
    errors.push(`Invalid private key: ${error.message}`);
    return { valid: false, errors };
  }
}

/**
 * Get faucet instructions for testnet
 * @returns {object} Faucet information
 */
export function getTestnetFaucetInfo() {
  return {
    faucetUrl: HYPERLIQUID_TESTNET.faucetUrl,
    apiMethod: {
      endpoint: `${HYPERLIQUID_TESTNET.apiUrl}/info`,
      method: 'POST',
      body: {
        type: 'ethFaucet',
        user: '0x...YOUR_WALLET_ADDRESS',
      },
    },
    requirements: [
      'Must have deposited on mainnet with the same address',
      'Can claim 1,000 mock USDC every 4 hours',
    ],
    alternatives: [
      {
        name: 'Chainstack Faucet',
        url: 'https://chainstack.com/hyperliquid-faucet/',
        amount: '1 HYPE every 24 hours',
        requirement: 'No mainnet requirement',
      },
      {
        name: 'QuickNode Faucet',
        url: 'https://faucet.quicknode.com/hyperliquid/testnet',
        requirement: '0.05 HYPE on mainnet',
      },
    ],
  };
}

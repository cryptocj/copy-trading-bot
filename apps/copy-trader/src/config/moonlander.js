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
    // Major crypto pairs
    'BTC/USD': '0xf74fe922B0aC66cdFD7CC3e6DF6Bd44B18d46184',
    'ETH/USD': '0x8eac756B97613c49B7648ef7282181aD57784c84',
    'SOL/USD': '0x570A5D26f7765Ecb712C0924E4De545B89fD43dF',
    'CRO/USD': '0x6a3173618859C7cd40fAF6921b5E9eB6A76f1fD4',

    // Layer 1 chains
    'AVAX/USD': '0x8d58088D4E8Ffe75A8b6357ba5ff17B93B912640',
    'DOT/USD': '0x994047FE66406CbD646cd85B990E11D7F5dB8fC7',
    'ATOM/USD': '0x1a8E39ae59e5556B56b76fCBA98d22c9ae557396', // Cosmos
    'NEAR/USD': '0xAFE470AE215e48c144c7158EAe3CcF0C451cb0CB',
    'ADA/USD': '0x0e517979C2c1c1522ddB0c73905e0D39b3F990c0',
    'ALGO/USD': '0x7714436708E5B037e338C6DEA157dd4e7624192e',
    'TON/USD': '0x8d96EA3c7F7B7A824e2C8277495007c7Fbd769ea',
    'SUI/USD': '0x81710203A7FC16797aC9899228a87fd622df9706',
    'HBAR/USD': '0xe0C7226a58f54db71eDc6289Ba2dc80349B41974',

    // Major altcoins
    'LINK/USD': '0x16Eb7875C41b1D5812128790450F30658786AA23',
    'UNI/USD': '0x16aD43896f7C47a5d9Ee546c44A22205738B329c',
    'AAVE/USD': '0xE657b115bc45c0786274c824f83e3e02CE809185',
    'XRP/USD': '0x7B881C1A16814126813A5304B3a1Aa0abA10c88A',
    'DOGE/USD': '0x1a8E39ae59e5556B56b76fCBA98d22c9ae557396',
    'SHIB/USD': '0xbED48612BC69fA1CaB67052b42a95FB30C1bcFee',
    'PEPE/USD': '0xf868c454784048AF4f857991583E34243c92Ff48',
    'LTC/USD': '0x9d97Be214b68C7051215BB61059B4e299Cd792c3',
    'BCH/USD': '0x7589B70aBb83427bb7049e08ee9fC6479ccB7a23',
    'ETC/USD': '0xd9ce64C200721a98103102f9ea8e894E347EA287',

    // Layer 2 & scaling
    'ARB/USD': '0x71420dE57efBdffdccE4aDc3112B38639bBE33cF',
    'POL/USD': '0x40a7B093C9fAcAE2f668608338789e8fc209DA2A',

    // AI & Gaming
    'FET/USD': '0x708078A2BF535b2AC0667CEbd3a9c6d481F624A0',
    'TAO/USD': '0x3e06A0Bf43Bc145c7D83b5bedc2f28F4D6406Fa0',
    'RAY/USD': '0x78e7ae906d5421488454B48Fc4edef4e7Cb1FE0D',
    'SAND/USD': '0x508fe42428b0E9de1501799f1f5d54a5203639Dc',
    'VIRTUAL/USD': '0xf3A4d4f01b7cA4dFBaD493504F69E6791e550531',
    'AI16Z/USD': '0xED65aA648c7E63E527F9881d2c8001d6b3DE4feD',

    // Meme & trending
    'TRUMP/USD': '0x000000E744CcFF009df0008a9BEE3eeEB8e17993',
    'MELANIA/USD': '0x0a045883E84c4B026562A1925bc15E4f8775AC61',
    'FARTCOIN/USD': '0x3803B1DEAfEBbc452dbf2E36B6a5f7f76f0bCfD9',

    // DeFi & other
    'JLP/USD': '0xB4D15E490f7bc94a175D437310445f12366baBaB',
    'S/USD': '0x6D03365eDF19e6C233241cA2175729eCF55330B9',
    'KAITO/USD': '0x6284d80177C54E0b736C68Eb6Ef5fCBf846bD648',
    'PAXG/USD': '0x46C9a9E3a6f6E5fDD8113f30D7C79238B03cE4C6',
    'OM/USD': '0xeB1d71eA9351a613735127844C53dc6DdF25f293',
    'XMR/USD': '0x7F5F497e8AEB7CC82aF3921a22b2F0520f633Fa8',
    'ONDO/USD': '0xD8D9629cf47abe2fCa22b2F2c95Dc6ef46392326',
    'MNT/USD': '0xa76521EB6C2470A6f477674Bd74179bD660089B0',
    'APT/USD': '0x39e552a93a58Af98987BB5Cb08b04D25d41D1A2a',
    'HYPE/USD': '0xC5bE0303968b51d175b77b275eF5784B4B4b7d7c',

    // Leveraged pairs (500x)
    '500BTC/USD': '0xBAd4ccc91EF0dfFfbCAb1402C519601fbAf244EF',
    '500ADA/USD': '0x47521B8A40C38F4B538e9b49cEc895d9896BDc19',
    '500SUI/USD': '0x1FC9ccff020680aD461CFFaCF6aAFBDf28e601B0',
    '500LTC/USD': '0x4C3DbEaf91a7917ab4B5c4B4Bb9C20c773F843A5',
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

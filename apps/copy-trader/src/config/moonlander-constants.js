/**
 * Moonlander Exchange Constants
 * Centralized constants to avoid magic numbers and improve maintainability
 */

// API Configuration
export const MOONLANDER_API_URL = 'https://zsta-moonlander-public-api.crorc.co/v1';
export const MOONLANDER_CHAIN = 'CRONOS';
export const PYTH_HERMES_URL = 'https://hermes.pyth.network';
export const HYPERLIQUID_API_URL = 'https://api.hyperliquid.xyz/info';

// Cache Configuration
export const PRICE_CACHE_TTL_MS = 3000; // 3 seconds for price data
export const PYTH_VAA_CACHE_TTL_MS = 60000; // 60 seconds for Pyth VAA data

// Transaction Configuration
export const DEFAULT_GAS_LIMIT = 800000;
export const CLOSE_TRADE_GAS_LIMIT = 600000;
export const PYTH_UPDATE_FEE_PER_UPDATE = 1n;

// Price Configuration
export const PRICE_DECIMALS = 18;
export const MARGIN_TOKEN_DECIMALS = 6; // USDC has 6 decimals
export const QTY_DECIMALS = 10;

// Slippage Configuration (basis points)
export const DEFAULT_SLIPPAGE_BPS = 10; // 0.1% = 10 basis points

// Stop Loss / Take Profit Multipliers (basis points)
export const DEFAULT_STOP_LOSS_LONG_BPS = 5000; // 50% below entry
export const DEFAULT_STOP_LOSS_SHORT_BPS = 15000; // 150% above entry
export const DEFAULT_TAKE_PROFIT_LONG_BPS = 15000; // 150% above entry
export const DEFAULT_TAKE_PROFIT_SHORT_BPS = 5000; // 50% below entry

// Approval Configuration
export const APPROVAL_THRESHOLD_PERCENTAGE = 10; // 10% of max uint256

// Nonce Management (for sequential blockchain transactions)
export const TRANSACTION_DELAY_MS = 2000; // 2 seconds between transactions

// Timestamp Format
export const TIMESTAMP_FORMAT_OPTIONS = {
  hour12: false,
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  fractionalSecondDigits: 3
};

// Pyth Network Price Feed IDs
export const PYTH_PRICE_IDS = {
  // Major crypto
  'BTC/USD': '0xe62df6c8b4a85fe1a67db44dc12de5db330f7ac66b72dc658afedf0f4a415b43',
  'ETH/USD': '0xff61491a931112ddf1bd8147cd1b641375f79f5825126d665480874634fd0ace',
  'SOL/USD': '0xef0d8b6fda2ceba41da15d4095d1da392a0d2f8ed0c6c7bc0f4cfac8c280b56d',
  'CRO/USD': '0x23199c2bcb1303f667e733b9934db9eca5991e765b45f5ed18bc4b231415f2fe',

  // Layer 1 chains
  'AVAX/USD': '0x93da3352f9f1d105fdfe4971cfa80e9dd777bfc5d0f683ebb6e1294b92137bb7',
  'DOT/USD': '0xca3eed9b267293f6595901c734c7525ce8ef49adafe8284606ceb307afa2ca5b',
  'ATOM/USD': '0xb00b60f88b03a6a625a8d1c048c3f66653edf217439983d037e7222c4e612819',
  'NEAR/USD': '0xc415de8d2eba7db216527dff4b60e8f3a5311c740dadb233e13e12547e226750',
  'ADA/USD': '0x2a01deaec9e51a579277b34b122399984d0bbf57e2458a7e42fecd2829867a0d',
  'ALGO/USD': '0xfa17ceaf30d19ba51112fdcc750cc83454776f47fb0112e4af07f15f4bb1ebc0',
  'TON/USD': '0x8963217838ab4cf5cadc172203c1f0b763fbaa45f346d8ee50ba994bbcac3026',
  'SUI/USD': '0x23d7315113f5b1d3ba7a83604c44b94d79f4fd69af77f804fc7f920a6dc65744',
  'HBAR/USD': '0x3728e591097635310e6341af53db8b7ee42da9b3a8d918f9463ce9cca886dfbd',

  // Major altcoins
  'LINK/USD': '0x8ac0c70fff57e9aefdf5edf44b51d62c2d433653cbb2cf5cc06bb115af04d221',
  'UNI/USD': '0x78d185a741d07edb3412b09008b7c5cfb9bbbd7d568bf00ba737b456ba171501',
  'AAVE/USD': '0x2b9ab1e972a281585084148ba1389800799bd4be63b957507db1349314e47445',
  'XRP/USD': '0xec5d399846a9209f3fe5881d70aae9268c94339ff9817e8d18ff19fa05eea1c8',
  'DOGE/USD': '0xdcef50dd0a4cd2dcc17e45df1676dcb336a11a61c69df7a0299b0150c672d25c',
  'SHIB/USD': '0xf0d57deca57b3da2fe63a493f4c25925fdfd8edf834b20f93e1f84dbd1504d4a',
  'PEPE/USD': '0xd69731a2e74ac1ce884fc3890f7ee324b6deb66147055249568869ed700882e4',
  'LTC/USD': '0x6e3f3fa8253588df9326580180233eb791e03b443a3ba7a1d892e73874e19a54',
  'BCH/USD': '0x3dd2b63686a450ec7290df3a1e0b583c0481f651351edfa7636f39aed55cf8a3',
  'ETC/USD': '0x7f5cc8d963fc5b3d2ae41fe5685ada89fd4f14b435f8050f28c7fd409f40c2d8',

  // Layer 2 & scaling
  'ARB/USD': '0x3fa4252848f9f0a1480be62745a4629d9eb1322aebab8a791e344b3b9c1adcf5',
  'POL/USD': '0xffd11c5a1cfd42f80afb2df4d9f264c15f956d68153335374ec10722edd70472',

  // AI & Gaming
  'FET/USD': '0x7da003ada32eabbac855af3d22fcf0fe692cc589f0cfd5ced63cf0bdcc742efe',
  'TAO/USD': '0x410f41de235f2db824e562ea7ab2d3d3d4ff048316c61d629c0b93f58584e1af',
  'RAY/USD': '0x91568baa8beb53db23eb3fb7f22c6e8bd303d103919e19733f2bb642d3e7987a',
  'SAND/USD': '0xcb7a1d45139117f8d3da0a4b67264579aa905e3b124efede272634f094e1e9d1',
  'VIRTUAL/USD': '0x8132e3eb1dac3e56939a16ff83848d194345f6688bff97eb1c8bd462d558802b',
  'AI16Z/USD': '0x2551eca7784671173def2c41e6f3e51e11cd87494863f1d208fdd8c64a1f85ae',
  'RENDER/USD': '0x3d4a2bd9535be6ce8059d75eadeba507b043257321aa544717c56fa19b49e35d',

  // Meme & trending
  'TRUMP/USD': '0x879551021853eec7a7dc827578e8e69da7e4fa8148339aa0d3d5296405be4b1a',
  'MELANIA/USD': '0x8fef7d52c7f4e3a6258d663f9d27e64a1b6fd95ab5f7d545dbf9a515353d0064',
  'FARTCOIN/USD': '0x58cd29ef0e714c5affc44f269b2c1899a52da4169d7acc147b9da692e6953608',
  'BONK/USD': '0x72b021217ca3fe68922a19aaf990109cb9d84e9ad004b4d2025ad6f529314419',

  // DeFi & other
  'JLP/USD': '0xc811abc82b4bad1f9bd711a2773ccaa935b03ecef974236942cec5e0eb845a3a',
  'S/USD': '0xf490b178d0c85683b7a0f2388b40af2e6f7c90cbe0f96b31f315f08d0e5a2d6d',
  'KAITO/USD': '0x7302dee641a08507c297a7b0c8b3efa74a48a3baa6c040acab1e5209692b7e59',
  'PAXG/USD': '0x273717b49430906f4b0c230e99aa1007f83758e3199edbc887c0d06c3e332494',
  'OM/USD': '0xef8382df144cd3289a754b07bfb51acbe5bbc47444c36f727169c06387469ac6',
  'XMR/USD': '0x46b8cc9347f04391764a0361e0b17c3ba394b001e7c304f7650f6376e37c321d',
  'ONDO/USD': '0xd40472610abe56d36d065a0cf889fc8f1dd9f3b7f2a478231a5fc6df07ea5ce3',
  'MNT/USD': '0x4e3037c822d852d79af3ac80e35eb420ee3b870dca49f9344a38ef4773fb0585',
  'APT/USD': '0x03ae4db29ed4ae33d323568895aa00337e658e348b37509f5372ae51f0af00d5',
  'HYPE/USD': '0x4279e31cc369bbcc2faf022b382b080e32a8e689ff20fbc530d2a603eb6cd98b',
  'AXL/USD': '0x60144b1d5c9e9851732ad1d9760e3485ef80be39b984f6bf60f82b28a2b7f126',
  'ENA/USD': '0xb7910ba7322db020416fcac28b48c01212fd9cc8fbcbaf7d30477ed8605f6bd4',
  'VET/USD': '0x1722176f738aa1aafea170f8b27724042c5ac6d8cb9cf8ae02d692b0927e0681',

  // Leveraged pairs (use same price as base)
  '500BTC/USD': '0xe62df6c8b4a85fe1a67db44dc12de5db330f7ac66b72dc658afedf0f4a415b43',
  '500ETH/USD': '0xff61491a931112ddf1bd8147cd1b641375f79f5825126d665480874634fd0ace',
  '500SOL/USD': '0xef0d8b6fda2ceba41da15d4095d1da392a0d2f8ed0c6c7bc0f4cfac8c280b56d',
  '500ADA/USD': '0x2a01deaec9e51a579277b34b122399984d0bbf57e2458a7e42fecd2829867a0d',
  '500SUI/USD': '0x23d7315113f5b1d3ba7a83604c44b94d79f4fd69af77f804fc7f920a6dc65744',
  '500LTC/USD': '0x6e3f3fa8253588df9326580180233eb791e03b443a3ba7a1d892e73874e19a54',
  '500XRP/USD': '0xec5d399846a9209f3fe5881d70aae9268c94339ff9817e8d18ff19fa05eea1c8',
  '500DOGE/USD': '0xdcef50dd0a4cd2dcc17e45df1676dcb336a11a61c69df7a0299b0150c672d25c',

  // Stocks & ETFs
  'AAPL/USD': '0x49f6b65cb1de6b10eaf75e7c03ca029c306d0357e91b5311b175084a5ad55688',
  'GOOG/USD': '0xe65ff435be42630439c96396653a342829e877e2aafaeaf1a10d0ee5fd2cf3f2',
  'AMZN/USD': '0xb5d0e0fa58a1f8b81498ae670ce93c872d14434b72c364885d4fa1b257cbb07a',
  'MSFT/USD': '0xd0ca23c1cc005e004ccf1db5bf76aeb6a49218f43dac3d4b275e92de12ded4d1',
  'META/USD': '0x78a3e3b8e676a8f73c439f5d749737034b139bbbe899ba5775216fba596607fe',
  'NVDA/USD': '0xb1073854ed24cbc755dc527418f52b7d271f6cc967bbf8d8129112b18860a593',
  'TSLA/USD': '0x16dad506d7db8da01c87581c87ca897a012a153557d4d578c3b9c9e1bc0632f1',
  'MSTR/USD': '0xe1e80251e5f5184f2195008382538e847fafc36f751896889dd3d1b1f6111f09',
  'VOO/USD': '0x236b30dd09a9c00dfeec156c7b1efd646c0f01825a1758e3e4a0679e3bdff179',
  'QQQ/USD': '0x9695e2b96ea7b3859da9ed25b7a46a920a776e2fdae19a7bcfdf2b219230452d',
  'HOOD/USD': '0x306736a4035846ba15a3496eed57225b64cc19230a50d14f3ed20fd7219b7849',
  'NFLX/USD': '0x8376cfd7ca8bcdf372ced05307b24dced1f15b1afafdeff715664598f15a3dd2',

  // Commodities
  'UKOILSPOT/USD': '0x27f0d5e09a830083e5491795cac9ca521399c8f7fd56240d09484b14e614d57a',

  // Other tokens
  'PUMP/USD': '0x7a01fca212788bba7c5bf8c9efd576a8a722f070d2c17596ff7bb609b8d5c3b9',
  'LION/USD': '0xa57e29fe0a3e6165a55a42675d94aaf27e1b0183e7dfa1b7e9e3514c70f622d0',
  'A/USD': '0x2cffc28ec4268805dbcb315bb122616059a1c200dda3d56f06ac150db8dfc370',
  'SPX6900/USD': '0x8414cfadf82f6bed644d2e399c11df21ec0131aa574c56030b132113dbbf3a0a',
  'CRCL/USD': '0x92b8527aabe59ea2b12230f7b532769b133ffb118dfbd48ff676f14b273f1365',
  'FIG/USD': '0xe6af4d828b88cd3b40cb34686e61157d3fa37c1aa20ca2b99453aae62619b351',
};

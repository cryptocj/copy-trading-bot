// ============================================
// MOONLANDER-CONFIG.JS - Moonlander Configuration
// ============================================

// Moonlander blockchain and contract configuration
export const MOONLANDER_CONFIG = {
  rpcUrl: 'https://mainnet.cronoslabs.com/v1/55e37d8975113ae7a44603ef8ce460aa',
  diamondAddress: '0xE6F6351fb66f3a35313fEEFF9116698665FBEeC9',
  pairAddresses: {
    // Major Cryptocurrencies
    'BTC/USD': '0x062E66477Faf219F25D27dCED647BF57C3107d52',
    'ETH/USD': '0xe44Fd7fCb2b1581822D0c862B68222998a0c299a',
    'SOL/USD': '0xc9DE0F3e08162312528FF72559db82590b481800',
    'CRO/USD': '0x5C7F8A570d578ED84E63fdFA7b1eE72dEae1AE23',
    'XRP/USD': '0xb9Ce0dd29C91E02d4620F57a66700Fc5e41d6D15',
    'DOGE/USD': '0x1a8E39ae59e5556B56b76fCBA98d22c9ae557396',
    'ADA/USD': '0x0e517979C2c1c1522ddB0c73905e0D39b3F990c0',
    'LTC/USD': '0x9d97Be214b68C7051215BB61059B4e299Cd792c3',
    'BCH/USD': '0x7589B70aBb83427bb7049e08ee9fC6479ccB7a23',
    'ETC/USD': '0xd9ce64C200721a98103102f9ea8e894E347EA287',

    // Layer 1 Blockchains
    'AVAX/USD': '0x8d58088D4E8Ffe75A8b6357ba5ff17B93B912640',
    'DOT/USD': '0x994047FE66406CbD646cd85B990E11D7F5dB8fC7',
    'ATOM/USD': '0xB888d8Dd1733d72681b30c00ee76BDE93ae7aa93',
    'NEAR/USD': '0xAFE470AE215e48c144c7158EAe3CcF0C451cb0CB',
    'ALGO/USD': '0x2fEfe47989214c2e74A6319076c138d395681407',
    'TON/USD': '0x8d96EA3c7F7B7A824e2C8277495007c7Fbd769ea',
    'SUI/USD': '0x81710203A7FC16797aC9899228a87fd622df9706',
    'HBAR/USD': '0xe0C7226a58f54db71eDc6289Ba2dc80349B41974',
    'APT/USD': '0x39e552a93a58Af98987BB5Cb08b04D25d41D1A2a',
    'MNT/USD': '0xa76521EB6C2470A6f477674Bd74179bD660089B0',
    'VET/USD': '0xA158b0de99AFcE0d4BA1Eda3DE20DD3617F8fC16',
    'AXL/USD': '0x0ddFe253A378Ae28635ef21855dadB297cD99DAd',

    // DeFi Tokens
    'LINK/USD': '0xBc6f24649CCd67eC42342AccdCECCB2eFA27c9d9',
    'UNI/USD': '0x16aD43896f7C47a5d9Ee546c44A22205738B329c',
    'AAVE/USD': '0xE657b115bc45c0786274c824f83e3e02CE809185',
    'ARB/USD': '0x71420dE57efBdffdccE4aDc3112B38639bBE33cF',
    'POL/USD': '0x40a7B093C9fAcAE2f668608338789e8fc209DA2A',
    'OM/USD': '0xeB1d71eA9351a613735127844C53dc6DdF25f293',
    'ONDO/USD': '0xD8D9629cf47abe2fCa22b2F2c95Dc6ef46392326',
    'ENA/USD': '0xC907345cfeB81bf4830AED8060563eA8e793e177',

    // AI & Tech Tokens
    'FET/USD': '0xBe2bd41D6b3fBe01eda6e1AddeD7a4b242e04528',
    'TAO/USD': '0x3e06A0Bf43Bc145c7D83b5bedc2f28F4D6406Fa0',
    'RENDER/USD': '0x989547A33595d5a6DDd68F1EF3C4aA8c4D700917',
    'A/USD': '0x4c8e043e3748239FA78cE0c74838800f17A22160',

    // Meme Coins
    'SHIB/USD': '0xbED48612BC69fA1CaB67052b42a95FB30C1bcFee',
    'PEPE/USD': '0xf868c454784048AF4f857991583E34243c92Ff48',
    'BONK/USD': '0xB3b6d1896E6D8E6542E7A91176844772895A6F7f',
    'PUMP/USD': '0x3300c702b0b2F3823666Be8b8bF70C4a6C82eF0c',

    // Solana Ecosystem
    'RAY/USD': '0x78e7ae906d5421488454B48Fc4edef4e7Cb1FE0D',
    'JLP/USD': '0xB4D15E490f7bc94a175D437310445f12366baBaB',

    // Other Tokens
    'SAND/USD': '0x9097eA65B55dfC7383A7EFB465e8fFC18D46e784',
    'VIRTUAL/USD': '0x101632377A2378F6A9bda0eAB990cf6382ab8c85',
    'AI16Z/USD': '0xED65aA648c7E63E527F9881d2c8001d6b3DE4feD',
    'PAXG/USD': '0x81749e7258f9e577f61f49ABeeB426b70F561b89',
    'XMR/USD': '0x7F5F497e8AEB7CC82aF3921a22b2F0520f633Fa8',
    'HYPE/USD': '0xC5bE0303968b51d175b77b275eF5784B4B4b7d7c',
    'KAITO/USD': '0x6284d80177C54E0b736C68Eb6Ef5fCBf846bD648',
    'S/USD': '0x6D03365eDF19e6C233241cA2175729eCF55330B9',
    'SPX6900/USD': '0x1De258764B7d1C4978087505f6CE5B94042a1883',
    'FARTCOIN/USD': '0x3803B1DEAfEBbc452dbf2E36B6a5f7f76f0bCfD9',
    'LION/USD': '0x9D8c68F185A04314DDC8B8216732455e8dbb7E45',
    'FIG/USD': '0x97Aa3b796C8bc9EAc0221174401A00C55769F41E',
    'CRCL/USD': '0x7F55d95BEfC4b558d2Bf5632bC466A5b0125C6A5',

    // Political/Meme Tokens
    'TRUMP/USD': '0xd1D7A0Ff6Cd3d494038b7FB93dbAeF624Da6f417',
    'MELANIA/USD': '0x0a045883E84c4B026562A1925bc15E4f8775AC61',

    // US Stocks
    'AAPL/USD': '0x34A8319c0AD0A68BBe2eD4a154960CE38c0c0970',
    'GOOG/USD': '0x5d842b8F4176662817F04B1585aE7E81F6e718FF',
    'AMZN/USD': '0x48197e0888e80e71Ec7c424FfAbBcc7CAe0f0851',
    'MSFT/USD': '0xbfAebB36ad3e4Dc08Db03F3f42747c09aDe4cccF',
    'META/USD': '0xE563B1f4D4Ce4FCf658E4f61fBb8204412f0Ced3',
    'NVDA/USD': '0x1f50B2cDCe9E06234405B359021e7404E0676C17',
    'TSLA/USD': '0xEB6EBE0D7b888E9F07adaDEf202d046F1f2EaC1A',
    'MSTR/USD': '0xC52Fa0A0D2aE284Ade66A3b7c7Ec3c07A8Dd456f',
    'NFLX/USD': '0x674fA9fb7B59b038a6e6d195B44A4e2B1a9C58dE',
    'HOOD/USD': '0xF11F855f82089e2F0A2962329590D882A26Ba7CE',

    // ETFs
    'VOO/USD': '0x5120A287a0823927fb800867E5895d89a07c0a71',
    'QQQ/USD': '0xc59171D543cc81D8ebee17B3a56f8809104672a5',

    // Leveraged Pairs (500x)
    '500BTC/USD': '0xBAd4ccc91EF0dfFfbCAb1402C519601fbAf244EF',
    '500ETH/USD': '0xFd23131811dDB031a3e568b787E57D36C41fC117',
    '500SOL/USD': '0x10c247B417C4cd2e3542FF8Cb758d895279F0eC6',
    '500XRP/USD': '0xB2BaDEA485457F11EDD5a19FC70fc1C64C7165E9',
    '500DOGE/USD': '0x2600e56e2aE2D15582180862fd71E96DCb86C2D8',
    '500ADA/USD': '0x47521B8A40C38F4B538e9b49cEc895d9896BDc19',
    '500SUI/USD': '0x1FC9ccff020680aD461CFFaCF6aAFBDf28e601B0',
    '500LTC/USD': '0x4C3DbEaf91a7917ab4B5c4B4Bb9C20c773F843A5',
  },
};

// USDC token address on Cronos
export const USDC_ADDRESS = '0xc21223249CA28397B4B6541dfFaEcC539BfF0c59';

// Pyth Price Feed IDs for all trading pairs
export const PYTH_PRICE_IDS = {
  // Major Cryptocurrencies
  'BTC/USD': '0xe62df6c8b4a85fe1a67db44dc12de5db330f7ac66b72dc658afedf0f4a415b43',
  'ETH/USD': '0xff61491a931112ddf1bd8147cd1b641375f79f5825126d665480874634fd0ace',
  'SOL/USD': '0xef0d8b6fda2ceba41da15d4095d1da392a0d2f8ed0c6c7bc0f4cfac8c280b56d',
  'CRO/USD': '0x23199c2bcb1303f667e733b9934db9eca5991e765b45f5ed18bc4b231415f2fe',
  'XRP/USD': '0xec5d399846a9209f3fe5881d70aae9268c94339ff9817e8d18ff19fa05eea1c8',
  'DOGE/USD': '0xdcef50dd0a4cd2dcc17e45df1676dcb336a11a61c69df7a0299b0150c672d25c',
  'ADA/USD': '0x2a01deaec9e51a579277b34b122399984d0bbf57e2458a7e42fecd2829867a0d',
  'LTC/USD': '0x6e3f3fa8253588df9326580180233eb791e03b443a3ba7a1d892e73874e19a54',
  'BCH/USD': '0x3dd2b63686a450ec7290df3a1e0b583c0481f651351edfa7636f39aed55cf8a3',
  'ETC/USD': '0x7f5cc8d963fc5b3d2ae41fe5685ada89fd4f14b435f8050f28c7fd409f40c2d8',

  // Layer 1 Blockchains
  'AVAX/USD': '0x93da3352f9f1d105fdfe4971cfa80e9dd777bfc5d0f683ebb6e1294b92137bb7',
  'DOT/USD': '0xca3eed9b267293f6595901c734c7525ce8ef49adafe8284606ceb307afa2ca5b',
  'ATOM/USD': '0xb00b60f88b03a6a625a8d1c048c3f66653edf217439983d037e7222c4e612819',
  'NEAR/USD': '0xc415de8d2eba7db216527dff4b60e8f3a5311c740dadb233e13e12547e226750',
  'ALGO/USD': '0xfa17ceaf30d19ba51112fdcc750cc83454776f47fb0112e4af07f15f4bb1ebc0',
  'TON/USD': '0x8963217838ab4cf5cadc172203c1f0b763fbaa45f346d8ee50ba994bbcac3026',
  'SUI/USD': '0x23d7315113f5b1d3ba7a83604c44b94d79f4fd69af77f804fc7f920a6dc65744',
  'HBAR/USD': '0x3728e591097635310e6341af53db8b7ee42da9b3a8d918f9463ce9cca886dfbd',
  'APT/USD': '0x03ae4db29ed4ae33d323568895aa00337e658e348b37509f5372ae51f0af00d5',
  'MNT/USD': '0x4e3037c822d852d79af3ac80e35eb420ee3b870dca49f9344a38ef4773fb0585',
  'VET/USD': '0x1722176f738aa1aafea170f8b27724042c5ac6d8cb9cf8ae02d692b0927e0681',
  'AXL/USD': '0x60144b1d5c9e9851732ad1d9760e3485ef80be39b984f6bf60f82b28a2b7f126',

  // DeFi Tokens
  'LINK/USD': '0x8ac0c70fff57e9aefdf5edf44b51d62c2d433653cbb2cf5cc06bb115af04d221',
  'UNI/USD': '0x78d185a741d07edb3412b09008b7c5cfb9bbbd7d568bf00ba737b456ba171501',
  'AAVE/USD': '0x2b9ab1e972a281585084148ba1389800799bd4be63b957507db1349314e47445',
  'ARB/USD': '0x3fa4252848f9f0a1480be62745a4629d9eb1322aebab8a791e344b3b9c1adcf5',
  'POL/USD': '0xffd11c5a1cfd42f80afb2df4d9f264c15f956d68153335374ec10722edd70472',
  'OM/USD': '0xef8382df144cd3289a754b07bfb51acbe5bbc47444c36f727169c06387469ac6',
  'ONDO/USD': '0xd40472610abe56d36d065a0cf889fc8f1dd9f3b7f2a478231a5fc6df07ea5ce3',
  'ENA/USD': '0xb7910ba7322db020416fcac28b48c01212fd9cc8fbcbaf7d30477ed8605f6bd4',

  // AI & Tech Tokens
  'FET/USD': '0x7da003ada32eabbac855af3d22fcf0fe692cc589f0cfd5ced63cf0bdcc742efe',
  'TAO/USD': '0x410f41de235f2db824e562ea7ab2d3d3d4ff048316c61d629c0b93f58584e1af',
  'RENDER/USD': '0x3d4a2bd9535be6ce8059d75eadeba507b043257321aa544717c56fa19b49e35d',
  'A/USD': '0x2cffc28ec4268805dbcb315bb122616059a1c200dda3d56f06ac150db8dfc370',

  // Meme Coins
  'SHIB/USD': '0xf0d57deca57b3da2fe63a493f4c25925fdfd8edf834b20f93e1f84dbd1504d4a',
  'PEPE/USD': '0xd69731a2e74ac1ce884fc3890f7ee324b6deb66147055249568869ed700882e4',
  'BONK/USD': '0x72b021217ca3fe68922a19aaf990109cb9d84e9ad004b4d2025ad6f529314419',
  'PUMP/USD': '0x7a01fca212788bba7c5bf8c9efd576a8a722f070d2c17596ff7bb609b8d5c3b9',

  // Solana Ecosystem
  'RAY/USD': '0x91568baa8beb53db23eb3fb7f22c6e8bd303d103919e19733f2bb642d3e7987a',
  'JLP/USD': '0xc811abc82b4bad1f9bd711a2773ccaa935b03ecef974236942cec5e0eb845a3a',

  // Other Tokens
  'SAND/USD': '0xcb7a1d45139117f8d3da0a4b67264579aa905e3b124efede272634f094e1e9d1',
  'VIRTUAL/USD': '0x8132e3eb1dac3e56939a16ff83848d194345f6688bff97eb1c8bd462d558802b',
  'AI16Z/USD': '0x2551eca7784671173def2c41e6f3e51e11cd87494863f1d208fdd8c64a1f85ae',
  'PAXG/USD': '0x273717b49430906f4b0c230e99aa1007f83758e3199edbc887c0d06c3e332494',
  'XMR/USD': '0x46b8cc9347f04391764a0361e0b17c3ba394b001e7c304f7650f6376e37c321d',
  'HYPE/USD': '0x4279e31cc369bbcc2faf022b382b080e32a8e689ff20fbc530d2a603eb6cd98b',
  'KAITO/USD': '0x7302dee641a08507c297a7b0c8b3efa74a48a3baa6c040acab1e5209692b7e59',
  'S/USD': '0xf490b178d0c85683b7a0f2388b40af2e6f7c90cbe0f96b31f315f08d0e5a2d6d',
  'SPX6900/USD': '0x8414cfadf82f6bed644d2e399c11df21ec0131aa574c56030b132113dbbf3a0a',
  'FARTCOIN/USD': '0x58cd29ef0e714c5affc44f269b2c1899a52da4169d7acc147b9da692e6953608',
  'LION/USD': '0xa57e29fe0a3e6165a55a42675d94aaf27e1b0183e7dfa1b7e9e3514c70f622d0',
  'FIG/USD': '0xe6af4d828b88cd3b40cb34686e61157d3fa37c1aa20ca2b99453aae62619b351',
  'CRCL/USD': '0x92b8527aabe59ea2b12230f7b532769b133ffb118dfbd48ff676f14b273f1365',

  // Political/Meme Tokens
  'TRUMP/USD': '0x879551021853eec7a7dc827578e8e69da7e4fa8148339aa0d3d5296405be4b1a',
  'MELANIA/USD': '0x8fef7d52c7f4e3a6258d663f9d27e64a1b6fd95ab5f7d545dbf9a515353d0064',

  // US Stocks
  'AAPL/USD': '0x49f6b65cb1de6b10eaf75e7c03ca029c306d0357e91b5311b175084a5ad55688',
  'GOOG/USD': '0xe65ff435be42630439c96396653a342829e877e2aafaeaf1a10d0ee5fd2cf3f2',
  'AMZN/USD': '0xb5d0e0fa58a1f8b81498ae670ce93c872d14434b72c364885d4fa1b257cbb07a',
  'MSFT/USD': '0xd0ca23c1cc005e004ccf1db5bf76aeb6a49218f43dac3d4b275e92de12ded4d1',
  'META/USD': '0x78a3e3b8e676a8f73c439f5d749737034b139bbbe899ba5775216fba596607fe',
  'NVDA/USD': '0xb1073854ed24cbc755dc527418f52b7d271f6cc967bbf8d8129112b18860a593',
  'TSLA/USD': '0x16dad506d7db8da01c87581c87ca897a012a153557d4d578c3b9c9e1bc0632f1',
  'MSTR/USD': '0xe1e80251e5f5184f2195008382538e847fafc36f751896889dd3d1b1f6111f09',
  'NFLX/USD': '0x8376cfd7ca8bcdf372ced05307b24dced1f15b1afafdeff715664598f15a3dd2',
  'HOOD/USD': '0x306736a4035846ba15a3496eed57225b64cc19230a50d14f3ed20fd7219b7849',

  // ETFs
  'VOO/USD': '0x236b30dd09a9c00dfeec156c7b1efd646c0f01825a1758e3e4a0679e3bdff179',
  'QQQ/USD': '0x9695e2b96ea7b3859da9ed25b7a46a920a776e2fdae19a7bcfdf2b219230452d',

  // Leveraged Pairs (500x)
  '500BTC/USD': '0xe62df6c8b4a85fe1a67db44dc12de5db330f7ac66b72dc658afedf0f4a415b43',
  '500ETH/USD': '0xff61491a931112ddf1bd8147cd1b641375f79f5825126d665480874634fd0ace',
  '500SOL/USD': '0xef0d8b6fda2ceba41da15d4095d1da392a0d2f8ed0c6c7bc0f4cfac8c280b56d',
  '500XRP/USD': '0xec5d399846a9209f3fe5881d70aae9268c94339ff9817e8d18ff19fa05eea1c8',
  '500DOGE/USD': '0xdcef50dd0a4cd2dcc17e45df1676dcb336a11a61c69df7a0299b0150c672d25c',
  '500ADA/USD': '0x2a01deaec9e51a579277b34b122399984d0bbf57e2458a7e42fecd2829867a0d',
  '500SUI/USD': '0x23d7315113f5b1d3ba7a83604c44b94d79f4fd69af77f804fc7f920a6dc65744',
  '500LTC/USD': '0x6e3f3fa8253588df9326580180233eb791e03b443a3ba7a1d892e73874e19a54',
};

// Contract ABIs
export const TRADING_READER_ABI = [
  {
    inputs: [
      { internalType: 'address', name: 'user', type: 'address' },
      { internalType: 'address', name: 'marginToken', type: 'address' },
    ],
    name: 'getPositionsV2',
    outputs: [
      {
        components: [
          { internalType: 'bytes32', name: 'positionHash', type: 'bytes32' },
          { internalType: 'string', name: 'pair', type: 'string' },
          { internalType: 'address', name: 'pairBase', type: 'address' },
          { internalType: 'address', name: 'marginToken', type: 'address' },
          { internalType: 'bool', name: 'isLong', type: 'bool' },
          { internalType: 'uint96', name: 'margin', type: 'uint96' },
          { internalType: 'uint128', name: 'qty', type: 'uint128' },
          { internalType: 'uint128', name: 'entryPrice', type: 'uint128' },
          { internalType: 'uint128', name: 'stopLoss', type: 'uint128' },
          { internalType: 'uint128', name: 'takeProfit', type: 'uint128' },
          { internalType: 'int256', name: 'fundingFee', type: 'int256' },
          { internalType: 'uint40', name: 'timestamp', type: 'uint40' },
        ],
        internalType: 'struct ITradingReader.PositionWithPairInfo[]',
        name: '',
        type: 'tuple[]',
      },
    ],
    stateMutability: 'view',
    type: 'function',
  },
];

// Trading Portal ABI (correct ABI with struct parameter)
export const TRADING_PORTAL_ABI = [
  {
    inputs: [
      {
        components: [
          { internalType: 'address', name: 'pairBase', type: 'address' },
          { internalType: 'bool', name: 'isLong', type: 'bool' },
          { internalType: 'address', name: 'tokenIn', type: 'address' },
          { internalType: 'uint96', name: 'amountIn', type: 'uint96' },
          { internalType: 'uint128', name: 'qty', type: 'uint128' },
          { internalType: 'uint128', name: 'price', type: 'uint128' },
          { internalType: 'uint128', name: 'stopLoss', type: 'uint128' },
          { internalType: 'uint128', name: 'takeProfit', type: 'uint128' },
          { internalType: 'uint24', name: 'broker', type: 'uint24' },
        ],
        internalType: 'struct IBook.OpenDataInput',
        name: 'data',
        type: 'tuple',
      },
      { internalType: 'bytes[]', name: 'priceUpdateData', type: 'bytes[]' },
    ],
    name: 'openMarketTradeWithPyth',
    outputs: [{ internalType: 'bytes32', name: 'tradeHash', type: 'bytes32' }],
    stateMutability: 'payable',
    type: 'function',
  },
  {
    inputs: [{ internalType: 'bytes32', name: 'tradeHash', type: 'bytes32' }],
    name: 'closeTrade',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
];

export const TRADING_CORE_ABI = TRADING_PORTAL_ABI; // Alias for backwards compatibility

export const ERC20_ABI = [
  'function approve(address spender, uint256 amount) returns (bool)',
  'function allowance(address owner, address spender) view returns (uint256)',
  'function balanceOf(address account) view returns (uint256)',
  'function decimals() view returns (uint8)',
];

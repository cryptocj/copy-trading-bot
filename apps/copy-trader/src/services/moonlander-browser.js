/**
 * Moonlander Exchange Adapter (Browser Version)
 * Smart contract-based trading on Cronos with Pyth price feeds
 * Uses globally loaded ethers from CDN
 */

// ABIs will be loaded dynamically
let TRADING_READER_ABI = null;
let TRADING_PORTAL_ABI = null;

// Standard ERC20 ABI (minimal, inline)
const ERC20_ABI = [
  'function approve(address spender, uint256 amount) returns (bool)',
  'function allowance(address owner, address spender) view returns (uint256)',
  'function balanceOf(address account) view returns (uint256)',
  'function decimals() view returns (uint8)',
  'function symbol() view returns (string)',
  'function totalSupply() view returns (uint256)',
];

/**
 * Load ABI from JSON file
 * @param {string} filename - ABI filename
 * @returns {Promise<any>} ABI JSON
 */
async function loadABI(filename) {
  const response = await fetch(`/src/abi/${filename}`);
  if (!response.ok) {
    throw new Error(`Failed to load ABI: ${filename}`);
  }
  return response.json();
}

/**
 * Initialize ABIs (call once before using MoonlanderExchange)
 */
async function initializeABIs() {
  if (!TRADING_READER_ABI || !TRADING_PORTAL_ABI) {
    console.log('📦 Loading Moonlander ABIs...');
    [TRADING_READER_ABI, TRADING_PORTAL_ABI] = await Promise.all([
      loadABI('TradingReaderFacet.json'),
      loadABI('TradingPortalFacet.json'),
    ]);
    console.log('✅ ABIs loaded successfully');
  }
}

/**
 * Moonlander Exchange class
 * Handles smart contract interactions for trading
 */
export class MoonlanderExchange {
  constructor(config) {
    const {
      privateKey,
      rpcUrl,
      diamondAddress,
      marginTokenAddress,
      pythEndpoint = 'https://hermes.pyth.network',
      pairAddresses = {},
    } = config;

    // Setup provider and signer (using global ethers from CDN)
    this.provider = new ethers.JsonRpcProvider(rpcUrl);
    this.signer = new ethers.Wallet(privateKey, this.provider);
    this.walletAddress = this.signer.address;

    // Contract addresses
    this.diamondAddress = diamondAddress;
    this.marginTokenAddress = marginTokenAddress;
    this.pythEndpoint = pythEndpoint;
    this.pairAddresses = pairAddresses;

    // Moonlander public API
    this.apiUrl = 'https://zsta-moonlander-public-api.crorc.co/v1';
    this.chain = 'CRONOS';

    // Cache for trading pair info
    this.pairInfoCache = new Map();

    console.log('🌙 Moonlander Exchange initialized');
    console.log(`  Wallet: ${this.walletAddress}`);
    console.log(`  Diamond: ${diamondAddress}`);
    console.log(`  Margin Token: ${marginTokenAddress}`);
  }

  /**
   * Initialize contract instances (must be called after construction)
   */
  async initialize() {
    // Ensure ABIs are loaded
    await initializeABIs();

    // Initialize contract instances
    this.tradingReader = new ethers.Contract(
      this.diamondAddress,
      TRADING_READER_ABI,
      this.provider
    );
    this.tradingPortal = new ethers.Contract(this.diamondAddress, TRADING_PORTAL_ABI, this.signer);
    this.marginToken = new ethers.Contract(this.marginTokenAddress, ERC20_ABI, this.signer);

    console.log('✅ Moonlander contracts initialized');
  }

  /**
   * Fetch trading pair info from Moonlander API
   * @param {string} pairAddress - Pair contract address
   * @returns {Promise<object|null>} Trading pair info or null if not found
   */
  async fetchPairInfo(pairAddress) {
    // Check cache first
    if (this.pairInfoCache.has(pairAddress.toLowerCase())) {
      return this.pairInfoCache.get(pairAddress.toLowerCase());
    }

    try {
      const response = await fetch(
        `${this.apiUrl}/trading-pairs/${pairAddress}?chain=${this.chain}`
      );

      if (!response.ok) {
        console.warn(`Failed to fetch pair info for ${pairAddress}: ${response.status}`);
        return null;
      }

      const pairInfo = await response.json();

      // Cache the result
      this.pairInfoCache.set(pairAddress.toLowerCase(), pairInfo);

      return pairInfo;
    } catch (error) {
      console.error(`Error fetching pair info for ${pairAddress}:`, error);
      return null;
    }
  }

  /**
   * Convert pair address to human-readable symbol
   * @param {string} pairAddress - Pair contract address
   * @returns {Promise<string>} Human-readable symbol (e.g., "BTC/USD")
   */
  async getPairSymbol(pairAddress) {
    // Try to fetch from API first
    const pairInfo = await this.fetchPairInfo(pairAddress);
    if (pairInfo?.pair_name) {
      return pairInfo.pair_name; // "BTC/USD"
    }

    // Fallback to local mapping
    const addressToSymbol = {};
    for (const [symbol, address] of Object.entries(this.pairAddresses)) {
      addressToSymbol[address.toLowerCase()] = symbol;
    }

    const symbol = addressToSymbol[pairAddress.toLowerCase()];
    if (symbol) {
      return symbol;
    }

    // If not found anywhere, return truncated address
    console.warn(`Unknown pair address: ${pairAddress}`);
    return `${pairAddress.substring(0, 6)}...${pairAddress.substring(38)}`;
  }

  /**
   * Get user's current positions from Moonlander public API
   * @returns {Promise<Array>} Array of position objects
   */
  async fetchPositions() {
    try {
      console.log(`📊 Fetching positions for ${this.walletAddress}...`);

      // Use Moonlander public API
      const response = await fetch(
        `${this.apiUrl}/user/${this.walletAddress}/positions?chain=${this.chain}`
      );

      if (!response.ok) {
        throw new Error(`Moonlander API error: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      const positions = data.items || [];

      console.log(`✅ Found ${positions.length} positions from API`);

      // Map positions and fetch symbols in parallel
      const positionsWithSymbols = await Promise.all(
        positions.map(async (pos) => {
          const symbol = await this.getPairSymbol(pos.trading_pair_id);
          console.log(`  Position: ${symbol} (${pos.is_long ? 'LONG' : 'SHORT'})`);

          return {
            tradeHash: pos.position_id,
            symbol: symbol,
            side: pos.is_long ? 'long' : 'short',
            size: Number(pos.position_size),
            entryPrice: Number(pos.entry_price),
            markPrice: Number(pos.market_price),
            liquidationPrice: Number(pos.liq_price),
            leverage: Number(pos.leverage),
            margin: Number(pos.collateral),
            unrealizedPnl: Number(pos.pnl_after_fee),
            fundingFee: Number(pos.funding_fee),
            takeProfit: Number(pos.take_profit),
            notionalValue: Number(pos.notional_value_usd),
            pnlPercentage: Number(pos.pnl_after_fee_percentage) * 100, // Convert to percentage
          };
        })
      );

      return positionsWithSymbols;
    } catch (error) {
      console.error('Failed to fetch positions from Moonlander API:', error);
      return [];
    }
  }

  /**
   * Get user's balance for margin token
   * Uses blockchain query for USDC balance and calculates margin usage from positions
   * @returns {Promise<{total: number, free: number, used: number}>}
   */
  async fetchBalance() {
    try {
      // Initialize contracts if not already done (needed for balance query)
      if (!this.marginToken) {
        await this.initialize();
      }

      console.log(`💰 Fetching balance for ${this.walletAddress}...`);

      // Fetch USDC balance from blockchain
      const decimals = await this.marginToken.decimals();
      const balance = await this.marginToken.balanceOf(this.walletAddress);

      // Get total margin used from positions API
      const positions = await this.fetchPositions();
      const usedMargin = positions.reduce((sum, pos) => sum + pos.margin, 0);

      const total = Number(ethers.formatUnits(balance, decimals));
      const free = total;

      console.log(`✅ Balance: ${total} USDC (used: ${usedMargin}, free: ${free})`);

      return {
        total,
        used: usedMargin,
        free: free > 0 ? free : 0,
        assets: {
          USDC: {
            total,
            used: usedMargin,
            free: free > 0 ? free : 0,
          },
        },
      };
    } catch (error) {
      console.error('Failed to fetch balance:', error);
      return { total: 0, used: 0, free: 0, assets: {} };
    }
  }

  /**
   * Fetch current price for a trading pair from Pyth Network
   * @param {string} pairBase - Trading pair identifier (e.g., "BTC/USD")
   * @returns {Promise<{price: bigint, pythUpdateData: string[]}>}
   */
  async fetchPrice(pairBase) {
    try {
      // Pyth Network price feed IDs (from cronos-testnet.ts PythPriceFacet)
      const pythPriceIds = {
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

      const priceId = pythPriceIds[pairBase];
      if (!priceId) {
        throw new Error(
          `Price feed not found for ${pairBase}. ` +
          `Available: ${Object.keys(pythPriceIds).slice(0, 10).join(', ')}... (${Object.keys(pythPriceIds).length} total)`
        );
      }

      // Fetch latest price from Pyth Hermes API
      const pythUrl = 'https://hermes.pyth.network';
      const cleanPriceId = priceId.replace('0x', '');

      const response = await fetch(
        `${pythUrl}/v2/updates/price/latest?ids[]=${cleanPriceId}&encoding=hex`
      );

      if (!response.ok) {
        throw new Error(`Pyth API error: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();

      // Extract price from parsed data
      const parsedPrice = data.parsed?.[0];
      if (!parsedPrice) {
        throw new Error(`No price data returned for ${pairBase}`);
      }

      // Convert price to 18 decimals
      const price = BigInt(parsedPrice.price.price) * BigInt(10 ** (18 + parsedPrice.price.expo));

      // Extract VAA update data
      const pythUpdateData = data.binary?.data || [];
      if (pythUpdateData.length === 0) {
        throw new Error(`No VAA update data returned for ${pairBase}`);
      }

      const formattedUpdateData = pythUpdateData.map((hexData) => `0x${hexData}`);

      console.log(`📊 Pyth price for ${pairBase}: ${ethers.formatUnits(price, 18)}`);

      return { price, pythUpdateData: formattedUpdateData };
    } catch (error) {
      console.error(`Failed to fetch price for ${pairBase}:`, error);
      throw error;
    }
  }

  /**
   * Approve margin token spending by diamond contract
   * @param {string} amount - Amount to approve
   */
  async approveMarginToken(amount) {
    try {
      if (!this.marginToken) {
        await this.initialize();
      }

      const decimals = await this.marginToken.decimals();
      const amountWei = ethers.parseUnits(amount, decimals);

      const currentAllowance = await this.marginToken.allowance(
        this.walletAddress,
        this.diamondAddress
      );

      if (currentAllowance >= amountWei) {
        console.log(`✅ Already approved: ${amount}`);
        return true;
      }

      console.log(`📝 Approving ${amount} margin token...`);
      const tx = await this.marginToken.approve(this.diamondAddress, amountWei);
      await tx.wait();

      console.log(`✅ Approval confirmed: ${tx.hash}`);
      return true;
    } catch (error) {
      console.error('Failed to approve margin token:', error);
      throw error;
    }
  }

  /**
   * Calculate acceptable price with slippage
   */
  calculateAcceptablePrice(currentPrice, isLong, slippagePercent = 10) {
    const multiplier = isLong ? 100 + slippagePercent : 100 - slippagePercent;
    return (currentPrice * BigInt(multiplier)) / 100n;
  }

  /**
   * Open a market order
   */
  async createMarketOrder({
    pairBase,
    side,
    amount,
    qty,
    stopLoss = null,
    takeProfit = null,
    broker = 1,
  }) {
    try {
      if (!this.tradingPortal) {
        await this.initialize();
      }

      const isLong = side === 'buy' || side === 'long';

      console.log(`\n🌙 Opening ${isLong ? 'LONG' : 'SHORT'} market order`);
      console.log(`  Pair: ${pairBase}`);
      console.log(`  Margin: ${amount}`);
      console.log(`  Quantity: ${qty}`);

      // Get pair address
      const pairAddress = this.pairAddresses[pairBase];
      if (!pairAddress) {
        throw new Error(`Pair ${pairBase} not found in configuration`);
      }

      // Get current price
      const { price: currentPrice, pythUpdateData } = await this.fetchPrice(pairBase);

      // Calculate order parameters
      const decimals = await this.marginToken.decimals();
      const amountIn = ethers.parseUnits(amount, decimals);
      const qtyWei = ethers.parseUnits(qty, 10);

      const acceptablePrice = this.calculateAcceptablePrice(currentPrice, isLong, 10);
      const stopLossPrice = stopLoss
        ? ethers.parseUnits(stopLoss.toString(), 18)
        : isLong
          ? (currentPrice * 50n) / 100n
          : (currentPrice * 150n) / 100n;
      const takeProfitPrice = takeProfit
        ? ethers.parseUnits(takeProfit.toString(), 18)
        : isLong
          ? (currentPrice * 150n) / 100n
          : (currentPrice * 50n) / 100n;

      // Approve if needed
      await this.approveMarginToken(amount);

      // Submit order
      const pythUpdateFee = BigInt(pythUpdateData.length) * BigInt(1);

      const tx = await this.tradingPortal.openMarketTradeWithPyth(
        {
          pairBase: pairAddress,
          isLong,
          tokenIn: this.marginTokenAddress,
          amountIn,
          qty: qtyWei,
          price: acceptablePrice,
          stopLoss: stopLossPrice,
          takeProfit: takeProfitPrice,
          broker,
        },
        pythUpdateData,
        {
          gasLimit: 800000,
          value: pythUpdateFee,
        }
      );

      const receipt = await tx.wait();
      console.log(`✅ Order submitted: ${receipt.hash}`);

      // Extract trade hash from event
      const marketPendingTradeEvent = receipt.logs
        .map((log) => {
          try {
            return this.tradingPortal.interface.parseLog(log);
          } catch {
            return null;
          }
        })
        .find((event) => event && event.name === 'MarketPendingTrade');

      if (!marketPendingTradeEvent) {
        throw new Error('MarketPendingTrade event not found');
      }

      const tradeHash = marketPendingTradeEvent.args.tradeHash;
      console.log(`📋 Trade hash: ${tradeHash}`);

      return {
        tradeHash,
        txHash: receipt.hash,
        status: 'pending',
      };
    } catch (error) {
      console.error('Failed to create market order:', error);
      throw error;
    }
  }

  /**
   * Close an existing position
   */
  async closePosition(tradeHash) {
    try {
      if (!this.tradingPortal) {
        await this.initialize();
      }

      console.log(`\n🌙 Closing position: ${tradeHash}`);

      const position = await this.tradingReader.getPendingTrade(tradeHash);
      const { price: currentPrice, pythUpdateData } = await this.fetchPrice(position.pairBase);

      const tx = await this.tradingPortal.closeMarketTradeWithPyth(
        tradeHash,
        currentPrice,
        pythUpdateData,
        {
          gasLimit: 600000,
          value: ethers.parseEther('0.000000001'),
        }
      );

      const receipt = await tx.wait();
      console.log(`✅ Position closed: ${receipt.hash}`);

      return {
        txHash: receipt.hash,
        status: 'closed',
      };
    } catch (error) {
      console.error('Failed to close position:', error);
      throw error;
    }
  }
}

/**
 * Create Moonlander exchange instance
 * @param {object} config - Configuration object
 * @returns {Promise<MoonlanderExchange>} Initialized exchange instance
 */
export async function createMoonlanderExchange(config) {
  const exchange = new MoonlanderExchange(config);
  await exchange.initialize();
  return exchange;
}

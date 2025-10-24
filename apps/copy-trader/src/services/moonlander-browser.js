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
    this.tradingPortal = new ethers.Contract(
      this.diamondAddress,
      TRADING_PORTAL_ABI,
      this.signer
    );
    this.marginToken = new ethers.Contract(
      this.marginTokenAddress,
      ERC20_ABI,
      this.signer
    );

    console.log('✅ Moonlander contracts initialized');
  }

  /**
   * Convert pair address to human-readable symbol
   * @param {string} pairAddress - Pair contract address
   * @returns {string} Human-readable symbol (e.g., "BTC/USD")
   */
  getPairSymbol(pairAddress) {
    // Create reverse mapping from address to symbol
    const addressToSymbol = {};
    for (const [symbol, address] of Object.entries(this.pairAddresses)) {
      addressToSymbol[address.toLowerCase()] = symbol;
    }

    const symbol = addressToSymbol[pairAddress.toLowerCase()];
    if (symbol) {
      return symbol;
    }

    // If not found, return truncated address
    console.warn(`Unknown pair address: ${pairAddress}`);
    return `${pairAddress.substring(0, 6)}...${pairAddress.substring(38)}`;
  }

  /**
   * Get user's current positions
   * @returns {Promise<Array>} Array of position objects
   */
  async fetchPositions() {
    try {
      if (!this.tradingReader) {
        await this.initialize();
      }

      console.log(`📊 Fetching positions for ${this.walletAddress}...`);

      // Use getPositionsV2 with ZeroAddress to get all positions
      const positions = await this.tradingReader.getPositionsV2(
        this.walletAddress,
        ethers.ZeroAddress
      );

      console.log(`✅ Found ${positions.length} positions`);

      return positions.map((pos) => {
        const symbol = this.getPairSymbol(pos.pairBase);
        console.log(`  Position: ${symbol} (${pos.isLong ? 'LONG' : 'SHORT'})`);

        return {
          tradeHash: pos.tradeHash,
          symbol: symbol, // Convert address to human-readable symbol
          side: pos.isLong ? 'long' : 'short',
          margin: Number(ethers.formatUnits(pos.margin, 18)),
          leverage: Number(pos.leverage),
          entryPrice: Number(ethers.formatUnits(pos.entryPrice, 18)),
          size: Number(ethers.formatUnits(pos.qty, 10)),
          stopLoss: Number(ethers.formatUnits(pos.stopLoss, 18)),
          takeProfit: Number(ethers.formatUnits(pos.takeProfit, 18)),
          fundingFee: Number(ethers.formatUnits(pos.fundingFee, 18)),
          openTimestamp: Number(pos.openTimestamp),
        };
      });
    } catch (error) {
      console.error('Failed to fetch positions:', error);
      return [];
    }
  }

  /**
   * Get user's balance for margin token
   * @returns {Promise<{total: number, free: number, used: number}>}
   */
  async fetchBalance() {
    try {
      if (!this.marginToken) {
        await this.initialize();
      }

      console.log(`💰 Fetching balance for ${this.walletAddress}...`);

      const decimals = await this.marginToken.decimals();
      const balance = await this.marginToken.balanceOf(this.walletAddress);

      // Get total margin used in positions
      const positions = await this.fetchPositions();
      const usedMargin = positions.reduce((sum, pos) => sum + pos.margin, 0);

      const total = Number(ethers.formatUnits(balance, decimals));
      const free = total - usedMargin;

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
      // Pyth Network price feed IDs
      const pythPriceIds = {
        'BTC/USD': '0xe62df6c8b4a85fe1a67db44dc12de5db330f7ac66b72dc658afedf0f4a415b43',
        'ETH/USD': '0xff61491a931112ddf1bd8147cd1b641375f79f5825126d665480874634fd0ace',
        'SOL/USD': '0xef0d8b6fda2ceba41da15d4095d1da392a0d2f8ed0c6c7bc0f4cfac8c280b56d',
        'CRO/USD': '0x23199c2bcb1303f667e733b9934db9eca5991e765b45f5ed18bc4b231415f2fe',
      };

      const priceId = pythPriceIds[pairBase];
      if (!priceId) {
        throw new Error(
          `Price feed not found for ${pairBase}. Available: ${Object.keys(pythPriceIds).join(', ')}`
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

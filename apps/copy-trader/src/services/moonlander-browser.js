/**
 * Moonlander Exchange Adapter (Browser Version)
 * Smart contract-based trading on Cronos with Pyth price feeds
 * Uses globally loaded ethers from CDN
 */

import {
  MOONLANDER_API_URL,
  MOONLANDER_CHAIN,
  PYTH_VAA_CACHE_TTL_MS,
  DEFAULT_GAS_LIMIT,
  CLOSE_TRADE_GAS_LIMIT,
  PYTH_UPDATE_FEE_PER_UPDATE,
  PRICE_DECIMALS,
  QTY_DECIMALS,
  DEFAULT_SLIPPAGE_BPS,
  DEFAULT_STOP_LOSS_LONG_BPS,
  DEFAULT_STOP_LOSS_SHORT_BPS,
  DEFAULT_TAKE_PROFIT_LONG_BPS,
  DEFAULT_TAKE_PROFIT_SHORT_BPS,
  APPROVAL_THRESHOLD_PERCENTAGE,
  PYTH_PRICE_IDS,
  HYPERLIQUID_API_URL,
  PYTH_HERMES_URL,
} from '../config/moonlander-constants.js';

import {
  getFormattedTimestamp,
  cleanSymbolForHyperliquid,
  cleanPythPriceId,
  formatHexData,
} from '../utils/formatting.js';

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
    this.pairAddresses = pairAddresses;

    // API configuration (using constants)
    this.apiUrl = MOONLANDER_API_URL;
    this.chain = MOONLANDER_CHAIN;

    // Cache for trading pair info
    this.pairInfoCache = new Map();

    // Cache for prices (with expiry)
    this.priceCache = new Map();

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
   * Pre-warm Pyth VAA cache for given symbols (run in background during startup)
   * This prevents the first trade from being slow
   * @param {string[]} pairBases - Array of trading pairs (e.g., ["BTC/USD", "ETH/USD"])
   */
  async prefetchPythVAACache(pairBases) {
    console.log(`\n🔥 Pre-warming Pyth VAA cache for ${pairBases.length} symbols...`);

    const pythPriceIds = this.getPythPriceIds();
    const promises = pairBases.map(async (pairBase) => {
      try {
        const priceId = pythPriceIds[pairBase];
        if (!priceId) {
          console.log(`  ⚠️ ${pairBase}: No Pyth price ID found, skipping`);
          return;
        }

        // Fetch Hyperliquid price and Pyth VAA
        const priceStr = await this.fetchHyperliquidPrice(pairBase);
        const price = ethers.parseUnits(priceStr, 18);

        // Fetch Pyth VAA
        const cleanPriceId = priceId.replace('0x', '');
        const pythResponse = await fetch(`https://hermes.pyth.network/v2/updates/price/latest?ids[]=${cleanPriceId}&encoding=hex`);

        if (!pythResponse.ok) {
          console.log(`  ⚠️ ${pairBase}: Pyth fetch failed (${pythResponse.status})`);
          return;
        }

        const pythData = await pythResponse.json();
        const pythUpdateData = pythData.binary?.data || [];
        if (!pythUpdateData.length) {
          console.log(`  ⚠️ ${pairBase}: No Pyth VAA data`);
          return;
        }
        const formattedUpdateData = pythUpdateData.map((h) => `0x${h}`);

        // Cache it
        const result = { price, pythUpdateData: formattedUpdateData };
        this.priceCache.set(pairBase, { data: result, timestamp: Date.now() });

        console.log(`  ✅ ${pairBase}: Cached (${priceStr})`);
      } catch (error) {
        console.log(`  ⚠️ ${pairBase}: Failed - ${error.message}`);
      }
    });

    await Promise.all(promises);
    console.log(`✅ Pyth VAA cache pre-warmed (valid for 60s)\n`);
  }

  /**
   * Get Pyth price IDs mapping (using centralized constant)
   * @returns {Object} Mapping of pair names to Pyth price IDs
   */
  getPythPriceIds() {
    return PYTH_PRICE_IDS;
  }

  /**
   * Fetch fast price from Hyperliquid API (< 1s response time)
   * @param {string} pairBase - Trading pair identifier (e.g., "BTC/USD", "500BTC/USD")
   * @returns {Promise<string>} Price as string (e.g., "43250.5")
   */
  async fetchHyperliquidPrice(pairBase) {
    const start = performance.now();
    console.log(`  🚀 ${getFormattedTimestamp()} Fetching from Hyperliquid API for ${pairBase}...`);

    const cleanSymbol = cleanSymbolForHyperliquid(pairBase);

    const response = await fetch(HYPERLIQUID_API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'allMids' })
    });

    const end = performance.now();
    console.log(`  ⏱️ ${getFormattedTimestamp()} Hyperliquid API: ${(end - start).toFixed(0)}ms`);

    if (!response.ok) {
      throw new Error(`Hyperliquid API error: ${response.status}`);
    }

    const data = await response.json();
    const priceStr = data[cleanSymbol];

    if (!priceStr) {
      throw new Error(`Symbol ${cleanSymbol} not found on Hyperliquid. Available: ${Object.keys(data).slice(0, 10).join(', ')}...`);
    }

    console.log(`📊 ${getFormattedTimestamp()} Hyperliquid price for ${pairBase}: ${priceStr}`);
    return priceStr;
  }

  /**
   * Fetch current price for a trading pair with Pyth VAA data
   * Uses smart caching: Hyperliquid for fresh price (~1s), Pyth VAA cached for 60s
   * @param {string} pairBase - Trading pair identifier (e.g., "BTC/USD")
   * @returns {Promise<{price: bigint, pythUpdateData: string[]}>}
   */
  async fetchPrice(pairBase) {
    try {
      const pythPriceIds = this.getPythPriceIds();
      const priceId = pythPriceIds[pairBase];
      if (!priceId) {
        throw new Error(
          `Price feed not found for ${pairBase}. ` +
          `Available: ${Object.keys(pythPriceIds).slice(0, 10).join(', ')}... (${Object.keys(pythPriceIds).length} total)`
        );
      }

      // Check cache first - use longer TTL for Pyth VAA since we only need it for contract validation
      const cached = this.priceCache.get(pairBase);
      if (cached) {
        const cacheAge = Date.now() - cached.timestamp;
        if (cacheAge < PYTH_VAA_CACHE_TTL_MS) {
          console.log(`  💾 Using cached Pyth VAA for ${pairBase} (age: ${cacheAge}ms)`);

          // Fetch fresh Hyperliquid price (fast, ~1s)
          try {
            const priceStr = await this.fetchHyperliquidPrice(pairBase);
            const freshPrice = ethers.parseUnits(priceStr, PRICE_DECIMALS);

            // Return fresh price with cached Pyth VAA
            return {
              price: freshPrice,
              pythUpdateData: cached.data.pythUpdateData
            };
          } catch (hlError) {
            console.log(`  ⚠️ Hyperliquid fetch failed, using cached price too:`, hlError.message);
            return cached.data;
          }
        }
      }

      // No cache or expired - fetch Hyperliquid first (fast), then Pyth VAA (slow)
      console.log(`  🚀 ${getFormattedTimestamp()} Cache expired, fetching fresh data...`);

      // 1. Get fast Hyperliquid price first (~1s)
      const priceStr = await this.fetchHyperliquidPrice(pairBase);
      const price = ethers.parseUnits(priceStr, PRICE_DECIMALS);

      // 2. Then fetch Pyth VAA data (slow, ~20s, happens once per minute)
      console.log(`  ⏳ ${getFormattedTimestamp()} Fetching Pyth VAA data (happens once per minute)...`);
      const pythStart = performance.now();
      const cleanPriceId = cleanPythPriceId(priceId);

      const pythResponse = await fetch(`${PYTH_HERMES_URL}/v2/updates/price/latest?ids[]=${cleanPriceId}&encoding=hex`);

      const pythEnd = performance.now();
      console.log(`  ⏱️ ${getFormattedTimestamp()} Pyth VAA fetch: ${(pythEnd - pythStart).toFixed(0)}ms`);

      // Parse Pyth VAA
      if (!pythResponse.ok) throw new Error(`Pyth error: ${pythResponse.status}`);
      const pythData = await pythResponse.json();
      const pythUpdateData = pythData.binary?.data || [];
      if (!pythUpdateData.length) throw new Error(`No Pyth VAA for ${pairBase}`);
      const formattedUpdateData = pythUpdateData.map(formatHexData);

      console.log(`✅ ${getFormattedTimestamp()} ${pairBase}: ${priceStr} (VAA cached for 60s)`);

      const result = { price, pythUpdateData: formattedUpdateData };
      this.priceCache.set(pairBase, { data: result, timestamp: Date.now() });

      return result;
    } catch (error) {
      console.error(`Failed to fetch price for ${pairBase}:`, error);
      throw error;
    }
  }

  /**
   * Approve margin token spending by diamond contract
   * Approves maximum amount (2^256-1) so it only needs to be done once
   */
  async approveMarginToken() {
    try {
      if (!this.marginToken) {
        await this.initialize();
      }

      // Check current allowance first
      const currentAllowance = await this.marginToken.allowance(
        this.walletAddress,
        this.diamondAddress
      );

      // Use maximum uint256 value for unlimited approval
      const maxApproval = ethers.MaxUint256;

      // If allowance is already high (> 90% of max), skip approval
      const threshold = maxApproval / 10n; // 10% of max as threshold
      if (currentAllowance >= threshold) {
        console.log(`✅ Already approved (allowance: ${ethers.formatUnits(currentAllowance, 6)} USDC)`);
        return true;
      }

      console.log(`📝 Approving maximum amount for margin token (one-time approval)...`);
      const tx = await this.marginToken.approve(this.diamondAddress, maxApproval);
      console.log(`⏳ Waiting for approval transaction: ${tx.hash}`);
      await tx.wait();

      console.log(`✅ Maximum approval confirmed: ${tx.hash}`);
      console.log(`   This approval will work for all future trades.`);
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

      const timestamp = new Date().toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit', fractionalSecondDigits: 3 });
      console.log(`\n🌙 [${timestamp}] Opening ${isLong ? 'LONG' : 'SHORT'} market order`);
      console.log(`  Pair: ${pairBase}`);
      console.log(`  Margin: ${amount}`);
      console.log(`  Quantity: ${qty}`);

      // Get pair address
      const pairAddress = this.pairAddresses[pairBase];
      if (!pairAddress) {
        throw new Error(`Pair ${pairBase} not found in configuration`);
      }

      // Get current price (Hyperliquid fast price + Pyth VAA for contract)
      const priceStartTime = performance.now();
      const priceTimestamp = new Date().toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit', fractionalSecondDigits: 3 });
      console.log(`⏳ [${priceTimestamp}] Fetching price for ${pairBase}...`);

      const { price: currentPrice, pythUpdateData } = await this.fetchPrice(pairBase);

      const priceEndTime = performance.now();
      const priceEndTimestamp = new Date().toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit', fractionalSecondDigits: 3 });
      console.log(`✅ [${priceEndTimestamp}] Price fetched in ${(priceEndTime - priceStartTime).toFixed(0)}ms`);

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

      // Approve if needed (one-time max approval)
      await this.approveMarginToken();

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
      const txTimestamp = new Date().toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit', fractionalSecondDigits: 3 });
      console.log(`✅ [${txTimestamp}] Order submitted: ${receipt.hash}`);

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
      console.log(`📋 [${txTimestamp}] Trade hash: ${tradeHash}`);

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
   * Request to close a trade (simplified version)
   * This triggers a price request and returns the request ID
   * @param {string} tradeHash - Position hash to close
   * @returns {Promise<{txHash: string, requestId: string}>}
   */
  async closeTrade(tradeHash) {
    try {
      if (!this.tradingPortal) {
        await this.initialize();
      }

      const timestamp = new Date().toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit', fractionalSecondDigits: 3 });
      console.log(`\n🌙 [${timestamp}] Requesting trade closure: ${tradeHash}`);

      // Request closure (triggers RequestPrice event)
      const tx = await this.tradingPortal.closeTrade(tradeHash, {
        gasLimit: 600000,
      });

      const receipt = await tx.wait();
      const closeTimestamp = new Date().toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit', fractionalSecondDigits: 3 });
      console.log(`✅ [${closeTimestamp}] Close request submitted: ${receipt.hash}`);

      // Parse RequestPrice event to get request ID
      let requestId = null;
      for (const log of receipt.logs) {
        try {
          const parsed = this.tradingPortal.interface.parseLog({
            topics: log.topics,
            data: log.data,
          });

          if (parsed && parsed.name === 'RequestPrice') {
            requestId = parsed.args.requestId;
            console.log(`📋 [${closeTimestamp}] Request price ID: ${requestId}`);
            break;
          }
        } catch {
          // Skip logs that don't match
        }
      }

      if (!requestId) {
        console.warn(`⚠️ [${closeTimestamp}] RequestPrice event not found in transaction logs`);
      }

      return {
        txHash: receipt.hash,
        requestId: requestId || 'unknown',
        status: 'requested',
      };
    } catch (error) {
      console.error('Failed to request trade closure:', error);
      throw error;
    }
  }

  /**
   * Close an existing position with market order
   * @param {string} tradeHash - Position hash to close
   * @returns {Promise<{txHash: string, status: string}>}
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

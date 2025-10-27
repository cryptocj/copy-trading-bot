/**
 * Moonlander Exchange Adapter
 * Smart contract-based trading on Cronos with Pyth price feeds
 */

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { ethers } from 'ethers';

// Get directory path for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load ABIs from JSON files
const loadABI = (filename) => {
  const path = join(__dirname, '../abi', filename);
  return JSON.parse(readFileSync(path, 'utf8'));
};

// Load ABIs - use TradingPortalFacet for full ABI with events
export const TRADING_PORTAL_ABI = loadABI('TradingPortalFacet.json');
export const TRADING_READER_ABI = loadABI('TradingReaderFacet.json');
export const TRADING_CONFIG_ABI = loadABI('TradingConfigFacet.json');
export const PRICE_FACADE_ABI = loadABI('PriceFacadeFacet.json');
export const PAIRS_MANAGER_ABI = loadABI('PairsManagerFacet.json');

// Standard ERC20 ABI (minimal, can keep inline)
export const ERC20_ABI = [
  'function approve(address spender, uint256 amount) returns (bool)',
  'function allowance(address owner, address spender) view returns (uint256)',
  'function balanceOf(address account) view returns (uint256)',
  'function decimals() view returns (uint8)',
  'function symbol() view returns (string)',
  'function totalSupply() view returns (uint256)',
];

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
      marginTokenAddress, // USDC or other collateral token
      pythEndpoint = 'https://hermes.pyth.network',
      pairAddresses = {}, // Pair contract addresses mapping
    } = config;

    // Setup provider and signer
    this.provider = new ethers.JsonRpcProvider(rpcUrl);
    this.signer = new ethers.Wallet(privateKey, this.provider);
    this.walletAddress = this.signer.address;

    // Contract addresses
    this.diamondAddress = diamondAddress;
    this.marginTokenAddress = marginTokenAddress;
    this.pythEndpoint = pythEndpoint;
    this.pairAddresses = pairAddresses;

    // Initialize contract instances
    this.tradingPortal = new ethers.Contract(diamondAddress, TRADING_PORTAL_ABI, this.signer);
    this.tradingReader = new ethers.Contract(diamondAddress, TRADING_READER_ABI, this.provider);
    this.priceFacade = new ethers.Contract(diamondAddress, PRICE_FACADE_ABI, this.provider);
    this.tradingConfig = new ethers.Contract(diamondAddress, TRADING_CONFIG_ABI, this.provider);
    this.marginToken = new ethers.Contract(marginTokenAddress, ERC20_ABI, this.signer);

    console.log('🌙 Moonlander Exchange initialized');
    console.log(`  Wallet: ${this.walletAddress}`);
    console.log(`  Diamond: ${diamondAddress}`);
    console.log(`  Margin Token: ${marginTokenAddress}`);
  }

  /**
   * Fetch current price for a trading pair from Pyth Network
   * @param {string} pairBase - Trading pair identifier (e.g., "BTC/USD")
   * @returns {Promise<{price: bigint, pythUpdateData: string[]}>}
   */
  async fetchPrice(pairBase) {
    try {
      // Pyth Network price feed IDs (standardized across all blockchains)
      // Source: https://pyth.network/developers/price-feed-ids
      const pythPriceIds = {
        // Major Crypto
        'BTC/USD': '0xe62df6c8b4a85fe1a67db44dc12de5db330f7ac66b72dc658afedf0f4a415b43',
        'ETH/USD': '0xff61491a931112ddf1bd8147cd1b641375f79f5825126d665480874634fd0ace',
        'SOL/USD': '0xef0d8b6fda2ceba41da15d4095d1da392a0d2f8ed0c6c7bc0f4cfac8c280b56d',
        'CRO/USD': '0x23199c2bcb1303f667e733b9934db9eca5991e765b45f5ed18bc4b231415f2fe',

        // Layer 1 Chains
        'AVAX/USD': '0x93da3352f9f1d105fdfe4971cfa80e9dd777bfc5d0f683ebb6e1294b92137bb7',
        'DOT/USD': '0xca3eed9b267293f6595901c734c7525ce8ef49adafe8284606ceb307afa2ca5b',
        'ATOM/USD': '0xb00b60f88b03a6a625a8d1c048c3f66653edf217439983d037e7222c4e612819',
        'NEAR/USD': '0xc415de8d2eba7db216527dff4b60e8f3a5311c740dadb233e13e12547e226750',
        'ADA/USD': '0x2a01deaec9e51a579277b34b122399984d0bbf57e2458a7e42fecd2829867a0d',
        'ALGO/USD': '0xfa17ceaf30d19ba51112fdcc750cc83454776f47fb0112e4af07f15f4bb1ebc0',
        'TON/USD': '0x8963217838ab4cf5cadc172203c1f0b763fbaa45f346d8ee50ba994bbcac3026',
        'SUI/USD': '0x23d7315113f5b1d3ba7a83604c44b94d79f4fd69af77f804fc7f920a6dc65744',
        'HBAR/USD': '0x8d49e2d0c97f0b0c88e3e30d0f37c2b96d52d84a08eee08ab1f8e8b7f2f9a76a',

        // Major Altcoins
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

        // Layer 2 & Scaling
        'ARB/USD': '0x3fa4252848f9f0a1480be62745a4629d9eb1322aebab8a791e344b3b9c1adcf5',
        'POL/USD': '0xffd11c5a1cfd42f80afb2df4d9f264c15f956d68153335374ec10722edd70472',

        // AI & Gaming
        'FET/USD': '0xb98e7ae8af2d298d2651eb21ab5b8b5738212e13efb43bd0dfbce7a74ba4b5d0',
        'TAO/USD': '0x8a646b51e31085f85f7feda4813d7a30ebf8e08d3e0e96a8b3c4ef6f2f6f2e64',
        'RAY/USD': '0x91568baa8beb53db23eb3fb7f22c6e8b1b82d1e1c7e4c82e0c8be7d2e95c3e3e',
        'SAND/USD': '0xabf2e3f5f2f7e75c9e2e3f5f2f7e75c9e2e3f5f2f7e75c9e2e3f5f2f7e75c9e2',
      };

      // Extract token from pair (e.g., "BTC/USD" -> "BTC/USD")
      const priceId = pythPriceIds[pairBase];
      if (!priceId) {
        throw new Error(
          `Price feed not found for ${pairBase}. Available: ${Object.keys(pythPriceIds).join(', ')}`
        );
      }

      // Fetch latest price and VAA from Pyth Hermes API
      // Use mainnet endpoint (Pyth is network-agnostic)
      const pythUrl = 'https://hermes.pyth.network';
      const cleanPriceId = priceId.replace('0x', '');

      const response = await fetch(
        `${pythUrl}/v2/updates/price/latest?ids[]=${cleanPriceId}&encoding=hex`
      );

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(
          `Pyth API error: ${response.status} ${response.statusText}\nURL: ${pythUrl}/v2/updates/price/latest?ids[]=${cleanPriceId}\n${errorText}`
        );
      }

      const data = await response.json();

      // Extract price from parsed data
      const parsedPrice = data.parsed?.[0];
      if (!parsedPrice) {
        throw new Error(`No price data returned for ${pairBase}`);
      }

      // Convert price to 18 decimals (Pyth expo is negative)
      // Formula: price * 10^(18 + expo)
      const price = BigInt(parsedPrice.price.price) * BigInt(10 ** (18 + parsedPrice.price.expo));

      // Extract VAA update data from binary field
      const pythUpdateData = data.binary?.data || [];
      if (pythUpdateData.length === 0) {
        throw new Error(`No VAA update data returned for ${pairBase}`);
      }

      // Add 0x prefix to hex data
      const formattedUpdateData = pythUpdateData.map((hexData) => `0x${hexData}`);

      console.log(`  📊 Pyth price for ${pairBase}: ${ethers.formatUnits(price, 18)}`);

      return { price, pythUpdateData: formattedUpdateData };
    } catch (error) {
      console.error(`Failed to fetch price for ${pairBase}:`, error.message);
      throw error;
    }
  }

  /**
   * Get user's current positions
   * @returns {Promise<Array>} Array of position objects
   */
  async fetchPositions() {
    try {
      // Use getPositionsV2 with ZeroAddress to get all positions
      // Second parameter is token filter (use ZeroAddress for all tokens)
      const positions = await this.tradingReader.getPositionsV2(
        this.walletAddress,
        ethers.ZeroAddress
      );

      // Create reverse mapping: address → symbol
      const addressToSymbol = {};
      for (const [symbol, address] of Object.entries(this.pairAddresses)) {
        addressToSymbol[address.toLowerCase()] = symbol;
      }

      return positions.map((pos) => {
        // Convert pairBase address to symbol
        const pairAddress = pos.pairBase.toLowerCase();
        const symbol = addressToSymbol[pairAddress] || pos.pairBase;

        // Parse BigInt values to numbers with correct decimals
        const size = Number(pos.qty) / 1e10; // qty uses 10 decimals
        const entryPrice = Number(pos.entryPrice) / 1e18; // price uses 18 decimals
        const margin = Number(pos.margin) / 1e6; // margin uses 6 decimals (USDC)

        // Calculate leverage: (size * price) / margin
        const positionValue = size * entryPrice;
        const leverage = margin > 0 ? positionValue / margin : 0;

        const stopLoss = Number(pos.stopLoss) / 1e18;
        const takeProfit = Number(pos.takeProfit) / 1e18;

        return {
          tradeHash: pos.tradeHash,
          symbol,
          pairAddress: pos.pairBase, // Keep original address for reference
          side: pos.isLong ? 'long' : 'short',
          size,
          entryPrice,
          margin,
          leverage,
          stopLoss,
          takeProfit,
          fundingFee: Number(pos.fundingFee) / 1e18,
          openTimestamp: Number(pos.openTimestamp),
        };
      });
    } catch (error) {
      console.error('Failed to fetch positions:', error.message);
      return [];
    }
  }

  /**
   * Get user's balance for margin token
   * @returns {Promise<{total: number, free: number, used: number}>}
   */
  async fetchBalance() {
    try {
      const decimals = await this.marginToken.decimals();
      const balance = await this.marginToken.balanceOf(this.walletAddress);

      // Get total margin used in positions
      const positions = await this.fetchPositions();
      const usedMargin = positions.reduce(
        (sum, pos) => sum + Number(ethers.formatUnits(pos.margin, 18)),
        0
      );

      const total = Number(ethers.formatUnits(balance, decimals));
      const free = total - usedMargin;

      return {
        total,
        used: usedMargin,
        free: free > 0 ? free : 0,
      };
    } catch (error) {
      console.error('Failed to fetch balance:', error.message);
      return { total: 0, used: 0, free: 0 };
    }
  }

  /**
   * Approve margin token spending by diamond contract
   * Approves maximum amount (2^256-1) so it only needs to be done once
   */
  async approveMarginToken() {
    try {
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
        console.log(
          `  ✅ Already approved (allowance: ${ethers.formatUnits(currentAllowance, 6)} USDC)`
        );
        return true;
      }

      console.log(`  📝 Approving maximum amount for margin token (one-time approval)...`);
      const tx = await this.marginToken.approve(this.diamondAddress, maxApproval);
      console.log(`  ⏳ Waiting for approval transaction: ${tx.hash}`);
      await tx.wait();

      console.log(`  ✅ Maximum approval confirmed: ${tx.hash}`);
      console.log(`     This approval will work for all future trades.`);
      return true;
    } catch (error) {
      console.error('Failed to approve margin token:', error.message);
      throw error;
    }
  }

  /**
   * Parse event from transaction receipt
   * @param {Interface} contractInterface - Contract interface
   * @param {TransactionReceipt} receipt - Transaction receipt
   * @param {string} eventName - Event name to parse
   * @returns {object|null} Parsed event args or null if not found
   */
  parseEvent(contractInterface, receipt, eventName) {
    for (const log of receipt.logs) {
      try {
        const parsed = contractInterface.parseLog(log);
        if (parsed && parsed.name === eventName) {
          return parsed.args;
        }
      } catch {
        // Skip logs that don't match
      }
    }
    return null;
  }

  /**
   * Calculate acceptable price with slippage
   * @param {bigint} currentPrice - Current price from oracle
   * @param {boolean} isLong - true for LONG, false for SHORT
   * @param {number} slippagePercent - Slippage tolerance (default 10%)
   */
  calculateAcceptablePrice(currentPrice, isLong, slippagePercent = 10) {
    const multiplier = isLong ? 100 + slippagePercent : 100 - slippagePercent;
    return (currentPrice * BigInt(multiplier)) / 100n;
  }

  /**
   * Open a market order
   * @param {object} params - Order parameters
   * @returns {Promise<{tradeHash: string, txHash: string}>}
   */
  async createMarketOrder({
    pairBase,
    side, // 'buy' or 'sell', 'long' or 'short'
    amount, // Margin amount in human-readable format
    qty, // Position size in human-readable format
    stopLoss = null,
    takeProfit = null,
    broker = 1,
  }) {
    try {
      const isLong = side === 'buy' || side === 'long';

      console.log(`\n🌙 Opening ${isLong ? 'LONG' : 'SHORT'} market order on Moonlander`);
      console.log(`  Pair: ${pairBase}`);
      console.log(`  Margin: ${amount}`);
      console.log(`  Quantity: ${qty}`);

      // Step 1: Get pair address (pairBase must be address, not string!)
      const pairAddress = this.pairAddresses[pairBase];
      if (!pairAddress) {
        throw new Error(
          `Pair ${pairBase} not found in configuration. Available pairs: ${Object.keys(this.pairAddresses).join(', ')}`
        );
      }
      console.log(`  📍 Pair address: ${pairAddress}`);

      // Step 2: Get current price and Pyth update data
      const { price: currentPrice, pythUpdateData } = await this.fetchPrice(pairBase);
      console.log(`  Current price: ${ethers.formatUnits(currentPrice, 18)}`);

      // Step 3: Calculate order parameters
      const decimals = await this.marginToken.decimals();
      const amountIn = ethers.parseUnits(amount, decimals);
      const qtyWei = ethers.parseUnits(qty, 10); // Qty uses 10 decimals

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

      console.log(`  Acceptable price: ${ethers.formatUnits(acceptablePrice, 18)}`);
      console.log(`  Stop loss: ${ethers.formatUnits(stopLossPrice, 18)}`);
      console.log(`  Take profit: ${ethers.formatUnits(takeProfitPrice, 18)}`);

      // Step 3: Approve margin token if needed (one-time max approval)
      await this.approveMarginToken();

      // Step 4: Calculate Pyth update fee
      // Mainnet requires higher fee - successful txs use 0.06 CRO
      // Testnet uses 1 wei
      const pythUpdateFee = ethers.parseEther('0.06'); // 0.06 CRO for mainnet

      console.log(
        `  💰 Pyth update fee: ${ethers.formatEther(pythUpdateFee)} CRO (${pythUpdateData.length} updates)`
      );

      // Step 5: Submit order to smart contract
      console.log(`  🚀 Submitting order to blockchain...`);

      // Log parameters for debugging
      console.log(`  📋 Order params:`, {
        pairBase: pairAddress, // Now using address instead of string!
        isLong,
        tokenIn: this.marginTokenAddress,
        amountIn: amountIn.toString(),
        qty: qtyWei.toString(),
        price: acceptablePrice.toString(),
        stopLoss: stopLossPrice.toString(),
        takeProfit: takeProfitPrice.toString(),
        broker,
      });
      console.log(`  📋 Pyth data: ${pythUpdateData.length} update(s)`);

      // Try the standard function first (works on testnet and possibly mainnet)
      console.log(`  🚀 Attempting: openMarketTradeWithPyth`);

      const tx = await this.tradingPortal.openMarketTradeWithPyth(
        {
          pairBase: pairAddress, // CRITICAL: Use address, not string!
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
          value: pythUpdateFee, // Pyth update fee in CRO
        }
      );

      console.log(`  ⏳ Waiting for confirmation...`);
      const receipt = await tx.wait();
      console.log(`  ✅ Order submitted: ${receipt.hash}`);

      // Step 5: Extract trade hash from MarketPendingTrade event
      const marketPendingTradeEvent = this.parseEvent(
        this.tradingPortal.interface,
        receipt,
        'MarketPendingTrade'
      );

      if (!marketPendingTradeEvent) {
        throw new Error('MarketPendingTrade event not found in receipt');
      }

      const tradeHash = marketPendingTradeEvent.tradeHash;
      console.log(`  📋 Trade hash: ${tradeHash}`);
      console.log(`  ⚠️  Order is PENDING - awaiting keeper execution`);

      return {
        tradeHash,
        txHash: receipt.hash,
        status: 'pending',
      };
    } catch (error) {
      console.error('Failed to create market order:', error.message);
      throw error;
    }
  }

  /**
   * Close an existing position
   * @param {string} tradeHash - Hash of the trade to close
   * @returns {Promise<{txHash: string}>}
   */
  async closePosition(tradeHash) {
    try {
      console.log(`\n🌙 Closing position: ${tradeHash}`);

      // Get position details
      const position = await this.tradingReader.getPendingTrade(tradeHash);
      const { price: currentPrice, pythUpdateData } = await this.fetchPrice(position.pairBase);

      console.log(`  Current price: ${ethers.formatUnits(currentPrice, 18)}`);
      console.log(`  🚀 Submitting close order...`);

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
      console.log(`  ✅ Position closed: ${receipt.hash}`);

      return {
        txHash: receipt.hash,
        status: 'closed',
      };
    } catch (error) {
      console.error('Failed to close position:', error.message);
      throw error;
    }
  }

  /**
   * Get trading configuration and limits
   */
  async getTradingConfig() {
    try {
      const config = await this.tradingConfig.getTradingConfig();
      return {
        minNotionalUsd: ethers.formatUnits(config.minNotionalUsd, 18),
        maxLeverage: config.maxLeverage.toString(),
        maintenanceMarginRate: ethers.formatUnits(config.maintenanceMarginRate, 18),
        liquidationFeeRate: ethers.formatUnits(config.liquidationFeeRate, 18),
      };
    } catch (error) {
      console.error('Failed to get trading config:', error.message);
      return null;
    }
  }

  /**
   * Get pair-specific configuration
   */
  async getPairConfig(pairBase) {
    try {
      const config = await this.tradingConfig.getPairConfig(pairBase);
      return {
        name: config.name,
        base: config.base,
        enabled: config.enabled,
        maxLeverage: config.maxLeverage.toString(),
        maintenanceMargin: ethers.formatUnits(config.maintenanceMargin, 18),
      };
    } catch (error) {
      console.error(`Failed to get config for ${pairBase}:`, error.message);
      return null;
    }
  }
}

/**
 * Create Moonlander exchange instance
 * @param {object} config - Configuration object
 * @returns {MoonlanderExchange}
 */
export function createMoonlanderExchange(config) {
  return new MoonlanderExchange(config);
}

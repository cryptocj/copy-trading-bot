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
      // Pyth Network price feed IDs
      const pythPriceIds = {
        'BTC/USD': '0xe62df6c8b4a85fe1a67db44dc12de5db330f7ac66b72dc658afedf0f4a415b43',
        'ETH/USD': '0xff61491a931112ddf1bd8147cd1b641375f79f5825126d665480874634fd0ace',
        'SOL/USD': '0xef0d8b6fda2ceba41da15d4095d1da392a0d2f8ed0c6c7bc0f4cfac8c280b56d',
        'CRO/USD': '0x23199c2bcb1303f667e733b9934db9eca5991e765b45f5ed18bc4b231415f2fe',
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

      return positions.map((pos) => ({
        tradeHash: pos.tradeHash,
        symbol: pos.pairBase,
        side: pos.isLong ? 'long' : 'short',
        margin: pos.margin,
        leverage: pos.leverage,
        entryPrice: pos.entryPrice,
        size: pos.qty,
        stopLoss: pos.stopLoss,
        takeProfit: pos.takeProfit,
        fundingFee: pos.fundingFee,
        openTimestamp: pos.openTimestamp,
      }));
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
   * @param {string} amount - Amount to approve in human-readable format
   */
  async approveMarginToken(amount) {
    try {
      const decimals = await this.marginToken.decimals();
      const amountWei = ethers.parseUnits(amount, decimals);

      // Check current allowance
      const currentAllowance = await this.marginToken.allowance(
        this.walletAddress,
        this.diamondAddress
      );

      if (currentAllowance >= amountWei) {
        console.log(`  ✅ Already approved: ${amount}`);
        return true;
      }

      console.log(`  📝 Approving ${amount} margin token...`);
      const tx = await this.marginToken.approve(this.diamondAddress, amountWei);
      await tx.wait();

      console.log(`  ✅ Approval confirmed: ${tx.hash}`);
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

      // Step 3: Approve margin token if needed
      await this.approveMarginToken(amount);

      // Step 4: Calculate Pyth update fee
      // Fee is typically 1 wei per update data entry on testnet/mainnet
      const pythUpdateFee = BigInt(pythUpdateData.length) * BigInt(1);

      console.log(`  💰 Pyth update fee: ${pythUpdateFee} wei (${pythUpdateData.length} updates)`);

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
          value: pythUpdateFee, // Calculated Pyth fee
        }
      );

      console.log(`  ⏳ Waiting for confirmation...`);
      const receipt = await tx.wait();
      console.log(`  ✅ Order submitted: ${receipt.hash}`);

      // Step 5: Extract trade hash from MarketPendingTrade event
      const marketPendingTradeEvent = this.parseEvent(this.tradingPortal.interface, receipt, 'MarketPendingTrade');

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

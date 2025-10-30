// ============================================
// MOONLANDER-SERVICE.JS - Moonlander Blockchain Service
// ============================================

import {
  MOONLANDER_CONFIG,
  USDC_ADDRESS,
  ERC20_ABI,
  TRADING_READER_ABI,
  TRADING_PORTAL_ABI,
  PYTH_PRICE_IDS,
} from './moonlander-config.js';
import {
  MIN_COPY_BALANCE,
  DEFAULT_SLIPPAGE_PERCENT,
  DEFAULT_BROKER_ID,
  GAS_LIMIT_OPEN_TRADE,
  GAS_LIMIT_CLOSE_TRADE,
  PYTH_UPDATE_FEE,
  PYTH_API_URL,
  DECIMALS_USDC,
  DECIMALS_QTY,
  DECIMALS_PRICE,
  STOP_LOSS_PERCENT_LONG,
  STOP_LOSS_PERCENT_SHORT,
  TAKE_PROFIT_PERCENT_LONG,
  TAKE_PROFIT_PERCENT_SHORT,
} from './config.js';
import { SymbolUtils, log, calculateAcceptablePrice } from './utils.js';
import { state } from './state.js';

// Access ethers from global window object (loaded via UMD script in index.html)
const ethers = window.ethers;

// Get or create Moonlander wallet
export function getMoonlanderWallet(privateKey) {
  if (!privateKey) return null;
  if (!privateKey.match(/^0x[0-9a-fA-F]{64}$/)) {
    throw new Error('Invalid private key format');
  }
  if (!state.cachedMoonlanderWallet) {
    state.cachedMoonlanderWallet = new ethers.Wallet(privateKey);
  }
  return state.cachedMoonlanderWallet;
}

// Fetch Moonlander trading pairs
export async function fetchMoonlanderTradingPairs() {
  if (state.moonlanderTradingPairsCache) {
    return state.moonlanderTradingPairsCache;
  }
  try {
    const response = await fetch(
      'https://public-api.moonlander.trade/v1/trading-pairs?chain=CRONOS'
    );
    if (!response.ok) throw new Error(`API returned ${response.status}`);
    const data = await response.json();
    const mapping = {};
    (data.items || []).forEach((pair) => {
      mapping[pair.trading_pair_id.toLowerCase()] = pair.pair_name;
    });
    state.moonlanderTradingPairsCache = mapping;
    return mapping;
  } catch (error) {
    console.error('Failed to fetch trading pairs:', error);
    return {};
  }
}

// Fetch Moonlander positions
export async function fetchMoonlanderPositions(userAddress) {
  try {
    log('info', `📍 Moonlander wallet: ${userAddress.slice(0, 6)}...${userAddress.slice(-4)}`);

    // Fetch trading pairs mapping
    const tradingPairs = await fetchMoonlanderTradingPairs();

    // Create reverse mapping: address → symbol (from pairAddresses config)
    const addressToSymbol = {};
    for (const [symbol, address] of Object.entries(MOONLANDER_CONFIG.pairAddresses)) {
      addressToSymbol[address.toLowerCase()] = symbol;
    }

    // Fetch positions from API (has PnL and current price) and contract (has accurate SL/TP) in parallel
    const [apiResponse, contractPositions] = await Promise.all([
      fetch(`https://public-api.moonlander.trade/v1/user/${userAddress}/positions?chain=CRONOS`),
      (async () => {
        try {
          const provider = new ethers.JsonRpcProvider(MOONLANDER_CONFIG.rpcUrl);
          const tradingReader = new ethers.Contract(
            MOONLANDER_CONFIG.diamondAddress,
            TRADING_READER_ABI,
            provider
          );
          return await tradingReader.getPositionsV2(userAddress, ethers.ZeroAddress);
        } catch (error) {
          console.warn('Failed to fetch from contract:', error.message);
          return [];
        }
      })(),
    ]);

    if (!apiResponse.ok) {
      throw new Error(`API returned ${apiResponse.status}: ${apiResponse.statusText}`);
    }

    const apiData = await apiResponse.json();
    const apiPositions = apiData.items || [];

    // Create map of contract positions by position hash for SL/TP lookup
    const contractPositionMap = new Map();
    contractPositions.forEach((pos) => {
      contractPositionMap.set(pos.positionHash, pos);
    });

    // Parse positions from API and merge with contract data for SL/TP
    return apiPositions.map((apiPos) => {
      const pairAddress = apiPos.trading_pair_id.toLowerCase();
      const symbol = addressToSymbol[pairAddress] || tradingPairs[pairAddress] || 'UNKNOWN';

      // Get contract position for SL/TP
      const contractPos = contractPositionMap.get(apiPos.position_id);
      let stopLoss = null;
      let takeProfit = null;

      if (contractPos) {
        stopLoss = contractPos.stopLoss > 0 ? Number(contractPos.stopLoss) / 1e18 : null;
        takeProfit = contractPos.takeProfit > 0 ? Number(contractPos.takeProfit) / 1e18 : null;
      }

      return {
        positionHash: apiPos.position_id,
        symbol: symbol,
        pairBase: apiPos.trading_pair_id,
        side: apiPos.is_long ? 'long' : 'short',
        margin: parseFloat(apiPos.collateral),
        size: Math.abs(parseFloat(apiPos.position_size)),
        entryPrice: parseFloat(apiPos.entry_price),
        currentPrice: parseFloat(apiPos.market_price),
        unrealizedPnl: parseFloat(apiPos.pnl_after_fee),
        stopLoss: stopLoss,
        takeProfit: takeProfit,
        leverage: parseFloat(apiPos.leverage),
        timestamp: Date.now(), // API doesn't provide timestamp in clear format
      };
    });
  } catch (error) {
    log('error', `Failed to fetch Moonlander positions: ${error.message}`);
    return [];
  }
}

// Enrich positions with PnL
export async function enrichPositionsWithPnL(positions) {
  try {
    return await Promise.all(
      positions.map(async (pos) => {
        try {
          const pythData = await fetchPythPrice(pos.symbol);
          const priceDiff = pythData.price - pos.entryPrice;
          const multiplier = pos.side === 'long' ? 1 : -1;
          const unrealizedPnl = priceDiff * multiplier * pos.size;
          return {
            ...pos,
            currentPrice: pythData.price,
            unrealizedPnl,
            pnlPercent: (priceDiff / pos.entryPrice) * 100 * multiplier,
          };
        } catch (error) {
          return { ...pos, currentPrice: pos.entryPrice, unrealizedPnl: 0, pnlPercent: 0 };
        }
      })
    );
  } catch (error) {
    return positions;
  }
}

// Fetch Moonlander balance
export async function fetchMoonlanderBalance(walletAddress) {
  try {
    const provider = new ethers.JsonRpcProvider(MOONLANDER_CONFIG.rpcUrl);
    const usdcContract = new ethers.Contract(USDC_ADDRESS, ERC20_ABI, provider);
    const [balance, decimals] = await Promise.all([
      usdcContract.balanceOf(walletAddress),
      usdcContract.decimals(),
    ]);
    const freeBalance = Number(ethers.formatUnits(balance, decimals));
    const positions = await fetchMoonlanderPositions(walletAddress);
    const enrichedPositions = await enrichPositionsWithPnL(positions);
    const positionsMargin = enrichedPositions.reduce((sum, pos) => sum + pos.margin, 0);
    const positionsPnl = enrichedPositions.reduce((sum, pos) => sum + (pos.unrealizedPnl || 0), 0);
    const totalEquity = freeBalance + positionsMargin + positionsPnl;
    if (totalEquity < MIN_COPY_BALANCE) {
      log(
        'warning',
        `Total equity ($${totalEquity.toFixed(2)}) below minimum $${MIN_COPY_BALANCE}`
      );
    }
    const pnlSign = positionsPnl >= 0 ? '+' : '';
    log(
      'success',
      `Free: $${freeBalance.toFixed(2)} + Margin: $${positionsMargin.toFixed(2)} ${pnlSign}$${positionsPnl.toFixed(2)} = $${totalEquity.toFixed(2)}`
    );
    return { freeBalance, totalEquity, positionsValue: positionsMargin };
  } catch (error) {
    log('error', `Failed to fetch balance: ${error.message}`);
    return { freeBalance: MIN_COPY_BALANCE, totalEquity: MIN_COPY_BALANCE, positionsValue: 0 };
  }
}

// Fetch Pyth price
export async function fetchPythPrice(symbol) {
  const priceId = PYTH_PRICE_IDS[symbol];
  if (!priceId) throw new Error(`Pyth price ID not found for ${symbol}`);

  // Use Hermes v2 API endpoint
  const url = `${PYTH_API_URL}/v2/updates/price/latest?ids%5B%5D=${priceId}&encoding=hex&parsed=true&ignore_invalid_price_ids=true`;
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`Pyth API error: ${response.status} ${response.statusText}`);
  }

  const data = await response.json();

  if (!data.parsed || data.parsed.length === 0) {
    throw new Error(`No Pyth price data for ${symbol}`);
  }

  const priceData = data.parsed[0];
  const priceInfo = priceData.price;

  // Calculate actual price from price and expo
  const price = Number(priceInfo.price) * 10 ** priceInfo.expo;

  // Get update data in hex format (already provided by API with encoding=hex)
  const updateData = [`0x${data.binary.data[0]}`];

  return { price, updateData };
}

// Execute copy trade
export async function executeCopyTrade(position, action, moonlanderKey) {
  try {
    if (action === 'open') {
      log(
        'info',
        `Opening ${position.symbol} ${position.side.toUpperCase()} ${position.size.toFixed(4)} - Margin: $${position.margin.toFixed(2)}`
      );
      const provider = new ethers.JsonRpcProvider(MOONLANDER_CONFIG.rpcUrl);
      const signer = new ethers.Wallet(moonlanderKey, provider);
      const moonlanderSymbol = SymbolUtils.toMoonlanderFormat(position.symbol);
      const pairAddress = MOONLANDER_CONFIG.pairAddresses[moonlanderSymbol];
      if (!pairAddress) throw new Error(`Pair ${moonlanderSymbol} not found`);

      const pythPrice = await fetchPythPrice(moonlanderSymbol);
      const isLong = position.side === 'long' || position.side === 'buy';
      const amountIn = ethers.parseUnits(position.margin.toFixed(DECIMALS_USDC), DECIMALS_USDC);
      const qtyWei = ethers.parseUnits(position.size.toFixed(DECIMALS_QTY), DECIMALS_QTY);
      const acceptablePrice = calculateAcceptablePrice(
        pythPrice.price,
        isLong,
        DEFAULT_SLIPPAGE_PERCENT
      );
      const acceptablePriceWei = ethers.parseUnits(
        acceptablePrice.toFixed(DECIMALS_PRICE),
        DECIMALS_PRICE
      );

      // Stop loss and take profit (use trader's values if available, otherwise defaults)
      let stopLossWei;
      let takeProfitWei;

      if (position.stopLoss) {
        stopLossWei = ethers.parseUnits(position.stopLoss.toFixed(DECIMALS_PRICE), DECIMALS_PRICE);
        log('info', `  📍 Using trader's stop loss: $${position.stopLoss.toFixed(2)}`);
      } else {
        // pythPrice.price is a JavaScript number, convert to decimal string first
        const slPrice = isLong
          ? pythPrice.price * (STOP_LOSS_PERCENT_LONG / 100)
          : pythPrice.price * (STOP_LOSS_PERCENT_SHORT / 100);
        stopLossWei = ethers.parseUnits(slPrice.toFixed(DECIMALS_PRICE), DECIMALS_PRICE);
        log('info', `  ⚠️  No stop loss from trader, using default: $${slPrice.toFixed(2)}`);
      }

      if (position.takeProfit) {
        takeProfitWei = ethers.parseUnits(
          position.takeProfit.toFixed(DECIMALS_PRICE),
          DECIMALS_PRICE
        );
        log('info', `  🎯 Using trader's take profit: $${position.takeProfit.toFixed(2)}`);
      } else {
        const tpPrice = isLong
          ? pythPrice.price * (TAKE_PROFIT_PERCENT_LONG / 100)
          : pythPrice.price * (TAKE_PROFIT_PERCENT_SHORT / 100);
        takeProfitWei = ethers.parseUnits(tpPrice.toFixed(DECIMALS_PRICE), DECIMALS_PRICE);
        log('info', `  ⚠️  No take profit from trader, using default: $${tpPrice.toFixed(2)}`);
      }

      // Debug logging
      console.log('📊 Trade Parameters:');
      console.log(`   Position: ${position.symbol} ${isLong ? 'LONG' : 'SHORT'}`);
      console.log(`   Size: ${position.size} (${qtyWei.toString()} wei)`);
      console.log(`   Margin: $${position.margin.toFixed(2)} (${amountIn.toString()} wei)`);
      console.log(`   Pyth Price: ${pythPrice.price}`);
      console.log(`   Acceptable Price: ${acceptablePrice} (${acceptablePriceWei.toString()} wei)`);
      console.log(`   Stop Loss: ${stopLossWei.toString()} wei`);
      console.log(`   Take Profit: ${takeProfitWei.toString()} wei`);
      console.log(`   Pair Address: ${pairAddress}`);

      const usdcContract = new ethers.Contract(USDC_ADDRESS, ERC20_ABI, signer);
      const allowance = await usdcContract.allowance(
        signer.address,
        MOONLANDER_CONFIG.diamondAddress
      );
      if (allowance < amountIn) {
        log('info', 'Approving USDC...');
        const approveTx = await usdcContract.approve(
          MOONLANDER_CONFIG.diamondAddress,
          ethers.MaxUint256
        );
        await approveTx.wait();
        log('success', 'USDC approved');
      }

      const tradingPortal = new ethers.Contract(
        MOONLANDER_CONFIG.diamondAddress,
        TRADING_PORTAL_ABI,
        signer
      );
      const tx = await tradingPortal.openMarketTradeWithPyth(
        {
          pairBase: pairAddress,
          isLong,
          tokenIn: USDC_ADDRESS,
          amountIn,
          qty: qtyWei,
          price: acceptablePriceWei,
          stopLoss: stopLossWei,
          takeProfit: takeProfitWei,
          broker: DEFAULT_BROKER_ID,
        },
        pythPrice.updateData,
        { value: ethers.parseEther(PYTH_UPDATE_FEE), gasLimit: GAS_LIMIT_OPEN_TRADE }
      );
      log('info', `Transaction: ${tx.hash}`);
      await tx.wait();
      log('success', 'Position opened!');
      return { success: true, txHash: tx.hash };
    } else if (action === 'close') {
      log('info', `Closing ${position.symbol} ${position.side.toUpperCase()}`);
      const provider = new ethers.JsonRpcProvider(MOONLANDER_CONFIG.rpcUrl);
      const signer = new ethers.Wallet(moonlanderKey, provider);
      const tradingPortal = new ethers.Contract(
        MOONLANDER_CONFIG.diamondAddress,
        TRADING_PORTAL_ABI,
        signer
      );
      const tx = await tradingPortal.closeTrade(position.positionHash, {
        gasLimit: GAS_LIMIT_CLOSE_TRADE,
      });
      log('info', `Transaction: ${tx.hash}`);
      await tx.wait();
      log('success', 'Position closed!');
      return { success: true, txHash: tx.hash };
    }
  } catch (error) {
    log('error', `Failed to ${action}: ${error.message}`);
    state.stats.errors++;
    return { success: false, error: error.message };
  }
}

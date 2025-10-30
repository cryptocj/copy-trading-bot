// ============================================
// MOONLANDER-SERVICE.JS - Moonlander Blockchain Service
// ============================================

import {
    MOONLANDER_CONFIG,
    USDC_ADDRESS,
    ERC20_ABI,
    TRADING_READER_ABI,
    TRADING_CORE_ABI,
    PYTH_PRICE_IDS
} from './moonlander-config.js';
import {
    MIN_COPY_BALANCE,
    DECIMALS_USDC,
    DECIMALS_QTY,
    DECIMALS_PRICE,
    USDC_DIVISOR,
    QTY_DIVISOR,
    PRICE_DIVISOR,
    DEFAULT_SLIPPAGE_PERCENT,
    DEFAULT_BROKER_ID,
    GAS_LIMIT_OPEN_TRADE,
    GAS_LIMIT_CLOSE_TRADE,
    PYTH_UPDATE_FEE,
    PYTH_API_URL,
    STOP_LOSS_PERCENT_LONG,
    STOP_LOSS_PERCENT_SHORT,
    TAKE_PROFIT_PERCENT_LONG,
    TAKE_PROFIT_PERCENT_SHORT
} from './config.js';
import { SymbolUtils, log, calculateAcceptablePrice } from './utils.js';
import { state } from './state.js';

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
        const response = await fetch('https://public-api.moonlander.trade/v1/trading-pairs?chain=CRONOS');
        if (!response.ok) throw new Error(`API returned ${response.status}`);
        const data = await response.json();
        const mapping = {};
        (data.items || []).forEach(pair => {
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
        const provider = new ethers.JsonRpcProvider(MOONLANDER_CONFIG.rpcUrl);
        const contract = new ethers.Contract(MOONLANDER_CONFIG.diamondAddress, TRADING_READER_ABI, provider);
        const positionsData = await contract.getPositionsV2(userAddress, USDC_ADDRESS);
        const pairMapping = await fetchMoonlanderTradingPairs();

        return positionsData
            .filter(pos => pos.margin > 0n)
            .map(pos => ({
                positionHash: pos.positionHash,
                symbol: pairMapping[pos.pairBase.toLowerCase()] || pos.pair || 'UNKNOWN',
                pairBase: pos.pairBase,
                side: pos.isLong ? 'long' : 'short',
                margin: Number(pos.margin) / USDC_DIVISOR,
                size: Number(pos.qty) / QTY_DIVISOR,
                entryPrice: Number(pos.entryPrice) / PRICE_DIVISOR,
                stopLoss: pos.stopLoss > 0n ? Number(pos.stopLoss) / PRICE_DIVISOR : null,
                takeProfit: pos.takeProfit > 0n ? Number(pos.takeProfit) / PRICE_DIVISOR : null,
                fundingFee: Number(pos.fundingFee) / 1e18,
                timestamp: Number(pos.timestamp) * 1000,
                unrealizedPnl: 0
            }));
    } catch (error) {
        log('error', `Failed to fetch Moonlander positions: ${error.message}`);
        return [];
    }
}

// Enrich positions with PnL
export async function enrichPositionsWithPnL(positions) {
    try {
        return await Promise.all(positions.map(async (pos) => {
            try {
                const pythData = await fetchPythPrice(pos.symbol);
                const priceDiff = pythData.price - pos.entryPrice;
                const multiplier = pos.side === 'long' ? 1 : -1;
                const unrealizedPnl = (priceDiff / pos.entryPrice) * pos.margin * multiplier;
                return { ...pos, currentPrice: pythData.price, unrealizedPnl, pnlPercent: (priceDiff / pos.entryPrice) * 100 * multiplier };
            } catch (error) {
                return { ...pos, currentPrice: pos.entryPrice, unrealizedPnl: 0, pnlPercent: 0 };
            }
        }));
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
            usdcContract.decimals()
        ]);
        const freeBalance = Number(ethers.formatUnits(balance, decimals));
        const positions = await fetchMoonlanderPositions(walletAddress);
        const enrichedPositions = await enrichPositionsWithPnL(positions);
        const positionsMargin = enrichedPositions.reduce((sum, pos) => sum + pos.margin, 0);
        const positionsPnl = enrichedPositions.reduce((sum, pos) => sum + (pos.unrealizedPnl || 0), 0);
        const totalEquity = freeBalance + positionsMargin + positionsPnl;
        if (totalEquity < MIN_COPY_BALANCE) {
            log('warning', `Total equity ($${totalEquity.toFixed(2)}) below minimum $${MIN_COPY_BALANCE}`);
        }
        const pnlSign = positionsPnl >= 0 ? '+' : '';
        log('success', `Free: $${freeBalance.toFixed(2)} + Margin: $${positionsMargin.toFixed(2)} ${pnlSign}$${positionsPnl.toFixed(2)} = $${totalEquity.toFixed(2)}`);
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

    const response = await fetch(`${PYTH_API_URL}/latest_vaas?ids[]=${priceId}`);
    const data = await response.json();
    if (!data || data.length === 0) throw new Error(`No Pyth data for ${symbol}`);

    const pythUpdateData = data.map(vaaBase64 => {
        const binaryString = atob(vaaBase64);
        let hex = '0x';
        for (let i = 0; i < binaryString.length; i++) {
            hex += ('0' + binaryString.charCodeAt(i).toString(16)).slice(-2);
        }
        return hex;
    });

    const priceResponse = await fetch(`${PYTH_API_URL}/latest_price_feeds?ids[]=${priceId}`);
    const priceData = await priceResponse.json();
    if (!priceData || priceData.length === 0) throw new Error(`No price data for ${symbol}`);

    const priceFeed = priceData[0];
    const price = Number(priceFeed.price.price) * Math.pow(10, priceFeed.price.expo);
    return { price, updateData: pythUpdateData };
}

// Execute copy trade
export async function executeCopyTrade(position, action, moonlanderKey) {
    try {
        if (action === 'open') {
            log('info', `Opening ${position.symbol} ${position.side.toUpperCase()} ${position.size.toFixed(4)} - Margin: $${position.margin.toFixed(2)}`);
            const provider = new ethers.JsonRpcProvider(MOONLANDER_CONFIG.rpcUrl);
            const signer = new ethers.Wallet(moonlanderKey, provider);
            const moonlanderSymbol = SymbolUtils.toMoonlanderFormat(position.symbol);
            const pairAddress = MOONLANDER_CONFIG.pairAddresses[moonlanderSymbol];
            if (!pairAddress) throw new Error(`Pair ${moonlanderSymbol} not found`);

            const pythPrice = await fetchPythPrice(moonlanderSymbol);
            const isLong = position.side === 'long' || position.side === 'buy';
            const amountIn = ethers.parseUnits(position.margin.toFixed(DECIMALS_USDC), DECIMALS_USDC);
            const qtyWei = ethers.parseUnits(position.size.toFixed(DECIMALS_QTY), DECIMALS_QTY);
            const acceptablePrice = calculateAcceptablePrice(pythPrice.price, isLong, DEFAULT_SLIPPAGE_PERCENT);
            const acceptablePriceWei = ethers.parseUnits(acceptablePrice.toFixed(DECIMALS_PRICE), DECIMALS_PRICE);

            const stopLossPrice = position.stopLoss || (isLong ? pythPrice.price * (STOP_LOSS_PERCENT_LONG / 100) : pythPrice.price * (STOP_LOSS_PERCENT_SHORT / 100));
            const takeProfitPrice = position.takeProfit || (isLong ? pythPrice.price * (TAKE_PROFIT_PERCENT_LONG / 100) : pythPrice.price * (TAKE_PROFIT_PERCENT_SHORT / 100));
            const stopLossWei = ethers.parseUnits(stopLossPrice.toFixed(DECIMALS_PRICE), DECIMALS_PRICE);
            const takeProfitWei = ethers.parseUnits(takeProfitPrice.toFixed(DECIMALS_PRICE), DECIMALS_PRICE);

            const usdcContract = new ethers.Contract(USDC_ADDRESS, ERC20_ABI, signer);
            const allowance = await usdcContract.allowance(signer.address, MOONLANDER_CONFIG.diamondAddress);
            if (allowance < amountIn) {
                log('info', 'Approving USDC...');
                const approveTx = await usdcContract.approve(MOONLANDER_CONFIG.diamondAddress, ethers.MaxUint256);
                await approveTx.wait();
                log('success', 'USDC approved');
            }

            const tradingContract = new ethers.Contract(MOONLANDER_CONFIG.diamondAddress, TRADING_CORE_ABI, signer);
            const tx = await tradingContract.openMarketTradeWithPyth(
                pairAddress, isLong, amountIn, qtyWei, acceptablePriceWei, stopLossWei, takeProfitWei,
                DEFAULT_BROKER_ID, pythPrice.updateData,
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
            const tradingContract = new ethers.Contract(MOONLANDER_CONFIG.diamondAddress, TRADING_CORE_ABI, signer);
            const tx = await tradingContract.closeTrade(position.positionHash, { gasLimit: GAS_LIMIT_CLOSE_TRADE });
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

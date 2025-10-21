/**
 * Wallet service for querying balances and positions
 * Supports querying both own wallet and monitored wallets
 *
 * Note:
 * - fetchBalance: Uses CCXT with user parameter (works for both own and monitored wallets)
 * - fetchPositions: Uses CCXT for own wallet, direct API for monitored wallets
 *   (CCXT's fetchPositions has a bug with user parameter)
 */

const HYPERLIQUID_API_URL = 'https://api.hyperliquid.xyz/info';

/**
 * Fetch wallet balance (USDC and other assets)
 * @param {object} exchange - CCXT exchange instance
 * @param {string} [userAddress] - Optional: specific user address (for monitoring)
 * @returns {Promise<{total: number, free: number, used: number, assets: object}>}
 */
export async function fetchWalletBalance(exchange, userAddress = null) {
    try {
        // Load markets if not already loaded (required by CCXT)
        if (!exchange.markets || Object.keys(exchange.markets).length === 0) {
            await exchange.loadMarkets();
        }

        // CCXT's fetchBalance works with user parameter (unlike fetchPositions)
        const params = userAddress ? { user: userAddress } : {};
        const balance = await exchange.fetchBalance(params);

        // Extract USDC balance (primary trading currency on Hyperliquid)
        const usdc = balance.USDC || { free: 0, used: 0, total: 0 };

        // Get all non-zero balances
        const assets = {};
        for (const [asset, data] of Object.entries(balance)) {
            if (asset !== 'info' && asset !== 'free' && asset !== 'used' && asset !== 'total') {
                if (data.total > 0) {
                    assets[asset] = {
                        free: data.free || 0,
                        used: data.used || 0,
                        total: data.total || 0
                    };
                }
            }
        }

        return {
            total: usdc.total,
            free: usdc.free,
            used: usdc.used,
            assets
        };
    } catch (error) {
        console.error('Failed to fetch balance:', error);
        throw new Error(`Balance fetch failed: ${error.message}`);
    }
}

/**
 * Fetch positions directly from Hyperliquid API (for monitored wallets)
 * @param {string} userAddress - User wallet address
 * @returns {Promise<Array>} - Array of position objects
 */
async function fetchPositionsDirectAPI(userAddress) {
    const response = await fetch(HYPERLIQUID_API_URL, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            type: 'clearinghouseState',
            user: userAddress,
        }),
    });

    if (!response.ok) {
        throw new Error(`Hyperliquid API error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();

    // Extract and format positions
    const assetPositions = data.assetPositions || [];

    return assetPositions
        .filter(pos => parseFloat(pos.position.szi) !== 0) // Filter open positions
        .map(pos => {
            const szi = parseFloat(pos.position.szi);
            const isLong = szi > 0;

            return {
                symbol: `${pos.position.coin}/USDC:USDC`, // Format to match CCXT
                side: isLong ? 'long' : 'short',
                size: Math.abs(szi),
                entryPrice: parseFloat(pos.position.entryPx || 0),
                markPrice: parseFloat(pos.position.positionValue || 0) / Math.abs(szi),
                unrealizedPnl: parseFloat(pos.position.unrealizedPnl || 0),
                leverage: parseFloat(pos.position.leverage?.value || 1),
                percentage: 0, // Not provided by direct API
                liquidationPrice: parseFloat(pos.position.liquidationPx || 0),
            };
        });
}

/**
 * Fetch open positions
 * @param {object} exchange - CCXT exchange instance
 * @param {string} [userAddress] - Optional: specific user address (for monitoring)
 * @returns {Promise<Array<{symbol: string, side: string, size: number, entryPrice: number, markPrice: number, unrealizedPnl: number, leverage: number}>>}
 */
export async function fetchPositions(exchange, userAddress = null) {
    try {
        // Use direct API for monitored wallets (CCXT has issues with user parameter)
        if (userAddress) {
            return await fetchPositionsDirectAPI(userAddress);
        }

        // Use CCXT for own wallet (works fine)
        // Load markets if not already loaded (required by CCXT)
        if (!exchange.markets || Object.keys(exchange.markets).length === 0) {
            await exchange.loadMarkets();
        }

        const positions = await exchange.fetchPositions();

        // Filter only open positions and format
        const openPositions = positions
            .filter(pos => pos.contracts !== 0)
            .map(pos => ({
                symbol: pos.symbol,
                side: pos.side, // 'long' or 'short'
                size: Math.abs(pos.contracts || 0),
                entryPrice: pos.entryPrice || 0,
                markPrice: pos.markPrice || 0,
                unrealizedPnl: pos.unrealizedPnl || 0,
                leverage: pos.leverage || 1,
                percentage: pos.percentage || 0, // PnL percentage
                liquidationPrice: pos.liquidationPrice || 0
            }));

        return openPositions;
    } catch (error) {
        console.error('Failed to fetch positions:', error);
        throw new Error(`Positions fetch failed: ${error.message}`);
    }
}

/**
 * Fetch complete wallet info (balance + positions)
 * @param {object} exchange - CCXT exchange instance
 * @param {string} [userAddress] - Optional: specific user address (for monitoring)
 * @returns {Promise<{balance: object, positions: Array, timestamp: number}>}
 */
export async function fetchWalletInfo(exchange, userAddress = null) {
    try {
        const [balance, positions] = await Promise.all([
            fetchWalletBalance(exchange, userAddress),
            fetchPositions(exchange, userAddress)
        ]);

        // Calculate total position value
        const totalPositionValue = positions.reduce((sum, pos) => {
            return sum + (pos.size * pos.markPrice);
        }, 0);

        // Calculate total unrealized PnL
        const totalUnrealizedPnl = positions.reduce((sum, pos) => {
            return sum + pos.unrealizedPnl;
        }, 0);

        return {
            address: userAddress || 'Your Wallet',
            balance,
            positions,
            totalPositionValue,
            totalUnrealizedPnl,
            timestamp: Date.now()
        };
    } catch (error) {
        console.error('Failed to fetch wallet info:', error);
        throw error;
    }
}

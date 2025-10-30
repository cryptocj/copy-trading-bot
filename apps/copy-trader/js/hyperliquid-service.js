// ============================================
// HYPERLIQUID-SERVICE.JS - Hyperliquid API
// ============================================

import { HYPERLIQUID_API_URL } from './config.js';
import { log } from './utils.js';
import { state } from './state.js';

// Fetch last trade timestamp for trader
export async function fetchLastTradeTimestamp(traderAddress) {
    try {
        const response = await fetch(`${HYPERLIQUID_API_URL}/info`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                type: 'userFills',
                user: traderAddress,
            }),
        });

        const fills = await response.json();

        // Get the most recent fill timestamp
        if (fills && fills.length > 0) {
            return fills[0].time;
        }

        return null;
    } catch (error) {
        console.error('Failed to fetch last trade timestamp:', error);
        return null;
    }
}

// Fetch trader's open orders (for stop loss and take profit)
export async function fetchTraderOrders(traderAddress) {
    try {
        const response = await fetch(`${HYPERLIQUID_API_URL}/info`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                type: 'frontendOpenOrders',
                user: traderAddress,
            }),
        });

        const orders = await response.json();
        return orders || [];
    } catch (error) {
        log('warning', `Failed to fetch trader orders: ${error.message}`);
        return [];
    }
}

// Fetch user fills (trade history) to get position open timestamps
export async function fetchUserFills(userAddress) {
    try {
        const response = await fetch(`${HYPERLIQUID_API_URL}/info`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                type: 'userFills',
                user: userAddress,
            }),
        });

        const fills = await response.json();
        return fills || [];
    } catch (error) {
        console.warn(`Failed to fetch user fills: ${error.message}`);
        return [];
    }
}

// Fetch trader positions with enriched data (stop loss, take profit, timestamps)
export async function fetchTraderPositions(traderAddress) {
    try {
        // Fetch positions, orders, and fills in parallel for better performance
        const [positionsResponse, orders, fills] = await Promise.all([
            fetch(`${HYPERLIQUID_API_URL}/info`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    type: 'clearinghouseState',
                    user: traderAddress,
                }),
            }),
            fetchTraderOrders(traderAddress),
            fetchUserFills(traderAddress)
        ]);

        const data = await positionsResponse.json();

        // Convert to standard format
        const positions = data.assetPositions
            .filter((pos) => Math.abs(pos.position.szi) > 0)
            .map((pos) => {
                const symbol = pos.position.coin;
                const side = parseFloat(pos.position.szi) > 0 ? 'long' : 'short';
                const size = Math.abs(parseFloat(pos.position.szi));

                // Find position open timestamp from fills
                let timestamp = null;
                const positionFills = fills.filter(fill =>
                    fill.coin === symbol &&
                    ((side === 'long' && fill.side === 'B') || (side === 'short' && fill.side === 'A'))
                );

                if (positionFills.length > 0) {
                    // Sort by time descending and get the most recent fill
                    positionFills.sort((a, b) => b.time - a.time);
                    timestamp = positionFills[0].time; // Unix timestamp in milliseconds
                }

                const entryPrice = parseFloat(pos.position.entryPx);
                let stopLoss = null;
                let takeProfit = null;

                // Find stop loss and take profit from trigger orders
                // Filter trigger orders for this position with robust matching
                const positionOrders = orders.filter(order => {
                    // Must be same symbol
                    if (order.coin !== symbol) return false;

                    // Must be trigger order
                    if (!order.isTrigger) return false;

                    // Must have size (origSz or sz)
                    const orderSize = parseFloat(order.origSz || order.sz || 0);
                    if (orderSize === 0) return false;

                    // Size should be close to position size (allow 1% tolerance)
                    const sizeDiff = Math.abs(orderSize - size) / size;
                    if (sizeDiff > 0.01) return false;

                    // Must be closing order (opposite side of position)
                    // For LONG position, closing orders are sell ('A' = Ask)
                    // For SHORT position, closing orders are buy ('B' = Bid)
                    if (side === 'long' && order.side !== 'A') return false;
                    if (side === 'short' && order.side !== 'B') return false;

                    // If we have position timestamp, prefer orders created after position opened
                    if (timestamp && order.timestamp) {
                        const timeDiff = Math.abs(order.timestamp - timestamp);
                        const fiveMinutes = 5 * 60 * 1000;
                        if (timeDiff > fiveMinutes) {
                            order._timeDiffPenalty = timeDiff;
                        }
                    }

                    return true;
                }).sort((a, b) => {
                    // Sort by time proximity to position open first, then by order ID
                    const aPenalty = a._timeDiffPenalty || 0;
                    const bPenalty = b._timeDiffPenalty || 0;

                    if (aPenalty !== bPenalty) {
                        return aPenalty - bPenalty;
                    }

                    return (b.oid || 0) - (a.oid || 0);
                });

                // Track which type we've found
                let foundStopLoss = false;
                let foundTakeProfit = false;

                for (const order of positionOrders) {
                    const triggerPrice = parseFloat(order.triggerPx);

                    // Parse trigger condition - "Price below X" or "Price above X"
                    const isBelowTrigger = order.triggerCondition?.toLowerCase().includes('below');
                    const isAboveTrigger = order.triggerCondition?.toLowerCase().includes('above');

                    // For LONG positions:
                    // - Stop loss = trigger below entry price (exit when price drops)
                    // - Take profit = trigger above entry price (exit when price rises)
                    if (side === 'long') {
                        if (isBelowTrigger && triggerPrice < entryPrice && !foundStopLoss) {
                            stopLoss = triggerPrice;
                            foundStopLoss = true;
                        } else if (isAboveTrigger && triggerPrice > entryPrice && !foundTakeProfit) {
                            takeProfit = triggerPrice;
                            foundTakeProfit = true;
                        }
                    }
                    // For SHORT positions:
                    // - Stop loss = trigger above entry price (exit when price rises)
                    // - Take profit = trigger below entry price (exit when price drops)
                    else if (side === 'short') {
                        if (isAboveTrigger && triggerPrice > entryPrice && !foundStopLoss) {
                            stopLoss = triggerPrice;
                            foundStopLoss = true;
                        } else if (isBelowTrigger && triggerPrice < entryPrice && !foundTakeProfit) {
                            takeProfit = triggerPrice;
                            foundTakeProfit = true;
                        }
                    }

                    // Stop iterating once we've found both SL and TP
                    if (foundStopLoss && foundTakeProfit) break;
                }

                return {
                    symbol,
                    side,
                    size,
                    entryPrice,
                    leverage: parseFloat(pos.position.leverage.value),
                    unrealizedPnl: parseFloat(pos.position.unrealizedPnl),
                    margin: parseFloat(pos.position.marginUsed),
                    stopLoss,
                    takeProfit,
                    timestamp
                };
            });

        // Return both positions and full account data for balance calculations
        return { positions, accountData: data };
    } catch (error) {
        log('error', `Failed to fetch trader positions: ${error.message}`);
        state.stats.errors++;
        return { positions: [], accountData: null };
    }
}

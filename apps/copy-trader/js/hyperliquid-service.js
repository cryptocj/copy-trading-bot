// ============================================
// HYPERLIQUID-SERVICE.JS - Hyperliquid API
// ============================================

import { HYPERLIQUID_API_URL } from './config.js';
import { log } from './utils.js';
import { state } from './state.js';

// Fetch last trade timestamp for trader
export async function fetchLastTradeTimestamp(traderAddress, exchange) {
    try {
        const response = await fetch(`${exchange.urls.api.public}/info`, {
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
export async function fetchTraderOrders(traderAddress, exchange) {
    try {
        const response = await fetch(`${exchange.urls.api.public}/info`, {
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
export async function fetchUserFills(userAddress, exchange) {
    try {
        const response = await fetch(`${exchange.urls.api.public}/info`, {
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
export async function fetchTraderPositions(traderAddress, exchange) {
    try {
        // Fetch positions, orders, and fills in parallel for better performance
        const [positionsResponse, orders, fills] = await Promise.all([
            fetch(`${exchange.urls.api.public}/info`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    type: 'clearinghouseState',
                    user: traderAddress,
                }),
            }),
            fetchTraderOrders(traderAddress, exchange),
            fetchUserFills(traderAddress, exchange)
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
                    // Get earliest fill for this position (position open time)
                    timestamp = positionFills[positionFills.length - 1].time;
                }

                const entryPrice = parseFloat(pos.position.entryPx);
                let stopLoss = null;
                let takeProfit = null;

                // Find stop loss and take profit from open orders
                const positionOrders = orders.filter(order => order.coin === symbol);

                // Track if we've found SL and TP to avoid duplicates
                let foundStopLoss = false;
                let foundTakeProfit = false;

                for (const order of positionOrders) {
                    if (!order.trigger || (!order.trigger.tpsl && !order.trigger.triggerPx)) continue;

                    const triggerPrice = parseFloat(order.trigger.tpsl || order.trigger.triggerPx);
                    const isBelowTrigger = order.isBuy === false;
                    const isAboveTrigger = order.isBuy === true;

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

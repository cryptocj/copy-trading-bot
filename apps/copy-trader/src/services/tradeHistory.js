/**
 * Trade History service for fetching trader's historical fills
 * Uses Hyperliquid public API
 */

import { formatNumber, formatTimestamp } from '../utils/format.js';

const HYPERLIQUID_API = 'https://api.hyperliquid.xyz/info';

/**
 * Fetch trade history (fills) for a specific trader address
 * @param {string} address - Trader's Ethereum address
 * @param {number} limit - Maximum number of trades to return (default: 200)
 * @returns {Promise<Array>} Array of trade objects
 */
export async function fetchTradeHistory(address, limit = 200) {
  try {
    console.log(`[tradeHistory] Fetching trade history for ${address}...`);
    console.log(`[tradeHistory] API URL: ${HYPERLIQUID_API}`);

    const response = await fetch(HYPERLIQUID_API, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: 'userFills',
        user: address
      })
    });

    console.log(`[tradeHistory] Response status: ${response.status}`);

    if (!response.ok) {
      throw new Error(`API returned ${response.status}: ${response.statusText}`);
    }

    const fills = await response.json();
    console.log(`[tradeHistory] Received ${fills.length} fills from API`);

    if (!Array.isArray(fills)) {
      throw new Error('Invalid API response format');
    }

    console.log(`Fetched ${fills.length} fills`);

    // Aggregate fills by order ID (oid)
    const orderMap = new Map();

    fills.forEach(fill => {
      const orderId = fill.oid;

      if (!orderMap.has(orderId)) {
        // First fill for this order
        orderMap.set(orderId, {
          orderId: orderId,
          coin: fill.coin,
          side: fill.side === 'B' ? 'buy' : 'sell',
          direction: fill.dir,
          timestamp: fill.time,
          totalSize: 0,
          weightedPriceSum: 0,
          totalPnl: 0,
          totalFee: 0,
          fillCount: 0,
          hash: fill.hash
        });
      }

      const order = orderMap.get(orderId);
      const size = parseFloat(fill.sz);
      const price = parseFloat(fill.px);

      // Aggregate values
      order.totalSize += size;
      order.weightedPriceSum += size * price; // For calculating average price
      order.totalPnl += fill.closedPnl ? parseFloat(fill.closedPnl) : 0;
      order.totalFee += parseFloat(fill.fee);
      order.fillCount++;
    });

    // Convert map to array and calculate average prices
    const orders = Array.from(orderMap.values()).map(order => ({
      coin: order.coin,
      price: order.weightedPriceSum / order.totalSize, // Average execution price
      size: order.totalSize,
      side: order.side,
      direction: order.direction,
      timestamp: order.timestamp,
      pnl: order.totalPnl !== 0 ? order.totalPnl : null,
      fee: order.totalFee,
      fillCount: order.fillCount, // How many fills this order had
      hash: order.hash
    }));

    // Sort by timestamp descending (most recent first)
    orders.sort((a, b) => b.timestamp - a.timestamp);

    console.log(`Aggregated ${fills.length} fills into ${orders.length} orders`);

    return orders.slice(0, limit);
  } catch (error) {
    console.error('Failed to fetch trade history:', error);
    throw error;
  }
}

/**
 * Render trade history table
 * @param {Array} trades - Array of trade objects
 * @param {HTMLElement} tableBody - Table body element to populate
 */
export function renderTradeHistoryTable(trades, tableBody) {
  if (!tableBody) {
    console.error('Trade history table body element not found');
    return;
  }

  if (trades.length === 0) {
    tableBody.innerHTML = `
      <tr>
        <td colspan="8" style="text-align:center; padding:30px; color:#666;">
          No order history available for this address.
        </td>
      </tr>
    `;
    return;
  }

  const html = trades.map(trade => {
    const sideClass = trade.side === 'buy' ? 'buy' : 'sell';
    const pnlClass = trade.pnl === null ? '' : (trade.pnl >= 0 ? 'buy' : 'sell');
    const pnlSign = trade.pnl === null ? 'N/A' : (trade.pnl >= 0 ? '+' : '');
    const pnlValue = trade.pnl === null ? 'N/A' : `${pnlSign}$${formatNumber(trade.pnl, 2)}`;

    return `
      <tr>
        <td>${formatTimestamp(trade.timestamp)}</td>
        <td><strong>${trade.coin}</strong></td>
        <td class="${sideClass}">${trade.side.toUpperCase()}</td>
        <td>${trade.direction}</td>
        <td>${formatNumber(trade.size, 4)}</td>
        <td>$${formatNumber(trade.price, 2)}</td>
        <td class="${pnlClass}">${pnlValue}</td>
        <td style="color:#888; font-size:0.9em;">${trade.fillCount}x</td>
      </tr>
    `;
  }).join('');

  tableBody.innerHTML = html;
}

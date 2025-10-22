/**
 * Order list rendering module
 * Handles rendering of recent orders from wallet address
 */

import { orderList, addOrderToList } from '../state/appState.js';
import { fetchTradeHistory } from '../services/tradeHistory.js';
import { formatNumber, formatTimestamp } from '../utils/format.js';

/**
 * Add order to list and re-render
 * @param {object} elements - DOM element references
 * @param {object} order - Order object with symbol, side, amount, price, timestamp
 */
export function addOrder(elements, order) {
  addOrderToList(order);
  renderOrderList(elements);
}

/**
 * Render order list in UI (US4)
 * Displays most recent 6 orders in FIFO order
 * @param {object} elements - DOM element references
 */
export function renderOrderList(elements) {
  if (orderList.length === 0) {
    elements.ordersBody.innerHTML = '';
    return;
  }

  const html = orderList
    .map(
      (order) => `
        <tr>
            <td>${order.symbol}</td>
            <td class="${order.side}">${order.side.toUpperCase()}</td>
            <td>${Number(order.amount).toFixed(6)}</td>
            <td>$${Number(order.price).toFixed(2)}</td>
            <td>${new Date(order.timestamp).toLocaleString()}</td>
        </tr>
    `
    )
    .join('');

  elements.ordersBody.innerHTML = html;
}

/**
 * Fetch and display recent orders for a wallet address
 * @param {object} elements - DOM element references
 * @param {string} address - Wallet address to fetch orders for
 */
export async function fetchAndDisplayRecentOrders(elements, address) {
  if (!address) {
    // Clear orders if no address
    elements.ordersBody.innerHTML = `
      <tr>
        <td colspan="5" class="text-center py-4 text-gray-500">No wallet loaded</td>
      </tr>
    `;
    return;
  }

  try {
    console.log(`Fetching recent orders for ${address}...`);

    // Fetch last 6 orders
    const orders = await fetchTradeHistory(address, 6);

    if (orders.length === 0) {
      elements.ordersBody.innerHTML = `
        <tr>
          <td colspan="5" class="text-center py-4 text-gray-500">No recent orders</td>
        </tr>
      `;
      return;
    }

    // Render orders
    const html = orders
      .map(order => {
        const sideClass = order.side === 'buy' ? 'buy' : 'sell';
        return `
          <tr>
            <td><strong>${order.coin}</strong></td>
            <td class="${sideClass}">${order.side.toUpperCase()}</td>
            <td>${formatNumber(order.size, 4)}</td>
            <td>$${formatNumber(order.price, 2)}</td>
            <td>${formatTimestamp(order.timestamp)}</td>
          </tr>
        `;
      })
      .join('');

    elements.ordersBody.innerHTML = html;
    console.log(`Displayed ${orders.length} recent orders`);
  } catch (error) {
    console.error('Failed to fetch recent orders:', error);
    elements.ordersBody.innerHTML = `
      <tr>
        <td colspan="5" class="text-center py-4 text-red-400">Failed to load orders</td>
      </tr>
    `;
  }
}

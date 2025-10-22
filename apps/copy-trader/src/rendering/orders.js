/**
 * Order list rendering module
 * Handles rendering of recent orders (FIFO list, max 6 items)
 */

import { orderList, addOrderToList } from '../state/appState.js';

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

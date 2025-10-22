/**
 * Trade history rendering module
 * Handles rendering of trade history and history panel
 */

import { truncateAddress } from '../utils/format.js';
import { fetchTradeHistory, renderTradeHistoryTable } from '../services/tradeHistory.js';
import {
  renderSelectedWalletBalance,
  renderSelectedWalletPositions,
  fetchBalanceForAddress,
  fetchPositionsForAddress
} from './wallet.js';

/**
 * Setup event listeners for history panel
 */
export function setupHistoryPanelListeners() {
  // Delegate click event for trader links (stop row selection)
  document.addEventListener('click', (e) => {
    const traderLink = e.target.closest('.trader-link');
    if (traderLink) {
      e.stopPropagation(); // Prevent row selection
      console.log('Trader link clicked - opening Hyperliquid');
    }
  });
}

/**
 * Show positions and trade history in right panel
 * @param {object} elements - DOM element references
 * @param {string} address - Wallet address to display
 */
export async function showHistoryPanel(elements, address) {
  console.log('========================================');
  console.log('[showHistoryPanel] FUNCTION CALLED');
  console.log('[showHistoryPanel] Address:', address);
  console.log('[showHistoryPanel] Timestamp:', new Date().toISOString());
  console.log('========================================');

  // Reset state - hide all panels
  elements.historyPlaceholder.style.display = 'none';
  elements.historyLoading.style.display = 'block';
  elements.historyError.style.display = 'none';
  elements.historyContent.style.display = 'none';

  // Set address display
  elements.historyAddress.textContent = truncateAddress(address);
  elements.historyAddress.title = address;

  try {
    console.log('[showHistoryPanel] Step 1: Starting data fetch...');

    // Fetch balance, positions and order history in parallel
    const [balance, positions, orders] = await Promise.all([
      fetchBalanceForAddress(address),
      fetchPositionsForAddress(address),
      fetchTradeHistory(address, 200),
    ]);

    console.log('[showHistoryPanel] Step 2: Data fetched successfully');
    console.log('[showHistoryPanel] Step 2: Balance:', balance);
    console.log('[showHistoryPanel] Step 2: Positions count:', positions.length);
    console.log('[showHistoryPanel] Step 2: Orders count:', orders.length);

    // Hide loading, show content
    elements.historyLoading.style.display = 'none';
    elements.historyContent.style.display = 'block';

    // Render balance
    console.log('[showHistoryPanel] Step 3: Rendering balance...');
    renderSelectedWalletBalance(elements, balance);

    // Render positions
    console.log('[showHistoryPanel] Step 3: Rendering positions...');
    renderSelectedWalletPositions(elements, positions);

    // Render orders in history panel
    console.log(`[showHistoryPanel] Step 4: Rendering ${orders.length} orders in history panel`);
    console.log(`[showHistoryPanel] Step 4: historyBody element:`, elements.historyBody);
    console.log(`[showHistoryPanel] Step 4: historyBody exists:`, !!elements.historyBody);

    try {
      renderTradeHistoryTable(orders, elements.historyBody);
      console.log(`[showHistoryPanel] Step 4: History panel updated successfully`);
    } catch (err) {
      console.error(`[showHistoryPanel] Step 4: Error rendering history table:`, err);
    }

    // Also update the "Recent Orders" section at the bottom to show selected wallet's orders
    console.log(`[showHistoryPanel] Step 5: Updating Recent Orders section`);
    console.log(`[showHistoryPanel] - Total orders: ${orders.length}`);
    console.log(`[showHistoryPanel] - Orders to display: ${Math.min(orders.length, 6)}`);
    console.log(`[showHistoryPanel] - Target element:`, elements.ordersBody);
    console.log(`[showHistoryPanel] - Element exists:`, !!elements.ordersBody);
    console.log(`[showHistoryPanel] - Element ID should be:`, 'orders-body');

    try {
      renderTradeHistoryTable(orders.slice(0, 6), elements.ordersBody);
      console.log(`[showHistoryPanel] Step 5: Recent Orders section updated successfully`);
    } catch (err) {
      console.error(`[showHistoryPanel] Step 5: Error rendering orders table:`, err);
    }

    console.log(
      `[showHistoryPanel] ✅ Complete: Displayed balance, ${positions.length} positions and ${orders.length} orders for ${address}`
    );
  } catch (error) {
    console.error('Error in showHistoryPanel:', error);
    // Show error
    elements.historyLoading.style.display = 'none';
    elements.historyError.style.display = 'block';
    elements.historyError.textContent = `Failed to load data: ${error.message}`;
  }
}

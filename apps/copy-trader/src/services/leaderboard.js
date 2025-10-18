/**
 * Leaderboard service for fetching and displaying top Hyperliquid traders
 * US1: Discover Traders via Leaderboard
 */

import { formatNumber, truncateAddress } from '../utils/format.js';

// Local leaderboard data (bypasses CORS restrictions)
// Pre-filtered to top 20 active traders with account value > $50K
const LEADERBOARD_FILE = 'data/leaderboard-top20.json';

/**
 * Fetch leaderboard data from local JSON file
 * @returns {Promise<Array>} Array of trader objects or empty array on error
 */
export async function fetchLeaderboard() {
  try {
    console.log('Loading filtered leaderboard from:', LEADERBOARD_FILE);

    const response = await fetch(LEADERBOARD_FILE);

    if (!response.ok) {
      throw new Error(`Failed to load: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();

    if (!data || !data.traders) {
      throw new Error('Invalid file format - expected { traders: [...] }');
    }

    console.log(`Loaded ${data.traders.length} traders (active, $50K+ accounts)`);

    // Data is already filtered and sorted, just return it
    return data.traders;
  } catch (error) {
    console.error('Leaderboard fetch failed:', error);
    return [];
  }
}

// parseLeaderboardData function removed - data is now pre-filtered and pre-sorted
// The filter script (see README) handles:
// - Extracting all-time performance metrics
// - Calculating ROI from PnL / Account Value
// - Filtering for account value > $50K and active traders (volume > 0)
// - Sorting by ROI descending
// - Taking top 20

/**
 * Render leaderboard table in UI
 * @param {Array} traders - Array of parsed trader objects
 * @param {HTMLElement} tableBody - Table body element to populate
 * @param {Function} onRowClick - Callback for row click (receives trader address)
 * @param {Function} onHistoryClick - Callback for viewing trader history (receives trader address)
 */
export function renderLeaderboardTable(traders, tableBody, onRowClick, onHistoryClick) {
  if (!tableBody) {
    console.error('Leaderboard table body element not found');
    return;
  }

  if (traders.length === 0) {
    tableBody.innerHTML = `
            <tr>
                <td colspan="6" style="text-align:center; padding:30px; color:#666;">
                    No traders available. You can still enter a trader address manually below.
                </td>
            </tr>
        `;
    return;
  }

  const html = traders
    .map((trader, index) => {
      const roiClass = trader.roi >= 0 ? 'buy' : 'sell';
      const roiSign = trader.roi >= 0 ? '+' : '';
      const hyperliquidUrl = `https://app.hyperliquid.xyz/explorer/address/${trader.address}`;

      return `
            <tr data-address="${trader.address}" style="cursor:pointer;">
                <td>${index + 1}</td>
                <td title="${trader.address}">
                    ${truncateAddress(trader.address)}
                    <a href="${hyperliquidUrl}" target="_blank" rel="noopener noreferrer"
                       class="trader-link"
                       style="color:#00d4ff; text-decoration:none; margin-left:8px; font-size:0.9em;"
                       title="Verify on Hyperliquid">
                        ↗
                    </a>
                    ${trader.displayName ? `<br><small style="color:#888;">${trader.displayName}</small>` : ''}
                </td>
                <td>$${formatNumber(trader.accountValue, 2)}</td>
                <td class="${roiClass}">${roiSign}${formatNumber(trader.roi, 2)}%</td>
                <td class="${roiClass}">${roiSign}$${formatNumber(trader.pnl, 2)}</td>
            </tr>
        `;
    })
    .join('');

  tableBody.innerHTML = html;

  // Add click event listeners to rows
  tableBody.querySelectorAll('tr[data-address]').forEach((row) => {
    row.addEventListener('click', (e) => {
      // Check if clicked element is a link
      if (e.target.closest('.trader-link')) {
        return; // Let the link handle it
      }

      const address = row.dataset.address;

      // Remove 'selected' class from all rows
      tableBody.querySelectorAll('tr').forEach((r) => r.classList.remove('selected'));

      // Add 'selected' class to clicked row
      row.classList.add('selected');

      // Auto-fill trader address in form
      if (onRowClick) {
        onRowClick(address);
      }

      // Show order history in right panel
      if (onHistoryClick) {
        onHistoryClick(address);
      }
    });
  });
}

/**
 * Display error message in leaderboard section
 * @param {HTMLElement} errorElement - Error message container
 * @param {string} message - Error message to display
 */
export function showLeaderboardError(errorElement, message) {
  if (!errorElement) return;

  errorElement.textContent = message;
  errorElement.style.display = 'block';
}

/**
 * Hide leaderboard error message
 * @param {HTMLElement} errorElement - Error message container
 */
export function hideLeaderboardError(errorElement) {
  if (!errorElement) return;

  errorElement.textContent = '';
  errorElement.style.display = 'none';
}

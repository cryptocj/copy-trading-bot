/**
 * Leaderboard service for fetching and displaying top Hyperliquid traders
 * US1: Discover Traders via Leaderboard
 */

import { formatNumber, formatPercentage, truncateAddress } from '../utils/format.js';

const LEADERBOARD_API = 'https://stats-data.hyperliquid.xyz/Mainnet/leaderboard';

/**
 * Fetch leaderboard data from Hyperliquid stats API
 * @returns {Promise<Array>} Array of trader objects or empty array on error
 */
export async function fetchLeaderboard() {
    try {
        console.log('Fetching leaderboard from:', LEADERBOARD_API);

        const response = await fetch(LEADERBOARD_API);

        if (!response.ok) {
            throw new Error(`API returned ${response.status}: ${response.statusText}`);
        }

        const data = await response.json();

        if (!data || !data.leaderboardRows) {
            throw new Error('Invalid API response format');
        }

        console.log(`Fetched ${data.leaderboardRows.length} traders from leaderboard`);

        return parseLeaderboardData(data.leaderboardRows);
    } catch (error) {
        console.error('Leaderboard fetch failed:', error);
        return [];
    }
}

/**
 * Parse raw leaderboard data and extract weekly metrics
 * @param {Array} rows - Raw leaderboard rows from API
 * @returns {Array} Parsed and sorted trader objects
 */
export function parseLeaderboardData(rows) {
    const traders = rows.map(row => {
        // Extract weekly performance (windowPerformances is array of [period, metrics] tuples)
        const weeklyPerf = row.windowPerformances?.find(([period]) => period === 'week');

        if (!weeklyPerf || !weeklyPerf[1]) {
            return null; // Skip traders without weekly data
        }

        const metrics = weeklyPerf[1];

        return {
            address: row.ethAddress,
            accountValue: parseFloat(row.accountValue) || 0,
            weeklyPnL: parseFloat(metrics.pnl) || 0,
            weeklyROI: parseFloat(metrics.roi) || 0,
            weeklyVolume: parseFloat(metrics.vlm) || 0,
            displayName: row.displayName || null
        };
    }).filter(trader => trader !== null); // Remove null entries

    // Sort by weekly ROI descending
    traders.sort((a, b) => b.weeklyROI - a.weeklyROI);

    // Take top 20
    return traders.slice(0, 20);
}

/**
 * Render leaderboard table in UI
 * @param {Array} traders - Array of parsed trader objects
 * @param {HTMLElement} tableBody - Table body element to populate
 * @param {Function} onRowClick - Callback for row click (receives trader address)
 */
export function renderLeaderboardTable(traders, tableBody, onRowClick) {
    if (!tableBody) {
        console.error('Leaderboard table body element not found');
        return;
    }

    if (traders.length === 0) {
        tableBody.innerHTML = `
            <tr>
                <td colspan="5" style="text-align:center; padding:30px; color:#666;">
                    No traders available. You can still enter a trader address manually below.
                </td>
            </tr>
        `;
        return;
    }

    const html = traders.map((trader, index) => {
        const roiClass = trader.weeklyROI >= 0 ? 'buy' : 'sell';
        const roiSign = trader.weeklyROI >= 0 ? '+' : '';

        return `
            <tr data-address="${trader.address}" style="cursor:pointer;">
                <td>${index + 1}</td>
                <td title="${trader.address}">
                    ${truncateAddress(trader.address)}
                    ${trader.displayName ? `<br><small style="color:#888;">${trader.displayName}</small>` : ''}
                </td>
                <td>$${formatNumber(trader.accountValue, 2)}</td>
                <td class="${roiClass}">${roiSign}${formatPercentage(trader.weeklyROI, 2)}</td>
                <td class="${roiClass}">${roiSign}$${formatNumber(trader.weeklyPnL, 2)}</td>
            </tr>
        `;
    }).join('');

    tableBody.innerHTML = html;

    // Add click event listeners to rows
    tableBody.querySelectorAll('tr[data-address]').forEach(row => {
        row.addEventListener('click', () => {
            const address = row.dataset.address;

            // Remove 'selected' class from all rows
            tableBody.querySelectorAll('tr').forEach(r => r.classList.remove('selected'));

            // Add 'selected' class to clicked row
            row.classList.add('selected');

            // Call callback with trader address
            if (onRowClick) {
                onRowClick(address);
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

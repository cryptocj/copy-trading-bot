/**
 * Formatting utilities for display in UI
 */

/**
 * Format number with thousands separators and decimal places
 * @param {number} value - Number to format
 * @param {number} decimals - Decimal places (default: 2)
 * @returns {string} Formatted number
 */
export function formatNumber(value, decimals = 2) {
    if (value === null || value === undefined || isNaN(value)) {
        return '0.00';
    }
    return value.toLocaleString('en-US', {
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals
    });
}

/**
 * Format percentage (multiply by 100 and add % sign)
 * @param {number} decimal - Decimal percentage (e.g., 0.0752 = 7.52%)
 * @param {number} decimals - Decimal places (default: 2)
 * @returns {string} Formatted percentage
 */
export function formatPercentage(decimal, decimals = 2) {
    if (decimal === null || decimal === undefined || isNaN(decimal)) {
        return '0.00%';
    }
    const percentage = decimal * 100;
    return formatNumber(percentage, decimals) + '%';
}

/**
 * Format Unix timestamp to readable date/time
 * @param {number} timestamp - Unix timestamp in milliseconds
 * @returns {string} Formatted date/time (e.g., "2025-01-18 14:30:45")
 */
export function formatTimestamp(timestamp) {
    if (!timestamp || isNaN(timestamp)) {
        return 'Invalid date';
    }

    const date = new Date(timestamp);
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    const seconds = String(date.getSeconds()).padStart(2, '0');

    return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
}

/**
 * Format order side with color indicator (for US4 order display)
 * @param {string} side - "buy" or "sell"
 * @returns {string} HTML string with styled side
 */
export function formatOrderSide(side) {
    if (side === 'buy') {
        return '<span class="buy">BUY (+)</span>';
    } else if (side === 'sell') {
        return '<span class="sell">SELL (−)</span>';
    }
    return side;
}

/**
 * Format trading symbol for display
 * @param {string} symbol - Trading pair (e.g., "BTC/USDT")
 * @returns {string} Formatted symbol
 */
export function formatSymbol(symbol) {
    if (!symbol) return '';
    return symbol.toUpperCase();
}

/**
 * Truncate Ethereum address for display (show first 6 and last 4 chars)
 * @param {string} address - Full Ethereum address
 * @returns {string} Truncated address (e.g., "0x87f9...e2cf")
 */
export function truncateAddress(address) {
    if (!address || address.length < 10) return address;
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

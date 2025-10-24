/**
 * Formatting Utilities
 * Helper functions for consistent formatting across the application
 */

import { TIMESTAMP_FORMAT_OPTIONS } from '../config/moonlander-constants.js';

/**
 * Get formatted timestamp string
 * @returns {string} Timestamp in format [HH:MM:SS.mmm]
 */
export function getTimestamp() {
  return new Date().toLocaleTimeString('en-US', TIMESTAMP_FORMAT_OPTIONS);
}

/**
 * Format timestamp with brackets
 * @returns {string} Formatted timestamp [HH:MM:SS.mmm]
 */
export function getFormattedTimestamp() {
  return `[${getTimestamp()}]`;
}

/**
 * Clean symbol for Hyperliquid API
 * Converts "BTC/USD" -> "BTC", "500BTC/USD" -> "BTC"
 * @param {string} pairBase - Trading pair (e.g., "BTC/USD", "500BTC/USD")
 * @returns {string} Clean symbol (e.g., "BTC")
 */
export function cleanSymbolForHyperliquid(pairBase) {
  return pairBase.replace(/^[0-9]+/, '').replace('/USD', '');
}

/**
 * Clean Pyth price ID (remove 0x prefix)
 * @param {string} priceId - Pyth price ID with 0x prefix
 * @returns {string} Price ID without 0x prefix
 */
export function cleanPythPriceId(priceId) {
  return priceId.replace('0x', '');
}

/**
 * Format hex data with 0x prefix
 * @param {string} hexData - Hex data without 0x
 * @returns {string} Hex data with 0x prefix
 */
export function formatHexData(hexData) {
  return `0x${hexData}`;
}

// ============================================
// POSITION-FETCHER.JS - Shared Position Fetching Logic
// ============================================
// DRY principle: Single source of truth for position fetching and normalization

import { fetchTraderPositions } from '../hyperliquid-service.js';
import { fetchMoonlanderPositions } from '../moonlander-service.js';

/**
 * Fetch positions from appropriate platform
 * @param {string} address - Trader wallet address
 * @param {string} platform - Trading platform (hyperliquid | moonlander)
 * @returns {Promise<{positions: Array, accountData: Object|null}>} Normalized response
 */
export async function fetchPositionsByPlatform(address, platform) {
  let response = null;

  if (platform === 'hyperliquid') {
    response = await fetchTraderPositions(address);
  } else if (platform === 'moonlander') {
    response = await fetchMoonlanderPositions(address);
  } else {
    throw new Error(`Unknown platform: ${platform}`);
  }

  return normalizePositionResponse(response);
}

/**
 * Normalize API response to consistent format
 * Handles multiple response structures from different platforms
 * @param {*} response - Raw API response
 * @returns {{positions: Array, accountData: Object|null}} Normalized data
 */
function normalizePositionResponse(response) {
  let posArray = [];
  let accountData = null;

  if (!response || typeof response !== 'object') {
    return { positions: [], accountData: null };
  }

  // Handle {positions: [...], accountData: {...}} structure
  if (response.positions && Array.isArray(response.positions)) {
    posArray = response.positions;
    accountData = response.accountData || null;
  }
  // Handle array response
  else if (Array.isArray(response)) {
    posArray = response;
  }
  // Handle {items: [...]} structure
  else if (response.items && Array.isArray(response.items)) {
    posArray = response.items;
  }
  // Handle object with position values
  else {
    posArray = Object.values(response);
  }

  // Filter out invalid entries
  posArray = posArray.filter((pos) => pos && (pos.symbol || pos.coin));

  return { positions: posArray, accountData };
}

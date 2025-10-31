// ============================================
// MULTI-TRADER-MONITOR.JS - Concurrent Position Monitoring
// ============================================
// Handles automatic concurrent position updates for all watched traders

import {
  multiState,
  getActiveTraders,
  updateTraderPositions,
  addSyncInterval,
  removeSyncInterval,
  setMultiMonitoring,
  addActivityLog,
} from './multi-trader-state.js';
import { fetchPositionsByPlatform } from './utils/position-fetcher.js';
import { renderTraderGrid } from './ui-multi-trader.js';
import { MULTI_TRADER_SYNC_INTERVAL } from './config.js';

// Convert seconds to milliseconds
const UPDATE_INTERVAL_MS = MULTI_TRADER_SYNC_INTERVAL * 1000;

/**
 * Start monitoring all active traders concurrently
 * @param {number} interval - Update interval in milliseconds
 */
export function startMonitoring(interval = UPDATE_INTERVAL_MS) {
  // Check if already monitoring
  if (multiState.isMonitoring) {
    console.warn('Monitoring already active');
    return;
  }

  const activeTraders = getActiveTraders();

  if (activeTraders.length === 0) {
    console.warn('No active traders to monitor');
    addActivityLog('warning', 'No active traders to monitor');
    return;
  }

  console.log(`Starting concurrent monitoring for ${activeTraders.length} traders (${interval}ms interval)`);
  setMultiMonitoring(true);
  addActivityLog('success', `Started monitoring ${activeTraders.length} traders`);

  // Start concurrent monitoring for each trader
  activeTraders.forEach((trader) => {
    startTraderMonitoring(trader, interval);
  });

  // Update UI
  updateMonitoringUI(true);
}

/**
 * Stop monitoring all traders
 */
export function stopMonitoring() {
  if (!multiState.isMonitoring) {
    console.warn('Monitoring not active');
    return;
  }

  console.log('Stopping all monitoring...');
  setMultiMonitoring(false);

  // Clear all sync intervals
  multiState.syncIntervals.forEach((intervalId, address) => {
    clearInterval(intervalId);
    console.log(`Stopped monitoring for trader: ${address}`);
  });
  multiState.syncIntervals.clear();

  addActivityLog('info', 'Monitoring stopped');

  // Update UI
  updateMonitoringUI(false);
}

/**
 * Start monitoring a single trader
 * @param {Object} trader - Trader object
 * @param {number} interval - Update interval in milliseconds
 */
function startTraderMonitoring(trader, interval) {
  // Initial immediate fetch
  fetchAndUpdateTrader(trader);

  // Set up recurring updates
  const intervalId = setInterval(() => {
    fetchAndUpdateTrader(trader);
  }, interval);

  // Store interval ID for this trader
  addSyncInterval(trader.address, intervalId);

  console.log(`Started monitoring trader: ${trader.name} (${trader.address})`);
}

/**
 * Fetch and update positions for a single trader
 * @param {Object} trader - Trader object
 */
async function fetchAndUpdateTrader(trader) {
  try {
    console.log(`Fetching positions for ${trader.name}...`);

    // Fetch using shared utility (DRY principle)
    const { positions, accountData } = await fetchPositionsByPlatform(
      trader.address,
      trader.platform
    );

    // Update trader state
    updateTraderPositions(trader.address, positions);

    // Update account data if available
    if (accountData) {
      trader.accountData = accountData;
    }

    // Re-render UI
    renderTraderGrid();

    console.log(`✅ Updated ${trader.name}: ${positions.length} positions`);
  } catch (error) {
    console.error(`Failed to update ${trader.name}:`, error);
    addActivityLog('error', `Failed to update ${trader.name}: ${error.message}`);
  }
}

/**
 * Update monitoring UI status
 * @param {boolean} isMonitoring - Monitoring status
 */
function updateMonitoringUI(isMonitoring) {
  const statusElement = document.getElementById('monitoring-status');
  const startButton = document.getElementById('btn-start-monitoring');
  const stopButton = document.getElementById('btn-stop-monitoring');

  if (statusElement) {
    if (isMonitoring) {
      statusElement.innerHTML = `
        <span class="inline-block w-2 h-2 rounded-full bg-green-500 mr-1 animate-pulse"></span>
        Monitoring
      `;
      statusElement.className = 'text-xs text-green-400';
    } else {
      statusElement.innerHTML = `
        <span class="inline-block w-2 h-2 rounded-full bg-gray-500 mr-1"></span>
        Stopped
      `;
      statusElement.className = 'text-xs text-gray-500';
    }
  }

  if (startButton) {
    startButton.style.display = isMonitoring ? 'none' : 'inline-block';
  }

  if (stopButton) {
    stopButton.style.display = isMonitoring ? 'inline-block' : 'none';
  }
}

/**
 * Add monitoring for a newly added trader
 * @param {Object} trader - Trader object
 */
export function addTraderToMonitoring(trader) {
  if (multiState.isMonitoring && trader.isActive) {
    startTraderMonitoring(trader, UPDATE_INTERVAL_MS);
    console.log(`Added trader to active monitoring: ${trader.name}`);
  }
}

/**
 * Remove monitoring for a specific trader
 * @param {string} address - Trader wallet address
 */
export function removeTraderFromMonitoring(address) {
  removeSyncInterval(address);
  console.log(`Removed trader from monitoring: ${address}`);
}

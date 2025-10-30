// ============================================
// STATE.JS - Application State Management
// ============================================

import { MIN_COPY_BALANCE } from './config.js';

// Application state
export const state = {
    // Monitoring state
    isMonitoring: false,
    syncInterval: null,

    // Wallet instances
    cachedMoonlanderWallet: null,

    // Position data
    lastTraderPositions: [],
    userPositions: [],
    lastTradeTimestamp: null,

    // Cache
    moonlanderTradingPairsCache: null,

    // Statistics
    stats: {
        balance: MIN_COPY_BALANCE,
        syncs: 0,
        added: 0,
        removed: 0,
        errors: 0
    },

    // Activity log
    activityLog: []
};

// State update functions
export function updateStats() {
    // Update individual stat elements
    const statBalance = document.getElementById('stat-balance');
    const statSyncs = document.getElementById('stat-syncs');
    const statAdded = document.getElementById('stat-added');
    const statRemoved = document.getElementById('stat-removed');
    const statErrors = document.getElementById('stat-errors');

    if (statBalance) statBalance.textContent = `$${state.stats.balance.toFixed(2)}`;
    if (statSyncs) statSyncs.textContent = state.stats.syncs;
    if (statAdded) statAdded.textContent = state.stats.added;
    if (statRemoved) statRemoved.textContent = state.stats.removed;
    if (statErrors) statErrors.textContent = state.stats.errors;
}

export function resetMonitoringState() {
    state.isMonitoring = false;
    if (state.syncInterval) {
        clearInterval(state.syncInterval);
        state.syncInterval = null;
    }
}

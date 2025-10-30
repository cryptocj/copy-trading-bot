// ============================================
// STATE.JS - Application State Management
// ============================================

import { MIN_COPY_BALANCE, STORAGE_KEY_LAST_TRADER_POSITIONS } from './config.js';

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

// Load persisted state on initialization
export function loadPersistedState() {
    try {
        const savedPositions = localStorage.getItem(STORAGE_KEY_LAST_TRADER_POSITIONS);
        if (savedPositions) {
            state.lastTraderPositions = JSON.parse(savedPositions);
        }
    } catch (error) {
        console.error('Failed to load persisted state:', error);
        state.lastTraderPositions = [];
    }
}

// Save trader positions to localStorage
export function saveTraderPositions(positions) {
    try {
        state.lastTraderPositions = positions;
        localStorage.setItem(STORAGE_KEY_LAST_TRADER_POSITIONS, JSON.stringify(positions));
    } catch (error) {
        console.error('Failed to save trader positions:', error);
    }
}

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

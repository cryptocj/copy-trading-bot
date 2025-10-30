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
    const statsElement = document.getElementById('stats');
    if (statsElement) {
        statsElement.innerHTML = `
            <div class="stat-card">
                <div class="stat-label">Balance</div>
                <div class="stat-value">$${state.stats.balance.toFixed(2)}</div>
            </div>
            <div class="stat-card">
                <div class="stat-label">Syncs</div>
                <div class="stat-value">${state.stats.syncs}</div>
            </div>
            <div class="stat-card">
                <div class="stat-label">Added</div>
                <div class="stat-value">${state.stats.added}</div>
            </div>
            <div class="stat-card">
                <div class="stat-label">Removed</div>
                <div class="stat-value">${state.stats.removed}</div>
            </div>
            <div class="stat-card">
                <div class="stat-label">Errors</div>
                <div class="stat-value">${state.stats.errors}</div>
            </div>
        `;
    }
}

export function resetMonitoringState() {
    state.isMonitoring = false;
    if (state.syncInterval) {
        clearInterval(state.syncInterval);
        state.syncInterval = null;
    }
}

// ============================================
// UTILS.JS - Utility Functions
// ============================================

import { MAX_LOG_ENTRIES } from './config.js';
import { state } from './state.js';

// Symbol utilities for consistent symbol handling
export const SymbolUtils = {
    // Convert to Moonlander format: "BTC" -> "BTC/USD"
    toMoonlanderFormat(symbol) {
        if (symbol.includes('/')) return symbol;
        return `${symbol}/USD`;
    },

    // Normalize for comparison: "BTC/USD" -> "BTC"
    normalize(symbol) {
        return symbol.replace('/USD', '');
    }
};

// Extract balance information from account data
export function extractBalanceInfo(accountData, margin = 0) {
    if (!accountData?.marginSummary?.accountValue) {
        return { total: 0, free: 0, ratio: 0 };
    }
    const total = parseFloat(accountData.marginSummary.accountValue);
    const free = total - margin;
    const ratio = total > 0 ? (margin / total) * 100 : 0;
    return { total, free, ratio };
}

// Logging functions
export function log(level, message) {
    const timestamp = new Date().toLocaleTimeString();
    const logEntry = { timestamp, level, message };

    // Add to state
    state.activityLog.unshift(logEntry);
    if (state.activityLog.length > MAX_LOG_ENTRIES) {
        state.activityLog = state.activityLog.slice(0, MAX_LOG_ENTRIES);
    }

    // Console output
    const prefix = level === 'error' ? '❌' : level === 'warning' ? '⚠️' : level === 'success' ? '✅' : 'ℹ️';
    console.log(`[${timestamp}] ${prefix} ${message}`);
}

export function clearLog() {
    state.activityLog = [];
}

// Calculate acceptable price with slippage
export function calculateAcceptablePrice(currentPrice, isLong, slippagePercent = 10) {
    const slippageFactor = isLong ? (1 + slippagePercent / 100) : (1 - slippagePercent / 100);
    return currentPrice * slippageFactor;
}

// Format timestamp to readable string
export function formatTimestamp(timestamp) {
    if (!timestamp) return 'Unknown';
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;

    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours}h ago`;

    const diffDays = Math.floor(diffHours / 24);
    return `${diffDays}d ago`;
}

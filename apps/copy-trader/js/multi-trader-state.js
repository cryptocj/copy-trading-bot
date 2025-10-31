// ============================================
// MULTI-TRADER-STATE.JS - Multi-Trader State Management
// ============================================

import { MIN_COPY_BALANCE, MAX_TRADERS } from './config.js';

const STORAGE_KEY_MULTI_TRADERS = 'multi_trader_watched_traders';
const STORAGE_KEY_MULTI_CONFIG = 'multi_trader_config';
const STORAGE_KEY_MULTI_POSITIONS = 'multi_trader_positions';

// Multi-trader application state
export const multiState = {
  // Monitoring state
  isMonitoring: false,
  syncIntervals: new Map(), // Map<traderAddress, intervalId>

  // Watched traders
  watchedTraders: [], // Array of trader objects

  // Configuration
  config: {
    minPnl: 10,
    minWinRate: 60,
    maxTraders: MAX_TRADERS, // Maximum number of traders (from config.js)
    totalPortfolio: 0,
    allocationStrategy: 'equal', // equal | performance | sharpe | custom
    minPositionSize: 10,
    privateKey: null,
    platform: 'moonlander', // default platform
  },

  // Portfolio state
  portfolio: {
    positions: [], // Array of position objects with trader attribution
    totalValue: 0,
    totalMargin: 0,
    totalPnl: 0,
    availableBalance: 0,
  },

  // Wallet instances
  cachedWallet: null,

  // Statistics
  stats: {
    syncs: 0,
    opened: 0,
    closed: 0,
    errors: 0,
    totalPnl: 0,
    winRate: 0,
    activePositions: 0,
  },

  // Activity log
  activityLog: [],

  // Performance tracking
  performance: {
    dailyPnl: [],
    traderContributions: new Map(), // Map<traderAddress, contribution>
  },
};

/**
 * Trader object structure:
 * {
 *   address: string,
 *   platform: 'hyperliquid' | 'moonlander',
 *   name: string (optional),
 *   allocation: number (% of portfolio, 0-100),
 *   isActive: boolean,
 *   addedAt: timestamp,
 *   performance: {
 *     pnl: number,
 *     winRate: number,
 *     totalTrades: number,
 *     sharpeRatio: number,
 *   },
 *   positions: Array, // Current positions for this trader
 *   accountData: Object | null, // Account balance and margin data
 *   lastSync: timestamp,
 * }
 */

// ============================================
// State Persistence Functions
// ============================================

/**
 * Load persisted multi-trader state from localStorage
 */
export function loadMultiTraderState() {
  try {
    // Load watched traders
    const savedTraders = localStorage.getItem(STORAGE_KEY_MULTI_TRADERS);
    if (savedTraders) {
      multiState.watchedTraders = JSON.parse(savedTraders);
    }

    // Load configuration
    const savedConfig = localStorage.getItem(STORAGE_KEY_MULTI_CONFIG);
    if (savedConfig) {
      const config = JSON.parse(savedConfig);
      multiState.config = { ...multiState.config, ...config };
      // Don't persist private key - user must re-enter
      multiState.config.privateKey = null;
    }

    // Load positions
    const savedPositions = localStorage.getItem(STORAGE_KEY_MULTI_POSITIONS);
    if (savedPositions) {
      multiState.portfolio.positions = JSON.parse(savedPositions);
    }

    console.log('Multi-trader state loaded:', {
      traders: multiState.watchedTraders.length,
      positions: multiState.portfolio.positions.length,
    });
  } catch (error) {
    console.error('Failed to load multi-trader state:', error);
    // Reset to defaults on error
    multiState.watchedTraders = [];
    multiState.portfolio.positions = [];
  }
}

/**
 * Save watched traders to localStorage
 */
export function saveWatchedTraders() {
  try {
    localStorage.setItem(STORAGE_KEY_MULTI_TRADERS, JSON.stringify(multiState.watchedTraders));
  } catch (error) {
    console.error('Failed to save watched traders:', error);
  }
}

/**
 * Save configuration to localStorage (excluding private key)
 */
export function saveMultiConfig() {
  try {
    const configToSave = { ...multiState.config };
    delete configToSave.privateKey; // Never persist private key
    localStorage.setItem(STORAGE_KEY_MULTI_CONFIG, JSON.stringify(configToSave));
  } catch (error) {
    console.error('Failed to save multi-trader config:', error);
  }
}

/**
 * Save portfolio positions to localStorage
 */
export function savePortfolioPositions() {
  try {
    localStorage.setItem(STORAGE_KEY_MULTI_POSITIONS, JSON.stringify(multiState.portfolio.positions));
  } catch (error) {
    console.error('Failed to save portfolio positions:', error);
  }
}

// ============================================
// Trader Management Functions
// ============================================

/**
 * Add a trader to the watch list
 * @param {string} address - Trader wallet address
 * @param {string} platform - Trading platform (hyperliquid | moonlander)
 * @param {string} name - Optional trader name
 * @param {number} allocation - Optional custom allocation (0-100)
 * @returns {boolean} Success status
 */
export function addTrader(address, platform = 'moonlander', name = null, allocation = null) {
  // Check if trader already exists
  if (multiState.watchedTraders.some(t => t.address.toLowerCase() === address.toLowerCase())) {
    console.warn('Trader already exists:', address);
    return false;
  }

  // Check max traders limit
  if (multiState.watchedTraders.length >= multiState.config.maxTraders) {
    console.warn('Maximum traders limit reached:', multiState.config.maxTraders);
    return false;
  }

  const trader = {
    address: address.toLowerCase(),
    platform,
    name: name || `Trader ${address.substring(0, 8)}...`,
    allocation: allocation || 0, // Will be calculated based on strategy
    isActive: true,
    addedAt: Date.now(),
    performance: {
      pnl: 0,
      winRate: 0,
      totalTrades: 0,
      sharpeRatio: 0,
      roi: 0,
    },
    positions: [],
    accountData: null, // Will be populated when positions are fetched
    lastSync: null,
  };

  multiState.watchedTraders.push(trader);
  saveWatchedTraders();

  console.log('Trader added:', trader);
  return true;
}

/**
 * Remove a trader from the watch list
 * @param {string} address - Trader wallet address
 * @returns {boolean} Success status
 */
export function removeTrader(address) {
  const index = multiState.watchedTraders.findIndex(
    t => t.address.toLowerCase() === address.toLowerCase()
  );

  if (index === -1) {
    console.warn('Trader not found:', address);
    return false;
  }

  // Remove trader's positions from portfolio
  multiState.portfolio.positions = multiState.portfolio.positions.filter(
    p => p.traderAddress.toLowerCase() !== address.toLowerCase()
  );

  // Remove trader
  multiState.watchedTraders.splice(index, 1);

  saveWatchedTraders();
  savePortfolioPositions();

  console.log('Trader removed:', address);
  return true;
}

/**
 * Update trader performance data
 * @param {string} address - Trader wallet address
 * @param {Object} performance - Performance metrics
 */
export function updateTraderPerformance(address, performance) {
  const trader = multiState.watchedTraders.find(
    t => t.address.toLowerCase() === address.toLowerCase()
  );

  if (!trader) {
    console.warn('Trader not found for performance update:', address);
    return;
  }

  trader.performance = { ...trader.performance, ...performance };
  trader.lastSync = Date.now();

  saveWatchedTraders();
}

/**
 * Update trader positions
 * @param {string} address - Trader wallet address
 * @param {Array} positions - Array of position objects
 */
export function updateTraderPositions(address, positions) {
  const trader = multiState.watchedTraders.find(
    t => t.address.toLowerCase() === address.toLowerCase()
  );

  if (!trader) {
    console.warn('Trader not found for position update:', address);
    return;
  }

  trader.positions = positions;
  trader.lastSync = Date.now();

  saveWatchedTraders();
}

/**
 * Toggle trader active status
 * @param {string} address - Trader wallet address
 * @param {boolean} isActive - Active status
 */
export function toggleTraderActive(address, isActive) {
  const trader = multiState.watchedTraders.find(
    t => t.address.toLowerCase() === address.toLowerCase()
  );

  if (!trader) {
    console.warn('Trader not found:', address);
    return;
  }

  trader.isActive = isActive;
  saveWatchedTraders();
}

/**
 * Get active traders
 * @returns {Array} Array of active trader objects
 */
export function getActiveTraders() {
  return multiState.watchedTraders.filter(t => t.isActive);
}

/**
 * Get trader by address
 * @param {string} address - Trader wallet address
 * @returns {Object|null} Trader object or null
 */
export function getTrader(address) {
  return multiState.watchedTraders.find(
    t => t.address.toLowerCase() === address.toLowerCase()
  ) || null;
}

// ============================================
// Portfolio Management Functions
// ============================================

/**
 * Calculate and update allocations for all traders based on strategy
 */
export function calculateAllocations() {
  const activeTraders = getActiveTraders();

  if (activeTraders.length === 0) {
    return;
  }

  const strategy = multiState.config.allocationStrategy;

  switch (strategy) {
    case 'equal':
      // Equal allocation to all active traders
      const equalAllocation = 100 / activeTraders.length;
      activeTraders.forEach(trader => {
        trader.allocation = equalAllocation;
      });
      break;

    case 'performance':
      // Allocation based on historical PnL performance
      const totalPnl = activeTraders.reduce((sum, t) => sum + Math.max(0, t.performance.pnl), 0);
      if (totalPnl > 0) {
        activeTraders.forEach(trader => {
          trader.allocation = (Math.max(0, trader.performance.pnl) / totalPnl) * 100;
        });
      } else {
        // Fallback to equal if no positive PnL
        const fallbackAllocation = 100 / activeTraders.length;
        activeTraders.forEach(trader => {
          trader.allocation = fallbackAllocation;
        });
      }
      break;

    case 'sharpe':
      // Allocation based on Sharpe ratio (risk-adjusted returns)
      const totalSharpe = activeTraders.reduce((sum, t) => sum + Math.max(0, t.performance.sharpeRatio), 0);
      if (totalSharpe > 0) {
        activeTraders.forEach(trader => {
          trader.allocation = (Math.max(0, trader.performance.sharpeRatio) / totalSharpe) * 100;
        });
      } else {
        // Fallback to equal if no Sharpe ratios
        const fallbackAllocation = 100 / activeTraders.length;
        activeTraders.forEach(trader => {
          trader.allocation = fallbackAllocation;
        });
      }
      break;

    case 'custom':
      // Custom allocations already set by user - just normalize to 100%
      const totalCustom = activeTraders.reduce((sum, t) => sum + t.allocation, 0);
      if (totalCustom > 0) {
        activeTraders.forEach(trader => {
          trader.allocation = (trader.allocation / totalCustom) * 100;
        });
      }
      break;
  }

  saveWatchedTraders();
  console.log('Allocations calculated:', activeTraders.map(t => ({
    address: t.address,
    allocation: t.allocation.toFixed(2) + '%'
  })));
}

/**
 * Get capital allocated to a specific trader
 * @param {string} address - Trader wallet address
 * @returns {number} Allocated capital in USD
 */
export function getTraderAllocation(address) {
  const trader = getTrader(address);
  if (!trader) return 0;

  return (multiState.config.totalPortfolio * trader.allocation) / 100;
}

/**
 * Update portfolio statistics
 */
export function updatePortfolioStats() {
  const positions = multiState.portfolio.positions;

  multiState.portfolio.totalValue = positions.reduce((sum, p) => sum + (p.size * p.currentPrice), 0);
  multiState.portfolio.totalMargin = positions.reduce((sum, p) => sum + p.margin, 0);
  multiState.portfolio.totalPnl = positions.reduce((sum, p) => sum + p.pnl, 0);

  // Update global stats
  multiState.stats.activePositions = positions.length;
  multiState.stats.totalPnl = multiState.portfolio.totalPnl;

  // Calculate win rate from closed positions
  const closedPositions = positions.filter(p => p.closedAt);
  if (closedPositions.length > 0) {
    const winningPositions = closedPositions.filter(p => p.pnl > 0);
    multiState.stats.winRate = (winningPositions.length / closedPositions.length) * 100;
  }
}

// ============================================
// Activity Logging
// ============================================

/**
 * Add entry to activity log
 * @param {string} type - Log type (success | error | warning | info)
 * @param {string} message - Log message
 */
export function addActivityLog(type, message) {
  const entry = {
    type,
    message,
    timestamp: Date.now(),
  };

  multiState.activityLog.unshift(entry);

  // Keep only last 100 entries
  if (multiState.activityLog.length > 100) {
    multiState.activityLog = multiState.activityLog.slice(0, 100);
  }
}

/**
 * Clear activity log
 */
export function clearActivityLog() {
  multiState.activityLog = [];
}

// ============================================
// Monitoring State Management
// ============================================

/**
 * Reset monitoring state
 */
export function resetMultiMonitoringState() {
  multiState.isMonitoring = false;

  // Clear all sync intervals
  multiState.syncIntervals.forEach(intervalId => {
    clearInterval(intervalId);
  });
  multiState.syncIntervals.clear();
}

/**
 * Set monitoring state
 * @param {boolean} isMonitoring - Monitoring status
 */
export function setMultiMonitoring(isMonitoring) {
  multiState.isMonitoring = isMonitoring;
}

/**
 * Add sync interval for a trader
 * @param {string} address - Trader wallet address
 * @param {number} intervalId - Interval ID
 */
export function addSyncInterval(address, intervalId) {
  multiState.syncIntervals.set(address.toLowerCase(), intervalId);
}

/**
 * Remove sync interval for a trader
 * @param {string} address - Trader wallet address
 */
export function removeSyncInterval(address) {
  const intervalId = multiState.syncIntervals.get(address.toLowerCase());
  if (intervalId) {
    clearInterval(intervalId);
    multiState.syncIntervals.delete(address.toLowerCase());
  }
}

// ============================================
// Configuration Updates
// ============================================

/**
 * Update multi-trader configuration
 * @param {Object} updates - Configuration updates
 */
export function updateMultiConfig(updates) {
  multiState.config = { ...multiState.config, ...updates };
  saveMultiConfig();
}

/**
 * Update statistics
 * @param {Object} updates - Statistics updates
 */
export function updateMultiStats(updates) {
  multiState.stats = { ...multiState.stats, ...updates };
}

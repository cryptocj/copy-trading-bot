/**
 * Session Persistence Service
 * Handles browser localStorage persistence for copy trading sessions
 * Prevents session loss on browser refresh/reload
 */

// Session state version for schema migration
const SESSION_STATE_VERSION = 1;

// localStorage keys for session persistence (T002)
export const SESSION_STORAGE_KEYS = {
  // Core session state
  SESSION_STATE: 'copyTrading.session.state',
  SESSION_VERSION: 'copyTrading.session.version',

  // Session metadata
  SESSION_START_TIME: 'copyTrading.session.startTime',
  SESSION_ACTIVE: 'copyTrading.session.active',
  SESSION_TRADE_COUNTER: 'copyTrading.session.tradeCounter',

  // Configuration persistence
  SESSION_CONFIG: 'copyTrading.session.config',
  SESSION_MONITORED_WALLET: 'copyTrading.session.monitoredWallet',

  // Multi-tab coordination
  SESSION_TAB_ID: 'copyTrading.session.tabId',
  SESSION_LAST_UPDATE: 'copyTrading.session.lastUpdate',
};

/**
 * Session State Schema (T003)
 * Represents the complete state of a copy trading session
 *
 * @typedef {Object} SessionState
 * @property {number} version - Schema version for migration
 * @property {boolean} isActive - Whether copy trading is currently active
 * @property {number} startTime - Session start timestamp (ms since epoch)
 * @property {number} tradeCounter - Number of trades executed in this session
 * @property {Object} config - Copy trading configuration
 * @property {string} config.traderAddress - Monitored wallet address
 * @property {string} config.executionPlatform - Execution platform ('hyperliquid' or 'moonlander')
 * @property {string} config.hyperliquidApiKey - Hyperliquid API key (for Hyperliquid execution)
 * @property {string} config.monitoringApiKey - Monitoring API key (for Moonlander execution)
 * @property {number} config.copyBalance - Total balance for copying in USD
 * @property {string} monitoredWallet - Current monitored wallet address
 * @property {number} lastUpdate - Last update timestamp
 * @property {string} tabId - Unique tab identifier for multi-tab coordination
 * @property {number} scalingFactor - Position scaling factor (0.0-1.0)
 * @property {boolean} initialPositionsOpened - Flag indicating if initial positions were already opened
 */

/**
 * Create empty session state with default values
 * @returns {SessionState}
 */
export function createEmptySessionState() {
  return {
    version: SESSION_STATE_VERSION,
    isActive: false,
    startTime: null,
    tradeCounter: 0,
    config: {
      traderAddress: '',
      executionPlatform: 'hyperliquid',
      hyperliquidApiKey: '',
      monitoringApiKey: '',
      copyBalance: 0,
    },
    monitoredWallet: '',
    lastUpdate: Date.now(),
    tabId: generateTabId(),
    scalingFactor: 1.0,
    initialPositionsOpened: false,
  };
}

/**
 * Generate unique tab identifier
 * @returns {string}
 */
function generateTabId() {
  return `tab_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}

/**
 * Validate session state schema
 * @param {any} state - State to validate
 * @returns {boolean}
 */
export function isValidSessionState(state) {
  if (!state || typeof state !== 'object') {
    return false;
  }

  // Check required fields
  const requiredFields = ['version', 'isActive', 'config'];
  for (const field of requiredFields) {
    if (!(field in state)) {
      return false;
    }
  }

  // Check config structure
  if (!state.config || typeof state.config !== 'object') {
    return false;
  }

  // Check for required config fields (support both old and new structure)
  const hasTraderAddress = 'traderAddress' in state.config;
  const hasCopyBalance = 'copyBalance' in state.config;

  // Support both old userApiKey and new platform-specific keys
  const hasApiKey = 'userApiKey' in state.config ||
                    'hyperliquidApiKey' in state.config ||
                    'monitoringApiKey' in state.config;

  return hasTraderAddress && hasCopyBalance && hasApiKey;
}

/**
 * Migrate session state to current version
 * @param {SessionState} state - State to migrate
 * @returns {SessionState}
 */
export function migrateSessionState(state) {
  // Migrate old userApiKey to new platform-specific keys
  if (state.config && state.config.userApiKey && !state.config.hyperliquidApiKey) {
    console.log('Migrating old userApiKey to hyperliquidApiKey');
    state.config.hyperliquidApiKey = state.config.userApiKey;
    state.config.executionPlatform = 'hyperliquid';
    delete state.config.userApiKey;
  }

  // Currently only version 1 exists
  if (state.version === SESSION_STATE_VERSION) {
    return state;
  }

  // Future migrations would go here
  // Example:
  // if (state.version === 1) {
  //   state = migrateV1ToV2(state);
  // }

  console.warn('Unknown session state version:', state.version);
  return state;
}

/**
 * Save session state to localStorage (T004 - implemented in Phase 2)
 * @param {SessionState} state - State to save
 * @param {string} monitoredWallet - Monitored wallet address (for wallet-based storage)
 * @throws {Error} If localStorage is unavailable or quota exceeded
 */
export function saveSessionState(state, monitoredWallet) {
  try {
    // Validate state before saving
    if (!isValidSessionState(state)) {
      throw new Error('Invalid session state structure');
    }

    // Update timestamp
    state.lastUpdate = Date.now();

    // Use wallet-specific storage keys for multi-tab support
    const sessionKey = `${SESSION_STORAGE_KEYS.SESSION_STATE}.${monitoredWallet}`;
    const versionKey = `${SESSION_STORAGE_KEYS.SESSION_VERSION}.${monitoredWallet}`;
    const activeKey = `${SESSION_STORAGE_KEYS.SESSION_ACTIVE}.${monitoredWallet}`;
    const startTimeKey = `${SESSION_STORAGE_KEYS.SESSION_START_TIME}.${monitoredWallet}`;
    const tradeCounterKey = `${SESSION_STORAGE_KEYS.SESSION_TRADE_COUNTER}.${monitoredWallet}`;
    const lastUpdateKey = `${SESSION_STORAGE_KEYS.SESSION_LAST_UPDATE}.${monitoredWallet}`;

    // Save complete state as JSON
    localStorage.setItem(sessionKey, JSON.stringify(state));
    localStorage.setItem(versionKey, SESSION_STATE_VERSION.toString());

    // Save individual components for quick access
    localStorage.setItem(activeKey, state.isActive.toString());
    if (state.startTime) {
      localStorage.setItem(startTimeKey, state.startTime.toString());
    }
    localStorage.setItem(tradeCounterKey, state.tradeCounter.toString());
    localStorage.setItem(lastUpdateKey, state.lastUpdate.toString());

    console.log(`Session state saved for wallet: ${monitoredWallet}`);
  } catch (error) {
    if (error.name === 'QuotaExceededError') {
      throw new Error('localStorage quota exceeded - session state too large');
    }
    throw new Error(`Failed to save session state: ${error.message}`);
  }
}

/**
 * Load session state from localStorage (T005 - implemented in Phase 2)
 * @param {string} monitoredWallet - Monitored wallet address (for wallet-based storage)
 * @returns {SessionState|null} Loaded state or null if not found/invalid
 */
export function loadSessionState(monitoredWallet) {
  try {
    // Check if localStorage is available
    if (typeof localStorage === 'undefined') {
      console.warn('localStorage not available');
      return null;
    }

    // Use wallet-specific storage key
    const sessionKey = `${SESSION_STORAGE_KEYS.SESSION_STATE}.${monitoredWallet}`;

    // Load complete state
    const stateJson = localStorage.getItem(sessionKey);
    if (!stateJson) {
      console.log(`No saved session state found for wallet: ${monitoredWallet}`);
      return null;
    }

    // Parse and validate
    let state = JSON.parse(stateJson);

    // Always run migration to handle old userApiKey structure
    state = migrateSessionState(state);

    if (!isValidSessionState(state)) {
      console.warn('Saved session state is invalid, clearing');
      clearSessionState(monitoredWallet);
      return null;
    }

    // Save migrated state if migration occurred
    if (state.config && (state.config.hyperliquidApiKey || state.config.monitoringApiKey)) {
      saveSessionState(state, monitoredWallet);
    }

    console.log(`Session state loaded for wallet: ${monitoredWallet}`);
    return state;
  } catch (error) {
    console.error('Failed to load session state:', error);
    // Clear corrupted state
    clearSessionState(monitoredWallet);
    return null;
  }
}

/**
 * Clear session state from localStorage (T006 - implemented in Phase 2)
 * @param {string} monitoredWallet - Monitored wallet address (for wallet-based storage)
 */
export function clearSessionState(monitoredWallet) {
  try {
    // Remove wallet-specific session keys
    const sessionKey = `${SESSION_STORAGE_KEYS.SESSION_STATE}.${monitoredWallet}`;
    const versionKey = `${SESSION_STORAGE_KEYS.SESSION_VERSION}.${monitoredWallet}`;
    const activeKey = `${SESSION_STORAGE_KEYS.SESSION_ACTIVE}.${monitoredWallet}`;
    const startTimeKey = `${SESSION_STORAGE_KEYS.SESSION_START_TIME}.${monitoredWallet}`;
    const tradeCounterKey = `${SESSION_STORAGE_KEYS.SESSION_TRADE_COUNTER}.${monitoredWallet}`;
    const lastUpdateKey = `${SESSION_STORAGE_KEYS.SESSION_LAST_UPDATE}.${monitoredWallet}`;

    localStorage.removeItem(sessionKey);
    localStorage.removeItem(versionKey);
    localStorage.removeItem(activeKey);
    localStorage.removeItem(startTimeKey);
    localStorage.removeItem(tradeCounterKey);
    localStorage.removeItem(lastUpdateKey);

    console.log(`Session state cleared for wallet: ${monitoredWallet}`);
  } catch (error) {
    console.error('Failed to clear session state:', error);
  }
}

/**
 * Check if session state exists and is valid
 * @returns {boolean}
 */
export function hasValidSession() {
  const state = loadSessionState();
  return state !== null && state.isActive === true;
}

/**
 * Get session duration in milliseconds
 * @param {SessionState} state
 * @returns {number}
 */
export function getSessionDuration(state) {
  if (!state || !state.startTime) {
    return 0;
  }
  return Date.now() - state.startTime;
}

/**
 * Update session config fields (for updating settings during active session)
 * @param {string} monitoredWallet - Monitored wallet address
 * @param {Object} configUpdates - Config fields to update
 * @returns {boolean} Success
 */
export function updateSessionConfig(monitoredWallet, configUpdates) {
  try {
    const sessionState = loadSessionState(monitoredWallet);
    if (!sessionState || !sessionState.isActive) {
      console.warn('No active session to update');
      return false;
    }

    // Update config fields
    Object.assign(sessionState.config, configUpdates);

    // Save updated session state
    saveSessionState(sessionState, monitoredWallet);
    console.log('[SessionPersistence] Config updated:', configUpdates);
    return true;
  } catch (error) {
    console.error('[SessionPersistence] Failed to update session config:', error);
    return false;
  }
}

/**
 * Multi-tab conflict detection (T009 - implemented in Phase 2)
 * Detects if another tab has an active session
 * @returns {boolean} True if conflict detected
 */
export function detectMultiTabConflict() {
  const currentTabId = sessionStorage.getItem('tabId');
  const savedTabId = localStorage.getItem(SESSION_STORAGE_KEYS.SESSION_TAB_ID);

  // No conflict if no saved tab ID or it's the same tab
  if (!savedTabId || savedTabId === currentTabId) {
    return false;
  }

  // Check if the other tab is still active (updated recently)
  const lastUpdate = localStorage.getItem(SESSION_STORAGE_KEYS.SESSION_LAST_UPDATE);
  if (!lastUpdate) {
    return false;
  }

  // Consider tab active if updated within last 10 seconds
  const timeSinceUpdate = Date.now() - parseInt(lastUpdate);
  return timeSinceUpdate < 10000;
}

/**
 * Claim session for current tab
 * Updates tab ID and timestamp to prevent conflicts
 */
export function claimSessionForCurrentTab() {
  const tabId = sessionStorage.getItem('tabId') || generateTabId();
  sessionStorage.setItem('tabId', tabId);
  localStorage.setItem(SESSION_STORAGE_KEYS.SESSION_TAB_ID, tabId);
  localStorage.setItem(SESSION_STORAGE_KEYS.SESSION_LAST_UPDATE, Date.now().toString());
}

/**
 * Initialize tab ID for this session
 * Should be called on page load
 */
export function initializeTabId() {
  if (!sessionStorage.getItem('tabId')) {
    const tabId = generateTabId();
    sessionStorage.setItem('tabId', tabId);
    console.log('Tab ID initialized:', tabId);
  }
}

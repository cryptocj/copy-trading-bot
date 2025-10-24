/**
 * Monitoring Status Service
 * Provides visual feedback for WebSocket monitoring status
 */

let elements = null;
let heartbeatInterval = null;
let lastActivityTime = null;

/**
 * Initialize monitoring status UI
 * @param {object} domElements - DOM elements from elements.js
 */
export function initMonitoringStatus(domElements) {
  elements = domElements;
}

/**
 * Show monitoring status indicator
 * @param {number} [initialTradeCount] - Initial trade count (for session restoration)
 */
export function showMonitoringStatus(initialTradeCount = 0) {
  if (!elements) return;

  elements.monitoringStatus.classList.remove('hidden');
  elements.monitoringStatus.classList.add('flex');

  // Start as active
  setStatusActive();

  // Show initial trade count if provided (session restoration)
  if (initialTradeCount > 0) {
    elements.statusDetails.textContent = `${initialTradeCount} trade${initialTradeCount !== 1 ? 's' : ''} detected`;
  } else {
    elements.statusDetails.textContent = 'Waiting for trades...';
  }

  // Start heartbeat monitor
  startHeartbeat();
}

/**
 * Hide monitoring status indicator
 */
export function hideMonitoringStatus() {
  if (!elements) return;

  elements.monitoringStatus.classList.add('hidden');
  elements.monitoringStatus.classList.remove('flex');

  // Stop heartbeat monitor
  stopHeartbeat();
}

/**
 * Update status to active (monitoring running)
 */
export function setStatusActive() {
  if (!elements) return;

  elements.statusIndicator.className = 'w-2 h-2 rounded-full bg-green-500 active';
  elements.statusText.textContent = 'Monitoring';
  elements.statusText.className = 'text-xs font-medium text-green-400';
  updateLastActivity();
}

/**
 * Update status to reconnecting
 */
export function setStatusReconnecting() {
  if (!elements) return;

  elements.statusIndicator.className = 'w-2 h-2 rounded-full reconnecting';
  elements.statusText.textContent = 'Reconnecting';
  elements.statusText.className = 'text-xs font-medium text-orange-400';
  elements.statusDetails.textContent = 'Retrying connection...';
}

/**
 * Update status to error
 */
export function setStatusError(message = 'Connection lost') {
  if (!elements) return;

  elements.statusIndicator.className = 'w-2 h-2 rounded-full error';
  elements.statusText.textContent = 'Error';
  elements.statusText.className = 'text-xs font-medium text-red-400';
  elements.statusDetails.textContent = message;
}

/**
 * Update last activity timestamp
 */
export function updateLastActivity() {
  lastActivityTime = Date.now();
  updateStatusDetails();
}

/**
 * Record trade detected
 * @param {number} tradeCount - Total trades detected
 */
export function recordTradeDetected(tradeCount) {
  if (!elements) return;

  updateLastActivity();
  elements.statusDetails.textContent = `${tradeCount} trade${tradeCount !== 1 ? 's' : ''} detected`;

  // Flash the indicator
  elements.statusIndicator.style.transform = 'scale(1.3)';
  setTimeout(() => {
    elements.statusIndicator.style.transform = 'scale(1)';
  }, 200);
}

/**
 * Show progress for long-running operations
 * @param {string} operation - Operation name (e.g., "Opening positions", "Closing positions")
 * @param {number} current - Current progress count
 * @param {number} total - Total items to process
 */
export function showProgress(operation, current, total) {
  if (!elements) return;

  const percentage = Math.round((current / total) * 100);

  elements.monitoringStatus.classList.remove('hidden');
  elements.monitoringStatus.classList.add('flex');

  elements.statusText.textContent = operation;
  elements.statusDetails.textContent = `${current}/${total} (${percentage}%)`;

  // Show orange indicator for in-progress
  elements.statusIndicator.className = 'w-2 h-2 rounded-full bg-orange-500 animate-pulse';
}

/**
 * Hide progress indicator and restore normal status
 */
export function hideProgress() {
  if (!elements) return;

  // Restore green indicator
  elements.statusIndicator.className = 'w-2 h-2 rounded-full bg-green-500';
}

/**
 * Update status details with time since last activity
 */
function updateStatusDetails() {
  if (!elements || !lastActivityTime) {
    if (elements) {
      elements.statusDetails.textContent = 'Waiting for trades...';
    }
    return;
  }

  const secondsAgo = Math.floor((Date.now() - lastActivityTime) / 1000);

  if (secondsAgo < 60) {
    elements.statusDetails.textContent = 'Active now';
  } else if (secondsAgo < 3600) {
    const minutes = Math.floor(secondsAgo / 60);
    elements.statusDetails.textContent = `Active ${minutes}m ago`;
  } else {
    const hours = Math.floor(secondsAgo / 3600);
    elements.statusDetails.textContent = `Active ${hours}h ago`;
  }
}

/**
 * Start heartbeat monitor (updates every 10 seconds)
 */
function startHeartbeat() {
  stopHeartbeat(); // Clear any existing interval

  lastActivityTime = Date.now();
  updateStatusDetails();

  heartbeatInterval = setInterval(() => {
    updateStatusDetails();

    // If no activity for 5 minutes, show warning
    const minutesInactive = (Date.now() - lastActivityTime) / 60000;
    if (minutesInactive > 5) {
      elements.statusText.textContent = 'Monitoring (idle)';
      elements.statusText.className = 'text-xs font-medium text-gray-400';
    }
  }, 10000); // Update every 10 seconds
}

/**
 * Stop heartbeat monitor
 */
function stopHeartbeat() {
  if (heartbeatInterval) {
    clearInterval(heartbeatInterval);
    heartbeatInterval = null;
  }
  lastActivityTime = null;
}

/**
 * Update status with WebSocket connection info
 * @param {string} state - Connection state: 'connected', 'reconnecting', 'disconnected'
 */
export function updateConnectionState(state) {
  switch (state) {
    case 'connected':
      setStatusActive();
      break;
    case 'reconnecting':
      setStatusReconnecting();
      break;
    case 'disconnected':
      setStatusError('Disconnected');
      break;
    default:
      console.warn('Unknown connection state:', state);
  }
}

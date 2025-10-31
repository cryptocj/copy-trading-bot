// ============================================
// UI-MULTI-TRADER.JS - Multi-Trader UI Components
// ============================================
// Compact form + grid-based trader card display

import {
  multiState,
  addTrader,
  removeTrader,
  calculateAllocations,
  addActivityLog,
  updateTraderPositions,
} from './multi-trader-state.js';
import { createPositionDisplay } from './components/position-display.js';
import {
  addTraderToMonitoring,
  removeTraderFromMonitoring,
} from './multi-trader-monitor.js';
import { fetchPositionsByPlatform } from './utils/position-fetcher.js';

/**
 * Initialize compact add trader form
 */
export function initAddTraderCompact() {
  const btnAdd = document.getElementById('btn-add-trader');
  const formInline = document.getElementById('add-trader-inline');
  const btnCancel = formInline?.querySelector('.btn-cancel-small');
  const btnSubmit = formInline?.querySelector('.btn-primary-small');

  // Show form on "+ Add" click
  btnAdd?.addEventListener('click', () => {
    formInline.style.display = 'flex';
    document.getElementById('trader-address-quick')?.focus();
  });

  // Hide form on Cancel
  btnCancel?.addEventListener('click', () => {
    formInline.style.display = 'none';
    clearQuickForm();
  });

  // Submit form on Add Trader click
  btnSubmit?.addEventListener('click', () => {
    handleQuickAddTrader();
  });

  // Submit on Enter key
  document.getElementById('trader-address-quick')?.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleQuickAddTrader();
    }
  });
}

/**
 * Handle quick add trader
 */
async function handleQuickAddTrader() {
  const name = document.getElementById('trader-name-quick')?.value.trim();
  const address = document.getElementById('trader-address-quick')?.value.trim();
  const platform = document.getElementById('trader-platform-quick')?.value;

  // Validate address format using ethers.js
  if (!ethers.isAddress(address)) {
    showNotification('error', 'Invalid Ethereum address format');
    return;
  }

  // Validate name
  if (!name || name.length === 0) {
    showNotification('error', 'Please enter a trader name');
    return;
  }

  // Add trader with user-provided name
  const success = addTrader(address, platform, name);

  if (!success) {
    // Error handling (duplicate, max limit)
    if (multiState.watchedTraders.some((t) => t.address.toLowerCase() === address.toLowerCase())) {
      showNotification('error', 'Trader already added');
    } else if (multiState.watchedTraders.length >= multiState.config.maxTraders) {
      showNotification('error', `Maximum ${multiState.config.maxTraders} traders allowed`);
    } else {
      showNotification('error', 'Failed to add trader');
    }
    return;
  }

  // Success - show notification
  showNotification('success', `Trader "${name}" added`);
  addActivityLog('success', `Trader added: ${name} (${address})`);

  // Hide form and refresh
  document.getElementById('add-trader-inline').style.display = 'none';
  clearQuickForm();
  renderTraderGrid();

  // Fetch positions for the newly added trader
  fetchTraderPositionsAsync(address, platform, name);

  // Add to monitoring if monitoring is active
  const trader = multiState.watchedTraders.find(
    (t) => t.address.toLowerCase() === address.toLowerCase()
  );
  if (trader) {
    addTraderToMonitoring(trader);
  }
}

/**
 * Fetch positions for newly added trader
 */
async function fetchTraderPositionsAsync(address, platform, name) {
  try {
    showNotification('info', `Fetching positions for ${name}...`);
    addActivityLog('info', `Fetching positions for ${name}...`);

    // Fetch using shared utility (DRY principle)
    const { positions, accountData } = await fetchPositionsByPlatform(address, platform);

    // Update trader positions in state
    updateTraderPositions(address, positions);

    // Store account data for balance calculations
    const trader = multiState.watchedTraders.find(
      (t) => t.address.toLowerCase() === address.toLowerCase()
    );
    if (trader && accountData) {
      trader.accountData = accountData;
    }

    // Re-render grid to show positions
    renderTraderGrid();

    showNotification('success', `Loaded ${positions.length} position(s) for ${name}`);
    addActivityLog('success', `Loaded ${positions.length} position(s) for ${name}`);
  } catch (error) {
    console.error('Failed to fetch positions:', error);
    showNotification('error', `Failed to fetch positions: ${error.message}`);
    addActivityLog('error', `Failed to fetch positions for ${name}: ${error.message}`);
  }
}

/**
 * Clear quick form inputs
 */
function clearQuickForm() {
  const nameInput = document.getElementById('trader-name-quick');
  const addressInput = document.getElementById('trader-address-quick');
  const platformSelect = document.getElementById('trader-platform-quick');
  if (nameInput) nameInput.value = '';
  if (addressInput) addressInput.value = '';
  if (platformSelect) platformSelect.value = 'moonlander';
}

/**
 * Render positions list for a trader
 * @param {Array} positions - Positions array
 * @param {Object} accountData - Account data for balance calculations
 */
function renderTraderPositions(positions, accountData = null) {
  // Handle different data structures
  if (!positions) {
    return '';
  }

  // Ensure positions is an array
  let posArray = [];
  if (Array.isArray(positions)) {
    posArray = positions;
  } else if (positions.items && Array.isArray(positions.items)) {
    // Handle {items: [...]} structure
    posArray = positions.items;
  } else if (typeof positions === 'object') {
    // Handle object with numeric keys or other structures
    posArray = Object.values(positions);
  }

  // Filter out any invalid entries
  posArray = posArray.filter((pos) => pos && (pos.symbol || pos.coin));

  if (posArray.length === 0) {
    return '';
  }

  // Use the reusable position display component in compact mode
  const { balanceHtml, tableHtml } = createPositionDisplay({
    positions: posArray,
    accountData: accountData, // Pass account data for margin % calculations
    mode: 'compact',
    showBalanceInfo: Boolean(accountData), // Show balance if we have accountData
  });

  return `
    <div class="positions-list">
      ${balanceHtml ? `<div class="positions-balance">${balanceHtml}</div>` : ''}
      ${tableHtml}
    </div>
  `;
}

/**
 * Render trader grid (replaces renderTraderList)
 */
export function renderTraderGrid() {
  const container = document.getElementById('trader-grid');
  const emptyState = document.getElementById('empty-state');

  if (!container) return;

  // Get traders from state
  const traders = multiState.watchedTraders;

  // Update trader count
  const countElement = document.getElementById('trader-count');
  if (countElement) {
    countElement.textContent = `${traders.length} trader${traders.length !== 1 ? 's' : ''}`;
  }

  if (traders.length === 0) {
    container.innerHTML = '';
    if (emptyState) {
      emptyState.style.display = 'block';
    }
    return;
  }

  if (emptyState) {
    emptyState.style.display = 'none';
  }

  // Render trader cards in grid
  container.innerHTML = traders
    .map(
      (trader) => `
    <div class="trader-card ${trader.isActive ? '' : 'paused'}" data-address="${trader.address}">
      <!-- Card Header -->
      <div class="card-header">
        <div class="card-header-left">
          <div class="trader-name-row">
            <span class="badge badge-${trader.platform}">${trader.platform}</span>
            <span class="trader-name" title="${trader.name}">${trader.name}</span>
            <span class="trader-address" title="${trader.address}">
              ${shortenAddress(trader.address)}
              <button
                class="btn-icon-small"
                onclick="window.copyToClipboard('${trader.address}')"
                title="Copy address"
              >
                📋
              </button>
            </span>
          </div>
        </div>
        <div class="card-header-actions">
          <button
            class="btn-header-action btn-edit"
            onclick="window.handleEditTrader('${trader.address}')"
            title="Edit trader"
          >
            ✏️
          </button>
          <button
            class="btn-header-action btn-remove"
            onclick="window.handleRemoveTrader('${trader.address}')"
            title="Remove trader"
          >
            🗑️
          </button>
        </div>
      </div>

      <!-- Card Body -->
      <div class="card-body">
        ${renderTraderPositions(trader.positions || [], trader.accountData || null)}
      </div>
    </div>
  `
    )
    .join('');
}

/**
 * Handle edit trader
 */
window.handleEditTrader = function (address) {
  const trader = multiState.watchedTraders.find(
    (t) => t.address.toLowerCase() === address.toLowerCase()
  );

  if (!trader) return;

  // Simple edit: prompt for new name
  const newName = prompt('Edit trader name:', trader.name);

  if (newName && newName.trim() !== '') {
    trader.name = newName.trim();
    addActivityLog('info', `Trader renamed: ${trader.name}`);
    renderTraderGrid();
    showNotification('success', 'Trader updated');
  }
};

/**
 * Handle remove trader
 */
window.handleRemoveTrader = function (address) {
  // Confirmation dialog
  const trader = multiState.watchedTraders.find(
    (t) => t.address.toLowerCase() === address.toLowerCase()
  );

  if (!trader) return;

  const confirmMessage = `Remove trader "${trader.name}"? This will close all their positions.`;

  if (!confirm(confirmMessage)) {
    return;
  }

  // Remove trader using existing function
  const success = removeTrader(address);

  if (!success) {
    showNotification('error', 'Failed to remove trader');
    return;
  }

  // Remove from monitoring if monitoring is active
  removeTraderFromMonitoring(address);

  calculateAllocations(); // Recalculate without removed trader
  addActivityLog('warning', `Trader removed: ${trader.name}`);
  renderTraderGrid();
  showNotification('success', 'Trader removed');
};

/**
 * Copy address to clipboard
 */
window.copyToClipboard = function (text) {
  navigator.clipboard
    .writeText(text)
    .then(() => {
      showNotification('success', 'Address copied to clipboard');
    })
    .catch((err) => {
      console.error('Failed to copy:', err);
      showNotification('error', 'Failed to copy address');
    });
};

/**
 * Shorten Ethereum address for display
 */
function shortenAddress(address) {
  return `${address.substring(0, 6)}...${address.substring(address.length - 4)}`;
}

/**
 * Display toast notification
 */
function showNotification(type, message) {
  const notification = document.createElement('div');
  notification.className = `notification notification-${type}`;
  notification.textContent = message;

  document.body.appendChild(notification);

  setTimeout(() => {
    notification.remove();
  }, 3000);
}

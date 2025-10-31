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
  saveWatchedTraders,
} from './multi-trader-state.js';
import { createPositionDisplay } from './components/position-display.js';
import { addTraderToMonitoring, removeTraderFromMonitoring } from './multi-trader-monitor.js';
import { fetchPositionsByPlatform } from './utils/position-fetcher.js';

// Constants
const PLATFORMS = {
  MOONLANDER: 'moonlander',
  HYPERLIQUID: 'hyperliquid',
};

const NOTIFICATION_TYPES = {
  ERROR: 'error',
  SUCCESS: 'success',
  INFO: 'info',
  WARNING: 'warning',
};

const FORM_ELEMENTS = {
  FORM: 'add-trader-inline',
  NAME_INPUT: 'trader-name-quick',
  ADDRESS_INPUT: 'trader-address-quick',
  PLATFORM_SELECT: 'trader-platform-quick',
};

const BUTTON_TEXT = {
  ADD: 'Add Trader',
  UPDATE: 'Update Trader',
};

const NOTIFICATION_TIMEOUT_MS = 3000;

// Track edit mode
let editingTraderAddress = null;

// ============================================
// Validation Functions
// ============================================

/**
 * Validate trader form inputs
 * @returns {Object} { isValid, name, address, platform, error }
 */
function validateTraderForm() {
  const name = document.getElementById(FORM_ELEMENTS.NAME_INPUT)?.value.trim();
  const address = document.getElementById(FORM_ELEMENTS.ADDRESS_INPUT)?.value.trim();
  const platform = document.getElementById(FORM_ELEMENTS.PLATFORM_SELECT)?.value;

  if (!ethers.isAddress(address)) {
    return { isValid: false, error: 'Invalid Ethereum address format' };
  }

  if (!name) {
    return { isValid: false, error: 'Please enter a trader name' };
  }

  if (platform !== PLATFORMS.MOONLANDER && platform !== PLATFORMS.HYPERLIQUID) {
    return { isValid: false, error: 'Invalid platform' };
  }

  return { isValid: true, name, address: address.toLowerCase(), platform };
}

/**
 * Check if address already exists (excluding specific trader)
 */
function isDuplicateAddress(address, excludeTrader = null) {
  return multiState.watchedTraders.some(
    (t) => t.address.toLowerCase() === address.toLowerCase() && t !== excludeTrader
  );
}

// ============================================
// Form Management Functions
// ============================================

/**
 * Get form elements
 */
function getFormElements() {
  const formInline = document.getElementById(FORM_ELEMENTS.FORM);
  return {
    formInline,
    nameInput: document.getElementById(FORM_ELEMENTS.NAME_INPUT),
    addressInput: document.getElementById(FORM_ELEMENTS.ADDRESS_INPUT),
    platformSelect: document.getElementById(FORM_ELEMENTS.PLATFORM_SELECT),
    btnSubmit: formInline?.querySelector('.btn-primary-small'),
  };
}

/**
 * Show form in add or edit mode
 */
function showForm(mode = 'add') {
  const { formInline, addressInput, btnSubmit } = getFormElements();

  if (mode === 'add') {
    editingTraderAddress = null;
    if (btnSubmit) btnSubmit.textContent = BUTTON_TEXT.ADD;
  } else {
    if (btnSubmit) btnSubmit.textContent = BUTTON_TEXT.UPDATE;
  }

  if (formInline) {
    formInline.style.display = 'flex';
    addressInput?.focus();
  }
}

/**
 * Hide form and reset state
 */
function hideForm() {
  const { formInline } = getFormElements();
  editingTraderAddress = null;
  if (formInline) formInline.style.display = 'none';
  clearQuickForm();
}

/**
 * Clear form inputs
 */
function clearQuickForm() {
  const { nameInput, addressInput, platformSelect } = getFormElements();
  if (nameInput) nameInput.value = '';
  if (addressInput) addressInput.value = '';
  if (platformSelect) platformSelect.value = PLATFORMS.MOONLANDER;
}

/**
 * Populate form with trader data
 */
function populateForm(trader) {
  const { nameInput, addressInput, platformSelect } = getFormElements();
  if (nameInput) nameInput.value = trader.name;
  if (addressInput) addressInput.value = trader.address;
  if (platformSelect) platformSelect.value = trader.platform;
}

// ============================================
// Trader Operations
// ============================================

/**
 * Handle monitoring updates when address changes
 */
function handleAddressChange(trader, oldAddress) {
  removeTraderFromMonitoring(oldAddress);
  trader.positions = [];
  trader.accountData = null;

  if (multiState.isMonitoring && trader.isActive) {
    addTraderToMonitoring(trader);
  }

  fetchTraderPositionsAsync(trader.address, trader.platform, trader.name);
}

/**
 * Finalize trader changes (save, log, render, notify)
 */
function finalizeTraderChanges(message, notificationType = NOTIFICATION_TYPES.SUCCESS) {
  calculateAllocations();
  saveWatchedTraders();
  addActivityLog(notificationType, message);
  hideForm();
  renderTraderGrid();
  showNotification(notificationType, message);
}

// ============================================
// Form Initialization
// ============================================

/**
 * Initialize compact add trader form
 */
export function initAddTraderCompact() {
  const btnAdd = document.getElementById('btn-add-trader');
  const { formInline, btnCancel, btnSubmit, addressInput } = getFormElements();

  // Show form on "+ Add" click
  btnAdd?.addEventListener('click', () => showForm('add'));

  // Hide form on Cancel
  btnCancel?.addEventListener('click', hideForm);

  // Submit form on Add/Update Trader click
  btnSubmit?.addEventListener('click', () => {
    editingTraderAddress ? handleQuickUpdateTrader() : handleQuickAddTrader();
  });

  // Submit on Enter key
  addressInput?.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      editingTraderAddress ? handleQuickUpdateTrader() : handleQuickAddTrader();
    }
  });
}

/**
 * Handle quick add trader
 */
async function handleQuickAddTrader() {
  // Validate form inputs
  const validation = validateTraderForm();
  if (!validation.isValid) {
    showNotification(NOTIFICATION_TYPES.ERROR, validation.error);
    return;
  }

  const { name, address, platform } = validation;

  // Check for duplicate
  if (isDuplicateAddress(address)) {
    showNotification(NOTIFICATION_TYPES.ERROR, 'Trader already added');
    return;
  }

  // Add trader
  const success = addTrader(address, platform, name);
  if (!success) {
    const error = multiState.watchedTraders.length >= multiState.config.maxTraders
      ? `Maximum ${multiState.config.maxTraders} traders allowed`
      : 'Failed to add trader';
    showNotification(NOTIFICATION_TYPES.ERROR, error);
    return;
  }

  // Success - finalize
  const message = `Trader "${name}" added`;
  addActivityLog(NOTIFICATION_TYPES.SUCCESS, `Trader added: ${name} (${address})`);
  hideForm();
  renderTraderGrid();
  showNotification(NOTIFICATION_TYPES.SUCCESS, message);

  // Fetch positions and add to monitoring
  fetchTraderPositionsAsync(address, platform, name);
  const trader = multiState.watchedTraders.find(
    (t) => t.address.toLowerCase() === address.toLowerCase()
  );
  if (trader) {
    addTraderToMonitoring(trader);
  }
}

/**
 * Handle quick update trader
 */
async function handleQuickUpdateTrader() {
  // Validate form inputs
  const validation = validateTraderForm();
  if (!validation.isValid) {
    showNotification(NOTIFICATION_TYPES.ERROR, validation.error);
    return;
  }

  const { name, address, platform } = validation;

  // Find trader being edited
  const trader = multiState.watchedTraders.find(
    (t) => t.address.toLowerCase() === editingTraderAddress.toLowerCase()
  );

  if (!trader) {
    showNotification(NOTIFICATION_TYPES.ERROR, 'Trader not found');
    return;
  }

  // Check for duplicate address (if changed)
  if (address !== editingTraderAddress.toLowerCase() && isDuplicateAddress(address, trader)) {
    showNotification(NOTIFICATION_TYPES.ERROR, 'Address already exists');
    return;
  }

  // Apply updates
  const addressChanged = address !== trader.address;
  const oldAddress = trader.address;

  trader.name = name;
  trader.address = address;
  trader.platform = platform;

  // Handle address change
  if (addressChanged) {
    handleAddressChange(trader, oldAddress);
  }

  // Finalize changes
  finalizeTraderChanges(`Trader updated: ${trader.name}`, NOTIFICATION_TYPES.INFO);
}

/**
 * Fetch positions for newly added trader
 */
async function fetchTraderPositionsAsync(address, platform, name) {
  try {
    showNotification(NOTIFICATION_TYPES.INFO, `Fetching positions for ${name}...`);
    addActivityLog(NOTIFICATION_TYPES.INFO, `Fetching positions for ${name}...`);

    const { positions, accountData } = await fetchPositionsByPlatform(address, platform);

    updateTraderPositions(address, positions);

    const trader = multiState.watchedTraders.find(
      (t) => t.address.toLowerCase() === address.toLowerCase()
    );
    if (trader && accountData) {
      trader.accountData = accountData;
    }

    renderTraderGrid();

    const message = `Loaded ${positions.length} position(s) for ${name}`;
    showNotification(NOTIFICATION_TYPES.SUCCESS, message);
    addActivityLog(NOTIFICATION_TYPES.SUCCESS, message);
  } catch (error) {
    console.error('Failed to fetch positions:', error);
    const errorMsg = `Failed to fetch positions: ${error.message}`;
    showNotification(NOTIFICATION_TYPES.ERROR, errorMsg);
    addActivityLog(NOTIFICATION_TYPES.ERROR, `Failed to fetch positions for ${name}: ${error.message}`);
  }
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
 * Handle edit trader - populate form for editing
 */
window.handleEditTrader = function (address) {
  const trader = multiState.watchedTraders.find(
    (t) => t.address.toLowerCase() === address.toLowerCase()
  );

  if (!trader) return;

  editingTraderAddress = trader.address;
  populateForm(trader);
  showForm('edit');
};

/**
 * Handle remove trader
 */
window.handleRemoveTrader = function (address) {
  const trader = multiState.watchedTraders.find(
    (t) => t.address.toLowerCase() === address.toLowerCase()
  );

  if (!trader) return;

  const confirmMessage = `Remove trader "${trader.name}"? This will close all their positions.`;
  if (!confirm(confirmMessage)) return;

  const success = removeTrader(address);
  if (!success) {
    showNotification(NOTIFICATION_TYPES.ERROR, 'Failed to remove trader');
    return;
  }

  removeTraderFromMonitoring(address);
  calculateAllocations();
  addActivityLog(NOTIFICATION_TYPES.WARNING, `Trader removed: ${trader.name}`);
  renderTraderGrid();
  showNotification(NOTIFICATION_TYPES.SUCCESS, 'Trader removed');
};

/**
 * Copy address to clipboard
 */
window.copyToClipboard = function (text) {
  navigator.clipboard
    .writeText(text)
    .then(() => {
      showNotification(NOTIFICATION_TYPES.SUCCESS, 'Address copied to clipboard');
    })
    .catch((err) => {
      console.error('Failed to copy:', err);
      showNotification(NOTIFICATION_TYPES.ERROR, 'Failed to copy address');
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
  }, NOTIFICATION_TIMEOUT_MS);
}

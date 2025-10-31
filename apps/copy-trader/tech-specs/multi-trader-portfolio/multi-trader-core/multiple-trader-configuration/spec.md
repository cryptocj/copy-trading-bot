# Technical Specification: Multiple Trader Configuration

## Overview

Implement UI components and workflows for adding, managing, and displaying multiple traders in the copy trading portfolio. This leverages the existing `multi-trader-state.js` infrastructure with minimal modifications.

**Story**: [Multiple Trader Configuration](./story.md)

**Complexity**: Low (UI bindings to existing backend logic)

**Estimated Effort**: 2-3 days

## Architecture

### System Context

```
┌─────────────────────────────────────────────────────────────┐
│                     Multi-Trader Portfolio                  │
│                                                             │
│  ┌──────────────┐      ┌──────────────────────────────┐   │
│  │  User Input  │─────>│   Trader Configuration UI     │   │
│  │   (Form)     │      │  - Add Trader Form            │   │
│  └──────────────┘      │  - Trader List Display        │   │
│                        │  - Pause/Resume/Remove BTNs   │   │
│                        └───────────┬──────────────────────┘   │
│                                    │                          │
│                                    │ Calls existing functions │
│                                    ▼                          │
│                        ┌──────────────────────────────┐      │
│                        │  multi-trader-state.js       │      │
│                        │  ✅ Already Implemented:     │      │
│                        │  - addTrader()               │      │
│                        │  - removeTrader()            │      │
│                        │  - toggleTraderActive()      │      │
│                        │  - calculateAllocations()    │      │
│                        │  - saveWatchedTraders()      │      │
│                        └──────────┬───────────────────┘      │
│                                   │                          │
│                                   ▼                          │
│                        ┌──────────────────────────────┐      │
│                        │      localStorage            │      │
│                        │  'multi_trader_watched...'   │      │
│                        └──────────────────────────────┘      │
└─────────────────────────────────────────────────────────────┘
```

### Component Architecture

**New Components** (UI layer):
1. **AddTraderForm** - Form for adding new traders
2. **TraderList** - Display list of added traders
3. **TraderItem** - Individual trader row with controls

**Existing Components** (No changes needed):
- `multiState` in `multi-trader-state.js` (✅ Complete)
- `addTrader()`, `removeTrader()`, `toggleTraderActive()` (✅ Complete)
- `calculateAllocations()` (✅ Complete - equal strategy)
- localStorage persistence (✅ Complete)

## Data Flow

### Sequence Diagram: Add Trader Flow

```mermaid
sequenceDiagram
    participant User
    participant UI as Add Trader UI
    participant State as multi-trader-state.js
    participant Storage as localStorage

    User->>UI: Enter trader address
    User->>UI: (Optional) Enter trader name
    User->>UI: Click "Add Trader"

    UI->>UI: Validate address format (ethers.js)

    alt Invalid address
        UI->>User: Show error "Invalid Ethereum address"
    else Valid address
        UI->>State: addTrader(address, platform, name)

        State->>State: Check if trader exists
        alt Trader already exists
            State-->>UI: return false
            UI->>User: Show error "Trader already added"
        else Duplicate check pass
            State->>State: Check max traders limit (5)
            alt Max limit reached
                State-->>UI: return false
                UI->>User: Show error "Maximum 10 traders allowed"
            else Limit check pass
                State->>State: Create trader object
                State->>State: Add to watchedTraders[]
                State->>State: calculateAllocations() - equal weight
                State->>Storage: saveWatchedTraders()
                State-->>UI: return true

                UI->>UI: renderTraderList()
                UI->>User: Show success notification
                UI->>UI: Clear form
            end
        end
    end
```

## Implementation Design

### Design Principles

**Compact & Efficient**:
- Minimal form (inline, collapsible)
- Grid-based trader display (3 columns desktop, 2 tablet, 1 mobile)
- Auto-generated trader names (no manual naming required)
- ~75% space savings vs traditional form

### 1. Compact Add Trader Component

**Location**: `js/ui-multi-trader.js` (new file)

**HTML Structure** (Inline Collapsible Form):
```html
<div id="trader-list-section" class="config-section">
  <!-- Compact Header with Add Button -->
  <div class="section-header">
    <h3>👥 Watched Traders (<span id="trader-count">0</span>/10)</h3>
    <button id="btn-add-trader" class="btn-add-compact">+ Add</button>
  </div>

  <!-- Inline Add Form (hidden by default, expands when "+ Add" clicked) -->
  <div id="add-trader-inline" class="add-trader-inline" style="display: none;">
    <input
      type="text"
      id="trader-address-quick"
      placeholder="Enter trader address (0x...)"
      class="input-quick"
      pattern="^0x[a-fA-F0-9]{40}$"
      required
    />
    <select id="trader-platform-quick" class="select-quick">
      <option value="moonlander">Moonlander</option>
      <option value="hyperliquid">Hyperliquid</option>
    </select>
    <button class="btn-primary-small">Add Trader</button>
    <button class="btn-cancel-small">Cancel</button>
  </div>

  <!-- Trader Grid (see section 2) -->
  <div id="trader-grid" class="trader-grid">
    <!-- Dynamically populated trader cards -->
  </div>

  <!-- Empty State -->
  <div id="empty-state" class="empty-state" style="display: none;">
    <p>📭 No traders yet. Click "+ Add" to start.</p>
  </div>
</div>
```

**JavaScript Handler** (Compact Form):
```javascript
// js/ui-multi-trader.js
import { ethers } from 'ethers';
import {
  multiState,
  addTrader,
  calculateAllocations,
  addActivityLog
} from './multi-trader-state.js';

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
function handleQuickAddTrader() {
  const address = document.getElementById('trader-address-quick')?.value.trim();
  const platform = document.getElementById('trader-platform-quick')?.value;

  // Validate address format
  if (!ethers.utils.isAddress(address)) {
    showNotification('error', 'Invalid Ethereum address format');
    return;
  }

  // Add trader using existing function (auto-generates name)
  const success = addTrader(address, platform, null); // null = auto-generate name

  if (!success) {
    // Error handling (duplicate, max limit)
    if (multiState.watchedTraders.some(t => t.address.toLowerCase() === address.toLowerCase())) {
      showNotification('error', 'Trader already added');
    } else if (multiState.watchedTraders.length >= 10) {
      showNotification('error', 'Maximum 10 traders allowed');
    } else {
      showNotification('error', 'Failed to add trader');
    }
    return;
  }

  // Success - update UI
  showNotification('success', `Trader added`);
  addActivityLog('success', `Trader added: ${address}`);

  // Hide form and refresh
  document.getElementById('add-trader-inline').style.display = 'none';
  clearQuickForm();
  renderTraderGrid();
  updateTraderCount();
}

/**
 * Clear quick form inputs
 */
function clearQuickForm() {
  document.getElementById('trader-address-quick').value = '';
  document.getElementById('trader-platform-quick').value = 'moonlander';
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
```

### 2. Grid-Based Trader List Component

**HTML Structure** (Grid Layout):
```html
<!-- Trader grid is populated inside the trader-list-section from section 1 -->
<div id="trader-grid" class="trader-grid">
  <!-- Dynamically populated trader cards (3 columns desktop, 2 tablet, 1 mobile) -->
</div>
```

**JavaScript Renderer** (Grid-Based Cards):
```javascript
// js/ui-multi-trader.js

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
    countElement.textContent = traders.length;
  }

  if (traders.length === 0) {
    container.innerHTML = '';
    emptyState.style.display = 'block';
    return;
  }

  emptyState.style.display = 'none';

  // Render trader cards in grid
  container.innerHTML = traders.map(trader => `
    <div class="trader-card ${trader.isActive ? '' : 'paused'}" data-address="${trader.address}">
      <!-- Card Header -->
      <div class="card-header">
        <span class="trader-name" title="${trader.name}">${trader.name}</span>
        <span class="badge badge-${trader.platform}">${trader.platform}</span>
      </div>

      <!-- Card Body -->
      <div class="card-body">
        <div class="card-row">
          <span class="label">Address:</span>
          <span class="trader-address" title="${trader.address}">
            ${shortenAddress(trader.address)}
            <button
              class="btn-icon-small"
              onclick="copyToClipboard('${trader.address}')"
              title="Copy address"
            >
              📋
            </button>
          </span>
        </div>

        <div class="card-row">
          <span class="label">Allocation:</span>
          <span class="allocation-value">${(trader.allocation || 0).toFixed(1)}%</span>
        </div>

        ${trader.lastSync ? `
          <div class="card-row">
            <span class="label">Last sync:</span>
            <span class="sync-time">${formatTimestamp(trader.lastSync)}</span>
          </div>
        ` : ''}

        <div class="card-row">
          <span class="label">Status:</span>
          <span class="badge badge-${trader.isActive ? 'active' : 'paused'}">
            ${trader.isActive ? 'Active' : 'Paused'}
          </span>
        </div>
      </div>

      <!-- Card Actions -->
      <div class="card-actions">
        ${trader.isActive ? `
          <button
            class="btn-card btn-pause"
            onclick="handlePauseTrader('${trader.address}')"
            title="Pause trader"
          >
            Pause
          </button>
        ` : `
          <button
            class="btn-card btn-resume"
            onclick="handleResumeTrader('${trader.address}')"
            title="Resume trader"
          >
            Resume
          </button>
        `}

        <button
          class="btn-card btn-remove"
          onclick="handleRemoveTrader('${trader.address}')"
          title="Remove trader"
        >
          Remove
        </button>
      </div>
    </div>
  `).join('');
}

/**
 * Shorten Ethereum address for display
 */
function shortenAddress(address) {
  return `${address.substring(0, 6)}...${address.substring(address.length - 4)}`;
}

/**
 * Format timestamp
 */
function formatTimestamp(timestamp) {
  const date = new Date(timestamp);
  const now = Date.now();
  const diff = now - timestamp;

  // Less than 1 minute
  if (diff < 60000) {
    return 'Just now';
  }

  // Less than 1 hour
  if (diff < 3600000) {
    const minutes = Math.floor(diff / 60000);
    return `${minutes}m ago`;
  }

  // Less than 24 hours
  if (diff < 86400000) {
    const hours = Math.floor(diff / 3600000);
    return `${hours}h ago`;
  }

  // More than 24 hours
  return date.toLocaleDateString();
}

/**
 * Copy address to clipboard
 */
function copyToClipboard(text) {
  navigator.clipboard.writeText(text).then(() => {
    showNotification('success', 'Address copied to clipboard');
  }).catch(err => {
    console.error('Failed to copy:', err);
    showNotification('error', 'Failed to copy address');
  });
}
```

### 3. Trader Actions Handlers

**JavaScript Functions**:
```javascript
// js/ui-multi-trader.js
import {
  toggleTraderActive,
  removeTrader,
  calculateAllocations,
  addActivityLog
} from './multi-trader-state.js';

/**
 * Handle pause trader
 */
window.handlePauseTrader = function(address) {
  toggleTraderActive(address, false);
  calculateAllocations(); // Recalculate for active traders only
  addActivityLog('info', `Trader paused: ${address}`);
  renderTraderGrid();
  showNotification('success', 'Trader paused');
};

/**
 * Handle resume trader
 */
window.handleResumeTrader = function(address) {
  toggleTraderActive(address, true);
  calculateAllocations(); // Recalculate with resumed trader
  addActivityLog('success', `Trader resumed: ${address}`);
  renderTraderGrid();
  showNotification('success', 'Trader resumed');
};

/**
 * Handle remove trader
 */
window.handleRemoveTrader = function(address) {
  // Confirmation dialog
  const trader = multiState.watchedTraders.find(
    t => t.address.toLowerCase() === address.toLowerCase()
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

  calculateAllocations(); // Recalculate without removed trader
  addActivityLog('warning', `Trader removed: ${trader.name}`);
  renderTraderGrid();
  showNotification('success', 'Trader removed');
};
```

## Integration Points

### 1. With Existing State Management

**File**: `js/multi-trader-state.js`

**No changes needed** - UI simply calls existing functions:
- `addTrader(address, platform, name, allocation)` - Already implemented
- `removeTrader(address)` - Already implemented
- `toggleTraderActive(address, isActive)` - Already implemented
- `calculateAllocations()` - Already implemented (equal strategy)
- `saveWatchedTraders()` - Called automatically by state functions

### 2. With Configuration

**File**: `js/config.js`

**Add constants** (if not present):
```javascript
// Multi-trader settings
export const MAX_TRADERS = 10; // Maximum number of traders
export const MIN_TRADER_NAME_LENGTH = 1;
export const MAX_TRADER_NAME_LENGTH = 50;
```

### 3. With Main Application

**File**: `js/main.js` or `multi-trader.html`

**Initialize UI** on page load:
```javascript
import { initAddTraderCompact, renderTraderGrid } from './ui-multi-trader.js';
import { loadMultiTraderState } from './multi-trader-state.js';

// On DOM ready
document.addEventListener('DOMContentLoaded', () => {
  // Load persisted state
  loadMultiTraderState();

  // Initialize UI components
  initAddTraderCompact();
  renderTraderGrid();
});
```

## Testing Strategy

### Unit Tests

**Test File**: `tests/test-trader-management.js`

**Test Cases**:
1. ✅ Add trader with valid address
2. ✅ Reject invalid Ethereum address format
3. ✅ Prevent duplicate traders (case-insensitive)
4. ✅ Enforce maximum traders limit (10)
5. ✅ Equal allocation calculation (3 traders = 33.3% each)
6. ✅ Allocation update on trader add/remove
7. ✅ Pause trader sets allocation to 0
8. ✅ Resume trader recalculates allocation
9. ✅ Remove trader updates allocations
10. ✅ localStorage persistence (save/load)

### Integration Tests

**Test File**: `tests/test-trader-ui-integration.js`

**Test Scenarios**:
1. Submit add trader form with valid data
2. Display validation error for invalid address
3. Render trader list correctly
4. Pause/resume trader updates UI
5. Remove trader with confirmation
6. Update trader count badge

### Manual Testing Checklist

- [ ] Add first trader - allocation shows 100%
- [ ] Add second trader - both show 50%
- [ ] Add third trader - all show 33.3%
- [ ] Pause one trader - active traders split 100%
- [ ] Resume trader - all active split equally
- [ ] Remove trader - remaining split equally
- [ ] Try to add 11th trader - see error message
- [ ] Try to add duplicate address - see error message
- [ ] Refresh page - traders persist from localStorage
- [ ] Copy address to clipboard - works
- [ ] Long trader name - truncates properly

## Similar Code References

### From `multi-trader-state.js`:

**Add Trader Function** (Lines 174-210):
```javascript
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
    allocation: allocation || 0,
    isActive: true,
    addedAt: Date.now(),
    performance: { pnl: 0, winRate: 0, totalTrades: 0, sharpeRatio: 0, roi: 0 },
    positions: [],
    lastSync: null,
  };

  multiState.watchedTraders.push(trader);
  saveWatchedTraders();

  console.log('Trader added:', trader);
  return true;
}
```

**Calculate Allocations - Equal Strategy** (Lines 339-344):
```javascript
case 'equal':
  // Equal allocation to all active traders
  const equalAllocation = 100 / activeTraders.length;
  activeTraders.forEach(trader => {
    trader.allocation = equalAllocation;
  });
  break;
```

**Toggle Trader Active** (Lines 289-301):
```javascript
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
```

## CSS Styling

**File**: `css/multi-trader.css` (new file)

```css
/* ========================================
   Section Layout
   ======================================== */
.config-section {
  margin-bottom: 2rem;
}

.section-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1rem;
}

.section-header h3 {
  margin: 0;
  font-size: 1.25rem;
}

/* ========================================
   Compact Add Trader Form
   ======================================== */
.btn-add-compact {
  padding: 0.5rem 1rem;
  background: #4caf50;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 0.9rem;
  font-weight: 600;
  transition: background 0.2s;
}

.btn-add-compact:hover {
  background: #45a049;
}

.add-trader-inline {
  display: flex;
  gap: 0.5rem;
  align-items: center;
  padding: 1rem;
  background: #f5f5f5;
  border-radius: 8px;
  margin-bottom: 1rem;
  flex-wrap: wrap;
}

.add-trader-inline .input-quick {
  flex: 1;
  min-width: 250px;
  padding: 0.5rem;
  border: 1px solid #ccc;
  border-radius: 4px;
  font-size: 0.9rem;
}

.add-trader-inline .select-quick {
  padding: 0.5rem;
  border: 1px solid #ccc;
  border-radius: 4px;
  font-size: 0.9rem;
}

.btn-primary-small,
.btn-cancel-small {
  padding: 0.5rem 1rem;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 0.9rem;
  font-weight: 600;
  transition: background 0.2s;
}

.btn-primary-small {
  background: #4caf50;
  color: white;
}

.btn-primary-small:hover {
  background: #45a049;
}

.btn-cancel-small {
  background: #999;
  color: white;
}

.btn-cancel-small:hover {
  background: #777;
}

/* ========================================
   Trader Grid Layout (Responsive)
   ======================================== */
.trader-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 1rem;
}

/* Desktop: Force 3 columns */
@media (min-width: 1024px) {
  .trader-grid {
    grid-template-columns: repeat(3, 1fr);
  }
}

/* Tablet: Force 2 columns */
@media (min-width: 640px) and (max-width: 1023px) {
  .trader-grid {
    grid-template-columns: repeat(2, 1fr);
  }
}

/* Mobile: Single column */
@media (max-width: 639px) {
  .trader-grid {
    grid-template-columns: 1fr;
  }
}

/* ========================================
   Trader Card
   ======================================== */
.trader-card {
  border: 1px solid #ddd;
  border-radius: 8px;
  background: #fff;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  transition: box-shadow 0.2s, transform 0.2s;
}

.trader-card:hover {
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
  transform: translateY(-2px);
}

.trader-card.paused {
  opacity: 0.6;
  background: #f9f9f9;
}

/* Card Header */
.card-header {
  padding: 1rem;
  background: #f8f8f8;
  border-bottom: 1px solid #e0e0e0;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.trader-name {
  font-weight: 600;
  font-size: 1rem;
  color: #333;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

/* Card Body */
.card-body {
  padding: 1rem;
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.card-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 0.85rem;
}

.card-row .label {
  color: #666;
  font-weight: 500;
}

.trader-address {
  font-family: monospace;
  font-size: 0.8rem;
  color: #333;
  display: flex;
  align-items: center;
  gap: 0.25rem;
}

.allocation-value {
  font-weight: 600;
  color: #4caf50;
  font-size: 1rem;
}

.sync-time {
  color: #999;
  font-size: 0.8rem;
}

/* Card Actions */
.card-actions {
  padding: 0.75rem 1rem;
  background: #fafafa;
  border-top: 1px solid #e0e0e0;
  display: flex;
  gap: 0.5rem;
}

.btn-card {
  flex: 1;
  padding: 0.5rem;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 0.85rem;
  font-weight: 600;
  transition: background 0.2s;
}

.btn-pause {
  background: #ff9800;
  color: white;
}

.btn-pause:hover {
  background: #fb8c00;
}

.btn-resume {
  background: #4caf50;
  color: white;
}

.btn-resume:hover {
  background: #45a049;
}

.btn-remove {
  background: #f44336;
  color: white;
}

.btn-remove:hover {
  background: #e53935;
}

/* ========================================
   Badges
   ======================================== */
.badge {
  padding: 0.25rem 0.5rem;
  border-radius: 4px;
  font-size: 0.7rem;
  font-weight: 600;
  text-transform: uppercase;
  white-space: nowrap;
}

.badge-active {
  background: #4caf50;
  color: white;
}

.badge-paused {
  background: #ff9800;
  color: white;
}

.badge-moonlander {
  background: #2196f3;
  color: white;
}

.badge-hyperliquid {
  background: #9c27b0;
  color: white;
}

/* ========================================
   Icon Buttons
   ======================================== */
.btn-icon-small {
  background: none;
  border: none;
  cursor: pointer;
  font-size: 0.9rem;
  padding: 0.25rem;
  opacity: 0.7;
  transition: opacity 0.2s;
}

.btn-icon-small:hover {
  opacity: 1;
}

/* ========================================
   Notifications (Toast)
   ======================================== */
.notification {
  position: fixed;
  top: 20px;
  right: 20px;
  padding: 1rem 1.5rem;
  border-radius: 4px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  z-index: 1000;
  animation: slideIn 0.3s ease;
  font-size: 0.9rem;
  font-weight: 500;
}

.notification-success {
  background: #4caf50;
  color: white;
}

.notification-error {
  background: #f44336;
  color: white;
}

@keyframes slideIn {
  from {
    transform: translateX(100%);
    opacity: 0;
  }
  to {
    transform: translateX(0);
    opacity: 1;
  }
}

/* ========================================
   Empty State
   ======================================== */
.empty-state {
  text-align: center;
  padding: 3rem 1rem;
  color: #999;
  font-size: 0.95rem;
}

.empty-state p {
  margin: 0;
}
```

## Files to Create/Modify

### New Files
- `js/ui-multi-trader.js` - UI components and handlers (~300 lines)
- `css/multi-trader.css` - Styling (~200 lines)
- `tests/test-trader-management.js` - Unit tests (~200 lines)

### Modified Files
- `multi-trader.html` - Add HTML structure for form and list (~100 lines added)
- `js/main.js` - Initialize multi-trader UI (~10 lines added)
- `js/config.js` - Add MAX_TRADERS constant (~5 lines added)

### No Changes Needed
- ✅ `js/multi-trader-state.js` - Already complete
- ✅ `js/utils.js` - Already has needed utilities
- ✅ `js/hyperliquid-service.js` - No changes needed
- ✅ `js/moonlander-service.js` - No changes needed

## Security Considerations

1. **Address Validation**: Use `ethers.utils.isAddress()` for format validation
2. **XSS Prevention**: Sanitize trader names before rendering
3. **localStorage Security**: Never persist private keys (already handled in multi-trader-state.js)
4. **Confirmation Dialogs**: Require confirmation for destructive actions (remove trader)

## Performance Considerations

1. **Efficient Rendering**: Only re-render trader list when state changes
2. **Event Delegation**: Use event delegation for dynamic trader list items
3. **Debouncing**: Debounce rapid add/remove operations
4. **localStorage Throttling**: Batch localStorage writes to reduce I/O

## Accessibility

1. **Keyboard Navigation**: All actions accessible via keyboard
2. **Screen Readers**: Proper ARIA labels and roles
3. **Focus Management**: Logical tab order
4. **Error Announcements**: Screen reader announcements for errors/success

## Next Steps

1. **Implementation**: Create UI components following this spec
2. **Testing**: Write and run unit tests
3. **Integration**: Connect UI to existing multi-trader-state.js
4. **Manual Testing**: Test all user flows
5. **Move to Next Spec**: Position Conflict Resolution

---

**Note**: This spec leverages 90% existing infrastructure from `multi-trader-state.js`. Implementation is primarily UI work - no complex logic needed.

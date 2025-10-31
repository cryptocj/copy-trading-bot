# User Story: Multiple Trader Configuration

## Story

**As an** active copy trader
**I want to** add and track 2-10 AI traders simultaneously
**So that** I can diversify my risk across different trading strategies instead of being dependent on a single trader.

## Priority

**Must Have (P0)** - MVP Core Feature

## Acceptance Criteria

### AC1: Add Traders to Portfolio
- **Given** I am on the trader configuration page
- **When** I click "Add Trader" button
- **Then** I see a form to enter trader address
- **And** I can add up to 10 unique trader addresses
- **And** System validates each address format (Ethereum address)
- **And** System prevents duplicate trader addresses

### AC2: Display Trader List
- **Given** I have added multiple traders
- **When** I view the configuration page
- **Then** I see a list of all added traders with:
  - Trader address (shortened format with copy button)
  - Trader name/label (optional, defaults to "Trader N")
  - Status badge (Active | Paused)
  - Remove button
  - Equal allocation percentage (auto-calculated)

### AC3: Manage Individual Traders
- **Given** I have multiple traders in my portfolio
- **When** I want to control a specific trader
- **Then** I can:
  - Pause monitoring for that trader
  - Resume monitoring for that trader
  - Remove trader from portfolio (with confirmation)
- **And** System updates equal allocation when traders added/removed

### AC4: Trader Status Monitoring
- **Given** I have active traders configured
- **When** positions are being synced
- **Then** System:
  - Fetches positions for all active traders (paused traders skipped)
  - Displays position count per trader
  - Shows last sync timestamp per trader
  - Indicates sync errors per trader (if any)

### AC5: Allocation Updates Automatically
- **Given** I add or remove a trader
- **When** The trader list changes
- **Then** System automatically recalculates equal allocation for all active traders
- **And** Displays new allocation percentage per trader (e.g., 3 traders = 33.3% each)

## Technical Implementation

### State Management Changes

```javascript
// Extend state.js to support multiple traders
const state = {
  traders: [
    {
      id: generateUniqueId(), // UUID or timestamp-based
      address: '0x...', // Ethereum address
      name: 'Trader 1', // User-provided or default
      allocation: 0.33, // Auto-calculated (1 / traders.length)
      status: 'active', // 'active' | 'paused' | 'removed'
      positions: [],
      lastSyncTime: null,
      lastSyncError: null,
      isAutoAdded: false // For Phase 2
    }
  ],
  // ... rest of state
};
```

### Core Functions

```javascript
// Add trader
function addTrader(address, name = null) {
  // Validate address format
  if (!ethers.utils.isAddress(address)) {
    throw new Error('Invalid Ethereum address');
  }

  // Check for duplicates
  if (state.traders.some(t => t.address.toLowerCase() === address.toLowerCase())) {
    throw new Error('Trader already added');
  }

  // Check max limit
  if (state.traders.length >= 10) {
    throw new Error('Maximum 10 traders allowed');
  }

  // Add trader
  const trader = {
    id: generateUniqueId(),
    address: address,
    name: name || `Trader ${state.traders.length + 1}`,
    allocation: 0, // Will be recalculated
    status: 'active',
    positions: [],
    lastSyncTime: null,
    lastSyncError: null,
    isAutoAdded: false
  };

  state.traders.push(trader);
  updateTraderAllocations();
  saveState();

  return trader;
}

// Remove trader
function removeTrader(traderId) {
  const index = state.traders.findIndex(t => t.id === traderId);
  if (index === -1) return;

  state.traders.splice(index, 1);
  updateTraderAllocations();
  saveState();
}

// Pause/Resume trader
function setTraderStatus(traderId, status) {
  const trader = state.traders.find(t => t.id === traderId);
  if (!trader) return;

  trader.status = status;
  if (status === 'active' || status === 'paused') {
    updateTraderAllocations(); // Recalculate for active traders only
  }
  saveState();
}

// Update allocations (equal weight)
function updateTraderAllocations() {
  const activeTraders = state.traders.filter(t => t.status === 'active');
  if (activeTraders.length === 0) return;

  const equalShare = 1.0 / activeTraders.length;

  activeTraders.forEach(trader => {
    trader.allocation = equalShare;
  });

  // Set paused traders to 0 allocation
  state.traders
    .filter(t => t.status !== 'active')
    .forEach(t => t.allocation = 0);
}
```

### UI Components

```javascript
// Render trader list
function renderTraderList() {
  const container = document.getElementById('trader-list');

  const html = state.traders.map(trader => `
    <div class="trader-item" data-trader-id="${trader.id}">
      <div class="trader-info">
        <span class="trader-name">${trader.name}</span>
        <span class="trader-address" title="${trader.address}">
          ${shortenAddress(trader.address)}
          <button onclick="copyAddress('${trader.address}')" class="btn-icon">📋</button>
        </span>
        <span class="badge ${trader.status}">${trader.status.toUpperCase()}</span>
        <span class="allocation">${(trader.allocation * 100).toFixed(1)}%</span>
      </div>
      <div class="trader-actions">
        ${trader.status === 'active'
          ? `<button onclick="pauseTrader('${trader.id}')" class="btn-secondary">Pause</button>`
          : `<button onclick="resumeTrader('${trader.id}')" class="btn-primary">Resume</button>`
        }
        <button onclick="removeTrader('${trader.id}')" class="btn-danger">Remove</button>
      </div>
      ${trader.lastSyncError
        ? `<div class="sync-error">⚠️ ${trader.lastSyncError}</div>`
        : ''
      }
    </div>
  `).join('');

  container.innerHTML = html;
}

// Add trader form handler
function handleAddTrader(event) {
  event.preventDefault();

  const address = document.getElementById('trader-address').value.trim();
  const name = document.getElementById('trader-name').value.trim() || null;

  try {
    addTrader(address, name);
    renderTraderList();
    showNotification('success', `Trader added: ${name || address}`);
    document.getElementById('add-trader-form').reset();
  } catch (error) {
    showNotification('error', error.message);
  }
}
```

### Validation Rules

1. **Address Format**: Must be valid Ethereum address (0x + 40 hex characters)
2. **Uniqueness**: No duplicate addresses (case-insensitive comparison)
3. **Limit**: Maximum 10 traders
4. **Name**: Optional, 1-50 characters, alphanumeric + spaces
5. **Allocation**: Auto-calculated, always sums to 1.0 (100%)

## Test Scenarios

### Test 1: Add First Trader
- **Given** Empty trader list
- **When** User adds trader with address `0x123...`
- **Then** Trader added with 100% allocation, status "active"

### Test 2: Add Multiple Traders (Equal Allocation)
- **Given** Empty trader list
- **When** User adds 3 traders
- **Then** Each trader has 33.3% allocation (0.333, 0.333, 0.334 to round to 100%)

### Test 3: Prevent Duplicate Traders
- **Given** Trader with address `0x123...` already added
- **When** User tries to add same address (case variations)
- **Then** System shows error "Trader already added"
- **And** No new trader added

### Test 4: Enforce Maximum Limit
- **Given** 10 traders already added
- **When** User tries to add 11th trader
- **Then** System shows error "Maximum 10 traders allowed"
- **And** No new trader added

### Test 5: Invalid Address Format
- **Given** Add trader form
- **When** User enters invalid address "abc123"
- **Then** System shows error "Invalid Ethereum address"
- **And** Form prevents submission

### Test 6: Remove Trader and Recalculate
- **Given** 3 traders with 33.3% each
- **When** User removes 1 trader
- **Then** Remaining 2 traders have 50% each
- **And** Removed trader no longer in list

### Test 7: Pause Trader Updates Allocation
- **Given** 3 active traders with 33.3% each
- **When** User pauses 1 trader
- **Then** 2 active traders have 50% each
- **And** Paused trader has 0% allocation
- **And** Paused trader positions not synced

### Test 8: Resume Trader Recalculates
- **Given** 2 active traders (50% each), 1 paused (0%)
- **When** User resumes paused trader
- **Then** All 3 traders have 33.3% allocation
- **And** Resumed trader positions start syncing

## Dependencies

### Requires
- State management system (state.js)
- LocalStorage for persistence
- ethers.js for address validation
- UI framework (vanilla JS or library)

### Blocks
- Position Conflict Resolution (needs multiple traders to detect conflicts)
- Aggregated Portfolio View (needs traders to aggregate)
- Position Scaling (needs allocations to scale positions)

## Estimated Effort

**2-3 days** (1 developer)

- Day 1: State management refactoring, core functions
- Day 2: UI components, form handlers, validation
- Day 3: Testing, edge cases, polish

## Notes

- Equal allocation is automatic and transparent
- Users cannot manually set percentages in MVP (deferred to Phase 2)
- Allocation updates happen instantly when traders added/removed/paused
- Paused traders remain in list but don't sync positions
- Removed traders are permanently deleted (no soft delete in MVP)
- Consider adding trader nicknames/labels for easier identification
- Future: Add trader search/autocomplete from nof1.ai registry

## Related Requirements

- **REQ-1**: Multiple Trader Configuration
- **REQ-2-SIMPLIFIED**: Equal Weight Allocation (automatic)

## Related User Stories

- Position Conflict Resolution (uses trader list)
- Aggregated Portfolio View (displays all traders)

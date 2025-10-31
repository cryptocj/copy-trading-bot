# User Story: Aggregated Portfolio View

## Story

**As a** user following multiple AI traders
**I want to** see a consolidated view of all my positions across all traders
**So that** I can understand my total portfolio exposure, PnL, and risk at a glance without having to mentally aggregate across traders.

## Priority

**Must Have (P0)** - MVP Core Feature

## Acceptance Criteria

### AC1: Display Aggregated Portfolio Metrics
- **Given** I have multiple traders with active positions
- **When** I view the portfolio dashboard
- **Then** I see aggregated metrics at the top:
  - Total Portfolio Value (sum across all traders)
  - Total PnL (absolute $ and %)
  - Total Margin Used (sum of all position margins)
  - Available Balance (wallet balance - margin used)
  - Number of Active Positions (count)
  - Number of Active Traders (count)

### AC2: Show Consolidated Position List
- **Given** Multiple traders have positions
- **When** I view the aggregated position view
- **Then** I see a consolidated list showing:
  - All unique positions (symbol + side combinations)
  - Combined size for conflicted positions
  - Individual positions for non-conflicted symbols
  - Conflict indicators for combined positions
  - Source trader attribution (which traders contribute to each position)
  - Real-time PnL per position
  - Entry price, current price, leverage

### AC3: Toggle Between Views
- **Given** I am viewing the portfolio
- **When** I click the view toggle button
- **Then** I can switch between:
  - **Aggregated View**: Consolidated positions across all traders
  - **Per-Trader View**: Separate tabs/sections for each trader
- **And** View preference persisted in localStorage

### AC4: Real-Time Updates
- **Given** I am viewing the aggregated portfolio
- **When** Position prices update (via polling)
- **Then** System updates:
  - Current prices for all positions
  - PnL calculations (position and total)
  - Portfolio value
  - Margin used
- **And** Updates render within 100ms
- **And** No full page reload required

### AC5: Color-Coded PnL Indicators
- **Given** Positions have PnL values
- **When** I view positions
- **Then** System displays PnL with color coding:
  - Green: Positive PnL (profit)
  - Red: Negative PnL (loss)
  - Gray: Breakeven (±0.5%)
- **And** Portfolio-level PnL also color-coded

### AC6: Position Attribution Details
- **Given** A combined/conflicted position
- **When** I click on the position row
- **Then** System expands to show:
  - Breakdown by trader
  - Each trader's contribution (size, value, %)
  - Individual trader PnL for this position
  - Strategy used for conflict resolution
- **And** I can collapse to hide details

## Technical Implementation

### Aggregation Logic

```javascript
// Calculate aggregated portfolio metrics
function calculatePortfolioMetrics() {
  const activeTraders = state.traders.filter(t => t.status === 'active');

  // Aggregate positions across all traders
  const allPositions = activeTraders.flatMap(trader =>
    trader.positions.map(pos => ({
      ...pos,
      traderId: trader.id,
      traderName: trader.name,
      allocation: trader.allocation
    }))
  );

  // Calculate total portfolio value
  const totalValue = state.userWallet.totalBalance;

  // Calculate total margin used
  const totalMarginUsed = allPositions.reduce((sum, pos) => {
    return sum + (pos.notionalValue * pos.allocation / pos.leverage);
  }, 0);

  // Calculate available balance
  const availableBalance = totalValue - totalMarginUsed;

  // Calculate total PnL
  const totalPnL = allPositions.reduce((sum, pos) => {
    return sum + (pos.pnl || 0) * pos.allocation;
  }, 0);

  const totalPnLPercent = (totalPnL / totalValue) * 100;

  // Count positions
  const activePositions = allPositions.length;

  return {
    totalValue,
    totalPnL,
    totalPnLPercent,
    totalMarginUsed,
    availableBalance,
    activePositions,
    activeTraders: activeTraders.length
  };
}
```

### Consolidated Position View

```javascript
// Consolidate positions across traders (merge conflicts)
function consolidatePositions() {
  const activeTraders = state.traders.filter(t => t.status === 'active');

  // Get all positions with trader context
  const allPositions = activeTraders.flatMap(trader =>
    trader.positions.map(pos => ({
      ...pos,
      traderId: trader.id,
      traderName: trader.name,
      allocation: trader.allocation
    }))
  );

  // Group by symbol + side
  const grouped = new Map();

  allPositions.forEach(pos => {
    const key = `${pos.symbol}-${pos.side}`;

    if (!grouped.has(key)) {
      grouped.set(key, []);
    }

    grouped.get(key).push(pos);
  });

  // Create consolidated positions
  return Array.from(grouped.entries()).map(([key, positions]) => {
    if (positions.length === 1) {
      // Single trader position - no conflict
      return {
        ...positions[0],
        isConsolidated: false,
        attribution: [{
          traderId: positions[0].traderId,
          traderName: positions[0].traderName,
          size: positions[0].size * positions[0].allocation,
          pnl: (positions[0].pnl || 0) * positions[0].allocation,
          percentage: 1.0
        }]
      };
    }

    // Multiple traders - consolidated position
    const totalSize = positions.reduce((sum, p) => sum + (p.size * p.allocation), 0);
    const totalPnL = positions.reduce((sum, p) => sum + ((p.pnl || 0) * p.allocation), 0);
    const totalValue = positions.reduce((sum, p) => sum + (p.notionalValue * p.allocation), 0);

    const attribution = positions.map(p => ({
      traderId: p.traderId,
      traderName: p.traderName,
      size: p.size * p.allocation,
      pnl: (p.pnl || 0) * p.allocation,
      percentage: (p.size * p.allocation) / totalSize
    }));

    return {
      symbol: positions[0].symbol,
      side: positions[0].side,
      size: totalSize,
      notionalValue: totalValue,
      entryPrice: positions[0].entryPrice, // Assume same
      currentPrice: positions[0].currentPrice,
      leverage: positions[0].leverage,
      pnl: totalPnL,
      pnlPercent: (totalPnL / totalValue) * 100,
      isConsolidated: true,
      attribution,
      sourceTraders: positions.map(p => p.traderId)
    };
  });
}
```

### UI Rendering

```javascript
// Render aggregated portfolio metrics
function renderPortfolioMetrics() {
  const metrics = calculatePortfolioMetrics();

  const html = `
    <div class="portfolio-metrics">
      <div class="metric-card">
        <span class="metric-label">Total Value</span>
        <span class="metric-value">\$${metrics.totalValue.toFixed(2)}</span>
      </div>

      <div class="metric-card">
        <span class="metric-label">Total PnL</span>
        <span class="metric-value ${getPnLClass(metrics.totalPnL)}">
          \$${metrics.totalPnL.toFixed(2)}
          (${metrics.totalPnLPercent > 0 ? '+' : ''}${metrics.totalPnLPercent.toFixed(2)}%)
        </span>
      </div>

      <div class="metric-card">
        <span class="metric-label">Margin Used</span>
        <span class="metric-value">\$${metrics.totalMarginUsed.toFixed(2)}</span>
        <span class="metric-subtext">${((metrics.totalMarginUsed / metrics.totalValue) * 100).toFixed(1)}% utilization</span>
      </div>

      <div class="metric-card">
        <span class="metric-label">Available Balance</span>
        <span class="metric-value">\$${metrics.availableBalance.toFixed(2)}</span>
      </div>

      <div class="metric-card">
        <span class="metric-label">Active Positions</span>
        <span class="metric-value">${metrics.activePositions}</span>
      </div>

      <div class="metric-card">
        <span class="metric-label">Active Traders</span>
        <span class="metric-value">${metrics.activeTraders}</span>
      </div>
    </div>
  `;

  document.getElementById('portfolio-metrics').innerHTML = html;
}

// Render consolidated positions
function renderConsolidatedPositions() {
  const positions = consolidatePositions();

  const html = positions.map(pos => `
    <div class="position-row ${pos.isConsolidated ? 'consolidated' : ''}" data-position-key="${pos.symbol}-${pos.side}">
      <div class="position-main">
        <span class="symbol">${pos.symbol}</span>
        <span class="side ${pos.side.toLowerCase()}">${pos.side}</span>
        <span class="size">${pos.size.toFixed(4)}</span>
        <span class="entry-price">\$${pos.entryPrice.toFixed(2)}</span>
        <span class="current-price">\$${pos.currentPrice.toFixed(2)}</span>
        <span class="leverage">${pos.leverage}x</span>
        <span class="pnl ${getPnLClass(pos.pnl)}">
          \$${pos.pnl.toFixed(2)} (${pos.pnlPercent > 0 ? '+' : ''}${pos.pnlPercent.toFixed(2)}%)
        </span>
        ${pos.isConsolidated
          ? `<span class="conflict-indicator" title="Combined from ${pos.attribution.length} traders">⚠️</span>`
          : ''
        }
        ${pos.isConsolidated
          ? `<button class="btn-expand" onclick="toggleAttribution('${pos.symbol}-${pos.side}')">▼</button>`
          : ''
        }
      </div>

      ${pos.isConsolidated ? `
        <div class="position-attribution" id="attribution-${pos.symbol}-${pos.side}" style="display: none;">
          <table class="attribution-table">
            <thead>
              <tr>
                <th>Trader</th>
                <th>Size</th>
                <th>PnL</th>
                <th>Share</th>
              </tr>
            </thead>
            <tbody>
              ${pos.attribution.map(a => `
                <tr>
                  <td>${a.traderName}</td>
                  <td>${a.size.toFixed(4)}</td>
                  <td class="${getPnLClass(a.pnl)}">\$${a.pnl.toFixed(2)}</td>
                  <td>${(a.percentage * 100).toFixed(1)}%</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      ` : ''}
    </div>
  `).join('');

  document.getElementById('consolidated-positions').innerHTML = html;
}

// Toggle between aggregated and per-trader views
function toggleView(viewType) {
  state.config.viewMode = viewType; // 'aggregated' | 'per-trader'
  saveState();

  if (viewType === 'aggregated') {
    document.getElementById('aggregated-view').style.display = 'block';
    document.getElementById('per-trader-view').style.display = 'none';
    renderPortfolioMetrics();
    renderConsolidatedPositions();
  } else {
    document.getElementById('aggregated-view').style.display = 'none';
    document.getElementById('per-trader-view').style.display = 'block';
    renderPerTraderView();
  }
}

// Toggle attribution details
function toggleAttribution(positionKey) {
  const element = document.getElementById(`attribution-${positionKey}`);
  element.style.display = element.style.display === 'none' ? 'block' : 'none';
}

// Helper: Get PnL CSS class
function getPnLClass(pnl) {
  if (pnl > 0) return 'pnl-positive';
  if (pnl < 0) return 'pnl-negative';
  return 'pnl-neutral';
}
```

### Real-Time Update Loop

```javascript
// Update portfolio metrics and positions in real-time
async function updatePortfolioRealtime() {
  // Fetch latest prices from exchange
  await updatePositionPrices();

  // Recalculate metrics
  renderPortfolioMetrics();

  // Update position display
  if (state.config.viewMode === 'aggregated') {
    renderConsolidatedPositions();
  } else {
    renderPerTraderView();
  }

  // Schedule next update
  setTimeout(updatePortfolioRealtime, 10000); // Every 10 seconds
}
```

## Test Scenarios

### Test 1: Display Portfolio Metrics (Single Trader)
- **Given** 1 active trader with 3 positions
- **And** Total balance: $1,000, Margin used: $300
- **When** I view aggregated portfolio
- **Then** Metrics show:
  - Total Value: $1,000
  - Total PnL: [calculated]
  - Margin Used: $300
  - Available Balance: $700
  - Active Positions: 3
  - Active Traders: 1

### Test 2: Display Portfolio Metrics (Multiple Traders)
- **Given** 3 active traders (33.3% each)
  - Trader A: 2 positions, $200 margin
  - Trader B: 3 positions, $250 margin
  - Trader C: 1 position, $100 margin
- **When** I view aggregated portfolio
- **Then** Metrics show:
  - Active Positions: 6
  - Active Traders: 3
  - Total Margin Used: $550
  - Available Balance: $450

### Test 3: Consolidated Position (No Conflict)
- **Given** Trader A has BTC-PERP LONG (0.1 BTC)
- **And** No other traders have BTC-PERP LONG
- **When** I view consolidated positions
- **Then** Single position shown:
  - BTC-PERP LONG, 0.033 BTC (scaled by 33% allocation)
  - No conflict indicator
  - Attribution: 100% Trader A

### Test 4: Consolidated Position (With Conflict)
- **Given** Trader A has BTC-PERP LONG (0.1 BTC @ 33%)
- **And** Trader B has BTC-PERP LONG (0.15 BTC @ 33%)
- **When** I view consolidated positions
- **Then** Single consolidated position shown:
  - BTC-PERP LONG, 0.083 BTC (0.033 + 0.050)
  - Conflict indicator ⚠️
  - Attribution: Trader A 40%, Trader B 60%

### Test 5: Expand Attribution Details
- **Given** Consolidated position with 2 traders
- **When** I click expand button
- **Then** Attribution table shows:
  - Trader A: 0.033 BTC, $50 PnL, 40%
  - Trader B: 0.050 BTC, $75 PnL, 60%
- **When** I click again
- **Then** Attribution table collapses

### Test 6: Toggle View (Aggregated ↔ Per-Trader)
- **Given** I am viewing aggregated portfolio
- **When** I click "Per-Trader View" button
- **Then** View switches to show separate sections per trader
- **And** View preference saved to localStorage
- **When** I click "Aggregated View" button
- **Then** View switches back to consolidated view

### Test 7: Real-Time PnL Updates
- **Given** I am viewing aggregated portfolio
- **And** BTC price increases from $50,000 to $51,000
- **When** Next price update occurs (10s interval)
- **Then** System updates:
  - Current price for BTC positions
  - PnL for all BTC positions
  - Total portfolio PnL
  - Color coding (green for profit)
- **And** UI updates without page reload

### Test 8: Color-Coded PnL Display
- **Given** Portfolio with mixed PnL:
  - Position 1: +$100 (profit)
  - Position 2: -$50 (loss)
  - Position 3: +$0.25 (breakeven)
- **When** I view positions
- **Then** PnL displayed with colors:
  - Position 1: Green text
  - Position 2: Red text
  - Position 3: Gray text
- **And** Total PnL: +$50.25 (Green)

## Dependencies

### Requires
- Multiple Trader Configuration (provides traders)
- Position Conflict Resolution (for consolidated view)
- Position fetching and price updates
- Real-time price polling

### Blocks
- None (final story in epic)

## Estimated Effort

**3-4 days** (1 developer)

- Day 1: Aggregation logic, metrics calculation
- Day 2: UI components (metrics cards, position list)
- Day 3: View toggle, attribution details, real-time updates
- Day 4: Testing, performance optimization, polish

## Notes

- Aggregated view is the primary dashboard for multi-trader users
- Real-time updates critical for user confidence in system
- Performance target: <100ms render time even with 100+ positions
- Consider adding position filtering (by symbol, side, trader)
- Consider adding sorting options (PnL, size, symbol)
- Future: Export portfolio snapshot as CSV/JSON (REQ-20)
- Future: Performance charts over time (REQ-15)

## Related Requirements

- **REQ-4**: Aggregated Portfolio View

## Related User Stories

- Multiple Trader Configuration (provides traders)
- Position Conflict Resolution (provides conflict indicators)

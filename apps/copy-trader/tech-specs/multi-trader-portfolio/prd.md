# PRD: Multi-Trader Portfolio Management & Auto-Discovery

## Executive Summary

This PRD defines the requirements for transforming the existing single-trader copy trading application into a comprehensive multi-trader portfolio management system. The feature enables users to diversify risk by following multiple AI traders simultaneously, automatically discover profitable traders based on performance metrics, and optimize capital allocation through intelligent position scaling.

**Key Benefits**:
- **Risk Diversification**: Follow 2-10 traders simultaneously to reduce single-trader dependency
- **Automated Discovery**: AI-powered trader discovery based on win rate and PnL thresholds
- **Capital Efficiency**: Position scaling enables following more traders with limited capital
- **Performance Improvement**: Expected 20%+ portfolio performance improvement vs single-trader

**Implementation Approach**: 100% client-side browser application with no backend dependencies, ensuring user privacy and security while maintaining full functionality.

**Timeline**: 8-week MVP delivery with core multi-trader features, followed by 6-week Phase 2 for auto-discovery capabilities.

## 1. Overview

### Problem Statement

Current copy trading users face three critical limitations:

1. **Single Trader Risk**: Users can only follow one trader at a time, exposing them to concentrated risk if that trader underperforms
2. **Manual Discovery**: Users must manually research and select traders, missing opportunities to discover profitable traders automatically
3. **Inefficient Capital Allocation**: Users cannot optimize position sizing across multiple traders, leading to suboptimal capital utilization

These limitations prevent users from building diversified, automated copy trading portfolios that maximize returns while managing risk.

### Objectives

1. **Portfolio Diversification**: Enable users to follow multiple traders simultaneously with intelligent capital allocation
2. **Automated Discovery**: Implement automatic trader discovery and filtering based on performance metrics (PnL, win rate)
3. **Capital Optimization**: Provide position scaling to minimum viable sizes, maximizing portfolio positions within capital constraints
4. **Risk Management**: Reduce concentration risk through multi-trader portfolio construction

### Success Criteria

- Users can successfully track 3-10 traders simultaneously
- Portfolio performance improves by 20%+ vs single-trader approach (measured via backtest)
- Auto-discovery identifies and adds profitable traders within 24 hours of meeting criteria
- Position scaling reduces minimum capital requirement by 50%+ while maintaining full trader coverage
- System maintains <5% sync error rate across all tracked positions

## 2. User Personas

### Primary Persona: Active Copy Trader (Sarah)

**Demographics**:
- Age: 28-45
- Experience: Intermediate crypto trader (6-24 months)
- Capital: $500 - $5,000 allocated to copy trading
- Time: Monitors positions 2-3 times daily

**Goals**:
- Build diversified portfolio of profitable AI traders
- Automate trader discovery to save research time
- Maximize number of positions within capital constraints
- Reduce risk through diversification

**Pain Points**:
- Currently limited to one trader - "putting all eggs in one basket"
- Misses opportunities when manually researching traders
- Capital inefficiency - can't follow all desired traders with limited funds
- Fear of missing out (FOMO) when other traders perform better

**Behaviors**:
- Checks nof1.ai daily for trader rankings
- Switches traders every 1-2 weeks based on performance
- Manually calculates position sizes in spreadsheets
- Constantly worries about choosing the "wrong" trader

### Secondary Persona: Passive Investor (Mike)

**Demographics**:
- Age: 35-60
- Experience: Beginner crypto trader (<6 months)
- Capital: $200 - $1,000 for copy trading
- Time: Checks positions once per day or less

**Goals**:
- "Set and forget" automated copy trading
- Minimize risk through diversification
- Avoid manual trader research and selection
- Match or beat traditional investment returns

**Pain Points**:
- Doesn't have time to research traders
- Overwhelmed by choices and technical complexity
- Worried about security and losing funds
- Needs simple automation without constant monitoring

**Behaviors**:
- Prefers default settings and recommendations
- Rarely changes configuration once set up
- Values simplicity over advanced features
- Willing to accept lower returns for lower risk/effort

## 3. User Stories

### Multi-Trader Following

**US-1**: As an active trader, I want to follow multiple AI traders simultaneously so that I can diversify my risk across different trading strategies.

**US-2**: As a user, I want to allocate different percentages of my capital to different traders so that I can weight my portfolio toward my preferred strategies.

**US-3**: As a user, I want to see an aggregated view of all my positions across all traders so that I can understand my total portfolio exposure.

**US-4**: As a user, I want the system to handle conflicts when multiple traders open the same symbol/side so that I don't end up with oversized positions.

### Auto-Discovery & Filtering

**US-5**: As a passive investor, I want the system to automatically discover and follow traders with >70% win rate and >$10K PnL so that I don't have to manually research traders.

**US-6**: As a user, I want to set minimum performance thresholds (win rate, PnL) so that only profitable traders are added to my portfolio.

**US-7**: As a user, I want underperforming traders automatically removed from my portfolio so that I maintain high portfolio quality without manual intervention.

**US-8**: As a user, I want to see why a trader was added or removed so that I can understand the system's decisions and adjust criteria if needed.

### Position Scaling

**US-9**: As a user with limited capital, I want positions automatically scaled to minimum sizes so that I can follow more traders with the same capital.

**US-10**: As a user, I want the system to respect platform minimum position sizes so that all my orders execute successfully.

**US-11**: As a user, I want to understand how my capital is allocated across traders and positions so that I can verify the scaling logic.

**US-12**: As a user, I want the option to manually override scaling factors so that I can customize allocation based on my preferences.

## 4. Requirements

### Must Have (P0) - MVP Scope

#### Multi-Trader Core

**REQ-1: Multiple Trader Configuration**
- **Description**: Allow users to add and track 2-10 traders simultaneously
- **Acceptance Criteria**:
  - User can add up to 10 trader addresses
  - Each trader has independent monitoring status (active/paused)
  - System fetches and displays positions for all active traders
  - UI displays all trader positions in separate sections or tabs
- **Technical Notes**: Extend current state.js to manage array of traders instead of single trader

**REQ-2: Portfolio Capital Allocation**
- **Description**: Allocate user's total capital across selected traders
- **Acceptance Criteria**:
  - User can set allocation percentage per trader (manual mode)
  - Allocations must sum to ≤100%
  - System calculates available capital per trader based on allocation
  - System respects allocation when opening positions
- **Technical Notes**: Add allocation logic to sync-engine.js

**REQ-3: Position Conflict Resolution**
- **Description**: Handle cases where multiple traders open same symbol/side
- **Acceptance Criteria**:
  - System detects when 2+ traders have same symbol/side position
  - Default strategy: Combine positions additively (scale each trader's position)
  - User can configure conflict strategy: Combine | Take Largest | First Only
  - Conflict status displayed in UI with warning indicator
- **Technical Notes**: Add conflict detection to sync-engine.js before position execution

**REQ-4: Aggregated Portfolio View**
- **Description**: Display consolidated view of all positions across all traders
- **Acceptance Criteria**:
  - UI shows total portfolio value, PnL, margin used
  - UI shows combined positions with attribution to source traders
  - User can toggle between aggregated view and per-trader view
  - Aggregated metrics update in real-time
- **Technical Notes**: Add aggregation logic to ui.js and new rendering functions

#### Auto-Discovery Basics

**REQ-5: Manual Performance Filter Input**
- **Description**: User can set minimum thresholds for trader auto-discovery
- **Acceptance Criteria**:
  - UI fields for: Min Win Rate (%), Min PnL ($), Min # Trades
  - Values persisted in localStorage
  - User can enable/disable auto-discovery toggle
  - Clear documentation of what each threshold means
- **Technical Notes**: Add configuration UI in index.html, persist to config.js

**REQ-6: Trader Discovery API Integration**
- **Description**: Integrate with external API/data source for trader discovery
- **Acceptance Criteria**:
  - System queries nof1.ai API (or equivalent) for trader performance data
  - API returns: trader address, win rate, total PnL, # trades, platform
  - System filters traders based on user-defined thresholds
  - Query runs every 24 hours or on manual trigger
- **Technical Notes**: Create new trader-discovery-service.js, handle API rate limits

**REQ-7: Auto-Add Qualifying Traders**
- **Description**: Automatically add traders meeting performance criteria
- **Acceptance Criteria**:
  - Traders meeting all thresholds are automatically added to portfolio
  - Maximum auto-added traders: 5 (configurable)
  - User receives notification when trader auto-added
  - User can manually remove auto-added traders
  - Auto-added traders marked with "auto" badge in UI
- **Technical Notes**: Add auto-add logic to trader-discovery-service.js, update state management

#### Position Scaling Core

**REQ-8: Minimum Position Scaling**
- **Description**: Scale all positions to minimum viable size to maximize position count
- **Acceptance Criteria**:
  - System calculates minimum position size per platform (Moonlander, Hyperliquid)
  - All positions scaled proportionally to fit within available capital
  - Scaling factor displayed per trader (e.g., "20% of trader size")
  - Positions below minimum size are skipped with warning
- **Technical Notes**: Add scaling logic to sync-engine.js, respect platform minimums

**REQ-9: Platform Minimum Validation**
- **Description**: Ensure all scaled positions meet platform minimum requirements
- **Acceptance Criteria**:
  - System validates position size ≥ platform minimum before execution
  - Platform minimums: Moonlander ($10), Hyperliquid ($5)
  - Positions failing validation are logged and skipped
  - User notified of skipped positions with reason
- **Technical Notes**: Add validation to moonlander-service.js and hyperliquid-service.js

**REQ-10: Capital Allocation Display**
- **Description**: Show user how capital is allocated across traders and positions
- **Acceptance Criteria**:
  - UI displays capital allocation breakdown: Available | Allocated | Margin Used
  - Per-trader allocation shown with percentage and dollar amount
  - Position-level margin shown per position
  - Total capital utilization percentage displayed prominently
- **Technical Notes**: Extend ui.js to render allocation breakdown

### Should Have (P1) - Post-MVP

**REQ-11: Equal Weight Auto-Allocation**
- **Description**: Automatically allocate capital equally across all selected traders
- **Acceptance Criteria**:
  - User can toggle "Equal Weight" mode
  - System automatically calculates equal % per trader (100% / N traders)
  - Allocations update automatically when traders added/removed
  - User can override with custom allocation
- **Technical Notes**: Add allocation mode selector to config

**REQ-12: Auto-Remove Underperforming Traders**
- **Description**: Remove traders that fall below performance thresholds
- **Acceptance Criteria**:
  - System monitors performance of followed traders daily
  - Traders falling below min thresholds for 3+ consecutive days are removed
  - User receives notification before removal (24hr warning)
  - User can disable auto-removal per trader
  - Removed trader's positions are closed gracefully
- **Technical Notes**: Add performance monitoring to trader-discovery-service.js

**REQ-13: Advanced Conflict Strategies**
- **Description**: Additional strategies for handling position conflicts
- **Acceptance Criteria**:
  - Strategy options: Combine | Largest | First | Average | None (skip)
  - User can set global default strategy
  - User can override strategy per symbol basis
  - Strategy rationale explained in UI tooltip
- **Technical Notes**: Extend conflict resolution in sync-engine.js

**REQ-14: Custom Scaling Factors**
- **Description**: Allow user to manually set scaling factor per trader
- **Acceptance Criteria**:
  - User can set custom scaling % per trader (10%-100%)
  - System validates total capital doesn't exceed available balance
  - Custom scaling overrides automatic minimum scaling
  - UI shows impact of custom scaling on position count
- **Technical Notes**: Add scaling override to trader config

**REQ-15: Historical Performance Tracking**
- **Description**: Track and display historical performance of followed traders
- **Acceptance Criteria**:
  - System logs daily PnL, win rate, # trades per trader
  - UI displays performance chart per trader (7/30/90 days)
  - User can compare traders side-by-side
  - Data persisted in localStorage (last 90 days)
- **Technical Notes**: Add performance tracking to state.js, create chart component

### Could Have (P2) - Future Enhancements

**REQ-16: Risk-Based Position Sizing**
- **Description**: Adjust position sizes based on risk metrics (volatility, drawdown)
- **Acceptance Criteria**:
  - System calculates risk score per trader (drawdown, Sharpe ratio)
  - Higher risk traders get smaller allocation
  - User can toggle risk-based sizing on/off
  - Risk scores displayed in UI
- **Technical Notes**: Implement risk scoring algorithm, integrate with allocation logic

**REQ-17: Smart Rebalancing**
- **Description**: Periodically rebalance portfolio to maintain target allocations
- **Acceptance Criteria**:
  - System detects when allocations drift >10% from target
  - User can trigger manual rebalance or enable auto-rebalance (daily/weekly)
  - Rebalancing respects minimum position sizes
  - Transaction costs estimated before rebalance
- **Technical Notes**: Add rebalancing logic to sync-engine.js

**REQ-18: Social Discovery Features**
- **Description**: Discover traders based on community ratings and follows
- **Acceptance Criteria**:
  - Show "most followed" traders by community
  - Display trader ratings/reviews from community
  - User can follow traders with 1-click from discovery UI
  - Social data refreshed hourly
- **Technical Notes**: Integrate with nof1.ai social API (if available)

**REQ-19: Backtesting Portfolio Performance**
- **Description**: Simulate portfolio performance with different configurations
- **Acceptance Criteria**:
  - User can input historical date range for backtest
  - System simulates multi-trader portfolio with specified allocations
  - Results show: Total return, Sharpe ratio, max drawdown, win rate
  - User can compare different allocation strategies
- **Technical Notes**: Create backtesting engine with historical data integration

**REQ-20: Export Portfolio Reports**
- **Description**: Generate downloadable reports of portfolio performance
- **Acceptance Criteria**:
  - User can export portfolio data as CSV/JSON
  - Report includes: All positions, PnL, transactions, allocations
  - Export covers custom date ranges
  - File downloads to user's device
- **Technical Notes**: Add export functionality to ui.js

### Won't Have (Out of Scope)

**WNH-1: Centralized Backend Storage**
- **Rationale**: Application must remain 100% client-side for security and privacy. No backend servers allowed.

**WNH-2: Cross-Device Synchronization**
- **Rationale**: Would require centralized storage or account system. Out of scope for MVP.

**WNH-3: Advanced Order Types (Limit, Stop-Limit)**
- **Rationale**: Current system uses market orders for simplicity. Advanced orders add significant complexity.

**WNH-4: Copy Trading for Non-Perpetuals**
- **Rationale**: Current system focuses on perpetual futures. Spot trading has different mechanics and requirements.

**WNH-5: Multi-User Collaboration**
- **Rationale**: Application is single-user. Multi-user features require backend infrastructure and authentication.

**WNH-6: Custom Indicators or TA Overlays**
- **Rationale**: System copies trader positions, not trading strategies. Technical analysis out of scope.

## 5. User Flows

### Flow 1: Setting Up Multi-Trader Portfolio (First-Time User)

**Actors**: New user (Sarah) with $1,000 capital

**Preconditions**:
- User has installed/opened the application
- User has funded wallet with $1,000 USDC + gas (CRO)

**Main Flow**:

1. **Access Configuration Panel**
   - User navigates to configuration section
   - Sees "Multi-Trader Mode" toggle (NEW)
   - Enables multi-trader mode

2. **Add Multiple Traders**
   - User clicks "Add Trader" button (NEW)
   - Enters trader address or selects from dropdown (Gemini 2.5 Pro)
   - Clicks "Add Trader" button again
   - Adds second trader (Claude Sonnet 4.5)
   - Adds third trader (Qwen3 Max)
   - System displays 3 traders in list with status badges

3. **Configure Capital Allocation**
   - System defaults to "Equal Weight" (33.3% each)
   - User reviews allocation: $333 per trader
   - User adjusts Gemini to 40%, Claude to 35%, Qwen to 25%
   - System validates allocations sum to 100%
   - System displays available capital per trader

4. **Enter Private Key**
   - User enters wallet private key in secure input field
   - System validates key format
   - System displays wallet address and balance ($1,000)

5. **Start Monitoring**
   - User clicks "Start Monitoring" button
   - System begins fetching positions for all 3 traders in parallel
   - System displays positions for each trader in separate tables
   - System shows aggregated portfolio view at top

6. **Monitor Portfolio**
   - User sees live position updates across all traders
   - System automatically syncs positions as traders open/close
   - User receives notifications for new positions
   - Activity log shows all sync actions

**Alternative Flows**:

**AF-1a: Allocation Exceeds 100%**
- At step 3, if user sets allocations >100%
- System shows error: "Total allocation cannot exceed 100%"
- User must adjust allocations before proceeding

**AF-1b: Trader Address Invalid**
- At step 2, if user enters invalid address format
- System shows error: "Invalid Ethereum address format"
- User must re-enter valid address

**AF-1c: Insufficient Balance**
- At step 5, if wallet balance < platform minimum × # traders
- System shows warning: "Insufficient balance to follow 3 traders"
- System suggests: "Reduce to 2 traders or add more capital"

**Postconditions**:
- User has 3 active traders being monitored
- Positions are syncing automatically based on allocations
- Portfolio view updates in real-time

---

### Flow 2: Enabling Auto-Discovery

**Actors**: Existing user (Mike) wanting to automate trader selection

**Preconditions**:
- User already has application configured
- User wants to automate trader discovery

**Main Flow**:

1. **Access Auto-Discovery Settings**
   - User clicks "Auto-Discovery" tab in configuration (NEW)
   - Sees auto-discovery configuration panel

2. **Set Performance Thresholds**
   - User sets "Min Win Rate": 70%
   - User sets "Min PnL": $10,000
   - User sets "Min # Trades": 50
   - System explains: "Traders meeting ALL criteria will be added automatically"

3. **Configure Auto-Add Limits**
   - User sets "Max Auto-Added Traders": 5
   - User toggles "Auto-Remove Underperformers": ON
   - System explains removal criteria (3 consecutive days below thresholds)

4. **Enable Auto-Discovery**
   - User toggles "Enable Auto-Discovery": ON
   - System shows confirmation: "Auto-discovery enabled. Next scan in 24 hours"
   - System immediately runs first discovery scan

5. **Review Discovery Results**
   - System queries trader API
   - Finds 3 traders meeting criteria:
     - Gemini 2.5 Pro (75% win rate, $15K PnL)
     - Claude Sonnet 4.5 (72% win rate, $12K PnL)
     - Qwen3 Max (80% win rate, $25K PnL)
   - System displays discovery results in UI

6. **Confirm Auto-Add**
   - System shows notification: "3 traders found. Add to portfolio?"
   - User clicks "Add All" or reviews individually
   - System adds traders with "AUTO" badge
   - System allocates capital equally across auto-added traders

7. **Monitor Auto-Discovery**
   - System runs discovery daily at configured time
   - User receives notifications for any changes
   - Activity log shows discovery events

**Alternative Flows**:

**AF-2a: No Traders Meet Criteria**
- At step 5, if no traders meet all thresholds
- System shows: "No traders found meeting criteria"
- System suggests: "Try lowering thresholds"

**AF-2b: Max Traders Already Reached**
- At step 6, if user already has 10 traders (max)
- System shows: "Cannot add more traders (max 10)"
- User must remove existing traders or increase max limit

**AF-2c: Auto-Remove Triggered**
- During monitoring, if trader falls below thresholds for 3 days
- System shows notification: "Qwen3 Max will be removed in 24 hours (below min win rate)"
- User can click "Keep Trader" to override
- If no action, trader removed and positions closed

**Postconditions**:
- Auto-discovery runs daily
- Qualifying traders added automatically
- Underperforming traders removed automatically
- User receives notifications for all discovery actions

---

### Flow 3: Handling Position Conflicts

**Actors**: Active user (Sarah) with multiple traders

**Preconditions**:
- User has 3 traders active: Trader A, Trader B, Trader C
- Each trader allocated 33% of $1,000 = $333

**Main Flow**:

1. **Detect Conflict**
   - Trader A opens: BTC-PERP LONG, 0.05 BTC, $2,000 value (scaled to 0.0083 BTC, $333 value)
   - Trader B opens: BTC-PERP LONG, 0.08 BTC, $3,200 value (scaled to 0.0083 BTC, $333 value)
   - System detects: Both traders have same symbol + side

2. **Apply Conflict Strategy**
   - System checks user's conflict strategy setting: "Combine" (default)
   - System calculates combined position: 0.0083 + 0.0083 = 0.0166 BTC
   - System calculates combined value: $333 + $333 = $666

3. **Validate Combined Position**
   - System checks: $666 < available capital ($1,000 - already used)
   - System checks: Combined position ≥ platform minimum ($10)
   - Validation passes

4. **Execute Combined Position**
   - System opens single position: 0.0166 BTC LONG on BTC-PERP
   - System records attribution: 50% Trader A, 50% Trader B
   - System updates UI with conflict indicator ⚠️

5. **Display Conflict in UI**
   - Position row shows: "BTC-PERP LONG | 0.0166 BTC | ⚠️ Combined (2 traders)"
   - Hover tooltip shows: "Trader A (0.0083) + Trader B (0.0083)"
   - User can click to see breakdown

6. **Handle Conflict Resolution**
   - When Trader A closes position, system partially closes (reduces by 0.0083 BTC)
   - When Trader B closes position, system fully closes remaining position
   - System logs all actions in activity log

**Alternative Flows**:

**AF-3a: Capital Insufficient for Combined Position**
- At step 3, if combined position value > available capital
- System shows warning: "Insufficient capital for combined position"
- System applies conflict strategy "Largest" (takes bigger position only)
- User notified of strategy override

**AF-3b: User Selects "First Only" Strategy**
- At step 2, if user's strategy is "First Only"
- System opens Trader A's position only
- System skips Trader B's position
- System logs: "Skipped BTC-PERP (Trader B) - conflict with Trader A"

**AF-3c: User Selects "None (Skip)" Strategy**
- At step 2, if user's strategy is "None"
- System skips both positions
- System logs: "Skipped BTC-PERP (conflict detected, skip strategy active)"
- User must resolve manually if desired

**Postconditions**:
- Conflicting positions resolved according to user's strategy
- User informed of conflicts via UI indicators
- Attribution tracked for partial closures
- All actions logged for transparency

## 6. Design Considerations

### UI/UX Considerations

**Multi-Trader Dashboard Layout**:
- **Option A (Tabbed)**: Each trader in separate tab, aggregated view in first tab
  - Pros: Clean, familiar pattern, easy to focus on one trader
  - Cons: More clicks to compare traders
  - Recommended for MVP

- **Option B (Side-by-Side)**: All traders visible simultaneously in columns
  - Pros: Easy comparison, see all at once
  - Cons: Horizontal scrolling on smaller screens
  - Consider for post-MVP

**Performance Thresholds Input**:
- Use slider with numeric input for flexibility
- Show real-time count of traders meeting criteria as user adjusts
- Provide preset options: "Conservative (80%+ win rate)", "Balanced (70%)", "Aggressive (60%)"

**Conflict Indicators**:
- Use visual indicator (⚠️ icon) on conflicted positions
- Color-code by severity: Yellow (2 traders), Orange (3+ traders)
- Tooltip shows breakdown and conflict resolution strategy applied

**Capital Allocation Visualization**:
- Pie chart showing allocation across traders
- Bar chart showing capital utilization: Available | Allocated | Margin Used
- Real-time updates as positions change

**Responsive Design**:
- Desktop: Show all traders side-by-side or tabbed
- Tablet: Tabbed view with collapsible sections
- Mobile: Stacked vertical layout with accordion traders

### Technical Architecture Considerations

**State Management Enhancement**:

Current structure:
```javascript
// state.js - Current (single trader)
const state = {
  traderAddress: '0x...',
  privateKey: '0x...',
  positions: [],
  balance: 0
}
```

New structure:
```javascript
// state.js - Multi-trader
const state = {
  traders: [
    {
      id: 'trader-1',
      address: '0x...',
      name: 'Gemini 2.5 Pro',
      allocation: 0.40, // 40%
      isAutoAdded: false,
      status: 'active', // active | paused | removed
      positions: [],
      performance: { winRate: 0.75, pnl: 15000, trades: 120 }
    },
    // ... more traders
  ],
  userWallet: {
    privateKey: '0x...',
    address: '0x...',
    totalBalance: 1000,
    availableBalance: 400,
    allocatedBalance: 600
  },
  portfolioPositions: [], // Aggregated view of all positions
  config: {
    conflictStrategy: 'combine', // combine | largest | first | average | none
    autoDiscovery: {
      enabled: true,
      minWinRate: 0.70,
      minPnl: 10000,
      minTrades: 50,
      maxAutoTraders: 5,
      autoRemove: true
    },
    scaling: {
      mode: 'minimum', // minimum | custom
      customFactors: {} // trader_id: factor
    }
  }
}
```

**Sync Engine Modifications**:

```javascript
// sync-engine.js - Multi-trader sync logic
async function syncAllTraders() {
  const activeTraders = state.traders.filter(t => t.status === 'active');

  // Fetch positions for all traders in parallel
  const traderPositions = await Promise.all(
    activeTraders.map(trader => fetchTraderPositions(trader))
  );

  // Detect conflicts across all traders
  const conflicts = detectPositionConflicts(traderPositions);

  // Resolve conflicts based on strategy
  const resolvedPositions = resolveConflicts(conflicts, state.config.conflictStrategy);

  // Apply scaling based on allocations
  const scaledPositions = applyCapitalAllocation(resolvedPositions);

  // Validate against platform minimums
  const validPositions = validateMinimums(scaledPositions);

  // Execute position updates
  await executePositionUpdates(validPositions);

  // Update UI
  updateUI();
}
```

**Trader Discovery Service**:

```javascript
// trader-discovery-service.js (NEW)
async function discoverTraders() {
  const { minWinRate, minPnl, minTrades } = state.config.autoDiscovery;

  // Query external API (e.g., nof1.ai, blockchain indexer)
  const allTraders = await fetchTraderPerformance();

  // Filter by criteria
  const qualifyingTraders = allTraders.filter(trader =>
    trader.winRate >= minWinRate &&
    trader.totalPnl >= minPnl &&
    trader.trades >= minTrades &&
    !state.traders.some(t => t.address === trader.address)
  );

  // Limit to max auto-add count
  const tradersToAdd = qualifyingTraders.slice(0, state.config.autoDiscovery.maxAutoTraders);

  return tradersToAdd;
}

async function monitorTraderPerformance() {
  const autoTraders = state.traders.filter(t => t.isAutoAdded);

  for (const trader of autoTraders) {
    const currentPerf = await fetchTraderPerformance(trader.address);

    // Check if below thresholds for 3 consecutive days
    if (isBelowThresholds(currentPerf)) {
      trader.underperformingDays = (trader.underperformingDays || 0) + 1;

      if (trader.underperformingDays >= 3 && state.config.autoDiscovery.autoRemove) {
        await removeTrader(trader.id);
        logActivity('warn', `Removed ${trader.name} (underperforming)`);
      }
    } else {
      trader.underperformingDays = 0;
    }
  }
}
```

**Position Scaling Logic**:

```javascript
// sync-engine.js - Scaling calculations
function applyCapitalAllocation(positions) {
  return positions.map(pos => {
    const trader = state.traders.find(t => t.id === pos.traderId);
    const allocatedCapital = state.userWallet.totalBalance * trader.allocation;

    // Calculate scaling factor to fit within allocation
    const scalingFactor = allocatedCapital / pos.notionalValue;

    // Apply minimum scaling mode
    if (state.config.scaling.mode === 'minimum') {
      // Scale to minimum while respecting platform limits
      const platformMin = getPlatformMinimum(pos.platform, pos.symbol);
      const scaledSize = Math.max(pos.size * scalingFactor, platformMin);

      return { ...pos, size: scaledSize, scalingFactor };
    }

    // Apply custom scaling if configured
    if (state.config.scaling.customFactors[trader.id]) {
      const customFactor = state.config.scaling.customFactors[trader.id];
      return { ...pos, size: pos.size * customFactor, scalingFactor: customFactor };
    }

    return { ...pos, size: pos.size * scalingFactor, scalingFactor };
  });
}
```

### Data Model Changes

**LocalStorage Schema**:

```javascript
// Current localStorage keys
localStorage.setItem('copy-trader-config', JSON.stringify({...}))
localStorage.setItem('copy-trader-state', JSON.stringify({...}))

// New localStorage keys (multi-trader)
localStorage.setItem('copy-trader-v2-config', JSON.stringify({
  traders: [...],
  userWallet: {...},
  config: {...}
}))

localStorage.setItem('copy-trader-v2-performance', JSON.stringify({
  'trader-1': { daily: [...], weekly: [...] },
  'trader-2': { daily: [...], weekly: [...] }
}))

localStorage.setItem('copy-trader-v2-actions', JSON.stringify([
  { timestamp, action, traderId, positionId, details },
  // ... action history
]))
```

**Migration Strategy**:
- Detect v1 data in localStorage
- Convert single trader to traders array (id: 'trader-1')
- Set default allocation: 100% to existing trader
- Preserve all existing positions and config
- Show migration notice to user: "Your configuration has been upgraded"

### Performance Optimization

**Parallel Position Fetching**:
- Use `Promise.all()` to fetch all trader positions simultaneously
- Implement request batching to avoid API rate limits
- Cache trader positions for 10 seconds to reduce API calls

**UI Rendering Optimization**:
- Use virtual scrolling for large position lists (>50 positions)
- Debounce UI updates during rapid position changes
- Implement lazy loading for trader performance charts

**LocalStorage Size Management**:
- Limit performance history to 90 days per trader
- Compress action history: Keep only last 1000 entries
- Implement pruning on startup: Remove old data

**API Rate Limit Handling**:
- Implement exponential backoff for failed requests
- Queue position sync requests with priority (active traders first)
- Show warning when approaching rate limits
- Fallback to slower polling interval if rate limited

### Security Considerations

**Private Key Protection**:
- Private key remains in memory only, never persisted to localStorage
- Use secure input field (type="password") with visibility toggle
- Clear private key from memory when monitoring stopped
- No transmission to external servers (client-side only)

**API Key Security** (if needed for discovery):
- Store API keys in secure localStorage (encrypted if possible)
- Never log or display API keys in UI
- Use read-only API keys when possible
- Warn user about API key permissions

**Position Execution Validation**:
- Validate all position data before execution
- Check transaction signatures before sending
- Implement nonce management to prevent replay attacks
- Log all transaction attempts for audit

**Data Integrity**:
- Validate trader addresses using checksum
- Verify position data format from APIs
- Sanitize all user inputs (allocations, thresholds)
- Implement schema validation for localStorage data

## 7. Success Metrics

### Primary Metrics

**PM-1: Multi-Trader Adoption Rate**
- **Definition**: % of users using multi-trader mode (≥2 traders)
- **Target**: 60% of active users within 3 months of launch
- **Measurement**: Track `state.traders.length` distribution
- **Success Criteria**: >60% users have 2+ traders configured

**PM-2: Portfolio Performance vs Single-Trader**
- **Definition**: Average portfolio return compared to single-trader baseline
- **Target**: +20% return improvement over single-trader mode
- **Measurement**: Compare 30-day PnL of multi-trader users vs single-trader users
- **Success Criteria**: Median multi-trader PnL ≥ 120% of single-trader PnL

**PM-3: Position Sync Accuracy**
- **Definition**: % of trader positions successfully replicated without errors
- **Target**: ≥95% sync success rate
- **Measurement**: `successful_syncs / total_sync_attempts`
- **Success Criteria**: <5% sync error rate across all positions

**PM-4: Auto-Discovery Adoption**
- **Definition**: % of users enabling auto-discovery feature
- **Target**: 40% of multi-trader users enable auto-discovery
- **Measurement**: Track `config.autoDiscovery.enabled` flag
- **Success Criteria**: ≥40% adoption within 2 months

**PM-5: Capital Efficiency Improvement**
- **Definition**: Average number of positions per $1000 capital
- **Target**: 2x more positions vs single-trader mode
- **Measurement**: Compare `position_count / (capital / 1000)` across modes
- **Success Criteria**: Multi-trader users achieve 2x position density

### Secondary Metrics

**SM-1: Average Traders per User**
- **Target**: 3.5 traders per active user
- **Measurement**: `mean(state.traders.length)`

**SM-2: Conflict Resolution Success Rate**
- **Target**: ≥98% of conflicts resolved without user intervention
- **Measurement**: `auto_resolved_conflicts / total_conflicts`

**SM-3: Auto-Added Trader Retention**
- **Target**: 70% of auto-added traders remain after 30 days
- **Measurement**: Track trader retention over time

**SM-4: Position Scaling Utilization**
- **Target**: 80% of users with scaled positions
- **Measurement**: `users_with_scaled_positions / total_users`

**SM-5: User Engagement (Session Duration)**
- **Target**: +30% increase in average session duration
- **Measurement**: Track time between monitoring start/stop

**SM-6: Error Rate Reduction**
- **Target**: <2% of position execution failures
- **Measurement**: `failed_executions / total_executions`

### User Satisfaction Metrics (Manual Collection)

**USM-1: Feature Usefulness Score**
- **Method**: In-app survey after 2 weeks of usage
- **Target**: ≥4.0/5.0 average rating
- **Questions**:
  - "How useful is multi-trader mode?" (1-5)
  - "How useful is auto-discovery?" (1-5)
  - "How satisfied are you with position scaling?" (1-5)

**USM-2: Net Promoter Score (NPS)**
- **Method**: Periodic survey (monthly)
- **Target**: NPS ≥40
- **Question**: "How likely are you to recommend this app?" (0-10)

**USM-3: Feature Request Volume**
- **Target**: <10% of users request missing features in first 3 months
- **Measurement**: Track feature requests in feedback channels

## 8. Dependencies

### Internal Dependencies

**DEP-1: State Management Refactor**
- **Description**: Refactor state.js to support multiple traders
- **Impact**: Blocks all multi-trader features
- **Owner**: Core dev team
- **Timeline**: Week 1-2

**DEP-2: Sync Engine Enhancement**
- **Description**: Update sync-engine.js for parallel trader syncing
- **Impact**: Blocks multi-trader position sync
- **Owner**: Core dev team
- **Timeline**: Week 2-3

**DEP-3: UI Component Updates**
- **Description**: Update ui.js for multi-trader views and aggregation
- **Impact**: Blocks UI rendering of multi-trader features
- **Owner**: Frontend dev
- **Timeline**: Week 3-4

**DEP-4: Position Conflict Logic**
- **Description**: Implement conflict detection and resolution
- **Impact**: Blocks conflict handling (critical for multi-trader)
- **Owner**: Core dev team
- **Timeline**: Week 4-5

### External Dependencies

**DEP-5: Trader Discovery API**
- **Description**: Access to trader performance data (e.g., nof1.ai API)
- **Impact**: Blocks auto-discovery feature
- **Options**:
  - Option A: Integrate nof1.ai API (if publicly available)
  - Option B: Build blockchain indexer (scrape on-chain data)
  - Option C: Manual CSV import as fallback
- **Owner**: External vendor or internal dev team
- **Timeline**: TBD (depends on API availability)
- **Risk**: High - API may not be available or have rate limits

**DEP-6: CCXT Library Support**
- **Description**: CCXT must support all required exchange APIs
- **Impact**: Blocks position fetching for certain platforms
- **Current Status**: Hyperliquid and Moonlander supported via custom integration
- **Risk**: Low - already implemented

**DEP-7: Ethers.js Compatibility**
- **Description**: Ethers.js must support required blockchain operations
- **Impact**: Blocks transaction signing and execution
- **Current Status**: Already in use, no blockers expected
- **Risk**: Low

**DEP-8: Browser Storage Limits**
- **Description**: localStorage must support increased data size (traders + history)
- **Impact**: May limit number of traders or history retention
- **Mitigation**: Implement data pruning, use IndexedDB if localStorage insufficient
- **Risk**: Medium - may require fallback storage strategy

### Platform Dependencies

**DEP-9: Moonlander Platform Stability**
- **Description**: Moonlander API must be stable and responsive
- **Impact**: Affects position fetching and execution reliability
- **Risk**: Medium - third-party platform, no SLA

**DEP-10: Hyperliquid Platform Stability**
- **Description**: Hyperliquid API must be stable and responsive
- **Impact**: Affects position fetching and execution reliability
- **Risk**: Medium - third-party platform, no SLA

**DEP-11: RPC Node Availability**
- **Description**: Cronos/Ethereum RPC nodes must be available for blockchain queries
- **Impact**: Blocks on-chain data fetching
- **Mitigation**: Use multiple RPC providers with fallback
- **Risk**: Medium - public RPCs may have rate limits

## 9. Risks and Mitigations

### Technical Risks

**RISK-1: Browser Performance Degradation**
- **Description**: Monitoring 10 traders simultaneously may degrade browser performance
- **Impact**: High - Poor UX, app becomes unusable
- **Probability**: Medium (40%)
- **Mitigation**:
  - Implement efficient polling strategy (staggered requests)
  - Use web workers for background processing
  - Profile and optimize rendering loop
  - Set max traders limit (10) with performance monitoring
  - Show performance warning if browser struggles
- **Contingency**: Reduce max traders to 5 if performance issues persist

**RISK-2: API Rate Limiting**
- **Description**: Fetching positions for multiple traders may hit API rate limits
- **Impact**: High - Position sync failures, missing trades
- **Probability**: High (60%)
- **Mitigation**:
  - Implement request batching and throttling
  - Use exponential backoff on rate limit errors
  - Cache position data (10-second TTL)
  - Display rate limit warnings to user
  - Implement priority queue (active positions first)
- **Contingency**: Increase polling interval (60s → 120s) if rate limited

**RISK-3: LocalStorage Size Overflow**
- **Description**: Storing data for 10 traders + history may exceed localStorage limits (5-10MB)
- **Impact**: Medium - Data loss, app crashes
- **Probability**: Medium (40%)
- **Mitigation**:
  - Implement data pruning (90-day history limit)
  - Compress stored JSON data
  - Monitor storage usage and warn user
  - Migrate to IndexedDB if needed
- **Contingency**: Prompt user to clear history or reduce tracked traders

**RISK-4: Position Conflict Logic Errors**
- **Description**: Bugs in conflict resolution may lead to incorrect position sizes
- **Impact**: High - Financial loss for users
- **Probability**: Medium (30%)
- **Mitigation**:
  - Extensive testing of conflict scenarios
  - Add validation checks before execution
  - Log all conflict decisions for audit
  - Implement "dry run" mode for testing
  - Show conflict details clearly in UI
- **Contingency**: Add "manual approval" mode for conflicts

**RISK-5: Trader Discovery API Unavailable**
- **Description**: External API for trader discovery may not exist or be inaccessible
- **Impact**: High - Auto-discovery feature blocked entirely
- **Probability**: High (70%)
- **Mitigation**:
  - Build blockchain indexer as fallback (scrape on-chain data)
  - Support manual CSV import of trader list
  - Partner with nof1.ai for API access
  - Use community-curated trader list as interim solution
- **Contingency**: Launch MVP without auto-discovery, add in Phase 2

### Business/User Risks

**RISK-6: User Confusion from Complexity**
- **Description**: Multi-trader features may overwhelm novice users
- **Impact**: Medium - Poor adoption, negative reviews
- **Probability**: Medium (50%)
- **Mitigation**:
  - Provide simple onboarding flow with defaults
  - Create "Quick Start" preset configurations
  - Add tooltips and help documentation
  - Implement progressive disclosure (hide advanced options)
  - Offer wizard for first-time setup
- **Contingency**: Add "Simple Mode" that hides multi-trader features

**RISK-7: Capital Loss from Bugs**
- **Description**: Bugs in position sizing or execution may cause financial losses
- **Impact**: Critical - User funds at risk, legal liability
- **Probability**: Low (10%)
- **Mitigation**:
  - Extensive testing on testnet before mainnet
  - Start with small position size limits (MVP)
  - Implement circuit breakers (max loss per day)
  - Add position size warnings
  - Clear disclaimer about risks in UI
- **Contingency**: Emergency stop button, bug bounty program

**RISK-8: Negative User Reviews**
- **Description**: Users may leave negative reviews if features don't work as expected
- **Impact**: Medium - Reduced adoption, brand damage
- **Probability**: Medium (40%)
- **Mitigation**:
  - Set clear expectations in documentation
  - Beta test with small user group first
  - Gather feedback early and iterate
  - Provide excellent support/help resources
  - Monitor reviews and respond quickly
- **Contingency**: Implement feedback loop, rapid bug fixes

### Regulatory/Compliance Risks

**RISK-9: Regulatory Scrutiny**
- **Description**: Copy trading may attract regulatory attention in some jurisdictions
- **Impact**: High - Legal issues, forced shutdown
- **Probability**: Low (20%)
- **Mitigation**:
  - Clear disclaimers: "Not financial advice", "For educational purposes"
  - No financial services claims (custodial wallet, investment advice)
  - Research regulatory landscape in target markets
  - Geo-block restricted jurisdictions if needed
- **Contingency**: Consult legal counsel, adjust product positioning

**RISK-10: Security Breach**
- **Description**: Despite client-side architecture, malicious actors may target users
- **Impact**: Critical - User funds stolen, reputational damage
- **Probability**: Low (15%)
- **Mitigation**:
  - Security audit of codebase
  - Warning prompts for large transactions
  - Educational content on security best practices
  - Recommend hardware wallets for large balances
  - Bug bounty program
- **Contingency**: Emergency contact/support, incident response plan

## 10. Timeline and Milestones

### MVP Scope (Phase 1) - 8 Weeks

**Goal**: Deliver core multi-trader functionality with basic automation

**Week 1-2: Foundation & Refactoring**
- Refactor state management for multi-trader support (DEP-1)
- Update data models and localStorage schema
- Implement state migration from v1 to v2
- Milestone: State management supports multiple traders ✅

**Week 3-4: Multi-Trader Core Features**
- Implement multiple trader configuration UI (REQ-1)
- Build parallel position fetching logic (DEP-2)
- Add capital allocation system (REQ-2)
- Implement position conflict detection (REQ-3, DEP-4)
- Milestone: Users can add and monitor 2-10 traders ✅

**Week 5-6: UI & Aggregation**
- Build aggregated portfolio view (REQ-4)
- Update position tables for multi-trader display (DEP-3)
- Add trader management UI (add/remove/pause traders)
- Implement capital allocation visualization
- Milestone: Complete UI for multi-trader experience ✅

**Week 7: Position Scaling & Validation**
- Implement minimum position scaling logic (REQ-8)
- Add platform minimum validation (REQ-9)
- Build capital allocation display (REQ-10)
- Add position size warnings and error handling
- Milestone: Position scaling works correctly ✅

**Week 8: Testing & Polish**
- Comprehensive testing (conflict resolution, scaling, edge cases)
- Performance optimization (parallel fetching, UI rendering)
- Bug fixes and refinements
- Documentation and help content
- **LAUNCH MVP** 🚀

**MVP Features Included**:
- ✅ Follow 2-10 traders simultaneously
- ✅ Manual capital allocation per trader
- ✅ Position conflict resolution (Combine strategy)
- ✅ Aggregated portfolio view
- ✅ Minimum position scaling
- ✅ Platform minimum validation

**MVP Features Excluded** (Phase 2):
- ❌ Auto-discovery (pending API availability)
- ❌ Auto-remove underperformers
- ❌ Advanced conflict strategies
- ❌ Custom scaling factors
- ❌ Performance tracking & charts

---

### Phase 2: Auto-Discovery & Automation - 6 Weeks

**Goal**: Add intelligent trader discovery and performance-based filtering

**Prerequisite**: DEP-5 (Trader Discovery API) must be resolved

**Week 9-10: Trader Discovery Service**
- Research and integrate trader discovery API (or build indexer) (REQ-6, DEP-5)
- Implement performance filtering logic
- Build trader ranking/scoring algorithm
- Add API rate limiting and caching
- Milestone: Discovery service fetches and filters traders ✅

**Week 11-12: Auto-Add & Configuration**
- Build auto-discovery configuration UI (REQ-5)
- Implement auto-add logic (REQ-7)
- Add notification system for discovery events
- Create trader performance dashboard
- Milestone: Auto-discovery adds qualifying traders ✅

**Week 13: Auto-Remove & Monitoring**
- Implement performance monitoring (REQ-12)
- Build auto-remove logic with grace period
- Add notification system for removal warnings
- Create performance history tracking
- Milestone: Auto-remove works correctly ✅

**Week 14: Testing & Refinement**
- Test discovery and removal logic thoroughly
- Optimize API usage and caching
- User testing with beta group
- Bug fixes and polish
- **LAUNCH PHASE 2** 🚀

**Phase 2 Features Included**:
- ✅ Auto-discovery based on performance thresholds
- ✅ Auto-add qualifying traders
- ✅ Auto-remove underperformers
- ✅ Performance monitoring dashboard

---

### Phase 3: Advanced Features - 6 Weeks

**Goal**: Add advanced allocation, risk management, and analytics

**Week 15-16: Advanced Allocation**
- Implement equal-weight auto-allocation (REQ-11)
- Add custom scaling factors (REQ-14)
- Build advanced conflict strategies (REQ-13)
- Add allocation optimization suggestions
- Milestone: Advanced allocation features complete ✅

**Week 17-18: Performance & Analytics**
- Build historical performance tracking (REQ-15)
- Create performance charts (7/30/90 day views)
- Add trader comparison tools
- Implement risk metrics (Sharpe, drawdown)
- Milestone: Comprehensive analytics available ✅

**Week 19-20: Polish & Future Features**
- Implement smart rebalancing (REQ-17)
- Add export functionality (REQ-20)
- Risk-based position sizing (REQ-16)
- Beta test with larger user group
- Bug fixes and optimization
- **LAUNCH PHASE 3** 🚀

**Phase 3 Features Included**:
- ✅ Equal-weight auto-allocation
- ✅ Custom scaling per trader
- ✅ Advanced conflict strategies
- ✅ Historical performance tracking
- ✅ Performance charts and comparison
- ✅ Smart rebalancing
- ✅ Portfolio export

---

### Long-Term Roadmap (6+ Months)

**Phase 4: Social & Community Features**
- Social trader discovery (REQ-18)
- Community ratings and reviews
- Trader leaderboards
- Social following/sharing

**Phase 5: Advanced Risk Management**
- Portfolio optimization algorithms
- Monte Carlo simulation
- Risk parity allocation
- Correlation analysis

**Phase 6: Institutional Features**
- Backtesting engine (REQ-19)
- Strategy builder
- Custom indicators
- API for programmatic trading

---

### Key Decision Points

**Decision Point 1 (Week 4)**:
- **Question**: Is parallel position fetching performant enough?
- **Options**: Continue | Reduce max traders | Implement web workers
- **Criteria**: Sync time <2s for 10 traders

**Decision Point 2 (Week 8)**:
- **Question**: Is MVP ready for launch?
- **Criteria**: All P0 features complete, <5% error rate, positive beta feedback
- **Go/No-Go**: Launch | Delay 1 week for fixes

**Decision Point 3 (Week 10)**:
- **Question**: Is trader discovery API viable?
- **Options**: Use API | Build indexer | Manual CSV import
- **Criteria**: API available, <1s response time, reasonable rate limits

**Decision Point 4 (Week 14)**:
- **Question**: Should auto-discovery be enabled by default?
- **Options**: Opt-in | Opt-out | Enabled with presets
- **Criteria**: >60% beta users enable it, <10% negative feedback

## 11. Open Questions

### Technical Questions

**Q1: Trader Discovery API Availability**
- **Question**: Does nof1.ai (or similar) offer a public API for trader performance data?
- **Impact**: Critical for auto-discovery feature
- **Options**:
  - Option A: Partner with nof1.ai for API access
  - Option B: Build blockchain indexer to scrape on-chain data
  - Option C: Use manual CSV import as interim solution
- **Owner**: Product Manager to research
- **Deadline**: Week 2 (before Phase 2 planning)

**Q2: Conflict Resolution Default Strategy**
- **Question**: What should be the default conflict resolution strategy?
- **Options**:
  - Option A: Combine (additive positions)
  - Option B: Largest (take bigger position)
  - Option C: First (first trader wins)
- **Consideration**: Combine maximizes exposure but increases risk
- **Owner**: Product Manager + User research
- **Deadline**: Week 3 (before conflict logic implementation)

**Q3: Platform Minimum Position Sizes**
- **Question**: What are exact minimum position sizes for each platform/symbol?
- **Required Data**:
  - Moonlander: $10 USDC minimum (confirmed?)
  - Hyperliquid: $5 minimum (confirmed?)
  - Per-symbol minimums (e.g., BTC vs altcoins)?
- **Owner**: Engineering to research platform docs
- **Deadline**: Week 6 (before scaling implementation)

**Q4: Web Worker Implementation**
- **Question**: Should position fetching/processing use web workers for performance?
- **Consideration**: Web workers add complexity but may improve performance
- **Decision Criteria**: If sync time >2s for 10 traders in testing
- **Owner**: Engineering lead
- **Deadline**: Week 4 (after parallel fetching implemented)

**Q5: IndexedDB vs LocalStorage**
- **Question**: Should we migrate to IndexedDB for larger storage capacity?
- **Consideration**: IndexedDB supports 50MB+ vs localStorage 5-10MB
- **Decision Criteria**: If projected storage >5MB with 10 traders + 90d history
- **Owner**: Engineering lead
- **Deadline**: Week 5 (after data model finalized)

### Product Questions

**Q6: Maximum Trader Limit**
- **Question**: What's the optimal max number of traders?
- **Options**: 5 | 10 | 20 | Unlimited (with performance warning)
- **Consideration**: More traders = better diversification but worse performance/UX
- **Owner**: Product Manager
- **Deadline**: Week 3

**Q7: Auto-Discovery Defaults**
- **Question**: What should default performance thresholds be?
- **Proposed**: Min Win Rate 70%, Min PnL $10K, Min Trades 50
- **Consideration**: Too strict = few traders, too loose = poor quality
- **Owner**: Product Manager + user research
- **Deadline**: Week 10

**Q8: Equal Weight vs Custom Allocation Default**
- **Question**: Should new users default to equal weight allocation or custom?
- **Options**:
  - Option A: Equal weight (simpler, recommended for beginners)
  - Option B: Custom (more control, better for advanced users)
  - Option C: Preset profiles (Conservative/Balanced/Aggressive)
- **Owner**: Product Manager + UX designer
- **Deadline**: Week 4

**Q9: Conflict Warning UI Placement**
- **Question**: How prominently should conflict warnings be displayed?
- **Options**:
  - Option A: Inline warning on position row (⚠️ icon)
  - Option B: Modal popup requiring acknowledgment
  - Option C: Banner at top of position table
- **Consideration**: Balance visibility with avoiding alarm
- **Owner**: UX designer
- **Deadline**: Week 5

**Q10: Performance Tracking Granularity**
- **Question**: How often should trader performance be tracked?
- **Options**: Real-time | Hourly | Daily | Weekly
- **Consideration**: More frequent = better data but more storage/processing
- **Proposed**: Daily snapshots (midnight UTC)
- **Owner**: Product Manager
- **Deadline**: Week 15

### User Experience Questions

**Q11: Onboarding Flow**
- **Question**: Should first-time users go through guided setup wizard?
- **Options**:
  - Option A: Wizard with preset recommendations
  - Option B: Quick setup with sensible defaults
  - Option C: Full manual configuration
- **Owner**: UX designer + Product Manager
- **Deadline**: Week 6

**Q12: Mobile Responsiveness Priority**
- **Question**: Is mobile support critical for MVP?
- **Consideration**: Desktop likely primary use case, but mobile growing
- **Decision**: Functional on mobile, optimized for desktop (MVP)
- **Owner**: Product Manager
- **Deadline**: Week 1

**Q13: Performance Comparison Visualization**
- **Question**: How should users compare performance across traders?
- **Options**:
  - Option A: Side-by-side comparison table
  - Option B: Overlay charts
  - Option C: Relative performance (vs portfolio average)
- **Owner**: UX designer
- **Deadline**: Week 16

### Business Questions

**Q14: Freemium vs Full Free**
- **Question**: Should advanced features be gated behind payment?
- **Consideration**: App is currently free, adding payment adds complexity
- **Decision**: Keep 100% free for MVP, consider monetization later
- **Owner**: Product Manager
- **Deadline**: Week 1

**Q15: User Support Strategy**
- **Question**: How will we support users with issues?
- **Options**:
  - Option A: Self-service docs only
  - Option B: Community Discord/Telegram
  - Option C: Email support
- **Proposed**: Comprehensive docs + community chat (Discord)
- **Owner**: Product Manager
- **Deadline**: Week 7

## 12. Appendix

### A. Glossary

**Auto-Discovery**: Automated process of finding and adding traders that meet performance criteria

**Capital Allocation**: Distribution of user's total capital across multiple traders

**Conflict (Position)**: Situation where multiple traders open the same symbol/side position

**Copy Trading**: Practice of automatically replicating positions from another trader

**Leverage**: Borrowed capital used to increase position size (e.g., 10x leverage)

**Minimum Position Size**: Smallest position size allowed by exchange platform

**Notional Value**: Total value of position (size × price)

**PnL (Profit and Loss)**: Total profit or loss from trading positions

**Position Scaling**: Adjusting position sizes to fit within capital constraints

**Perpetual Futures**: Derivative contracts with no expiration date

**Sync Engine**: Core logic that monitors and replicates trader positions

**Win Rate**: Percentage of profitable trades out of total trades

### B. Technical References

**Current Codebase**:
- Repository: `/Users/jingchen/ai/signal-tracker/apps/copy-trader`
- Key Files:
  - `index.html` - Main UI template
  - `js/main.js` - Application entry point
  - `js/sync-engine.js` - Position synchronization logic
  - `js/state.js` - State management
  - `js/ui.js` - UI rendering
  - `js/moonlander-service.js` - Moonlander platform integration
  - `js/hyperliquid-service.js` - Hyperliquid platform integration

**External APIs**:
- CCXT: https://github.com/ccxt/ccxt (Exchange API library)
- Ethers.js: https://docs.ethers.org/ (Ethereum library)
- nof1.ai: https://nof1.ai/ (Trader performance tracking)
- Moonlander: https://moonlander.trade/ (Trading platform)

**Platform Documentation**:
- Moonlander API: https://docs.moonlander.trade/ (if available)
- Hyperliquid API: https://hyperliquid.xyz/docs (if available)

### C. User Flows Diagrams

**Multi-Trader Setup Flow**:
```
[Start] → [Enable Multi-Trader Mode] → [Add Trader 1] → [Add Trader 2] → [Add Trader 3]
   ↓
[Configure Allocations] → [Review Setup] → [Enter Private Key] → [Start Monitoring]
   ↓
[Monitor Portfolio] ← [Auto-Sync Positions] ← [Fetch Trader Positions]
```

**Auto-Discovery Flow**:
```
[Enable Auto-Discovery] → [Set Thresholds] → [Run Discovery Scan]
   ↓
[Filter Traders] → [Show Results] → [User Confirm] → [Add Traders]
   ↓
[Monitor Performance] → [Below Threshold?] → [Yes] → [Warning (24h)] → [Remove]
   ↓ No
[Continue Monitoring]
```

**Position Conflict Flow**:
```
[Trader A Opens Position] → [Trader B Opens Same Position] → [Conflict Detected]
   ↓
[Check Strategy: Combine/Largest/First/None]
   ↓
[Apply Strategy] → [Validate Capital] → [Execute Combined Position]
   ↓
[Display Conflict Indicator in UI] → [User Can Review Details]
```

### D. Mockup Screenshots

*(Placeholder for actual mockups - to be created by UX designer)*

**Mockup 1: Multi-Trader Dashboard**
- Shows 3 traders in tabbed layout
- Aggregated portfolio view at top
- Position tables per trader

**Mockup 2: Auto-Discovery Configuration**
- Performance threshold sliders
- Real-time trader count matching criteria
- Preset options (Conservative/Balanced/Aggressive)

**Mockup 3: Capital Allocation Visualization**
- Pie chart showing allocation per trader
- Bar chart showing capital utilization
- Breakdown table with dollar amounts

**Mockup 4: Position Conflict Indicator**
- Position row with ⚠️ icon
- Tooltip showing conflict details
- Breakdown of attribution (Trader A: 50%, Trader B: 50%)

### E. Testing Scenarios

**Test Scenario 1: Basic Multi-Trader Setup**
- **Given**: New user with $1,000 balance
- **When**: User adds 3 traders with equal allocation
- **Then**: Each trader allocated $333, positions sync correctly

**Test Scenario 2: Position Conflict (Combine)**
- **Given**: User has 2 traders, Combine strategy
- **When**: Both traders open BTC-PERP LONG
- **Then**: Single combined position opened with correct size

**Test Scenario 3: Auto-Discovery Success**
- **Given**: Auto-discovery enabled, thresholds set
- **When**: Discovery scan finds 3 qualifying traders
- **Then**: Traders added automatically, allocations adjusted

**Test Scenario 4: Position Scaling to Minimum**
- **Given**: User has $500, 5 traders, each opens $1000 position
- **When**: System scales positions
- **Then**: Each position scaled to $100 (respecting $10 minimum)

**Test Scenario 5: Capital Exhaustion**
- **Given**: User has $300 allocated, 3 traders
- **When**: All traders open large positions
- **Then**: Positions scaled proportionally, total ≤$300 used

**Test Scenario 6: Auto-Remove Underperformer**
- **Given**: Auto-added trader falls below threshold 3 days
- **When**: 24h warning period expires
- **Then**: Trader removed, positions closed gracefully

**Test Scenario 7: API Rate Limit Handling**
- **Given**: User monitoring 10 traders
- **When**: Exchange API rate limit hit
- **Then**: Requests throttled, user notified, no data loss

### F. Migration Plan (v1 → v2)

**Step 1: Detect v1 Configuration**
```javascript
const hasV1Config = localStorage.getItem('copy-trader-config') !== null;
```

**Step 2: Convert Single Trader to Traders Array**
```javascript
const v1Config = JSON.parse(localStorage.getItem('copy-trader-config'));
const v2Config = {
  traders: [{
    id: 'trader-1',
    address: v1Config.traderAddress,
    name: 'Imported Trader',
    allocation: 1.0, // 100%
    isAutoAdded: false,
    status: 'active'
  }],
  userWallet: {
    privateKey: null, // Not persisted
    address: v1Config.userAddress,
    totalBalance: v1Config.balance
  },
  config: {
    conflictStrategy: 'combine',
    autoDiscovery: { enabled: false },
    scaling: { mode: 'minimum' }
  }
};
```

**Step 3: Migrate Positions**
```javascript
const v1Positions = JSON.parse(localStorage.getItem('copy-trader-positions'));
v2Config.traders[0].positions = v1Positions;
```

**Step 4: Save v2 Configuration**
```javascript
localStorage.setItem('copy-trader-v2-config', JSON.stringify(v2Config));
```

**Step 5: Clean Up v1 Data**
```javascript
localStorage.removeItem('copy-trader-config');
localStorage.removeItem('copy-trader-positions');
```

**Step 6: Show Migration Notice**
```javascript
showNotification('success', 'Your configuration has been upgraded to multi-trader mode!');
```

### G. Performance Benchmarks

**Target Performance Metrics**:

| Operation | Target Time | Max Acceptable |
|-----------|-------------|----------------|
| Fetch positions (1 trader) | <500ms | 1s |
| Fetch positions (10 traders) | <2s | 5s |
| Detect conflicts | <100ms | 500ms |
| Calculate scaling | <50ms | 200ms |
| UI render (full update) | <100ms | 300ms |
| LocalStorage read/write | <10ms | 50ms |
| Discovery API call | <1s | 3s |

**Browser Memory Targets**:
- Initial load: <50MB
- With 10 traders: <100MB
- With 90-day history: <150MB

**LocalStorage Size Estimates**:
- Config: ~5KB
- 10 traders × 10 positions: ~50KB
- 90-day performance history: ~500KB
- Action log (1000 entries): ~200KB
- **Total: ~750KB** (well within 5MB limit)

---

**Document Version**: 1.0
**Last Updated**: 2025-10-31
**Status**: Draft
**Owner**: Product Manager
**Reviewers**: Engineering Lead, UX Designer, Business Stakeholder

---

## Next Steps

1. **Review & Feedback** (Week 1)
   - Share PRD with stakeholders
   - Gather feedback and incorporate changes
   - Finalize requirements and scope

2. **Technical Planning** (Week 1-2)
   - Resolve open questions (Q1-Q15)
   - Finalize technical architecture
   - Create detailed engineering tasks

3. **Design Phase** (Week 2-3)
   - Create UI mockups for all features
   - User testing on mockups
   - Finalize design specifications

4. **Development Kickoff** (Week 3)
   - Begin MVP implementation (Phase 1)
   - Set up project tracking and milestones
   - Establish testing and QA processes

5. **Stakeholder Sign-Off** (Week 2)
   - Final PRD approval from all stakeholders
   - Commitment to timeline and resources
   - Go/No-Go decision for project start

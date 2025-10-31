# Epic: Multi-Trader Core Portfolio Management

## Business Context

Enable users to diversify risk by following multiple AI traders simultaneously with intelligent capital allocation and position conflict management. This transforms the application from single-trader to multi-trader portfolio management, addressing the core limitation of concentrated single-trader risk.

## Business Value

- **Risk Diversification**: Users can follow 2-10 traders, reducing dependency on single trader performance
- **Capital Efficiency**: Intelligent allocation across traders maximizes portfolio coverage
- **Conflict Management**: Automated handling of overlapping positions prevents oversized exposures
- **Portfolio Visibility**: Consolidated view provides clear understanding of total exposure

## Goals

1. Enable users to add and monitor 2-10 traders simultaneously
2. Implement capital allocation system with percentage-based distribution
3. Detect and resolve position conflicts across traders automatically
4. Provide aggregated portfolio view with real-time metrics

## Success Criteria

- ✅ Users can successfully track 3-10 traders simultaneously with <5% sync error rate
- ✅ Position conflict resolution works correctly in 98%+ of cases without user intervention
- ✅ Aggregated portfolio view updates in real-time with <100ms render time
- ✅ Capital allocation system prevents over-allocation errors
- ✅ Portfolio performance improves by 20%+ vs single-trader approach (measured via backtest)

## User Stories Covered

- **US-1**: Follow multiple traders simultaneously for risk diversification
- **US-3**: View aggregated positions across all traders
- **US-4**: Automated position conflict resolution

## Requirements Included

### Must Have (P0)
- **REQ-1**: Multiple Trader Configuration (2-10 traders)
- **REQ-2-SIMPLIFIED**: Equal Weight Allocation (automatic, 100% / N traders)
- **REQ-3**: Position Conflict Resolution (Combine/Largest/First strategies)
- **REQ-4**: Aggregated Portfolio View (consolidated metrics and positions)

### Deferred to Phase 2
- **REQ-2**: Custom Capital Allocation (manual percentage per trader) - moved to Should Have
- **US-2**: Allocate different percentages per trader - deferred to Phase 2

## Dependencies

### Internal Dependencies
- State management refactor to support multiple traders (Week 1-2)
- Sync engine enhancement for parallel trader syncing (Week 2-3)
- UI component updates for multi-trader views (Week 3-4)
- Position conflict logic implementation (Week 4-5)

### External Dependencies
- CCXT library support for exchange APIs (already implemented)
- Ethers.js compatibility for blockchain operations (already implemented)
- Browser storage limits (5-10MB localStorage sufficient)

### Dependent Epics
- **Position Scaling Core**: Requires capital allocation from this epic
- **Auto-Discovery**: Builds on multi-trader infrastructure from this epic

## Technical Considerations

### State Management Changes
```javascript
// Transform from single trader to array of traders
const state = {
  traders: [
    {
      id: 'trader-1',
      address: '0x...',
      name: 'Gemini 2.5 Pro',
      allocation: 0.33, // Auto-calculated: 1/3 = 33.3%
      status: 'active',
      positions: []
    },
    {
      id: 'trader-2',
      address: '0x...',
      name: 'Claude Sonnet 4.5',
      allocation: 0.33, // Auto-calculated: 1/3 = 33.3%
      status: 'active',
      positions: []
    },
    {
      id: 'trader-3',
      address: '0x...',
      name: 'Qwen3 Max',
      allocation: 0.34, // Auto-calculated: 1/3 = 33.3% (rounded)
      status: 'active',
      positions: []
    }
  ],
  userWallet: {
    totalBalance: 1000,
    availableBalance: 0,
    allocatedBalance: 1000
  },
  portfolioPositions: [], // Aggregated view
  config: {
    conflictStrategy: 'combine',
    allocationMode: 'equal' // MVP: equal only, 'custom' added in Phase 2
  }
}
```

### Equal Allocation Logic (MVP Simplification)
```javascript
// Automatic equal allocation when traders added/removed
function updateTraderAllocations() {
  const activeTraders = state.traders.filter(t => t.status === 'active');
  const equalShare = 1.0 / activeTraders.length;

  activeTraders.forEach(trader => {
    trader.allocation = equalShare;
  });
}
```

### Sync Engine Modifications
- Parallel position fetching for all active traders
- Conflict detection across all trader positions
- Conflict resolution based on configured strategy
- Equal allocation calculation (automatic, updates when traders added/removed)
- Capital distribution per trader (totalBalance * allocation)

### Performance Targets
- Fetch positions for 10 traders: <2 seconds
- Detect conflicts: <100ms
- UI render full update: <100ms
- LocalStorage operations: <10ms

## Risks and Mitigations

### High Priority Risks

**RISK-1: Browser Performance Degradation** (Probability: 40%, Impact: High)
- **Mitigation**: Implement staggered polling, web workers, max 10 traders limit
- **Contingency**: Reduce max traders to 5 if performance issues persist

**RISK-2: API Rate Limiting** (Probability: 60%, Impact: High)
- **Mitigation**: Request batching, exponential backoff, position caching (10s TTL)
- **Contingency**: Increase polling interval from 60s to 120s if rate limited

**RISK-4: Position Conflict Logic Errors** (Probability: 30%, Impact: High)
- **Mitigation**: Extensive testing, validation checks, audit logging, dry run mode
- **Contingency**: Add manual approval mode for conflicts

### Medium Priority Risks

**RISK-3: LocalStorage Size Overflow** (Probability: 40%, Impact: Medium)
- **Mitigation**: Data pruning (90-day limit), JSON compression, usage monitoring
- **Contingency**: Migrate to IndexedDB if needed

## Timeline

**Total Duration**: 5 weeks (MVP Phase 1)

### Week 1-2: Foundation & Refactoring
- Refactor state management for multi-trader support
- Update data models and localStorage schema
- Implement state migration from v1 to v2
- **Milestone**: State management supports multiple traders ✅

### Week 3-4: Multi-Trader Core Features
- Multiple trader configuration UI
- Parallel position fetching logic
- Capital allocation system
- Position conflict detection
- **Milestone**: Users can add and monitor 2-10 traders ✅

### Week 5: UI & Polish
- Aggregated portfolio view
- Multi-trader position display
- Trader management UI
- Capital allocation visualization
- **Milestone**: Complete multi-trader UI ✅

## Priority

**Must Have (P0) - MVP Scope**

This is the foundational epic that enables all other multi-trader functionality. Without this epic, the entire multi-trader portfolio management system cannot function.

## Complexity

**High** (8 story points equivalent)

- Significant state management refactoring required
- Complex conflict detection and resolution logic
- Parallel processing coordination across multiple traders
- Real-time UI updates with aggregation logic

## Dependencies on Other Epics

- **Blocks**: Position Scaling Core, Auto-Discovery
- **Blocked By**: None (foundational epic)

## Notes

- This epic delivers standalone business value: basic multi-trader portfolio management
- Can be released as MVP without Auto-Discovery or Position Scaling
- Focus on correctness over optimization (can optimize in later phases)
- Extensive testing required for conflict resolution logic due to financial impact
- Migration path from v1 (single trader) to v2 (multi-trader) must be seamless

## Related Documentation

- PRD Section 3: User Stories (Multi-Trader Following)
- PRD Section 4: Requirements (Multi-Trader Core)
- PRD Section 5: User Flows (Flow 1 - Setting Up Multi-Trader Portfolio)
- PRD Section 6: Design Considerations (State Management Enhancement, Sync Engine Modifications)
- PRD Section 10: Timeline and Milestones (MVP Scope - Week 1-5)

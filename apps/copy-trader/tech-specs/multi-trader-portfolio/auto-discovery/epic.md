# Epic: Automated Trader Discovery & Performance Management

## Business Context

Automate trader discovery and portfolio optimization by automatically finding profitable traders based on performance metrics and removing underperformers. This addresses the pain point of manual trader research and eliminates the need for constant portfolio monitoring, enabling "set and forget" copy trading.

## Business Value

- **Time Savings**: Eliminate manual trader research (estimated 5-10 hours/week saved)
- **Opportunity Capture**: Automatically discover and add profitable traders within 24 hours
- **Portfolio Quality**: Maintain high portfolio quality through automatic removal of underperformers
- **Passive Income**: Enable true passive investment for users who don't want active management

## Goals

1. Enable users to set performance thresholds (win rate, PnL, # trades)
2. Automatically discover and add traders meeting criteria
3. Monitor performance of followed traders continuously
4. Remove underperforming traders automatically with grace period

## Success Criteria

- ✅ Auto-discovery identifies and adds profitable traders within 24 hours of meeting criteria
- ✅ 40% of multi-trader users enable auto-discovery within 2 months
- ✅ 70% of auto-added traders remain after 30 days (retention indicator)
- ✅ Users receive clear notifications for all discovery events (add/remove)
- ✅ Auto-remove prevents portfolio quality degradation without manual intervention

## User Stories Covered

- **US-5**: Automatic discovery of traders with >70% win rate and >$10K PnL
- **US-6**: User-configurable performance thresholds for discovery
- **US-7**: Automatic removal of underperforming traders
- **US-8**: Transparency in add/remove decisions

## Requirements Included

### Must Have (P0)
- **REQ-5**: Manual Performance Filter Input
- **REQ-6**: Trader Discovery API Integration
- **REQ-7**: Auto-Add Qualifying Traders

### Should Have (P1)
- **REQ-12**: Auto-Remove Underperforming Traders

## Dependencies

### Internal Dependencies
- **Blocks**: None
- **Blocked By**: Multi-Trader Core Epic (must have multi-trader infrastructure first)

### External Dependencies
- **CRITICAL**: Trader Discovery API Availability
  - **Option A**: nof1.ai API (if publicly available)
  - **Option B**: Build blockchain indexer to scrape on-chain data
  - **Option C**: Manual CSV import as fallback
  - **Risk**: High - API may not be available or have restrictive rate limits
  - **Timeline**: Must be resolved by Week 10 to start Phase 2

## Technical Considerations

### Trader Discovery Service

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
  return qualifyingTraders.slice(0, state.config.autoDiscovery.maxAutoTraders);
}
```

### Performance Monitoring

```javascript
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

### Configuration Structure

```javascript
config: {
  autoDiscovery: {
    enabled: true,
    minWinRate: 0.70, // 70%
    minPnl: 10000, // $10,000
    minTrades: 50,
    maxAutoTraders: 5,
    autoRemove: true,
    scanInterval: 86400000 // 24 hours in ms
  }
}
```

## Risks and Mitigations

### Critical Risks

**RISK-5: Trader Discovery API Unavailable** (Probability: 70%, Impact: High)
- **Description**: External API for trader discovery may not exist or be inaccessible
- **Mitigation**:
  - Build blockchain indexer as fallback (scrape on-chain data)
  - Support manual CSV import of trader list
  - Partner with nof1.ai for API access
  - Use community-curated trader list as interim solution
- **Contingency**: Launch MVP without auto-discovery, add in Phase 2
- **Decision Point**: Week 10 - Determine if API viable or build indexer

### Medium Risks

**RISK: False Positives in Auto-Add** (Probability: 40%, Impact: Medium)
- **Description**: Traders may temporarily meet criteria but have unsustainable performance
- **Mitigation**: Add minimum trading history requirement (e.g., 50+ trades, 30+ days)
- **Contingency**: Implement probationary period before full allocation

**RISK: Grace Period Too Short** (Probability: 30%, Impact: Low)
- **Description**: 3-day grace period may remove traders during temporary slump
- **Mitigation**: Make grace period configurable (3/7/14 days)
- **Validation**: Analyze historical trader performance variance

## Timeline

**Total Duration**: 6 weeks (Phase 2)

**Prerequisite**: DEP-5 (Trader Discovery API) must be resolved

### Week 9-10: Trader Discovery Service
- Research and integrate trader discovery API (or build indexer)
- Implement performance filtering logic
- Build trader ranking/scoring algorithm
- Add API rate limiting and caching
- **Milestone**: Discovery service fetches and filters traders ✅

### Week 11-12: Auto-Add & Configuration
- Build auto-discovery configuration UI
- Implement auto-add logic
- Add notification system for discovery events
- Create trader performance dashboard
- **Milestone**: Auto-discovery adds qualifying traders ✅

### Week 13: Auto-Remove & Monitoring
- Implement performance monitoring
- Build auto-remove logic with grace period
- Add notification system for removal warnings
- Create performance history tracking
- **Milestone**: Auto-remove works correctly ✅

### Week 14: Testing & Refinement
- Test discovery and removal logic thoroughly
- Optimize API usage and caching
- User testing with beta group
- Bug fixes and polish
- **LAUNCH PHASE 2** 🚀

## Priority

**Should Have (P1) - Phase 2**

This epic provides significant value for passive investors but is not essential for MVP. Multi-Trader Core + Position Scaling deliver core value without auto-discovery. This epic enhances the product but is not blocking for initial launch.

## Complexity

**High** (8 story points equivalent)

- External API integration with unknown requirements
- Complex performance monitoring and scoring logic
- Background job scheduling (24-hour scans)
- Notification system implementation
- Extensive testing of edge cases (false positives, API failures)

## Integration Points

### Multi-Trader Core Epic
- Uses trader management infrastructure from core epic
- Integrates with state management for adding/removing traders
- Works with capital allocation system

### Position Scaling Epic
- Auto-added traders benefit from position scaling
- Capital allocation adjusts dynamically as traders added/removed

## Performance Targets

- Discovery API call: <1 second response time
- Performance monitoring per trader: <500ms
- Background scan (10 traders): <10 seconds total
- UI update after discovery: <100ms

## Decision Points

**Decision Point 3 (Week 10)**:
- **Question**: Is trader discovery API viable?
- **Options**: Use API | Build indexer | Manual CSV import
- **Criteria**: API available, <1s response time, reasonable rate limits
- **Deadline**: Must decide to proceed with Phase 2 or defer

**Decision Point 4 (Week 14)**:
- **Question**: Should auto-discovery be enabled by default?
- **Options**: Opt-in | Opt-out | Enabled with presets
- **Criteria**: >60% beta users enable it, <10% negative feedback

## Open Questions

**Q7: Auto-Discovery Defaults**
- **Question**: What should default performance thresholds be?
- **Proposed**: Min Win Rate 70%, Min PnL $10K, Min Trades 50
- **Consideration**: Too strict = few traders, too loose = poor quality
- **Owner**: Product Manager + user research
- **Deadline**: Week 10

**Q1: Trader Discovery API Availability**
- **Question**: Does nof1.ai (or similar) offer a public API for trader performance data?
- **Impact**: Critical for auto-discovery feature
- **Owner**: Product Manager to research
- **Deadline**: Week 2 (before Phase 2 planning)

## Notes

- Auto-discovery is the most requested feature from user research
- API availability is the largest blocker - must resolve early
- Consider building blockchain indexer as long-term sustainable solution
- Performance monitoring must be lightweight (daily scans, not real-time)
- Grace period prevents knee-jerk reactions to temporary performance dips
- Clear notifications critical for user trust in automated decisions
- Consider adding "pause auto-discovery" feature for user control

## Related Documentation

- PRD Section 3: User Stories (Auto-Discovery & Filtering)
- PRD Section 4: Requirements (Auto-Discovery Basics, Auto-Remove)
- PRD Section 5: User Flows (Flow 2 - Enabling Auto-Discovery)
- PRD Section 6: Design Considerations (Trader Discovery Service)
- PRD Section 8: Dependencies (DEP-5: Trader Discovery API)
- PRD Section 9: Risks (RISK-5: Trader Discovery API Unavailable)
- PRD Section 10: Timeline and Milestones (Phase 2 - Week 9-14)
- PRD Section 11: Open Questions (Q1, Q7)

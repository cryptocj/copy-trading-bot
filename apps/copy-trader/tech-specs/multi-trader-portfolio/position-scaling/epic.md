# Epic: Position Scaling & Capital Optimization

## Business Context

Enable users with limited capital to follow more traders by automatically scaling positions to minimum viable sizes. This addresses capital inefficiency where users cannot follow all desired traders due to position size requirements, allowing users to maximize portfolio diversity within capital constraints.

## Business Value

- **Capital Efficiency**: Users can follow 2x more traders with same capital
- **Access**: Lower barrier to entry for users with limited capital ($200-$1,000)
- **Position Density**: Increase average positions per $1,000 capital by 2x
- **Risk Management**: Maintain full trader coverage while respecting platform minimums

## Goals

1. Automatically scale all positions to minimum viable sizes
2. Validate scaled positions meet platform minimum requirements
3. Display capital allocation clearly to users
4. Provide warnings for positions that cannot be scaled (below minimums)

## Success Criteria

- ✅ Position scaling reduces minimum capital requirement by 50%+ while maintaining full trader coverage
- ✅ 100% of positions validate against platform minimums before execution
- ✅ Users can verify capital allocation logic through clear UI display
- ✅ <2% position execution failures due to scaling errors
- ✅ 80%+ of users utilize scaled positions feature

## User Stories Covered

- **US-9**: Automatic position scaling to minimum sizes for limited capital
- **US-10**: System respects platform minimum position sizes
- **US-11**: Clear capital allocation breakdown across traders/positions
- **US-12**: Manual override of scaling factors (Should Have)

## Requirements Included

### Must Have (P0)
- **REQ-8**: Minimum Position Scaling
- **REQ-9**: Platform Minimum Validation
- **REQ-10**: Capital Allocation Display

### Should Have (P1)
- **REQ-14**: Custom Scaling Factors (manual override per trader)

## Dependencies

### Internal Dependencies
- **Blocks**: None
- **Blocked By**: Multi-Trader Core Epic (capital allocation system must exist first)

### External Dependencies
- Platform minimum position sizes must be documented:
  - Moonlander: $10 USDC minimum
  - Hyperliquid: $5 minimum
- Platform APIs must return position size validation errors

## Technical Considerations

### Scaling Logic

```javascript
function applyCapitalAllocation(positions) {
  return positions.map(pos => {
    const trader = state.traders.find(t => t.id === pos.traderId);
    const allocatedCapital = state.userWallet.totalBalance * trader.allocation;

    // Calculate scaling factor
    const scalingFactor = allocatedCapital / pos.notionalValue;

    // Apply minimum scaling mode
    if (state.config.scaling.mode === 'minimum') {
      const platformMin = getPlatformMinimum(pos.platform, pos.symbol);
      const scaledSize = Math.max(pos.size * scalingFactor, platformMin);
      return { ...pos, size: scaledSize, scalingFactor };
    }

    return { ...pos, size: pos.size * scalingFactor, scalingFactor };
  });
}
```

### Platform Minimum Validation

```javascript
function validateMinimums(scaledPositions) {
  return scaledPositions.filter(pos => {
    const platformMin = getPlatformMinimum(pos.platform, pos.symbol);

    if (pos.size < platformMin) {
      logWarning(`Position ${pos.symbol} below minimum: ${pos.size} < ${platformMin}`);
      notifyUser('warn', `Skipped ${pos.symbol} - below platform minimum`);
      return false; // Skip this position
    }

    return true; // Include valid position
  });
}
```

### Capital Allocation Display

Components needed:
- Total capital breakdown: Available | Allocated | Margin Used
- Per-trader allocation: percentage + dollar amount
- Position-level margin: individual position sizing
- Capital utilization percentage: visual indicator (progress bar)

## Risks and Mitigations

### Medium Priority Risks

**RISK: Platform Minimum Sizes Incorrect** (Probability: 30%, Impact: Medium)
- **Mitigation**: Research and document exact minimums per platform/symbol
- **Validation**: Test with small positions to verify minimums
- **Contingency**: Add buffer (e.g., 10% above minimum) to prevent rejections

**RISK: Scaling Calculation Errors** (Probability: 20%, Impact: High)
- **Mitigation**: Extensive unit testing of scaling logic, add validation checks
- **Validation**: Manual review of scaled positions before execution
- **Contingency**: Add "dry run" mode to preview scaling results

## Timeline

**Total Duration**: 2 weeks (MVP Phase 1, Week 7-8)

### Week 7: Implementation
- Minimum position scaling logic
- Platform minimum validation
- Capital allocation display
- Position size warnings and error handling
- **Milestone**: Position scaling works correctly ✅

### Week 8: Testing & Polish (part of overall MVP testing)
- Test scaling with various capital amounts
- Validate platform minimums across all symbols
- Edge case testing (insufficient capital, below minimums)
- Performance optimization

## Priority

**Must Have (P0) - MVP Scope**

Essential for users with limited capital to benefit from multi-trader diversification. Without scaling, users need 10x more capital to follow 10 traders effectively.

## Complexity

**Medium** (5 story points equivalent)

- Straightforward mathematical calculations
- Clear validation logic
- Some complexity in UI display of allocations
- Testing required to verify scaling correctness

## Integration Points

### Multi-Trader Core Epic
- Uses capital allocation percentages from core epic
- Applies scaling to positions before execution
- Integrates with sync engine's position execution flow

### Auto-Discovery Epic
- Scaling enables users to follow more auto-discovered traders
- Must work seamlessly with auto-added traders
- Capital allocation adjusts dynamically as traders added/removed

## Performance Targets

- Calculate scaling: <50ms
- Validate minimums: <50ms
- Render capital allocation UI: <100ms
- No impact on position fetch performance

## Notes

- Scaling is critical for democratizing access to multi-trader portfolios
- Must communicate clearly to users WHY positions are scaled
- Consider adding educational content about position scaling benefits
- Platform minimums may change over time - make configurable
- Custom scaling factors (REQ-14) can be added post-MVP as enhancement

## Related Documentation

- PRD Section 3: User Stories (Position Scaling)
- PRD Section 4: Requirements (Position Scaling Core)
- PRD Section 6: Design Considerations (Position Scaling Logic)
- PRD Section 10: Timeline and Milestones (Week 7)

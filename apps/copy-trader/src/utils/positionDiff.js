/**
 * Position Difference Calculator
 *
 * Calculates the differences between current and target positions
 * to determine what actions need to be taken.
 */

/**
 * Normalize side for comparison (long/short to buy/sell)
 */
function normalizeSide(side) {
  if (side === 'long') return 'buy';
  if (side === 'short') return 'sell';
  return side;
}

/**
 * Get user-friendly direction name
 */
function getDirection(side) {
  const normalized = normalizeSide(side);
  return normalized === 'buy' ? 'LONG' : 'SHORT';
}

/**
 * Calculate required actions to sync positions
 *
 * @param {Array} currentPositions - User's current positions
 * @param {Array} targetPositions - Target positions (from trader)
 * @param {Object} options - Options { sizeThreshold: 0.05 }
 * @returns {Object} { toAdd, toRemove, toAdjust, toFlip }
 */
export function calculatePositionDiff(currentPositions, targetPositions, options = {}) {
  const sizeThreshold = options.sizeThreshold || 0.05; // 5% default

  const actions = {
    toAdd: [],
    toRemove: [],
    toAdjust: [],
    toFlip: [],
  };

  // Check what needs to be added, adjusted, or flipped
  targetPositions.forEach((target) => {
    const current = currentPositions.find(
      (p) => p.symbol === target.symbol
    );

    if (!current) {
      // Position doesn't exist - need to add
      actions.toAdd.push(target);
    } else {
      // Normalize sides for comparison
      const currentSideNorm = normalizeSide(current.side);
      const targetSideNorm = normalizeSide(target.side);

      if (currentSideNorm !== targetSideNorm) {
        // Wrong side - need to flip
        actions.toFlip.push({ current, target });
      } else {
        // Check if size needs adjustment
        const sizeDiff = Math.abs(current.size - target.size);
        const threshold = target.size * sizeThreshold;

        if (sizeDiff > threshold) {
          actions.toAdjust.push({
            symbol: target.symbol,
            side: target.side,
            currentSize: current.size,
            targetSize: target.size,
            difference: target.size - current.size,
            action: target.size > current.size ? 'INCREASE' : 'DECREASE',
          });
        }
      }
    }
  });

  // Check what needs to be removed
  currentPositions.forEach((current) => {
    const exists = targetPositions.find((p) => p.symbol === current.symbol);
    if (!exists) {
      actions.toRemove.push(current);
    }
  });

  return actions;
}

/**
 * Format position actions for display
 *
 * @param {Object} actions - Actions from calculatePositionDiff
 * @param {Object} colors - ANSI color codes
 * @returns {Array} Array of formatted lines
 */
export function formatPositionActions(actions, colors = {}) {
  const lines = [];
  const { green = '', red = '', yellow = '', cyan = '', reset = '' } = colors;

  if (actions.toAdd.length > 0) {
    lines.push(`\n${green}➕ ADD Positions:${reset}`);
    actions.toAdd.forEach((pos) => {
      const direction = getDirection(pos.side);
      lines.push(
        `   ${pos.symbol}: Open ${direction} ${pos.size} @ $${pos.entryPrice.toLocaleString()} (${pos.leverage}x)`
      );
      lines.push(
        `   Required margin: $${((pos.size * pos.entryPrice) / pos.leverage).toFixed(2)}`
      );
    });
  }

  if (actions.toRemove.length > 0) {
    lines.push(`\n${red}🗑️  REMOVE Positions:${reset}`);
    actions.toRemove.forEach((pos) => {
      const direction = getDirection(pos.side);
      lines.push(
        `   ${pos.symbol}: Close ${direction} ${pos.size} @ $${pos.entryPrice.toLocaleString()} (${pos.leverage}x)`
      );
      lines.push(
        `   Will free margin: $${((pos.size * pos.entryPrice) / pos.leverage).toFixed(2)}`
      );
    });
  }

  if (actions.toFlip.length > 0) {
    lines.push(`\n${yellow}🔄 FLIP Positions (Wrong Direction):${reset}`);
    actions.toFlip.forEach(({ current, target }) => {
      const currentDirection = getDirection(current.side);
      const targetDirection = getDirection(target.side);

      lines.push(
        `   ${current.symbol}: Currently ${currentDirection}, need ${targetDirection}`
      );
      lines.push(
        `   Action: Close ${currentDirection} ${current.size} → Open ${targetDirection} ${target.size}`
      );
    });
  }

  if (actions.toAdjust.length > 0) {
    lines.push(`\n${cyan}📊 ADJUST Positions:${reset}`);
    actions.toAdjust.forEach((adj) => {
      const direction = getDirection(adj.side);
      const sign = adj.difference > 0 ? '+' : '';
      lines.push(
        `   ${adj.symbol}: ${adj.action} ${direction} position`
      );
      lines.push(
        `   Current: ${adj.currentSize} → Target: ${adj.targetSize} (${sign}${adj.difference.toFixed(4)})`
      );
    });
  }

  if (
    actions.toAdd.length === 0 &&
    actions.toRemove.length === 0 &&
    actions.toFlip.length === 0 &&
    actions.toAdjust.length === 0
  ) {
    lines.push(`\n${green}✅ No actions needed - positions already in sync!${reset}`);
  }

  return lines;
}

/**
 * Check if positions are in sync
 */
export function arePositionsInSync(actions) {
  return (
    actions.toAdd.length === 0 &&
    actions.toRemove.length === 0 &&
    actions.toFlip.length === 0 &&
    actions.toAdjust.length === 0
  );
}

export { normalizeSide, getDirection };

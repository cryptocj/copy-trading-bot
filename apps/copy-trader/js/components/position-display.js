// ============================================
// POSITION-DISPLAY.JS - Reusable Position Display Component
// ============================================
// Provides both compact and full position table displays with balance info

const MAINTENANCE_MARGIN_RATIO = 0.05; // 5% maintenance margin

/**
 * Create position display with balance info and table
 * @param {Object} options - Configuration options
 * @param {Array} options.positions - Array of position objects
 * @param {Object} options.accountData - Account/balance data
 * @param {string} options.mode - Display mode: 'compact' | 'full'
 * @param {boolean} options.showBalanceInfo - Show balance info section (default: true)
 * @returns {Object} - { balanceHtml, tableHtml, fullHtml }
 */
export function createPositionDisplay(options) {
  const { positions = [], accountData = null, mode = 'compact', showBalanceInfo = true } = options;

  const balanceHtml = showBalanceInfo ? renderBalanceInfo(positions, accountData) : '';
  const tableHtml = renderPositionTable(positions, accountData, mode);

  const fullHtml = balanceHtml + tableHtml;

  return {
    balanceHtml,
    tableHtml,
    fullHtml,
  };
}

/**
 * Render balance info section
 * @param {Array} positions - Array of positions
 * @param {Object} accountData - Account data
 * @returns {string} - Balance info HTML
 */
function renderBalanceInfo(positions, accountData) {
  if (!accountData || !positions) {
    return '';
  }

  // Calculate totals
  const total = parseFloat(accountData.marginSummary?.accountValue || 0);
  const margin = positions.reduce(
    (sum, pos) => sum + (pos.margin || (pos.size * pos.entryPrice) / pos.leverage),
    0
  );
  const available =
    accountData.freeBalance !== undefined ? accountData.freeBalance : total - margin;
  const positionValue = positions.reduce((sum, pos) => sum + pos.size * pos.entryPrice, 0);
  const totalPnl = positions.reduce((sum, pos) => sum + (pos.unrealizedPnl || 0), 0);
  const ratio = total > 0 ? ((margin / total) * 100).toFixed(2) : '0.00';

  // PnL formatting
  const pnlClass = totalPnl >= 0 ? 'text-green-400' : 'text-red-400';
  const pnlSign = totalPnl >= 0 ? '+' : '';

  return `
    <div class="balance-info-row">
      <span>Balance: <span class="balance-total">$${total.toFixed(2)}</span></span>
      <span>Available: <span class="balance-available">$${available.toFixed(2)}</span></span>
      <span>Margin: <span class="balance-margin">$${margin.toFixed(2)}</span></span>
      <span>Position Value: <span class="balance-position-value">$${positionValue.toFixed(2)}</span></span>
      <span>PnL: <span class="${pnlClass}">${pnlSign}$${Math.abs(totalPnl).toFixed(2)}</span></span>
      <span>Ratio: <span class="balance-ratio">${ratio}%</span></span>
    </div>
  `;
}

/**
 * Render position table
 * @param {Array} positions - Array of positions
 * @param {Object} accountData - Account data for calculations
 * @param {string} mode - 'compact' | 'full'
 * @returns {string} - Table HTML
 */
function renderPositionTable(positions, accountData, mode) {
  if (!positions || positions.length === 0) {
    const colspan = mode === 'compact' ? 5 : 13;
    return `
      <div class="positions-table">
        <table>
          <thead>${renderTableHeader(mode)}</thead>
          <tbody>
            <tr><td colspan="${colspan}" class="text-center text-gray-500 py-4">No positions</td></tr>
          </tbody>
        </table>
      </div>
    `;
  }

  const totalBalance = accountData?.marginSummary?.accountValue || null;
  const rowsHtml = positions.map((pos) => renderPositionRow(pos, totalBalance, mode)).join('');

  return `
    <div class="positions-table">
      <table>
        <thead>${renderTableHeader(mode)}</thead>
        <tbody>${rowsHtml}</tbody>
      </table>
    </div>
  `;
}

/**
 * Render table header based on mode
 * @param {string} mode - 'compact' | 'full'
 * @returns {string} - Table header HTML
 */
function renderTableHeader(mode) {
  if (mode === 'compact') {
    return `
      <tr>
        <th>Symbol</th>
        <th>Side</th>
        <th class="text-right">Size</th>
        <th class="text-right">Entry</th>
        <th class="text-right">PnL</th>
      </tr>
    `;
  }

  // Full mode - all 13 columns
  return `
    <tr>
      <th>Symbol</th>
      <th>Side</th>
      <th class="text-right">Size</th>
      <th class="text-right">Entry</th>
      <th class="text-right">PnL</th>
      <th class="text-right">Stop Loss</th>
      <th class="text-right">Take Profit</th>
      <th class="text-right">Liq Price</th>
      <th class="text-right">Leverage</th>
      <th class="text-right">Margin</th>
      <th class="text-right">Position Value</th>
      <th class="text-right">Margin %</th>
      <th class="text-right">Time</th>
    </tr>
  `;
}

/**
 * Render a single position row
 * @param {Object} pos - Position object
 * @param {number} totalBalance - Total account balance for margin % calculation
 * @param {string} mode - 'compact' | 'full'
 * @returns {string} - Table row HTML
 */
function renderPositionRow(pos, totalBalance, mode) {
  // Normalize side
  const side = (pos.side || '').toLowerCase();
  const isLong = side === 'long' || side === 'buy';
  const sideClass = isLong ? 'side-long' : 'side-short';
  const sideText = isLong ? 'LONG' : 'SHORT';

  // Basic position data
  const symbol = pos.symbol || pos.coin || 'UNKNOWN';
  const size = Math.abs(parseFloat(pos.size || pos.szi || pos.qty || 0));
  const entryPrice = parseFloat(pos.entryPrice || pos.entryPx || 0);
  const leverage = parseFloat(pos.leverage || 1);

  // Calculate margin
  const margin = pos.margin !== undefined ? pos.margin : (size * entryPrice) / leverage;

  // PnL formatting
  const pnl = parseFloat(pos.unrealizedPnl || pos.pnl || 0);
  const pnlClass = pnl >= 0 ? 'text-green-400' : 'text-red-400';
  const pnlSign = pnl >= 0 ? '+' : '';

  if (mode === 'compact') {
    return `
      <tr>
        <td class="font-semibold">${symbol}</td>
        <td><span class="${sideClass}">${sideText}</span></td>
        <td class="text-right font-mono">${size.toFixed(4)}</td>
        <td class="text-right font-mono">$${entryPrice.toFixed(2)}</td>
        <td class="text-right font-mono ${pnlClass}">${pnlSign}$${Math.abs(pnl).toFixed(2)}</td>
      </tr>
    `;
  }

  // Full mode - calculate all fields
  const positionValue = size * entryPrice;

  // Calculate liquidation price
  let liquidationPrice = 0;
  if (isLong) {
    liquidationPrice = entryPrice * (1 - MAINTENANCE_MARGIN_RATIO / leverage);
  } else {
    liquidationPrice = entryPrice * (1 + MAINTENANCE_MARGIN_RATIO / leverage);
  }

  // Calculate margin percentage
  let marginPercent = '-';
  if (totalBalance !== null && totalBalance > 0) {
    marginPercent = `${((margin / totalBalance) * 100).toFixed(2)}%`;
  }

  // Format displays
  const stopLossDisplay = pos.stopLoss
    ? `<span class="text-red-400">$${pos.stopLoss.toLocaleString()}</span>`
    : '<span class="text-gray-500">-</span>';
  const takeProfitDisplay = pos.takeProfit
    ? `<span class="text-green-400">$${pos.takeProfit.toLocaleString()}</span>`
    : '<span class="text-gray-500">-</span>';
  const liquidationPriceDisplay =
    liquidationPrice > 0
      ? `<span class="text-orange-400">$${liquidationPrice.toLocaleString()}</span>`
      : '-';

  // Format timestamp
  let timestampDisplay = '-';
  if (pos.timestamp) {
    const posDate = new Date(pos.timestamp);
    if (!Number.isNaN(posDate.getTime())) {
      const year = posDate.getFullYear();
      const month = String(posDate.getMonth() + 1).padStart(2, '0');
      const day = String(posDate.getDate()).padStart(2, '0');
      const hours = String(posDate.getHours()).padStart(2, '0');
      const minutes = String(posDate.getMinutes()).padStart(2, '0');
      const seconds = String(posDate.getSeconds()).padStart(2, '0');
      timestampDisplay = `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
    }
  }

  return `
    <tr>
      <td class="font-semibold">${symbol}</td>
      <td><span class="${sideClass}">${sideText}</span></td>
      <td class="text-right font-mono">${size.toFixed(4)}</td>
      <td class="text-right font-mono">$${entryPrice.toLocaleString()}</td>
      <td class="text-right font-mono ${pnlClass}">${pnlSign}$${Math.abs(pnl).toFixed(2)}</td>
      <td class="text-right font-mono">${stopLossDisplay}</td>
      <td class="text-right font-mono">${takeProfitDisplay}</td>
      <td class="text-right font-mono">${liquidationPriceDisplay}</td>
      <td class="text-right">${leverage.toFixed(1)}x</td>
      <td class="text-right font-mono">$${margin.toFixed(2)}</td>
      <td class="text-right font-mono text-purple-400">$${positionValue.toLocaleString()}</td>
      <td class="text-right font-mono text-blue-400">${marginPercent}</td>
      <td class="text-right text-xs text-gray-500">${timestampDisplay}</td>
    </tr>
  `;
}

/**
 * Helper: Format balance display with proper styling
 * @param {Object} balanceData - Balance data object
 * @returns {Object} - Formatted balance values
 */
export function formatBalanceData(balanceData) {
  const {
    total = 0,
    available = 0,
    margin = 0,
    positionValue = 0,
    pnl = 0,
    ratio = 0,
  } = balanceData;

  return {
    total: `$${total.toFixed(2)}`,
    available: `$${available.toFixed(2)}`,
    margin: `$${margin.toFixed(2)}`,
    positionValue: `$${positionValue.toFixed(2)}`,
    pnl: `${pnl >= 0 ? '+' : ''}$${pnl.toFixed(2)}`,
    pnlClass: pnl >= 0 ? 'positive' : 'negative',
    ratio: `${ratio.toFixed(2)}%`,
  };
}

// ============================================
// UI.JS - User Interface and DOM Manipulation
// ============================================

import { VERSION, BUILD_DATE, MAINTENANCE_MARGIN_RATIO } from './config.js';
import { state } from './state.js';
import { log, clearLog, formatTimestamp } from './utils.js';

// DOM element references
export const elements = {
  traderSelect: document.getElementById('trader-select'),
  traderAddress: document.getElementById('trader-address'),
  traderPlatform: document.getElementById('trader-platform'),
  customAddressContainer: document.getElementById('custom-address-container'),
  moonlanderPrivateKey: document.getElementById('moonlander-private-key'),
  copyBalance: document.getElementById('copy-balance'),
  startButton: document.getElementById('start-button'),
  stopButton: document.getElementById('stop-button'),
  statusDisplay: document.getElementById('status-display'),

  statBalance: document.getElementById('stat-balance'),
  statSyncs: document.getElementById('stat-syncs'),
  statAdded: document.getElementById('stat-added'),
  statRemoved: document.getElementById('stat-removed'),
  statErrors: document.getElementById('stat-errors'),

  traderPositionsBody: document.getElementById('trader-positions-body'),
  userPositionsBody: document.getElementById('user-positions-body'),
  traderPositionCount: document.getElementById('trader-position-count'),
  userPositionCount: document.getElementById('user-position-count'),

  balanceUserTotal: document.getElementById('balance-user-total'),
  balanceUserAvailable: document.getElementById('balance-user-available'),
  balanceUserMargin: document.getElementById('balance-user-margin'),
  balanceUserPositionValue: document.getElementById('balance-user-position-value'),
  balanceUserPnl: document.getElementById('balance-user-pnl'),
  balanceUserFree: document.getElementById('balance-user-free'),
  balanceUserRatio: document.getElementById('balance-user-ratio'),
  balanceTraderTotal: document.getElementById('balance-trader-total'),
  balanceTraderAvailable: document.getElementById('balance-trader-available'),
  balanceTraderMargin: document.getElementById('balance-trader-margin'),
  balanceTraderPositionValue: document.getElementById('balance-trader-position-value'),
  balanceTraderPnl: document.getElementById('balance-trader-pnl'),
  balanceTraderRatio: document.getElementById('balance-trader-ratio'),
  balanceScalingFactor: document.getElementById('balance-scaling-factor'),

  actionHistoryContent: document.getElementById('action-history-content'),
  activityLog: document.getElementById('activity-log'),
  clearLogBtn: document.getElementById('clear-log-btn'),
};

// Initialize version display
export function initializeVersionDisplay() {
  document.getElementById('version-display').textContent = `v${VERSION}`;
  document.title = `Position Sync Monitor v${VERSION}`;
  console.log(`Position Sync Monitor v${VERSION} (${BUILD_DATE})`);
  console.log(`Features: Dynamic safety buffer, size tolerance, embedded balance info`);
}

// Render activity log
export function renderActivityLog() {
  elements.activityLog.innerHTML = state.activityLog
    .map((entry) => {
      const levelClass =
        entry.level === 'error'
          ? 'text-red-400'
          : entry.level === 'warning'
            ? 'text-yellow-400'
            : entry.level === 'success'
              ? 'text-green-400'
              : 'text-gray-300';
      return `<div class="text-sm"><span class="text-gray-500">${entry.timestamp}</span> <span class="${levelClass}">${entry.message}</span></div>`;
    })
    .join('');
}

// Render position row
export function renderPositionRow(pos, totalBalance = null, showPnl = true) {
  const sideClass = pos.side === 'long' || pos.side === 'buy' ? 'side-long' : 'side-short';
  const sideText = pos.side === 'long' || pos.side === 'buy' ? 'LONG' : 'SHORT';
  const isLong = pos.side === 'long' || pos.side === 'buy';

  const margin = pos.margin !== undefined ? pos.margin : (pos.size * pos.entryPrice) / pos.leverage;
  const positionValue = pos.size * pos.entryPrice;

  // Calculate liquidation price
  let liquidationPrice = 0;
  if (isLong) {
    liquidationPrice = pos.entryPrice * (1 - MAINTENANCE_MARGIN_RATIO / pos.leverage);
  } else {
    liquidationPrice = pos.entryPrice * (1 + MAINTENANCE_MARGIN_RATIO / pos.leverage);
  }

  // Calculate margin percentage
  let marginPercent = '-';
  if (totalBalance !== null && totalBalance > 0) {
    marginPercent = ((margin / totalBalance) * 100).toFixed(2) + '%';
  }

  // Format PnL display
  const pnl = pos.unrealizedPnl !== undefined ? pos.unrealizedPnl : 0;
  const pnlClass = pnl >= 0 ? 'text-green-400' : 'text-red-400';
  const pnlSign = pnl >= 0 ? '+' : '-';
  const pnlValue = Math.abs(pnl);
  const pnlDisplay = `<span class="${pnlClass}">${pnlSign}$${pnlValue.toFixed(2)}</span>`;

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
  const positionValueDisplay = `$${positionValue.toLocaleString()}`;

  // Format timestamp
  let timestampDisplay = '-';
  if (pos.timestamp) {
    const posDate = new Date(pos.timestamp);
    if (!isNaN(posDate.getTime())) {
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
            <td class="font-semibold">${pos.symbol}</td>
            <td><span class="${sideClass}">${sideText}</span></td>
            <td class="text-right font-mono">${pos.size.toFixed(4)}</td>
            <td class="text-right font-mono">$${pos.entryPrice.toLocaleString()}</td>
            ${showPnl ? `<td class="text-right font-mono">${pnlDisplay}</td>` : ''}
            <td class="text-right font-mono">${stopLossDisplay}</td>
            <td class="text-right font-mono">${takeProfitDisplay}</td>
            <td class="text-right font-mono">${liquidationPriceDisplay}</td>
            <td class="text-right">${pos.leverage.toFixed(1)}x</td>
            <td class="text-right font-mono">$${margin.toFixed(2)}</td>
            <td class="text-right font-mono text-purple-400">${positionValueDisplay}</td>
            <td class="text-right font-mono text-blue-400">${marginPercent}</td>
            <td class="text-right text-xs text-gray-500">${timestampDisplay}</td>
        </tr>
    `;
}

// Update positions display
export function updatePositions(
  traderPositions,
  userPositions,
  traderAccountData = null,
  userAccountData = null
) {
  const traderTotal = traderAccountData?.marginSummary?.accountValue || null;
  const userTotal = userAccountData?.marginSummary?.accountValue || null;

  // Update trader positions
  if (elements.traderPositionsBody) {
    const traderHtml =
      traderPositions && traderPositions.length > 0
        ? traderPositions.map((pos) => renderPositionRow(pos, traderTotal, true)).join('')
        : '<tr><td colspan="13" class="text-center text-gray-500">No positions</td></tr>';
    elements.traderPositionsBody.innerHTML = traderHtml;
  }

  // Update user positions
  if (elements.userPositionsBody) {
    const userHtml =
      userPositions && userPositions.length > 0
        ? userPositions.map((pos) => renderPositionRow(pos, userTotal, true)).join('')
        : '<tr><td colspan="13" class="text-center text-gray-500">No positions</td></tr>';
    elements.userPositionsBody.innerHTML = userHtml;
  }

  // Update position counts
  if (elements.traderPositionCount)
    elements.traderPositionCount.textContent = traderPositions?.length || 0;
  if (elements.userPositionCount)
    elements.userPositionCount.textContent = userPositions?.length || 0;
}

// Update actions display
export function updateActions(actions = null) {
  const requiredActions = actions || state.requiredActions;

  if (!requiredActions || (requiredActions.toAdd.length === 0 && requiredActions.toRemove.length === 0)) {
    elements.actionsContent.innerHTML = '<div class="text-gray-500 text-center py-4">No actions needed - positions in sync</div>';
    return;
  }

  let actionsHtml = '<div class="space-y-3">';

  // Close actions
  if (requiredActions.toRemove.length > 0) {
    actionsHtml += '<div class="bg-red-900/20 border border-red-700/30 rounded p-3">';
    actionsHtml += `<div class="text-red-400 font-semibold mb-2">🔻 Close Positions (${requiredActions.toRemove.length})</div>`;
    actionsHtml += '<div class="space-y-2">';
    requiredActions.toRemove.forEach(pos => {
      const margin = (pos.size * pos.entryPrice) / (pos.leverage || 10);
      actionsHtml += `
        <div class="bg-dark-800/50 rounded p-2">
          <div class="text-sm text-gray-300 flex justify-between items-center mb-1">
            <span>${pos.symbol} <span class="text-red-400">${pos.side.toUpperCase()}</span> ${pos.size.toFixed(4)}</span>
            <span class="text-gray-500">Margin: $${margin.toFixed(2)}</span>
          </div>
          ${pos.reason ? `<div class="text-xs text-gray-500">💡 ${pos.reason}</div>` : ''}
        </div>
      `;
    });
    actionsHtml += '</div></div>';
  }

  // Open actions
  if (requiredActions.toAdd.length > 0) {
    actionsHtml += '<div class="bg-green-900/20 border border-green-700/30 rounded p-3">';
    actionsHtml += `<div class="text-green-400 font-semibold mb-2">🔺 Open Positions (${requiredActions.toAdd.length})</div>`;
    actionsHtml += '<div class="space-y-2">';
    requiredActions.toAdd.forEach(pos => {
      const margin = (pos.size * pos.entryPrice) / pos.leverage;
      actionsHtml += `
        <div class="bg-dark-800/50 rounded p-2">
          <div class="text-sm text-gray-300 flex justify-between items-center mb-1">
            <span>${pos.symbol} <span class="text-green-400">${pos.side.toUpperCase()}</span> ${pos.size.toFixed(4)}</span>
            <span class="text-gray-500">Margin: $${margin.toFixed(2)} (${pos.leverage}x)</span>
          </div>
          ${pos.reason ? `<div class="text-xs text-gray-500">💡 ${pos.reason}</div>` : ''}
        </div>
      `;
    });
    actionsHtml += '</div></div>';
  }

  actionsHtml += '</div>';
  elements.actionsContent.innerHTML = actionsHtml;
}

// Update action history display
export function updateActionHistory() {
  if (!state.actionHistory || state.actionHistory.length === 0) {
    elements.actionHistoryContent.innerHTML = '<div class="text-center text-gray-500 py-4">No actions executed yet</div>';
    return;
  }

  let historyHtml = '<div class="space-y-2 max-h-96 overflow-y-auto">';

  state.actionHistory.forEach(action => {
    const typeColor = action.type === 'open' ? 'green' : 'red';
    const statusIcon = action.status === 'success' ? '✅' : '❌';
    const margin = action.margin || ((action.size * action.entryPrice) / (action.leverage || 10));
    const time = new Date(action.timestamp).toLocaleTimeString();

    historyHtml += `
      <div class="bg-dark-800 border border-dark-600 rounded p-3">
        <div class="flex justify-between items-start mb-1">
          <div class="flex-1">
            <div class="text-sm font-medium text-${typeColor}-400">
              ${statusIcon} ${action.type.toUpperCase()} ${action.symbol}
            </div>
            <div class="text-xs text-gray-400 mt-1">
              ${action.side.toUpperCase()} ${action.size.toFixed(4)} @ $${action.entryPrice.toLocaleString()} · Margin: $${margin.toFixed(2)}
            </div>
            ${action.reason ? `<div class="text-xs text-gray-500 mt-1">💡 ${action.reason}</div>` : ''}
          </div>
          <div class="text-xs text-gray-500 ml-2 whitespace-nowrap">
            ${time}
          </div>
        </div>
      </div>
    `;
  });

  historyHtml += '</div>';
  elements.actionHistoryContent.innerHTML = historyHtml;
}

// Update balance info display
export function updateBalanceInfo(
  traderAccountData,
  userAccountData,
  traderTotalMargin,
  userBalance,
  dynamicSafetyBuffer,
  scalingFactor,
  userFreeBalance = null,
  traderFreeBalance = null,
  traderPositions = [],
  userPositions = []
) {
  // Trader balance info
  if (traderAccountData) {
    const traderTotal = parseFloat(traderAccountData.marginSummary.accountValue);
    const traderMargin = traderTotalMargin || 0;
    const traderAvailable =
      traderFreeBalance !== null ? traderFreeBalance : traderTotal - traderMargin;
    const traderRatio = traderTotal > 0 ? ((traderMargin / traderTotal) * 100).toFixed(2) : '0.00';

    // Calculate trader total position value and PnL
    const traderPositionValue = traderPositions.reduce(
      (sum, pos) => sum + pos.size * pos.entryPrice,
      0
    );
    const traderTotalPnl = traderPositions.reduce((sum, pos) => sum + (pos.unrealizedPnl || 0), 0);

    if (elements.balanceTraderTotal)
      elements.balanceTraderTotal.textContent = `$${traderTotal.toFixed(2)}`;
    if (elements.balanceTraderAvailable)
      elements.balanceTraderAvailable.textContent = `$${traderAvailable.toFixed(2)}`;
    if (elements.balanceTraderMargin)
      elements.balanceTraderMargin.textContent = `$${traderMargin.toFixed(2)}`;
    if (elements.balanceTraderPositionValue)
      elements.balanceTraderPositionValue.textContent = `$${traderPositionValue.toFixed(2)}`;
    if (elements.balanceTraderRatio) elements.balanceTraderRatio.textContent = `${traderRatio}%`;

    if (elements.balanceTraderPnl) {
      const traderPnlClass = traderTotalPnl >= 0 ? 'text-green-400' : 'text-red-400';
      const traderPnlSign = traderTotalPnl >= 0 ? '+' : '-';
      const traderPnlValue = Math.abs(traderTotalPnl);
      elements.balanceTraderPnl.innerHTML = `<span class="${traderPnlClass}">${traderPnlSign}$${traderPnlValue.toFixed(2)}</span>`;
    }
  }

  // User balance info
  const userTotal = userBalance;
  const userMargin = userPositions.reduce((sum, pos) => sum + pos.margin, 0);
  const userAvailable = userFreeBalance !== null ? userFreeBalance : userTotal - userMargin;
  const userRatio = userTotal > 0 ? ((userMargin / userTotal) * 100).toFixed(2) : '0.00';

  // Calculate user total position value and PnL
  const userPositionValue = userPositions.reduce((sum, pos) => sum + pos.size * pos.entryPrice, 0);
  const userTotalPnl = userPositions.reduce((sum, pos) => sum + (pos.unrealizedPnl || 0), 0);

  if (elements.balanceUserTotal) elements.balanceUserTotal.textContent = `$${userTotal.toFixed(2)}`;
  if (elements.balanceUserAvailable)
    elements.balanceUserAvailable.textContent = `$${userAvailable.toFixed(2)}`;
  if (elements.balanceUserMargin)
    elements.balanceUserMargin.textContent = `$${userMargin.toFixed(2)}`;
  if (elements.balanceUserPositionValue)
    elements.balanceUserPositionValue.textContent = `$${userPositionValue.toFixed(2)}`;
  if (elements.balanceUserRatio) elements.balanceUserRatio.textContent = `${userRatio}%`;
  if (elements.balanceUserFree)
    elements.balanceUserFree.textContent = `$${userAvailable.toFixed(2)}`;

  if (elements.balanceUserPnl) {
    const userPnlClass = userTotalPnl >= 0 ? 'text-green-400' : 'text-red-400';
    const userPnlSign = userTotalPnl >= 0 ? '+' : '-';
    const userPnlValue = Math.abs(userTotalPnl);
    elements.balanceUserPnl.innerHTML = `<span class="${userPnlClass}">${userPnlSign}$${userPnlValue.toFixed(2)}</span>`;
  }

  // Scaling factor
  if (elements.balanceScalingFactor)
    elements.balanceScalingFactor.textContent = `${(scalingFactor * 100).toFixed(2)}%`;
}

// Setup event listeners
export function setupEventListeners(startMonitoringFn, stopMonitoringFn) {
  // Trader selection dropdown
  elements.traderSelect.addEventListener('change', (e) => {
    const selectedValue = e.target.value;
    if (selectedValue === 'custom') {
      elements.customAddressContainer.style.display = 'block';
      elements.traderAddress.value = '';
      elements.traderAddress.required = true;
    } else if (selectedValue) {
      elements.customAddressContainer.style.display = 'none';
      elements.traderAddress.value = selectedValue;
      elements.traderAddress.required = false;
    } else {
      elements.customAddressContainer.style.display = 'none';
      elements.traderAddress.value = '';
      elements.traderAddress.required = true;
    }
  });

  // Start/Stop buttons
  elements.startButton.addEventListener('click', startMonitoringFn);
  elements.stopButton.addEventListener('click', stopMonitoringFn);

  // Clear log button
  elements.clearLogBtn.addEventListener('click', () => {
    clearLog();
    renderActivityLog();
  });
}

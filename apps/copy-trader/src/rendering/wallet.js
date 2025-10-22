/**
 * Wallet rendering module
 * Handles rendering of wallet information, positions, and balances
 */

import { formatNumber, truncateAddress } from '../utils/format.js';
import { validateAddress } from '../services/validation.js';
import { config, monitoringWallets } from '../state/appState.js';
import { STORAGE_KEYS, saveSettings } from '../services/storage.js';
import { fetchWalletInfo, fetchPositions } from '../services/wallet.js';
import { displayValidationError } from '../validation/formValidation.js';

/**
 * Render balance summary for selected wallet in history panel
 * @param {object} elements - DOM element references
 * @param {object} balance - Balance object with free, used, total
 */
export function renderSelectedWalletBalance(elements, balance) {
  // Hide loading and error
  elements.selectedBalanceLoading.style.display = 'none';
  elements.selectedBalanceError.style.display = 'none';

  if (!balance || balance.total === 0) {
    elements.selectedBalanceContent.innerHTML =
      '<p style="text-align:center; padding:20px; color:#666;">No balance information available</p>';
    return;
  }

  // Render balance summary in grid layout
  const balanceHtml = `
    <div style="background-color:#0f1420; padding:20px; border-radius:6px; border:1px solid #2a3550;">
      <div style="display:grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap:20px;">
        <div>
          <div style="color:#888; font-size:0.9em; margin-bottom:5px;">Available</div>
          <div style="color:#e0e0e0; font-size:1.3em; font-weight:600;">$${formatNumber(balance.free, 2)}</div>
        </div>
        <div>
          <div style="color:#888; font-size:0.9em; margin-bottom:5px;">In Use</div>
          <div style="color:#e0e0e0; font-size:1.3em; font-weight:600;">$${formatNumber(balance.used, 2)}</div>
        </div>
        <div>
          <div style="color:#888; font-size:0.9em; margin-bottom:5px;">Total Balance</div>
          <div style="color:#e0e0e0; font-size:1.3em; font-weight:600;">$${formatNumber(balance.total, 2)}</div>
        </div>
      </div>
    </div>
  `;

  elements.selectedBalanceContent.innerHTML = balanceHtml;
}

/**
 * Render positions for selected wallet in history panel (table view)
 * @param {object} elements - DOM element references
 * @param {array} positions - Array of position objects
 */
export function renderSelectedWalletPositions(elements, positions) {
  // Hide loading and error
  elements.selectedPositionsLoading.style.display = 'none';
  elements.selectedPositionsError.style.display = 'none';

  if (!positions || positions.length === 0) {
    elements.selectedPositionsContent.innerHTML =
      '<p style="text-align:center; padding:20px; color:#666;">No open positions</p>';
    return;
  }

  // Calculate totals
  const totalPositionValue = positions.reduce((sum, pos) => sum + pos.size * pos.markPrice, 0);
  const totalUnrealizedPnl = positions.reduce((sum, pos) => sum + pos.unrealizedPnl, 0);

  // Render summary card
  const pnlClass = totalUnrealizedPnl >= 0 ? 'positive' : 'negative';
  const pnlSign = totalUnrealizedPnl >= 0 ? '+' : '';

  const summaryHtml = `
    <div style="background-color:#0f1420; padding:15px; border-radius:6px; margin-bottom:15px; border:1px solid #2a3550;">
      <div style="display:flex; justify-content:space-between; gap:20px;">
        <div>
          <div style="color:#888; font-size:0.9em; margin-bottom:5px;">Total Position Value</div>
          <div style="color:#e0e0e0; font-size:1.3em; font-weight:600;">$${formatNumber(totalPositionValue, 2)}</div>
        </div>
        <div>
          <div style="color:#888; font-size:0.9em; margin-bottom:5px;">Unrealized PnL</div>
          <div class="${pnlClass}" style="font-size:1.3em; font-weight:600;">${pnlSign}$${formatNumber(totalUnrealizedPnl, 2)}</div>
        </div>
      </div>
    </div>
  `;

  // Render positions table
  const tableRowsHtml = positions
    .map((pos) => {
      const sideClass = pos.side === 'long' ? 'buy' : 'sell';
      const pnlClass = pos.unrealizedPnl >= 0 ? 'positive' : 'negative';
      const pnlSign = pos.unrealizedPnl >= 0 ? '+' : '';
      const posValue = pos.size * pos.markPrice;

      return `
        <tr>
          <td>${pos.symbol.replace('/USDC:USDC', '')}</td>
          <td><span class="${sideClass}">${pos.side.toUpperCase()}</span></td>
          <td>${formatNumber(pos.size, 4)}</td>
          <td>$${formatNumber(pos.entryPrice, 2)}</td>
          <td>$${formatNumber(pos.markPrice, 2)}</td>
          <td>$${formatNumber(posValue, 2)}</td>
          <td><span class="balance-value ${pnlClass}">${pnlSign}$${formatNumber(pos.unrealizedPnl, 2)}</span></td>
          <td>${pos.leverage}x</td>
          <td>$${formatNumber(pos.liquidationPrice, 2)}</td>
        </tr>
      `;
    })
    .join('');

  const tableHtml = `
    <div class="table-container">
      <table>
        <thead>
          <tr>
            <th>Symbol</th>
            <th>Side</th>
            <th>Size</th>
            <th>Entry Price</th>
            <th>Mark Price</th>
            <th>Position Value</th>
            <th>Unrealized PnL</th>
            <th>Leverage</th>
            <th>Liquidation</th>
          </tr>
        </thead>
        <tbody>
          ${tableRowsHtml}
        </tbody>
      </table>
    </div>
  `;

  elements.selectedPositionsContent.innerHTML = summaryHtml + tableHtml;
}

/**
 * Render monitoring wallets table (similar to leaderboard)
 * @param {object} elements - DOM element references
 * @param {function} showHistoryPanelFn - Function to show history panel
 * @param {function} checkValidityFn - Function to check form validity
 */
export function renderWalletsTable(elements, showHistoryPanelFn, checkValidityFn) {
  const html = monitoringWallets
    .map((wallet) => {
      const displayAddress = truncateAddress(wallet.address);
      return `
        <tr data-address="${wallet.address}">
          <td>${wallet.label}</td>
          <td title="${wallet.address}">${displayAddress}</td>
        </tr>
      `;
    })
    .join('');

  elements.walletsBody.innerHTML = html;

  // Add row click event (similar to leaderboard selection)
  const rows = elements.walletsBody.querySelectorAll('tr');
  rows.forEach((row) => {
    row.addEventListener('click', async () => {
      console.log('[WALLET CLICK] Event triggered!');

      try {
        // Remove selected class from all wallet rows
        rows.forEach((r) => r.classList.remove('selected'));
        // Add selected class to clicked row
        row.classList.add('selected');

        // Auto-fill trader address
        const address = row.getAttribute('data-address');
        console.log(`[WALLET CLICK] 👆 Wallet selected: ${address}`);

        elements.traderAddressInput.value = address;
        config.traderAddress = address;

        // Load wallet-specific copy balance (if exists)
        const savedCopyBalance = localStorage.getItem(STORAGE_KEYS.getCopyBalanceKey(address));
        if (savedCopyBalance) {
          console.log(`📂 Loading saved copy balance for this wallet: $${savedCopyBalance}`);
          elements.copyBalanceInput.value = savedCopyBalance;
          config.copyBalance = parseFloat(savedCopyBalance);
        } else {
          console.log(
            `⚠️ No saved copy balance for this wallet, keeping current value: $${config.copyBalance}`
          );
        }

        // Trigger validation
        const result = validateAddress(address);
        displayValidationError(elements, 'trader-address', result);
        checkValidityFn();

        // Save settings with wallet-specific configuration
        if (result.valid) {
          console.log(`📝 Auto-saving configuration for selected wallet`);
          saveSettings(config);
        }

        // Load order history (same as leaderboard) - await to catch errors
        console.log(`🔄 Loading history panel for ${address}...`);
        await showHistoryPanelFn(address);
      } catch (error) {
        console.error('Error in wallet row click handler:', error);
        alert(`Failed to load wallet data: ${error.message}`);
      }
    });
  });
}

/**
 * Display your wallet info (balance and positions)
 * @param {object} elements - DOM element references
 * @param {object} balance - Balance object with free, used, total
 * @param {array} positions - Array of position objects
 */
export function displayYourWalletInfo(elements, balance, positions) {
  // Hide loading and error, show content
  elements.yourWalletPlaceholder.style.display = 'none';
  elements.yourWalletLoading.style.display = 'none';
  elements.yourWalletError.style.display = 'none';
  elements.yourWalletContent.style.display = 'block';

  const { free = 0, used = 0, total = 0 } = balance || {};

  // Calculate position value and unrealized PnL
  let totalPositionValue = 0;
  let totalUnrealizedPnl = 0;

  if (positions && positions.length > 0) {
    positions.forEach((pos) => {
      totalPositionValue += Math.abs(pos.notional || 0);
      totalUnrealizedPnl += pos.unrealizedPnl || 0;
    });
  }

  // Update balance elements
  elements.yourBalanceFree.textContent = `$${free.toFixed(2)}`;
  elements.yourBalanceUsed.textContent = `$${used.toFixed(2)}`;
  elements.yourBalanceTotal.textContent = `$${total.toFixed(2)}`;
  elements.yourPositionValue.textContent = `$${totalPositionValue.toFixed(2)}`;

  // Update unrealized PnL with color
  const pnlElement = elements.yourUnrealizedPnl;
  pnlElement.textContent = `$${totalUnrealizedPnl >= 0 ? '+' : ''}${totalUnrealizedPnl.toFixed(2)}`;
  pnlElement.classList.remove('positive', 'negative');
  if (totalUnrealizedPnl > 0) {
    pnlElement.classList.add('positive');
  } else if (totalUnrealizedPnl < 0) {
    pnlElement.classList.add('negative');
  }

  // Render positions
  renderPositions(positions, elements.yourPositionsBody);

  console.log(`Displayed balance and ${positions?.length || 0} positions`);
}

/**
 * Fetch and display your wallet info using exchange API
 * @param {object} elements - DOM element references
 * @param {object} exchange - CCXT exchange instance
 */
export async function fetchAndDisplayYourWallet(elements, exchange) {
  try {
    // Show loading
    elements.yourWalletPlaceholder.style.display = 'none';
    elements.yourWalletLoading.style.display = 'block';
    elements.yourWalletError.style.display = 'none';
    elements.yourWalletContent.style.display = 'none';

    // Fetch wallet info
    const walletInfo = await fetchWalletInfo(exchange);

    // Hide loading, show content
    elements.yourWalletLoading.style.display = 'none';
    elements.yourWalletContent.style.display = 'block';

    // Display balance
    elements.yourBalanceFree.textContent = `$${formatNumber(walletInfo.balance.free, 2)}`;
    elements.yourBalanceUsed.textContent = `$${formatNumber(walletInfo.balance.used, 2)}`;
    elements.yourBalanceTotal.textContent = `$${formatNumber(walletInfo.balance.total, 2)}`;
    elements.yourPositionValue.textContent = `$${formatNumber(walletInfo.totalPositionValue, 2)}`;

    // Display unrealized PnL with color
    const pnlElement = elements.yourUnrealizedPnl;
    const pnl = walletInfo.totalUnrealizedPnl;
    pnlElement.textContent = `${pnl >= 0 ? '+' : ''}$${formatNumber(pnl, 2)}`;
    pnlElement.classList.remove('positive', 'negative');
    pnlElement.classList.add(pnl >= 0 ? 'positive' : 'negative');

    // Render positions
    renderPositions(walletInfo.positions, elements.yourPositionsBody);

    console.log('Your wallet info displayed successfully');
  } catch (error) {
    console.error('Failed to fetch your wallet info:', error);
    elements.yourWalletLoading.style.display = 'none';
    elements.yourWalletError.style.display = 'block';
    elements.yourWalletError.textContent = `Failed to load: ${error.message}`;
  }
}

/**
 * Render positions table (for Your Wallet section)
 * @param {array} positions - Array of position objects
 * @param {HTMLElement} container - Container element for positions table
 */
export function renderPositions(positions, container) {
  if (!positions || positions.length === 0) {
    container.innerHTML =
      '<p style="text-align:center; padding:20px; color:#666;">No open positions</p>';
    return;
  }

  const tableRowsHtml = positions
    .map((pos) => {
      const sideClass = pos.side === 'long' ? 'buy' : 'sell';
      const pnlClass = pos.unrealizedPnl >= 0 ? 'positive' : 'negative';
      const pnlSign = pos.unrealizedPnl >= 0 ? '+' : '';
      const posValue = pos.size * pos.markPrice;

      return `
        <tr>
          <td>${pos.symbol.replace('/USDC:USDC', '')}</td>
          <td><span class="${sideClass}">${pos.side.toUpperCase()}</span></td>
          <td>${formatNumber(pos.size, 4)}</td>
          <td>$${formatNumber(pos.entryPrice, 2)}</td>
          <td>$${formatNumber(pos.markPrice, 2)}</td>
          <td>$${formatNumber(posValue, 2)}</td>
          <td><span class="balance-value ${pnlClass}">${pnlSign}$${formatNumber(pos.unrealizedPnl, 2)}</span></td>
          <td>${pos.leverage}x</td>
          <td>$${formatNumber(pos.liquidationPrice, 2)}</td>
        </tr>
      `;
    })
    .join('');

  const tableHtml = `
    <div class="table-container">
      <table>
        <thead>
          <tr>
            <th>Symbol</th>
            <th>Side</th>
            <th>Size</th>
            <th>Entry Price</th>
            <th>Mark Price</th>
            <th>Position Value</th>
            <th>Unrealized PnL</th>
            <th>Leverage</th>
            <th>Liquidation</th>
          </tr>
        </thead>
        <tbody>
          ${tableRowsHtml}
        </tbody>
      </table>
    </div>
  `;

  container.innerHTML = tableHtml;
}

/**
 * Fetch balance for a specific address using direct API
 * @param {string} address - Wallet address
 * @returns {Promise<object>} Balance object with free, used, total
 */
export async function fetchBalanceForAddress(address) {
  try {
    console.log(`[fetchBalance] Querying balance for ${address}`);

    // Use Hyperliquid direct API
    const response = await fetch('https://api.hyperliquid.xyz/info', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: 'clearinghouseState',
        user: address,
      }),
    });

    if (!response.ok) {
      throw new Error(`Hyperliquid API error: ${response.status}`);
    }

    const data = await response.json();
    console.log(`[fetchBalance] Full API response:`, JSON.stringify(data, null, 2));

    // Extract balance from marginSummary
    const marginSummary = data.marginSummary || {};
    const crossMarginSummary = data.crossMarginSummary || {};
    console.log(`[fetchBalance] marginSummary:`, marginSummary);
    console.log(`[fetchBalance] crossMarginSummary:`, crossMarginSummary);

    const accountValue = parseFloat(marginSummary.accountValue || 0);
    const totalMarginUsed = parseFloat(marginSummary.totalMarginUsed || 0);
    const withdrawable = parseFloat(data.withdrawable || 0);
    const crossMargin = parseFloat(crossMarginSummary.totalRawUsd || 0);

    // Hyperliquid balance calculation (works for both isolated and cross margin):
    // - Total: accountValue = isolated position margins + cross margin + unrealized PnL
    // - In Use: totalMarginUsed = margin locked in all open positions
    // - Available: withdrawable = free balance you can withdraw or use for new positions
    //
    // Note: For isolated margin accounts, totalRawUsd in marginSummary can be negative
    // because funds are allocated to isolated position margins, not in cross margin pool
    const balance = {
      total: accountValue,
      used: totalMarginUsed,
      free: withdrawable,
      accountValue: accountValue,
      withdrawable: withdrawable,
      crossMargin: crossMargin,
      assets: {
        USDC: {
          total: accountValue,
          used: totalMarginUsed,
          free: withdrawable,
        },
      },
    };

    console.log(`[fetchBalance] Calculated balance:`, balance);
    return balance;
  } catch (error) {
    console.error('[fetchBalance] Failed to fetch balance:', error);
    return { total: 0, free: 0, used: 0, assets: {} };
  }
}

/**
 * Fetch positions for a specific address
 * @param {string} address - Wallet address
 * @returns {Promise<array>} Array of position objects
 */
export async function fetchPositionsForAddress(address) {
  try {
    // fetchPositions from wallet.js uses direct API when userAddress is provided
    const positions = await fetchPositions(null, address);
    return positions;
  } catch (error) {
    console.error('Failed to fetch positions for address:', error);
    return [];
  }
}

/**
 * DOM element references
 * Centralized management of all DOM element references for the application
 */

/**
 * Initialize and cache all DOM element references
 * Must be called after DOM is loaded
 * @returns {object} Object containing all cached DOM element references
 */
export function initializeElements() {
  return {
    // Form inputs
    traderAddressInput: document.getElementById('trader-address'),
    apiKeyInput: document.getElementById('api-key'),
    copyBalanceInput: document.getElementById('copy-balance'),

    // Validation errors
    traderAddressError: document.getElementById('trader-address-error'),
    apiKeyError: document.getElementById('api-key-error'),
    copyBalanceError: document.getElementById('copy-balance-error'),

    // Buttons and controls
    testCalculationButton: document.getElementById('test-calculation-button'),
    startButton: document.getElementById('start-button'),
    stopButton: document.getElementById('stop-button'),
    calculationTestResults: document.getElementById('calculation-test-results'),
    loadCustomWalletButton: document.getElementById('load-custom-wallet-button'),
    customWalletAddress: document.getElementById('custom-wallet-address'),
    loadMyWalletButton: document.getElementById('load-my-wallet-button'),
    myWalletAddress: document.getElementById('my-wallet-address'),
    dryRunModeCheckbox: document.getElementById('dry-run-mode'),
    useLatestPriceCheckbox: document.getElementById('use-latest-price'),

    // Orders
    ordersBody: document.getElementById('orders-body'),

    // Collapsible sections
    walletsToggle: document.getElementById('wallets-toggle'),
    walletsContent: document.getElementById('wallets-content'),
    historyToggle: document.getElementById('history-toggle'),
    historyContentWrapper: document.getElementById('history-content-wrapper'),

    // Trade History Panel
    historyPlaceholder: document.getElementById('history-placeholder'),
    historyLoading: document.getElementById('history-loading'),
    historyError: document.getElementById('history-error'),
    historyContent: document.getElementById('history-content'),
    historyAddress: document.getElementById('history-address'),
    historyBody: document.getElementById('history-body'),

    // Selected Wallet Positions (in history panel)
    selectedPositionsSection: document.getElementById('selected-positions-section'),
    selectedPositionsLoading: document.getElementById('selected-positions-loading'),
    selectedPositionsError: document.getElementById('selected-positions-error'),
    selectedPositionsContent: document.getElementById('selected-positions-content'),

    // Selected Wallet Balance (in history panel)
    selectedBalanceSection: document.getElementById('selected-balance-section'),
    selectedBalanceLoading: document.getElementById('selected-balance-loading'),
    selectedBalanceError: document.getElementById('selected-balance-error'),
    selectedBalanceContent: document.getElementById('selected-balance-content'),

    // Monitoring Wallets
    walletsBody: document.getElementById('wallets-body'),

    // Wallet Info
    refreshWalletButton: document.getElementById('refresh-wallet-button'),

    // Your Wallet
    yourWalletPlaceholder: document.getElementById('your-wallet-placeholder'),
    yourWalletLoading: document.getElementById('your-wallet-loading'),
    yourWalletError: document.getElementById('your-wallet-error'),
    yourWalletContent: document.getElementById('your-wallet-content'),
    yourBalanceFree: document.getElementById('your-balance-free'),
    yourBalanceUsed: document.getElementById('your-balance-used'),
    yourBalanceTotal: document.getElementById('your-balance-total'),
    yourPositionValue: document.getElementById('your-position-value'),
    yourUnrealizedPnl: document.getElementById('your-unrealized-pnl'),
    yourPositionsBody: document.getElementById('your-positions-body'),

    // Monitored Wallet
    monitoredWalletPlaceholder: document.getElementById('monitored-wallet-placeholder'),
    monitoredWalletLoading: document.getElementById('monitored-wallet-loading'),
    monitoredWalletError: document.getElementById('monitored-wallet-error'),
    monitoredWalletContent: document.getElementById('monitored-wallet-content'),
    monitoredWalletAddress: document.getElementById('monitored-wallet-address'),
    monitoredBalanceFree: document.getElementById('monitored-balance-free'),
    monitoredBalanceUsed: document.getElementById('monitored-balance-used'),
    monitoredBalanceTotal: document.getElementById('monitored-balance-total'),
    monitoredPositionValue: document.getElementById('monitored-position-value'),
    monitoredUnrealizedPnl: document.getElementById('monitored-unrealized-pnl'),
    monitoredPositionsBody: document.getElementById('monitored-positions-body'),
  };
}

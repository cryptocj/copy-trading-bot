/**
 * Main entry point for Hyperliquid Copy Trading app
 * Initializes UI, handles events, coordinates services
 */

// Import CCXT library from CDN (browser-compatible)
import ccxt from 'https://cdn.jsdelivr.net/npm/ccxt@4.3.66/dist/ccxt.browser.js';

// Import services and utilities
import { validateAddress, validateApiKey, validateTradeValue, validateLeverage } from './services/validation.js';
import { formatNumber, formatPercentage, formatTimestamp, truncateAddress } from './utils/format.js';
import { fetchLeaderboard, renderLeaderboardTable, showLeaderboardError, hideLeaderboardError } from './services/leaderboard.js';
import { startCopyTrading as startTradingService, stopCopyTrading as stopTradingService } from './services/trading.js';

// Global state
let config = {
    traderAddress: '',
    userApiKey: '',
    tradeValue: 0,
    maxLeverage: 1
};

let isCopyTradingActive = false;
let orderList = []; // Max 6 orders (FIFO)
let leaderboardTraders = [];

// DOM elements (will be initialized after DOM loads)
let elements = {};

/**
 * Initialize app when DOM is ready
 */
document.addEventListener('DOMContentLoaded', () => {
    console.log('Initializing Hyperliquid Copy Trading app...');

    // Cache DOM elements
    elements = {
        // Leaderboard
        leaderboardBody: document.getElementById('leaderboard-body'),
        leaderboardError: document.getElementById('leaderboard-error'),

        // Form inputs
        traderAddressInput: document.getElementById('trader-address'),
        apiKeyInput: document.getElementById('api-key'),
        tradeValueInput: document.getElementById('trade-value'),
        maxLeverageInput: document.getElementById('max-leverage'),

        // Validation errors
        traderAddressError: document.getElementById('trader-address-error'),
        apiKeyError: document.getElementById('api-key-error'),
        tradeValueError: document.getElementById('trade-value-error'),
        maxLeverageError: document.getElementById('max-leverage-error'),

        // Buttons
        startButton: document.getElementById('start-button'),
        stopButton: document.getElementById('stop-button'),

        // Orders
        ordersBody: document.getElementById('orders-body')
    };

    // Initialize validation listeners
    setupValidationListeners();

    // Initialize button listeners
    setupButtonListeners();

    // Load leaderboard on page load (US1)
    loadLeaderboard();

    console.log('App initialized successfully.');
});

/**
 * Setup validation listeners for all form inputs
 */
function setupValidationListeners() {
    // Trader address validation
    elements.traderAddressInput.addEventListener('blur', () => {
        const result = validateAddress(elements.traderAddressInput.value);
        displayValidationError('trader-address', result);
        if (result.valid) {
            config.traderAddress = result.address;
        }
        checkFormValidity();
    });

    // API key validation
    elements.apiKeyInput.addEventListener('blur', () => {
        const result = validateApiKey(elements.apiKeyInput.value);
        displayValidationError('api-key', result);
        if (result.valid) {
            config.userApiKey = result.key;
        }
        checkFormValidity();
    });

    // Trade value validation
    elements.tradeValueInput.addEventListener('blur', () => {
        const result = validateTradeValue(elements.tradeValueInput.value);
        displayValidationError('trade-value', result);
        if (result.valid) {
            config.tradeValue = result.value;
        }
        checkFormValidity();
    });

    // Max leverage validation
    elements.maxLeverageInput.addEventListener('blur', () => {
        const result = validateLeverage(elements.maxLeverageInput.value);
        displayValidationError('max-leverage', result);
        if (result.valid) {
            config.maxLeverage = result.leverage;
        }
        checkFormValidity();
    });
}

/**
 * Display validation error message for a field
 * @param {string} fieldId - Field identifier (without '-error' suffix)
 * @param {{ valid: boolean, error?: string }} result - Validation result
 */
function displayValidationError(fieldId, result) {
    const errorElement = elements[`${fieldId}Error`];
    if (!errorElement) return;

    if (result.valid) {
        errorElement.textContent = '';
    } else {
        errorElement.textContent = result.error || 'Invalid input';
    }
}

/**
 * Check if all form fields are valid and enable/disable Start button
 */
function checkFormValidity() {
    const addressValid = validateAddress(elements.traderAddressInput.value).valid;
    const apiKeyValid = validateApiKey(elements.apiKeyInput.value).valid;
    const tradeValueValid = validateTradeValue(elements.tradeValueInput.value).valid;
    const leverageValid = validateLeverage(elements.maxLeverageInput.value).valid;

    const allValid = addressValid && apiKeyValid && tradeValueValid && leverageValid;

    // Enable Start button only if all fields valid and not currently active
    elements.startButton.disabled = !allValid || isCopyTradingActive;
}

/**
 * Setup button click listeners
 */
function setupButtonListeners() {
    elements.startButton.addEventListener('click', startCopyTrading);
    elements.stopButton.addEventListener('click', stopCopyTrading);
}

/**
 * Load leaderboard data and render table (US1)
 */
async function loadLeaderboard() {
    console.log('Loading leaderboard...');

    try {
        const traders = await fetchLeaderboard();

        if (traders.length === 0) {
            showLeaderboardError(
                elements.leaderboardError,
                'Failed to load leaderboard. You can still enter a trader address manually below.'
            );
        } else {
            hideLeaderboardError(elements.leaderboardError);
        }

        // Store traders in global state
        leaderboardTraders.length = 0;
        leaderboardTraders.push(...traders);

        // Render table with click handler
        renderLeaderboardTable(traders, elements.leaderboardBody, handleTraderSelect);

        console.log(`Leaderboard loaded: ${traders.length} traders`);
    } catch (error) {
        console.error('Error loading leaderboard:', error);
        showLeaderboardError(
            elements.leaderboardError,
            'Failed to load leaderboard. You can still enter a trader address manually below.'
        );
    }
}

/**
 * Handle trader selection from leaderboard (US1)
 * @param {string} address - Selected trader's wallet address
 */
function handleTraderSelect(address) {
    console.log('Trader selected:', address);

    // Auto-fill trader address input
    elements.traderAddressInput.value = address;

    // Trigger validation
    const result = validateAddress(address);
    displayValidationError('trader-address', result);
    if (result.valid) {
        config.traderAddress = result.address;
    }

    // Check form validity to enable/disable Start button
    checkFormValidity();
}

/**
 * Enable or disable all form inputs
 * @param {boolean} disabled - Whether to disable inputs
 */
function setFormDisabled(disabled) {
    elements.traderAddressInput.disabled = disabled;
    elements.apiKeyInput.disabled = disabled;
    elements.tradeValueInput.disabled = disabled;
    elements.maxLeverageInput.disabled = disabled;
}

/**
 * Start copy trading (US2/US3)
 */
async function startCopyTrading() {
    console.log('Starting copy trading...', config);

    try {
        // Update UI state
        isCopyTradingActive = true;
        elements.startButton.disabled = true;
        elements.stopButton.disabled = false;
        setFormDisabled(true);

        // Start trading service with order callback (US3 + US4 integration)
        await startTradingService(config, (order) => {
            addOrder(order); // Add order to display list (US4)
        });

        console.log('Copy trading started successfully');
    } catch (error) {
        console.error('Failed to start copy trading:', error);

        // Revert UI state on error
        isCopyTradingActive = false;
        elements.startButton.disabled = false;
        elements.stopButton.disabled = true;
        setFormDisabled(false);

        alert('Failed to start copy trading. Check console for details.');
    }
}

/**
 * Stop copy trading (US2/US3)
 */
async function stopCopyTrading() {
    console.log('Stopping copy trading...');

    try {
        // Stop trading service (closes WebSocket connections)
        await stopTradingService();

        // Update UI state
        isCopyTradingActive = false;
        elements.startButton.disabled = false;
        elements.stopButton.disabled = true;
        setFormDisabled(false);

        // Re-enable form validation
        checkFormValidity();

        console.log('Copy trading stopped successfully');
    } catch (error) {
        console.error('Error stopping copy trading:', error);

        // Update UI state anyway
        isCopyTradingActive = false;
        elements.startButton.disabled = false;
        elements.stopButton.disabled = true;
        setFormDisabled(false);
        checkFormValidity();
    }
}

/**
 * Add order to display list (US4)
 * FIFO: max 6 orders, remove oldest when exceeding
 * @param {{ symbol: string, side: string, amount: number, price: number, timestamp: number }} order
 */
function addOrder(order) {
    orderList.unshift(order); // Add to front
    if (orderList.length > 6) {
        orderList.pop(); // Remove oldest
    }
    renderOrderList();
}

/**
 * Render order list in UI (US4)
 */
function renderOrderList() {
    if (orderList.length === 0) {
        elements.ordersBody.innerHTML = '';
        return;
    }

    const html = orderList.map(order => `
        <tr>
            <td>${order.symbol}</td>
            <td class="${order.side}">${order.side.toUpperCase()}</td>
            <td>${formatNumber(order.amount, 6)}</td>
            <td>$${formatNumber(order.price, 2)}</td>
            <td>${formatTimestamp(order.timestamp)}</td>
        </tr>
    `).join('');

    elements.ordersBody.innerHTML = html;
}

// Export functions for use in other modules
export {
    config,
    isCopyTradingActive,
    orderList,
    leaderboardTraders,
    elements,
    addOrder,
    renderOrderList,
    setFormDisabled,
    checkFormValidity
};

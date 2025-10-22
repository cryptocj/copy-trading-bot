/**
 * Form validation module
 * Handles validation logic, error display, and form validity checking
 */

import { validateAddress, validateApiKey, validateCopyBalance } from '../services/validation.js';
import { config, isCopyTradingActive } from '../state/appState.js';
import { saveSettings } from '../services/storage.js';
import { setDryRunMode } from '../services/trading.js';
import { updateSessionConfig } from '../services/sessionPersistence.js';

/**
 * Setup all validation listeners for form inputs and controls
 * @param {object} elements - DOM element references
 * @param {function} checkFormValidityFn - Function to check overall form validity
 */
export function setupValidationListeners(elements, checkFormValidityFn) {
  // Save API key checkbox listener
  const saveApiKeyCheckbox = document.getElementById('save-api-key');
  if (saveApiKeyCheckbox) {
    saveApiKeyCheckbox.addEventListener('change', () => {
      saveSettings(config); // Update storage when checkbox changes
      if (!saveApiKeyCheckbox.checked) {
        console.log('API key will not be saved (more secure)');
      } else {
        console.log('API key will be saved in localStorage (less secure)');
      }
    });
  }

  // Dry-run mode checkbox listener
  if (elements.dryRunModeCheckbox) {
    elements.dryRunModeCheckbox.addEventListener('change', () => {
      const enabled = elements.dryRunModeCheckbox.checked;
      setDryRunMode(enabled);
      config.isDryRun = enabled; // Save to config for session persistence
      console.log('[DryRunCheckbox] Changed to:', enabled, 'config.isDryRun:', config.isDryRun);
      saveSettings(config); // Persist to localStorage
      console.log('[DryRunCheckbox] Settings saved, localStorage:', localStorage.getItem('copyTrading.settings'));

      // If copy trading is active, update the session state too
      if (isCopyTradingActive) {
        updateSessionConfig(config.traderAddress, { isDryRun: enabled });
      }

      // Update button text to indicate mode
      const startButtonText = enabled
        ? 'Start Copy Trading (DRY RUN)'
        : 'Start Copy Trading (LIVE)';
      elements.startButton.textContent = startButtonText;

      console.log(`🧪 Dry-run mode ${enabled ? 'enabled' : 'disabled'} - orders will ${enabled ? 'NOT' : ''} be placed on exchange`);
    });

    // Set initial mode based on checkbox state
    setDryRunMode(elements.dryRunModeCheckbox.checked);
    config.isDryRun = elements.dryRunModeCheckbox.checked; // Save to config
    const initialButtonText = elements.dryRunModeCheckbox.checked
      ? 'Start Copy Trading (DRY RUN)'
      : 'Start Copy Trading (LIVE)';
    elements.startButton.textContent = initialButtonText;
  }

  // Use latest price checkbox listener
  if (elements.useLatestPriceCheckbox) {
    elements.useLatestPriceCheckbox.addEventListener('change', () => {
      config.useLatestPrice = elements.useLatestPriceCheckbox.checked;
      saveSettings(config); // Persist to localStorage

      // If copy trading is active, update the session state too
      if (isCopyTradingActive) {
        updateSessionConfig(config.traderAddress, { useLatestPrice: config.useLatestPrice });
      }

      console.log(`📊 Use latest price: ${config.useLatestPrice ? 'enabled' : 'disabled'} - initial positions will use ${config.useLatestPrice ? 'current market price with tick offset' : "trader's entry price"}`);
    });

    // Set initial state
    config.useLatestPrice = elements.useLatestPriceCheckbox.checked;
  }

  // Trader address validation
  elements.traderAddressInput.addEventListener('blur', () => {
    const result = validateAddress(elements.traderAddressInput.value);
    displayValidationError(elements, 'trader-address', result);
    if (result.valid) {
      config.traderAddress = result.address;
      saveSettings(config); // Auto-save on valid input
    }
    checkFormValidityFn();
  });

  // API key validation
  elements.apiKeyInput.addEventListener('blur', () => {
    const result = validateApiKey(elements.apiKeyInput.value);
    displayValidationError(elements, 'api-key', result);
    if (result.valid) {
      config.userApiKey = result.key;
      saveSettings(config); // Auto-save on valid input
    }
    checkFormValidityFn();
  });

  // Trade value validation
  elements.copyBalanceInput.addEventListener('blur', () => {
    const result = validateCopyBalance(elements.copyBalanceInput.value);
    displayValidationError(elements, 'copy-balance', result);
    if (result.valid) {
      config.copyBalance = result.balance;
      saveSettings(config); // Auto-save on valid input
    }
    checkFormValidityFn();
  });
}

/**
 * Display validation error message for a field
 * @param {object} elements - DOM element references
 * @param {string} fieldId - Field identifier (without '-error' suffix)
 * @param {{ valid: boolean, error?: string }} result - Validation result
 */
export function displayValidationError(elements, fieldId, result) {
  const errorElement = elements[`${fieldId}Error`];
  if (!errorElement) return;

  if (result.valid) {
    errorElement.textContent = '';
  } else {
    errorElement.textContent = result.error || 'Invalid input';
  }
}

/**
 * Check if all form fields are valid and enable/disable buttons
 * @param {object} elements - DOM element references
 * @param {boolean} isCopyTradingActive - Whether copy trading is currently active
 */
export function checkFormValidity(elements, isCopyTradingActive) {
  const addressValid = validateAddress(elements.traderAddressInput.value).valid;
  const apiKeyValid = validateApiKey(elements.apiKeyInput.value).valid;
  const copyBalanceValid = validateCopyBalance(elements.copyBalanceInput.value).valid;

  const allValid = addressValid && apiKeyValid && copyBalanceValid;

  // Enable Start button only if all fields valid and not currently active
  elements.startButton.disabled = !allValid || isCopyTradingActive;
}

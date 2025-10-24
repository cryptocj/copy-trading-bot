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
  // Save Hyperliquid API key checkbox listener
  if (elements.saveHyperliquidApiKeyCheckbox) {
    elements.saveHyperliquidApiKeyCheckbox.addEventListener('change', () => {
      saveSettings(config); // Update storage when checkbox changes
      if (!elements.saveHyperliquidApiKeyCheckbox.checked) {
        console.log('Hyperliquid API key will not be saved (more secure)');
      } else {
        console.log('Hyperliquid API key will be saved in localStorage (less secure)');
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

  // Hyperliquid API key validation
  if (elements.hyperliquidApiKeyInput) {
    elements.hyperliquidApiKeyInput.addEventListener('blur', () => {
      const result = validateApiKey(elements.hyperliquidApiKeyInput.value);
      displayValidationError(elements, 'hyperliquid-api-key', result);
      if (result.valid) {
        config.hyperliquidApiKey = result.key;
        saveSettings(config); // Auto-save on valid input
      }
      checkFormValidityFn();
    });
  }

  // Monitoring API key validation (for Moonlander mode)
  if (elements.monitoringApiKeyInput) {
    elements.monitoringApiKeyInput.addEventListener('blur', () => {
      const result = validateApiKey(elements.monitoringApiKeyInput.value);
      displayValidationError(elements, 'monitoring-api-key', result);
      if (result.valid) {
        config.monitoringApiKey = result.key;
        saveSettings(config); // Auto-save on valid input
      }
      checkFormValidityFn();
    });
  }

  // Moonlander private key validation
  if (elements.moonlanderPrivateKeyInput) {
    elements.moonlanderPrivateKeyInput.addEventListener('blur', () => {
      const result = validateApiKey(elements.moonlanderPrivateKeyInput.value);
      displayValidationError(elements, 'moonlander-private-key', result);
      if (result.valid) {
        config.moonlander.privateKey = result.key;
        saveSettings(config); // Auto-save on valid input
      }
      checkFormValidityFn();
    });
  }

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

  // Check the correct API key based on platform
  const platform = elements.executionPlatformSelect?.value || 'hyperliquid';
  let apiKeyValid = false;
  let moonlanderPrivateKeyValid = true; // Only required when Moonlander is selected

  if (platform === 'moonlander') {
    // For Moonlander, we need both monitoring API key AND Moonlander private key
    const monitoringKeyValid = validateApiKey(elements.monitoringApiKeyInput?.value || '').valid;
    moonlanderPrivateKeyValid = validateApiKey(elements.moonlanderPrivateKeyInput?.value || '').valid;
    apiKeyValid = monitoringKeyValid && moonlanderPrivateKeyValid;
  } else {
    // For Hyperliquid, we need Hyperliquid API key
    apiKeyValid = validateApiKey(elements.hyperliquidApiKeyInput?.value || '').valid;
  }

  const copyBalanceValid = validateCopyBalance(elements.copyBalanceInput.value).valid;

  const allValid = addressValid && apiKeyValid && copyBalanceValid;

  // Enable Start button only if all fields valid and not currently active
  elements.startButton.disabled = !allValid || isCopyTradingActive;
}

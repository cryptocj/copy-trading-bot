/**
 * Input validation functions for copy trading configuration
 * All validators return { valid: boolean, error?: string, value?: any }
 */

/**
 * Validate Ethereum wallet address (40 hex characters)
 * @param {string} address - Raw address input (with or without 0x prefix)
 * @returns {{ valid: boolean, error?: string, address?: string }}
 */
export function validateAddress(address) {
    if (!address || typeof address !== 'string') {
        return { valid: false, error: 'Address is required' };
    }

    // Remove 0x prefix if present and convert to lowercase
    const cleanAddress = address.toLowerCase().replace(/^0x/, '');

    // Check exactly 40 hex characters
    if (!/^[0-9a-f]{40}$/.test(cleanAddress)) {
        return { valid: false, error: 'Invalid address format (40 hex characters)' };
    }

    return { valid: true, address: '0x' + cleanAddress };
}

/**
 * Validate Hyperliquid API key (64 hex characters)
 * @param {string} key - Raw API key input (with or without 0x prefix)
 * @returns {{ valid: boolean, error?: string, key?: string }}
 */
export function validateApiKey(key) {
    if (!key || typeof key !== 'string') {
        return { valid: false, error: 'API key is required' };
    }

    // Remove 0x prefix if present and convert to lowercase
    const cleanKey = key.toLowerCase().replace(/^0x/, '');

    // Check exactly 64 hex characters
    if (!/^[0-9a-f]{64}$/.test(cleanKey)) {
        return { valid: false, error: 'Invalid API key format (64 hex characters)' };
    }

    return { valid: true, key: '0x' + cleanKey };
}

/**
 * Validate trade value (minimum $12 USDC per spec FR-008)
 * @param {string|number} value - Trade value input
 * @returns {{ valid: boolean, error?: string, value?: number }}
 */
export function validateTradeValue(value) {
    const num = parseFloat(value);

    if (isNaN(num)) {
        return { valid: false, error: 'Trade value must be a number' };
    }

    if (num < 12) {
        return { valid: false, error: 'Minimum trade value is $12 USDC' };
    }

    return { valid: true, value: num };
}

/**
 * Validate leverage (1-50x per spec FR-009)
 * @param {string|number} leverage - Leverage input
 * @returns {{ valid: boolean, error?: string, leverage?: number }}
 */
export function validateLeverage(leverage) {
    const num = parseInt(leverage);

    if (isNaN(num)) {
        return { valid: false, error: 'Leverage must be a number' };
    }

    if (num < 1 || num > 50) {
        return { valid: false, error: 'Leverage must be between 1x and 50x' };
    }

    return { valid: true, leverage: num };
}

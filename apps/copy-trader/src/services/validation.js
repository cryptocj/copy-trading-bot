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
 * Validate copy balance (minimum $50)
 * Replaces per-position trade value and leverage with total balance for copying
 * @param {string|number} balance - Copy balance input
 * @returns {{ valid: boolean, error?: string, balance?: number }}
 */
export function validateCopyBalance(balance) {
    const num = parseFloat(balance);

    if (isNaN(num)) {
        return { valid: false, error: 'Copy balance must be a number' };
    }

    if (num < 50) {
        return { valid: false, error: 'Minimum copy balance is $50' };
    }

    // Check reasonable maximum (e.g., $1,000,000)
    if (num > 1000000) {
        return { valid: false, error: 'Maximum copy balance is $1,000,000' };
    }

    return { valid: true, balance: num };
}

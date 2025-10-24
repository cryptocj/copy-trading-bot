/**
 * Application Configuration
 *
 * IMPORTANT: For GitHub Pages deployment
 * - This file is committed to git
 * - DO NOT put private keys or sensitive data here
 * - Private keys should ONLY be entered via the UI (never in code)
 */

import { MOONLANDER_MAINNET, MOONLANDER_TESTNET } from './moonlander.js';

/**
 * Moonlander configuration
 * Public settings only - private keys come from user input
 */
export const moonlanderConfig = {
  // Default network (testnet is safer for initial deployment)
  defaultNetwork: 'testnet',

  // Network configurations (from moonlander.js)
  networks: {
    testnet: MOONLANDER_TESTNET,
    mainnet: MOONLANDER_MAINNET,
  },
};

/**
 * Get Moonlander configuration for selected network
 * @param {string} network - 'testnet' or 'mainnet'
 * @param {string} privateKey - User's private key (from UI input)
 * @returns {object} Complete configuration
 */
export function getMoonlanderConfigForNetwork(network, privateKey) {
  const baseConfig = moonlanderConfig.networks[network] || moonlanderConfig.networks.testnet;

  return {
    ...baseConfig,
    privateKey: privateKey || '',
  };
}

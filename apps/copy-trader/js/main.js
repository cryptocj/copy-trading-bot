// ============================================
// MAIN.JS - Application Entry Point
// ============================================

// Import all modules
import { VERSION, BUILD_DATE } from './config.js';
import { MOONLANDER_CONFIG } from './moonlander-config.js';
import { state, updateStats } from './state.js';
import { log } from './utils.js';

// Application initialization
export function initializeApp() {
    console.log(`Copy Trader v${VERSION} (${BUILD_DATE})`);
    log('info', `🚀 Application initialized`);
    updateStats();
}

// TODO: Wire up all event handlers and start app

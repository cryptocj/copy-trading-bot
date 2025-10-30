// ============================================
// MAIN.JS - Application Entry Point
// ============================================

import { initializeVersionDisplay, setupEventListeners, renderActivityLog } from './ui.js';
import { startMonitoring, stopMonitoring } from './sync-engine.js';

// Initialize application on page load
document.addEventListener('DOMContentLoaded', () => {
    // Initialize version display
    initializeVersionDisplay();

    // Setup event listeners
    setupEventListeners(startMonitoring, stopMonitoring);

    // Render initial activity log
    renderActivityLog();

    console.log('Copy Trader Application initialized');
});

// ============================================
// MULTI-TRADER-MAIN.JS - Multi-Trader Entry Point
// ============================================

import { VERSION } from './config.js';
import { loadMultiTraderState } from './multi-trader-state.js';
import { initAddTraderCompact, renderTraderGrid } from './ui-multi-trader.js';
import { startMonitoring, stopMonitoring } from './multi-trader-monitor.js';

/**
 * Initialize multi-trader application
 */
function initMultiTrader() {
  console.log(`🚀 Multi-Trader v${VERSION} initializing...`);

  // Display version
  const versionDisplay = document.getElementById('version-display');
  if (versionDisplay) {
    versionDisplay.textContent = `v${VERSION}`;
  }

  // Load persisted state from localStorage
  loadMultiTraderState();

  // Initialize UI components
  initAddTraderCompact();
  initMonitoringControls();
  renderTraderGrid();

  console.log('✅ Multi-Trader UI initialized');
}

/**
 * Initialize monitoring control buttons
 */
function initMonitoringControls() {
  const startButton = document.getElementById('btn-start-monitoring');
  const stopButton = document.getElementById('btn-stop-monitoring');

  // Start monitoring button
  startButton?.addEventListener('click', () => {
    startMonitoring(); // Uses default 30s interval
  });

  // Stop monitoring button
  stopButton?.addEventListener('click', () => {
    stopMonitoring();
  });
}

// Initialize on DOM ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initMultiTrader);
} else {
  initMultiTrader();
}

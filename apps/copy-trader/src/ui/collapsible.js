/**
 * Collapsible sections UI module
 * Handles collapsible panel behavior with localStorage persistence
 */

import { STORAGE_KEYS } from '../services/storage.js';

/**
 * Setup collapsible sections with localStorage persistence
 * @param {object} elements - DOM element references
 */
export function setupCollapsibleSections(elements) {
  // Restore saved collapsed states
  const historyCollapsed = localStorage.getItem(STORAGE_KEYS.HISTORY_COLLAPSED) === 'true';
  const walletsCollapsed = localStorage.getItem(STORAGE_KEYS.WALLETS_COLLAPSED) === 'true';

  if (historyCollapsed) {
    toggleSection(elements, 'history', true);
  }
  if (walletsCollapsed) {
    toggleSection(elements, 'wallets', true);
  }

  // Add event listeners
  elements.historyToggle.addEventListener('click', () => {
    const isCollapsed = elements.historyContentWrapper.classList.contains('collapsed');
    toggleSection(elements, 'history', !isCollapsed);
    localStorage.setItem(STORAGE_KEYS.HISTORY_COLLAPSED, (!isCollapsed).toString());
  });

  elements.walletsToggle.addEventListener('click', () => {
    const isCollapsed = elements.walletsContent.classList.contains('collapsed');
    toggleSection(elements, 'wallets', !isCollapsed);
    localStorage.setItem(STORAGE_KEYS.WALLETS_COLLAPSED, (!isCollapsed).toString());
  });
}

/**
 * Toggle section collapsed state
 * @param {object} elements - DOM element references
 * @param {string} section - 'history' or 'wallets'
 * @param {boolean} collapsed - Whether to collapse or expand
 */
function toggleSection(elements, section, collapsed) {
  if (section === 'history') {
    const icon = elements.historyToggle.querySelector('.collapse-icon');
    if (collapsed) {
      elements.historyContentWrapper.classList.add('collapsed');
      icon.textContent = '+';
    } else {
      elements.historyContentWrapper.classList.remove('collapsed');
      icon.textContent = '−';
    }
  } else if (section === 'wallets') {
    const icon = elements.walletsToggle.querySelector('.collapse-icon');
    if (collapsed) {
      elements.walletsContent.classList.add('collapsed');
      icon.textContent = '+';
    } else {
      elements.walletsContent.classList.remove('collapsed');
      icon.textContent = '−';
    }
  }
}

// Error Report Panel Service
// Provides functions to open/activate ErrorReportPanel from anywhere in the app

import type { DockNode, DockTabErrorReport } from '@dock/types';
import { openErrorReportPanel } from '@components/AppContent/infrastructure/docking/DockingHelpers';

let globalSetDockTree: ((updater: (prev: DockNode) => DockNode) => void) | null = null;

/**
 * Initialize the service with the dock tree setter
 * Should be called from AppContent when dock tree is available
 */
export function initializeErrorReportPanelService(
  setDockTree: (updater: (prev: DockNode) => DockNode) => void
): void {
  globalSetDockTree = setDockTree;
}

/**
 * Opens or activates the Error Report Panel
 * If panel doesn't exist, creates it in the right side panel
 * If panel exists, activates it
 */
export function openErrorReportPanelService(): void {
  if (!globalSetDockTree) {
    console.warn('[ErrorReportPanelService] Dock tree setter not initialized');
    return;
  }

  const errorReportTab: DockTabErrorReport = {
    id: 'error_report_main',
    title: 'Error Report',
    type: 'errorReport',
  };

  globalSetDockTree(prev => openErrorReportPanel(prev, {
    tabId: errorReportTab.id,
    newTab: errorReportTab,
    position: 'right',
  }));
}

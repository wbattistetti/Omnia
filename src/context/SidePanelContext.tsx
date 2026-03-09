// Side Panel Context
// Manages positions and mutual exclusion logic for Assistant and ErrorReport panels

import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import type { DockNode } from '@dock/types';
import { getTab } from '@dock/ops';

export type SidePanelType = 'assistant' | 'errorReport';

interface PanelPosition {
  tabsetId: string | null; // null if panel doesn't exist
  tabId: string | null;
}

interface SidePanelContextValue {
  // Panel positions
  assistantPosition: PanelPosition;
  errorReportPosition: PanelPosition;

  // Update positions
  updateAssistantPosition: (tabsetId: string | null, tabId: string | null) => void;
  updateErrorReportPosition: (tabsetId: string | null, tabId: string | null) => void;

  // Check if panels are in same slot
  areInSameSlot: () => boolean;

  // Find panel position in dock tree
  findPanelPosition: (dockTree: DockNode, panelType: SidePanelType) => PanelPosition;
}

const SidePanelContext = createContext<SidePanelContextValue | undefined>(undefined);

export function SidePanelProvider({ children }: { children: React.ReactNode }) {
  const [assistantPosition, setAssistantPosition] = useState<PanelPosition>({ tabsetId: null, tabId: null });
  const [errorReportPosition, setErrorReportPosition] = useState<PanelPosition>({ tabsetId: null, tabId: null });

  const updateAssistantPosition = useCallback((tabsetId: string | null, tabId: string | null) => {
    setAssistantPosition({ tabsetId, tabId });
  }, []);

  const updateErrorReportPosition = useCallback((tabsetId: string | null, tabId: string | null) => {
    setErrorReportPosition({ tabsetId, tabId });
  }, []);

  const areInSameSlot = useCallback(() => {
    if (!assistantPosition.tabsetId || !errorReportPosition.tabsetId) {
      return false;
    }
    return assistantPosition.tabsetId === errorReportPosition.tabsetId;
  }, [assistantPosition.tabsetId, errorReportPosition.tabsetId]);

  const findPanelPosition = useCallback((dockTree: DockNode, panelType: SidePanelType): PanelPosition => {
    const tabId = panelType === 'assistant' ? 'chat_flow_main' : 'error_report_main';
    const tab = getTab(dockTree, tabId);

    if (!tab) {
      return { tabsetId: null, tabId: null };
    }

    // Find which tabset contains this tab
    let tabsetId: string | null = null;

    const findTabset = (node: DockNode): string | null => {
      if (node.kind === 'tabset') {
        if (node.tabs.some(t => t.id === tabId)) {
          return node.id;
        }
      } else if (node.kind === 'split') {
        for (const child of node.children) {
          const found = findTabset(child);
          if (found) return found;
        }
      }
      return null;
    };

    tabsetId = findTabset(dockTree);

    return { tabsetId, tabId };
  }, []);

  return (
    <SidePanelContext.Provider
      value={{
        assistantPosition,
        errorReportPosition,
        updateAssistantPosition,
        updateErrorReportPosition,
        areInSameSlot,
        findPanelPosition,
      }}
    >
      {children}
    </SidePanelContext.Provider>
  );
}

export function useSidePanel() {
  const context = useContext(SidePanelContext);
  if (!context) {
    throw new Error('useSidePanel must be used within SidePanelProvider');
  }
  return context;
}

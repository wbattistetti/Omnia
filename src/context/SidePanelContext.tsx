// Side Panel Context — assistant (chat) tab position in the dock (optional / legacy).

import React, { createContext, useContext, useState, useCallback } from 'react';
import type { DockNode } from '@dock/types';
import { getTab } from '@dock/ops';

interface PanelPosition {
  tabsetId: string | null;
  tabId: string | null;
}

interface SidePanelContextValue {
  assistantPosition: PanelPosition;
  updateAssistantPosition: (tabsetId: string | null, tabId: string | null) => void;
  findAssistantPosition: (dockTree: DockNode) => PanelPosition;
}

const SidePanelContext = createContext<SidePanelContextValue | undefined>(undefined);

export function SidePanelProvider({ children }: { children: React.ReactNode }) {
  const [assistantPosition, setAssistantPosition] = useState<PanelPosition>({ tabsetId: null, tabId: null });

  const updateAssistantPosition = useCallback((tabsetId: string | null, tabId: string | null) => {
    setAssistantPosition({ tabsetId, tabId });
  }, []);

  const findAssistantPosition = useCallback((dockTree: DockNode): PanelPosition => {
    const tabId = 'chat_flow_main';
    const tab = getTab(dockTree, tabId);

    if (!tab) {
      return { tabsetId: null, tabId: null };
    }

    const findTabset = (node: DockNode): string | null => {
      if (node.kind === 'tabset') {
        if (node.tabs.some((t) => t.id === tabId)) {
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

    const tabsetId = findTabset(dockTree);

    return { tabsetId, tabId };
  }, []);

  return (
    <SidePanelContext.Provider
      value={{
        assistantPosition,
        updateAssistantPosition,
        findAssistantPosition,
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

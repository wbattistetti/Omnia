/**
 * React context so Dockview panel bodies read live structured section state (portals keep tree under this provider).
 */

import React from 'react';
import type { AgentStructuredSectionId } from './agentStructuredSectionIds';
import type { OtOp } from './otTypes';
import type { StructuredSectionsRevisionState } from './structuredSectionsRevisionReducer';
import type { RevisionBatchOp } from './textRevisionLinear';
import type { IaSectionDiffPair } from './iaSectionDiffTypes';

export interface AIAgentStructuredSectionsDockContextValue {
  instanceIdSuffix: string;
  runtimeMarkdown: string;
  sectionsState: StructuredSectionsRevisionState;
  readOnly: boolean;
  onApplyRevisionOps: (sectionId: AgentStructuredSectionId, ops: readonly RevisionBatchOp[]) => void;
  onApplyOtCommit: (sectionId: AgentStructuredSectionId, newOps: readonly OtOp[]) => void;
  onUndoSection: (sectionId: AgentStructuredSectionId) => void;
  onRedoSection: (sectionId: AgentStructuredSectionId) => void;
  structuredOtEnabled: boolean;
  iaRevisionDiffBySection: Partial<Record<AgentStructuredSectionId, IaSectionDiffPair>> | null;
  onDismissIaRevisionForSection: (sectionId: AgentStructuredSectionId) => void;
}

/** Exported for {@link useAgentStructuredDockSlice} (legacy nested dock + unified editor dock). */
export const AIAgentStructuredSectionsDockContext =
  React.createContext<AIAgentStructuredSectionsDockContextValue | null>(null);

export function AIAgentStructuredSectionsDockProvider({
  value,
  children,
}: {
  value: AIAgentStructuredSectionsDockContextValue;
  children: React.ReactNode;
}) {
  return (
    <AIAgentStructuredSectionsDockContext.Provider value={value}>
      {children}
    </AIAgentStructuredSectionsDockContext.Provider>
  );
}

export function useAIAgentStructuredSectionsDock(): AIAgentStructuredSectionsDockContextValue {
  const ctx = React.useContext(AIAgentStructuredSectionsDockContext);
  if (!ctx) {
    throw new Error('useAIAgentStructuredSectionsDock must be used within AIAgentStructuredSectionsDockProvider');
  }
  return ctx;
}

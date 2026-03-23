/**
 * React context supplying live AI Agent editor state to outer Dockview panel bodies (description, structured, dati, use cases).
 */

import React from 'react';
import type { AIAgentProposedVariable } from '@types/aiAgentDesign';
import type { AIAgentLogicalStep, AIAgentUseCase } from '@types/aiAgentUseCases';
import type { AgentStructuredSectionId } from './agentStructuredSectionIds';
import type { StructuredSectionsRevisionState } from './structuredSectionsRevisionReducer';
import type { IaSectionDiffPair } from './iaSectionDiffTypes';
import type { RevisionBatchOp } from './textRevisionLinear';

export interface AIAgentEditorDockContextValue {
  instanceId: string | undefined;
  hasAgentGeneration: boolean;
  designDescription: string;
  setDesignDescription: (value: string) => void;
  composedRuntimeMarkdown: string;
  structuredSectionsState: StructuredSectionsRevisionState;
  onApplyRevisionOps: (sectionId: AgentStructuredSectionId, ops: readonly RevisionBatchOp[]) => void;
  iaRevisionDiffBySection: Partial<Record<AgentStructuredSectionId, IaSectionDiffPair>> | null;
  onDismissIaRevisionForSection: (sectionId: AgentStructuredSectionId) => void;
  generating: boolean;
  /** Whether the dock shows the right column (Dati / Use case); drives header actions visibility. */
  showRightPanel: boolean;
  /** Primary action (Create / Refine) rendered by panels that previously showed it in the left column. */
  headerAction: React.ReactNode;
  primaryAgentActionLabel: string;
  proposedFields: AIAgentProposedVariable[];
  outputVariableMappings: Record<string, string>;
  onUpdateProposedField: (fieldName: string, patch: Partial<AIAgentProposedVariable>) => void;
  onRemoveProposedField: (fieldName: string) => void;
  onProposedLabelBlur: (fieldName: string, labelTrimmed: string) => void;
  logicalSteps: readonly AIAgentLogicalStep[];
  useCases: readonly AIAgentUseCase[];
  setUseCases: React.Dispatch<React.SetStateAction<AIAgentUseCase[]>>;
  useCaseComposerBusy: boolean;
  useCaseComposerError: string | null;
  onClearUseCaseComposerError: () => void;
  onGenerateUseCaseBundle: () => void | Promise<void>;
  onRegenerateUseCase: (useCaseId: string) => void | Promise<void>;
  /** Design-time preview style (persisted with task). */
  previewStyleId: string;
  setPreviewStyleId: (styleId: string) => void;
}

/** Exported for {@link useAgentStructuredDockSlice} (unified dock + legacy nested dock). */
export const AIAgentEditorDockContext = React.createContext<AIAgentEditorDockContextValue | null>(null);

export function AIAgentEditorDockProvider({
  value,
  children,
}: {
  value: AIAgentEditorDockContextValue;
  children: React.ReactNode;
}) {
  return <AIAgentEditorDockContext.Provider value={value}>{children}</AIAgentEditorDockContext.Provider>;
}

/**
 * Panel bodies must be rendered under {@link AIAgentEditorDockProvider}.
 */
export function useAIAgentEditorDock(): AIAgentEditorDockContextValue {
  const ctx = React.useContext(AIAgentEditorDockContext);
  if (!ctx) {
    throw new Error('useAIAgentEditorDock must be used within AIAgentEditorDockProvider');
  }
  return ctx;
}

/** Used by Dockview tabs outside mandatory panel bodies (e.g. tab strip only has context when unified dock is wrapped). */
export function useOptionalAIAgentEditorDock(): AIAgentEditorDockContextValue | null {
  return React.useContext(AIAgentEditorDockContext);
}

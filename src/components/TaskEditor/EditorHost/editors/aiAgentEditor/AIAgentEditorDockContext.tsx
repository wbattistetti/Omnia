/**
 * React context supplying live AI Agent editor state to outer Dockview panel bodies (description, structured, dati, use cases).
 */

import React from 'react';
import type { AIAgentProposedVariable } from '@types/aiAgentDesign';
import type { AIAgentLogicalStep, AIAgentUseCase } from '@types/aiAgentUseCases';
import type { AIAgentPreviewTurn } from '@types/aiAgentPreview';
import type { AgentStructuredSectionId } from './agentStructuredSectionIds';
import type { OtOp } from './otTypes';
import type { StructuredSectionsRevisionState } from './structuredSectionsRevisionReducer';
import type { IaSectionDiffPair } from './iaSectionDiffTypes';
import type { RevisionBatchOp } from './textRevisionLinear';
import type { AgentPromptPlatformId, BackendPlaceholderInstance, PlatformPromptOutput } from '@domain/agentPrompt';
import type { IAAgentConfig } from 'types/iaAgentRuntimeSetup';

export interface AIAgentEditorDockContextValue {
  instanceId: string | undefined;
  hasAgentGeneration: boolean;
  designDescription: string;
  setDesignDescription: (value: string) => void;
  composedRuntimeMarkdown: string;
  /** True when structured sections diverge from last committed snapshot (Create/Refine baseline). */
  structuredDesignDirty: boolean;
  structuredSectionsState: StructuredSectionsRevisionState;
  onApplyRevisionOps: (sectionId: AgentStructuredSectionId, ops: readonly RevisionBatchOp[]) => void;
  /** When {@link structuredOtEnabled}, structured sections may commit UTF-16 OT ops instead of linear batch ops. */
  onApplyOtCommit: (sectionId: AgentStructuredSectionId, newOps: readonly OtOp[]) => void;
  /** Undo/redo last committed edit for a structured section (Ctrl+Z / Ctrl+Y in revision editor). */
  onUndoSection: (sectionId: AgentStructuredSectionId) => void;
  onRedoSection: (sectionId: AgentStructuredSectionId) => void;
  structuredOtEnabled: boolean;
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
  onUpdateProposedField: (slotId: string, patch: Partial<AIAgentProposedVariable>) => void;
  onRemoveProposedField: (slotId: string) => void;
  onProposedLabelBlur: (slotId: string, labelTrimmed: string) => void;
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
  /** Runtime state template edited in design-time and persisted on task. */
  initialStateTemplateJson: string;
  /** Persisted JSON string for `runtime_compact` (token-efficient rules); empty for legacy tasks. */
  agentRuntimeCompactJson: string;
  /** Optional style-indexed preview turns that can be projected into runtime examples. */
  previewByStyle: Record<string, AIAgentPreviewTurn[]>;
  /** Declared backend placeholder rows (tokens live in section text). */
  backendPlaceholders: readonly BackendPlaceholderInstance[];
  /** Insert `🗄️ path` at caret / replace selection in IR section + register instance. */
  insertBackendPathAtSection: (
    sectionId: AgentStructuredSectionId,
    backendPath: string,
    rangeStart: number,
    rangeEnd?: number
  ) => void;
  /** Insert `🗄️ path` at caret / replace selection in task description. */
  insertBackendPathInDesign: (backendPath: string, rangeStart: number, rangeEnd?: number) => void;
  /** Persisted target platform for deterministic compile preview. */
  agentPromptTargetPlatform: AgentPromptPlatformId;
  setAgentPromptTargetPlatform: (v: AgentPromptPlatformId) => void;
  /** Structured compile for {@link agentPromptTargetPlatform} (derived views + debugger). */
  compiledPlatformOutput: PlatformPromptOutput;
  /** Flattened preview string (same information as structured compile). */
  compiledPromptForTargetPlatform: string;
  /**
   * True when persisted `runtime_compact` matches deterministic Phase-2 output for the current IR.
   * Governs lazy recompilation (Prompt finale view + flow debugger compile).
   */
  promptFinalAligned: boolean;
  /**
   * Synchronously rebuilds `agentRuntimeCompactJson` from current IR and patches TaskRepository when misaligned.
   * No LLM; safe to call before compile/debug.
   */
  ensurePromptFinalDeterministicCompile: (reason: string) => void;
  /** Prompt Finale panel: mutually exclusive textual IR preview vs readonly JS/JSON bundle. */
  promptFinaleJsMode: boolean;
  setPromptFinaleJsMode: (value: boolean) => void;

  /** Per-task runtime IA motor overrides (persisted as `agentIaRuntimeOverrideJson`). */
  iaRuntimeConfig: IAAgentConfig;
  setIaRuntimeConfig: (next: IAAgentConfig) => void;
  /** Loaded from saved task JSON vs copied global defaults when override was absent. */
  iaRuntimeLoadedFrom: 'saved_override' | 'global_defaults';
  /** Writes current editor state to TaskRepository including override JSON ("Salva override"). */
  saveIaRuntimeOverrideToTask: () => void;
  /** Merges partial IA fields into TaskRepository (`normalize` ×2); no hydrated gate. */
  persistIaRuntimeOverrideSnapshot: (partial: Partial<IAAgentConfig>) => void;
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

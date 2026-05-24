/**
 * Structured design phase: dockable section editors (dockview) plus Prompt finale as a dock panel.
 */

import React from 'react';
import type { AgentStructuredSectionId } from './agentStructuredSectionIds';
import type { OtOp } from './otTypes';
import type { StructuredSectionsRevisionState } from './structuredSectionsRevisionReducer';
import type { RevisionBatchOp } from './textRevisionLinear';
import type { IaSectionDiffPair } from './iaSectionDiffTypes';
import {
  AIAgentStructuredSectionsDockProvider,
  type AIAgentStructuredSectionsDockContextValue,
} from './AIAgentStructuredSectionsDockContext';
import { AIAgentStructuredSectionsDockview } from './AIAgentStructuredSectionsDockview';
import { tutorIdProps, UI_IDS } from './activeTutor/uiIds';

export type { IaSectionDiffPair } from './iaSectionDiffTypes';

export interface AIAgentStructuredSectionsPanelProps {
  instanceId: string | undefined;
  runtimeMarkdown: string;
  sectionsState: StructuredSectionsRevisionState;
  readOnly: boolean;
  onApplyRevisionOps: (sectionId: AgentStructuredSectionId, ops: readonly RevisionBatchOp[]) => void;
  onApplyOtCommit?: (sectionId: AgentStructuredSectionId, newOps: readonly OtOp[]) => void;
  onUndoSection?: (sectionId: AgentStructuredSectionId) => void;
  onRedoSection?: (sectionId: AgentStructuredSectionId) => void;
  structuredOtEnabled?: boolean;
  iaRevisionDiffBySection: Partial<Record<AgentStructuredSectionId, IaSectionDiffPair>> | null;
  onDismissIaRevisionForSection: (sectionId: AgentStructuredSectionId) => void;
  headerAction?: React.ReactNode;
  /** When true, inner Dockview fills the parent panel instead of a fixed viewport height. */
  embeddedDock?: boolean;
  /**
   * Wizard step 1: insert a leading "Descrizione" tab (free-form textarea bound
   * to `designDescription` via `AIAgentEditorDockContext`). The Dockview shows
   * one panel at a time, so the description naturally coexists with the
   * structured sections without splitting the screen.
   */
  includeDescriptionLeadingTab?: boolean;
  /**
   * Pre-Crea Agente: hide structured sections (Scopo, Sequenza, …) and the
   * Prompt Finale tab. Combined with {@link includeDescriptionLeadingTab} this
   * leaves "Descrizione" as the only visible tab.
   */
  omitStructuredSections?: boolean;
}

export function AIAgentStructuredSectionsPanel({
  instanceId,
  runtimeMarkdown,
  sectionsState,
  readOnly,
  onApplyRevisionOps,
  onApplyOtCommit: onApplyOtCommitProp,
  onUndoSection: onUndoSectionProp,
  onRedoSection: onRedoSectionProp,
  structuredOtEnabled: structuredOtEnabledProp,
  iaRevisionDiffBySection,
  onDismissIaRevisionForSection,
  headerAction,
  embeddedDock = false,
  includeDescriptionLeadingTab = false,
  omitStructuredSections = false,
}: AIAgentStructuredSectionsPanelProps) {
  const suffix = instanceId || 'default';
  const onApplyOtCommit = onApplyOtCommitProp ?? (() => {});
  const onUndoSection = onUndoSectionProp ?? (() => {});
  const onRedoSection = onRedoSectionProp ?? (() => {});
  const structuredOtEnabled = structuredOtEnabledProp === true;

  const dockValue = React.useMemo<AIAgentStructuredSectionsDockContextValue>(
    () => ({
      instanceIdSuffix: suffix,
      runtimeMarkdown,
      sectionsState,
      readOnly,
      onApplyRevisionOps,
      onApplyOtCommit,
      onUndoSection,
      onRedoSection,
      structuredOtEnabled,
      iaRevisionDiffBySection,
      onDismissIaRevisionForSection,
    }),
    [
      suffix,
      runtimeMarkdown,
      sectionsState,
      readOnly,
      onApplyRevisionOps,
      onApplyOtCommit,
      onUndoSection,
      onRedoSection,
      structuredOtEnabled,
      iaRevisionDiffBySection,
      onDismissIaRevisionForSection,
    ]
  );

  return (
    <div
      className={
        embeddedDock
          ? 'flex flex-col flex-1 min-h-0 h-full space-y-2'
          : 'space-y-4'
      }
    >
      {headerAction ? <div className="flex flex-wrap justify-end shrink-0">{headerAction}</div> : null}

      {!omitStructuredSections ? (
        <p className="text-xs text-slate-500 shrink-0">
          Sezioni <strong className="text-slate-400">Behavior</strong>,{' '}
          <strong className="text-slate-400">vincoli</strong>, ecc.: trascina le schede o i gruppi per
          affiancarli, staccarli o ridisporli (layout dockabile).
        </p>
      ) : null}

      <div
        {...(!omitStructuredSections ? tutorIdProps(UI_IDS.taskFormattedBox) : {})}
        className={embeddedDock ? 'flex-1 min-h-0 flex flex-col' : ''}
      >
        <AIAgentStructuredSectionsDockProvider value={dockValue}>
          <AIAgentStructuredSectionsDockview
            layoutKey={suffix}
            embedded={embeddedDock}
            includeDescriptionLeadingTab={includeDescriptionLeadingTab}
            omitStructuredSections={omitStructuredSections}
          />
        </AIAgentStructuredSectionsDockProvider>
      </div>
    </div>
  );
}

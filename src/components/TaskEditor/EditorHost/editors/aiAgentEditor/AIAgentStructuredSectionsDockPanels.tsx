/**
 * Dockview content components for structured AI Agent sections (unified editor dock + legacy nested Dockview).
 */

import React from 'react';
import type { IDockviewPanelProps } from 'dockview';
import { AIAgentRevisionEditorShell } from './AIAgentRevisionEditorShell';
import type { AgentStructuredSectionId } from './agentStructuredSectionIds';
import { useAgentStructuredDockSlice } from './useAgentStructuredDockSlice';

export function AgentSectionDockPanel(
  props: IDockviewPanelProps<{ sectionId?: AgentStructuredSectionId }>
) {
  const {
    instanceIdSuffix,
    sectionsState,
    readOnly,
    onApplyRevisionOps,
    iaRevisionDiffBySection,
    onDismissIaRevisionForSection,
  } = useAgentStructuredDockSlice();

  const sectionId = props.params?.sectionId;
  if (!sectionId) {
    return (
      <div className="p-3 text-sm text-red-300">Parametro sectionId mancante nel pannello dock.</div>
    );
  }

  const activeSlice = sectionsState[sectionId];
  const activeDiff = iaRevisionDiffBySection?.[sectionId];

  return (
    <div className="h-full min-h-0 overflow-hidden flex flex-col bg-slate-950/80">
      <AIAgentRevisionEditorShell
        key={sectionId}
        instanceId={`${instanceIdSuffix}-${sectionId}`}
        promptBaseText={activeSlice.promptBaseText}
        deletedMask={activeSlice.deletedMask}
        inserts={activeSlice.inserts}
        onApplyRevisionOps={(ops) => onApplyRevisionOps(sectionId, ops)}
        readOnly={readOnly}
        iaRevisionDiff={
          activeDiff
            ? { oldIaPrompt: activeDiff.oldIaPrompt, newIaPrompt: activeDiff.newIaPrompt }
            : null
        }
        onDismissIaRevisionDiff={() => onDismissIaRevisionForSection(sectionId)}
      />
    </div>
  );
}

export function PromptFinaleDockPanel(_props: IDockviewPanelProps) {
  const { runtimeMarkdown } = useAgentStructuredDockSlice();

  return (
    <div className="h-full min-h-0 flex flex-col gap-2 p-2 overflow-auto bg-slate-950/80">
      <p className="text-[11px] text-slate-500 shrink-0">
        Markdown composito da tutte le sezioni — non modificabile. Descrizione, sezioni, dati e use case condividono
        la stessa area dock: trascina le schede o dividi i gruppi come preferisci.
      </p>
      <textarea
        readOnly
        value={runtimeMarkdown}
        aria-label="Prompt finale runtime (sola lettura)"
        className="w-full min-h-[200px] flex-1 rounded-md border border-slate-700 bg-[#0c1222] p-3 text-sm font-mono text-slate-200 resize-y focus:outline-none focus:ring-2 focus:ring-amber-600/40 cursor-default"
        spellCheck={false}
      />
    </div>
  );
}

/**
 * Dockview content components for structured AI Agent sections (unified editor dock + legacy nested Dockview).
 */

import React from 'react';
import type { IDockviewPanelProps } from 'dockview';
import { AIAgentRevisionEditorShell } from './AIAgentRevisionEditorShell';
import type { AgentStructuredSectionId } from './agentStructuredSectionIds';
import { useAgentStructuredDockSlice } from './useAgentStructuredDockSlice';
import { getStructuredSectionEffectiveText } from './structuredSectionEffective';
import { splitOperationalSequenceLines } from './operationalSequenceDisplay';

export function AgentSectionDockPanel(
  props: IDockviewPanelProps<{ sectionId?: AgentStructuredSectionId }>
) {
  const {
    instanceIdSuffix,
    sectionsState,
    readOnly,
    onApplyRevisionOps,
    onApplyOtCommit,
    structuredOtEnabled,
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
  const effectiveText = getStructuredSectionEffectiveText(activeSlice);
  const opLines =
    sectionId === 'operational_sequence' && effectiveText.trim()
      ? splitOperationalSequenceLines(effectiveText)
      : null;

  const otMode = Boolean(structuredOtEnabled && activeSlice.storageMode === 'ot' && activeSlice.ot);

  return (
    <div className="h-full min-h-0 flex flex-col bg-slate-950/80 overflow-hidden">
      {opLines && opLines.length > 0 ? (
        <ul className="shrink-0 max-h-[min(40%,240px)] overflow-y-auto list-disc pl-5 pr-2 py-2 mx-2 mt-2 rounded-md border border-slate-800/90 bg-slate-900/40 text-sm text-slate-200 space-y-1">
          {opLines.map((line, i) => (
            <li key={i} className="leading-snug">
              {line}
            </li>
          ))}
        </ul>
      ) : null}
      <div className="flex-1 min-h-0 overflow-hidden flex flex-col p-2 pt-1">
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
          otMode={otMode}
          otCurrentText={activeSlice.ot?.currentText}
          onApplyOtCommit={
            otMode ? (ops) => onApplyOtCommit(sectionId, ops) : undefined
          }
        />
      </div>
    </div>
  );
}

export function PromptFinaleDockPanel(_props: IDockviewPanelProps) {
  const { runtimeMarkdown } = useAgentStructuredDockSlice();

  return (
    <div className="h-full min-h-0 flex flex-col p-2 overflow-hidden bg-slate-950/80">
      <textarea
        readOnly
        value={runtimeMarkdown}
        aria-label="Prompt finale runtime (sola lettura)"
        className="w-full flex-1 min-h-[120px] rounded-md border border-slate-700 bg-[#0c1222] p-3 text-sm font-mono text-slate-200 resize-none focus:outline-none focus:ring-2 focus:ring-amber-600/40 cursor-default"
        spellCheck={false}
      />
    </div>
  );
}

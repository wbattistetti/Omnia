/**
 * Dockview content components for structured AI Agent sections (unified editor dock + legacy nested Dockview).
 */

import React from 'react';
import type { IDockviewPanelProps } from 'dockview';
import { AIAgentRevisionEditorShell } from './AIAgentRevisionEditorShell';
import type { AgentStructuredSectionId } from './agentStructuredSectionIds';
import { AIAgentEditorDockContext } from './AIAgentEditorDockContext';
import { useAgentStructuredDockSlice } from './useAgentStructuredDockSlice';
import { parseAgentRuntimeCompactJson } from './composeRuntimeRulesFromCompact';
import {
  buildAiAgentRuntimeExperimentPayload,
  buildDistilledRulesString,
  buildRichRulesString,
  stringifyExperimentPayload,
} from './aiAgentRuntimeExperimentJson';
export function AgentSectionDockPanel(
  props: IDockviewPanelProps<{ sectionId?: AgentStructuredSectionId }>
) {
  const {
    instanceIdSuffix,
    sectionsState,
    readOnly,
    onApplyRevisionOps,
    onApplyOtCommit,
    onUndoSection,
    onRedoSection,
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

  const otMode = Boolean(structuredOtEnabled && activeSlice.storageMode === 'ot' && activeSlice.ot);

  return (
    <div className="h-full min-h-0 flex flex-col bg-slate-950/80 overflow-hidden">
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
          onUndoRequest={() => onUndoSection(sectionId)}
          onRedoRequest={() => onRedoSection(sectionId)}
        />
      </div>
    </div>
  );
}

export function PromptFinaleDockPanel(_props: IDockviewPanelProps) {
  const { runtimeMarkdown } = useAgentStructuredDockSlice();
  const editorCtx = React.useContext(AIAgentEditorDockContext);

  const parsedInitialState = React.useMemo(() => {
    const src = editorCtx?.initialStateTemplateJson;
    if (!src || src.trim().length === 0) {
      return {};
    }
    try {
      const parsed = JSON.parse(src) as unknown;
      return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
    } catch {
      return { _invalidInitialStateTemplateJson: src };
    }
  }, [editorCtx?.initialStateTemplateJson]);

  const runtimeExamples = React.useMemo(() => {
    if (!editorCtx) return [];
    const turns = editorCtx.previewByStyle[editorCtx.previewStyleId] ?? [];
    return turns
      .map((t) => ({
        role: t.role,
        content: (t.content ?? '').trim(),
      }))
      .filter((t) => t.content.length > 0);
  }, [editorCtx]);

  const { examplesForPreview, compactParsed } = React.useMemo(() => {
    const compact = editorCtx?.agentRuntimeCompactJson
      ? parseAgentRuntimeCompactJson(editorCtx.agentRuntimeCompactJson)
      : null;
    const useCompact =
      Boolean(compact && editorCtx && !editorCtx.structuredDesignDirty);
    if (useCompact && compact) {
      return {
        examplesForPreview: compact.examples_compact,
        compactParsed: compact,
      };
    }
    return { examplesForPreview: runtimeExamples, compactParsed: compact };
  }, [editorCtx, runtimeExamples]);

  const rulesForPreview = React.useMemo(() => {
    const variant = editorCtx?.runtimeRulesVariant ?? 'distilled';
    const compactJson = editorCtx?.agentRuntimeCompactJson ?? '';
    if (variant === 'rich') {
      return buildRichRulesString(runtimeMarkdown, compactParsed);
    }
    return buildDistilledRulesString(compactJson, runtimeMarkdown);
  }, [
    editorCtx?.runtimeRulesVariant,
    editorCtx?.agentRuntimeCompactJson,
    runtimeMarkdown,
    compactParsed,
  ]);

  const condensedRuntimeJson = React.useMemo(
    () =>
      stringifyExperimentPayload(
        buildAiAgentRuntimeExperimentPayload(
          rulesForPreview,
          parsedInitialState,
          examplesForPreview
        )
      ),
    [rulesForPreview, parsedInitialState, examplesForPreview]
  );

  return (
    <div className="h-full min-h-0 flex flex-col p-2 overflow-hidden bg-slate-950/80">
      <textarea
        readOnly
        value={condensedRuntimeJson}
        aria-label="JSON runtime (sola lettura)"
        className="w-full flex-1 min-h-[120px] rounded-md border border-slate-700 bg-[#0c1222] p-3 text-sm font-mono text-slate-200 resize-none focus:outline-none focus:ring-2 focus:ring-amber-600/40 cursor-default"
        spellCheck={false}
      />
    </div>
  );
}

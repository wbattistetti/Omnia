/**
 * Dockview content components for structured AI Agent sections (unified editor dock + legacy nested Dockview).
 */

import React from 'react';
import type { IDockviewPanelProps } from 'dockview';
import { AIAgentRevisionEditorShell } from './AIAgentRevisionEditorShell';
import type { AgentStructuredSectionId } from './agentStructuredSectionIds';
import { useOptionalAIAgentEditorDock } from './AIAgentEditorDockContext';
import { useAgentStructuredDockSlice } from './useAgentStructuredDockSlice';
import { parseAgentRuntimeCompactJson } from './composeRuntimeRulesFromCompact';
import {
  buildAiAgentRuntimeExperimentPayload,
  buildDistilledRulesString,
  stringifyExperimentPayload,
} from './aiAgentRuntimeExperimentJson';
import { PlatformEditorView, ReadOnlyPlatformBanner } from '@components/platform-editors';
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
  const editorCtx = useOptionalAIAgentEditorDock();

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
          onInsertBackendPathAtCaret={
            readOnly || !editorCtx
              ? undefined
              : (path, rangeStart, rangeEnd) =>
                  editorCtx.insertBackendPathAtSection(sectionId, path, rangeStart, rangeEnd)
          }
        />
      </div>
    </div>
  );
}

export function PromptFinaleDockPanel(_props: IDockviewPanelProps) {
  const { runtimeMarkdown } = useAgentStructuredDockSlice();
  const editorCtx = useOptionalAIAgentEditorDock();
  const jsMode = Boolean(editorCtx?.promptFinaleJsMode);

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

  const { examplesForPreview } = React.useMemo(() => {
    const compact = editorCtx?.agentRuntimeCompactJson
      ? parseAgentRuntimeCompactJson(editorCtx.agentRuntimeCompactJson)
      : null;
    const useCompact =
      Boolean(compact && editorCtx && !editorCtx.structuredDesignDirty);
    if (useCompact && compact) {
      return {
        examplesForPreview: compact.examples_compact,
      };
    }
    return { examplesForPreview: runtimeExamples };
  }, [editorCtx, runtimeExamples]);

  const rulesForPreview = React.useMemo(() => {
    const compactJson = editorCtx?.agentRuntimeCompactJson ?? '';
    return buildDistilledRulesString(compactJson, runtimeMarkdown);
  }, [editorCtx?.agentRuntimeCompactJson, runtimeMarkdown]);

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
    <div className="h-full min-h-0 flex flex-col overflow-hidden bg-slate-950/80 px-2 pb-2 pt-1 gap-1">
      {!editorCtx ? null : jsMode ? (
        <div className="flex min-h-0 flex-1 flex-col gap-1">
          <ReadOnlyPlatformBanner />
          <textarea
            readOnly
            value={condensedRuntimeJson}
            aria-label="Payload JSON runtime (sola lettura)"
            className="w-full min-h-0 flex-1 rounded-md border border-slate-700 bg-[#0c1222] p-3 text-sm font-mono text-slate-200 resize-none focus:outline-none cursor-default"
            spellCheck={false}
          />
        </div>
      ) : (
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
          <PlatformEditorView output={editorCtx.compiledPlatformOutput} />
        </div>
      )}
    </div>
  );
}

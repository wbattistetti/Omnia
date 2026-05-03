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
  stringifyExperimentPayload,
} from './aiAgentRuntimeExperimentJson';
import { PlatformEditorView, ReadOnlyPlatformBanner } from '@components/platform-editors';
import { normalizeAgentPromptPlatformId } from '@domain/agentPrompt';
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

  const elevenlabsTarget =
    editorCtx && normalizeAgentPromptPlatformId(editorCtx.agentPromptTargetPlatform) === 'elevenlabs';

  const contractualElevenLabsHint =
    elevenlabsTarget && sectionId === 'context' ? (
      <div className="mb-1.5 shrink-0 rounded border border-violet-800/60 bg-violet-950/35 px-2 py-1 text-[9px] leading-snug text-violet-100/95">
        <span className="font-semibold uppercase tracking-wide text-violet-300/95">ConvAI · Contesto contrattuale</span>
        <p className="mt-0.5 text-violet-100/88">
          Scrivi vincoli misurabili: nomi esatti dei tool, <strong>formato</strong> della risposta (es. JSON / ISO
          8601), <strong>fuso orario</strong> e riferimento temporale (&quot;oggi&quot; = clock del backend). Vietare
          dati non presenti nella risposta tool. Senza <code className="text-violet-200/90">outputSchema</code> nel
          payload ElevenLabs, il contratto sul formato di uscita deve stare qui e nella descrizione ConvAI del
          Backend Call.
        </p>
      </div>
    ) : null;

  const contractualGuardrailsHint =
    elevenlabsTarget && sectionId === 'constraints' ? (
      <div className="mb-1.5 shrink-0 rounded border border-amber-900/45 bg-amber-950/25 px-2 py-1 text-[9px] leading-snug text-amber-100/90">
        <span className="font-semibold uppercase tracking-wide text-amber-400/95">ConvAI · Vincoli operativi</span>
        <p className="mt-0.5 text-amber-100/85">
          Esplicita must/must-not eseguibili: es. invocare il tool prima di proporre valori; solo elementi dalla
          lista restituita; conferma utente prima di chiudere; se lista vuota → messaggio + raccolta preferenze (niente
          invenzione).
        </p>
      </div>
    ) : null;

  const operationalSequenceToolHint =
    elevenlabsTarget && sectionId === 'operational_sequence' ? (
      <div className="mb-1.5 shrink-0 rounded border border-sky-900/50 bg-sky-950/25 px-2 py-1 text-[9px] leading-snug text-sky-100/90">
        <span className="font-semibold uppercase tracking-wide text-sky-300/95">ConvAI · Sequenza</span>
        <p className="mt-0.5 text-sky-100/85">
          Inserisci un <strong>passo zero</strong> obbligatorio: chiamare il tool (per nome) e attendere la risposta
          prima di qualsiasi proposta all&apos;utente basata sui suoi dati.
        </p>
      </div>
    ) : null;

  return (
    <div className="h-full min-h-0 flex flex-col bg-slate-950/80 overflow-hidden">
      <div className="flex-1 min-h-0 overflow-hidden flex flex-col p-2 pt-1">
        {contractualElevenLabsHint}
        {contractualGuardrailsHint}
        {operationalSequenceToolHint}
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
  const rootRef = React.useRef<HTMLDivElement | null>(null);
  const ensureCompile = editorCtx?.ensurePromptFinalDeterministicCompile;
  const promptFinalAligned = editorCtx?.promptFinalAligned ?? true;
  const dockInstanceId = editorCtx?.instanceId;

  React.useEffect(() => {
    if (!ensureCompile || dockInstanceId === undefined) return;
    const el = rootRef.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting && e.intersectionRatio > 0) {
            ensureCompile('promptFinalePanelVisible');
          }
        }
      },
      { threshold: [0, 0.02, 0.1] }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [dockInstanceId, ensureCompile]);

  React.useEffect(() => {
    if (!ensureCompile || promptFinalAligned) return;
    const el = rootRef.current;
    if (!el) return;
    const raf = window.requestAnimationFrame(() => {
      const r = el.getBoundingClientRect();
      const vis = r.width > 2 && r.height > 2 && r.bottom > 0 && r.top < window.innerHeight;
      if (vis) {
        ensureCompile('promptFinaleVisibleAfterMisalign');
      }
    });
    return () => window.cancelAnimationFrame(raf);
  }, [dockInstanceId, promptFinalAligned, ensureCompile]);

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
    if (editorCtx?.compiledPromptForTargetPlatform?.trim()) {
      return editorCtx.compiledPromptForTargetPlatform;
    }
    return runtimeMarkdown.trim();
  }, [editorCtx?.compiledPromptForTargetPlatform, runtimeMarkdown]);

  const condensedRuntimeJson = React.useMemo(
    () =>
      stringifyExperimentPayload(
        buildAiAgentRuntimeExperimentPayload(
          rulesForPreview,
          parsedInitialState,
          examplesForPreview,
          { immediateStart: editorCtx?.agentImmediateStart === true }
        )
      ),
    [rulesForPreview, parsedInitialState, examplesForPreview, editorCtx?.agentImmediateStart]
  );

  return (
    <div
      ref={rootRef}
      className="h-full min-h-0 flex flex-col overflow-hidden bg-slate-950/80 px-2 pb-2 pt-1 gap-1"
    >
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

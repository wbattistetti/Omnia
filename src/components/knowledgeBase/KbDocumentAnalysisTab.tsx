/**
 * Tab «Analisi del documento»: guida, pannello revisione a schermo intero o Monaco.
 */

import React from 'react';
import { Loader2 } from 'lucide-react';
import { useAIProvider } from '@context/AIProviderContext';
import type { StagedKbDocument, KbDocumentPatch } from '@domain/knowledgeBase/kbDocumentTypes';
import type { AiCallMeta } from '@services/aiAgentDesignApi';
import {
  clarifyKbDocumentAnalysisObservation,
  finalizeKbDocumentAnalysis,
  proposeKbDocumentAnalysis,
  refineKbDocumentAnalysis,
  reviewKbDocumentAnalysisObservations,
  type KbDocumentAnalysisTaskContext,
} from '@domain/knowledgeBase/kbDocumentAnalysisApi';
import {
  KB_ANALYSIS_GUIDE_CLICK_HERE,
  KB_ANALYSIS_GUIDE_DRAFT,
  KB_ANALYSIS_GUIDE_PROPOSE_PREFIX,
  KB_ANALYSIS_GUIDE_PROPOSE_SUFFIX,
  KB_ANALYSIS_UPDATE_BUTTON,
} from '@domain/knowledgeBase/kbDocumentAnalysisGuide';
import type { KbAnalysisToolbarState } from '@domain/knowledgeBase/kbAnalysisToolbarState';
import {
  allReviewItemsConfirmed,
  countConfirmedReviewItems,
  createReviewSessionItems,
  mergeKbAnalysisToolbarPresentations,
  observationsForFinalize,
  resolveKbAnalysisToolbarPresentation,
  shouldKbAnalysisRouteToObservationReview,
  type KbAnalysisReviewSessionItem,
  type KbAnalysisToolbarPresentation,
} from '@domain/knowledgeBase/kbDocumentAnalysisWorkflow';
import { runMergedAnalysisToolbarAction } from '@domain/knowledgeBase/analysisToolbarExecute';
import type { KbSectionToolbarBridge } from './KbDocumentAnalysisEditContext';
import { clearKbRuntimeDistillCachePatch } from '@domain/analysisRuntime/analysisRuntimeDistill';
import { buildKbSectionBaselinesFromMarkdown } from '@domain/knowledgeBase/kbDocumentAnalysisSections';
import { KbDocumentAnalysisEditProvider } from './KbDocumentAnalysisEditContext';
import { KbDocumentAnalysisWorkspace } from './KbDocumentAnalysisWorkspace';
import { KbAnalysisObservationReviewPanel } from './KbAnalysisObservationReviewPanel';
import { useKbDocumentContent } from './useKbDocumentContent';
import { TUTOR_ID_ATTR, UI_IDS } from '@domain/activeTutor/tutorUiIds';

export interface KbDocumentAnalysisTabProps {
  doc: StagedKbDocument;
  projectId?: string;
  disabled?: boolean;
  callMeta?: AiCallMeta;
  taskContext?: KbDocumentAnalysisTaskContext;
  onUpdateDoc: (patch: KbDocumentPatch) => void;
  onToolbarStateChange?: (state: KbAnalysisToolbarState | null) => void;
  reviewPanelOpen?: boolean;
  onReviewPanelOpenChange?: (open: boolean) => void;
}

function apiBase(
  projectId: string,
  repoId: string,
  docName: string,
  sampleText: string,
  taskContext: KbDocumentAnalysisTaskContext | undefined,
  provider: string,
  model: string,
  callMeta: AiCallMeta | undefined
) {
  return {
    projectId,
    repositoryDocumentId: repoId,
    documentName: docName,
    documentSampleText: sampleText,
    taskContext,
    provider,
    model,
    callMeta,
  };
}

function hasReviewDisagreement(items: readonly KbAnalysisReviewSessionItem[]): boolean {
  return items.some(
    (item) =>
      item.status === 'clarifying' ||
      Boolean(item.observation.userCorrectionNote?.trim())
  );
}

const HIDDEN_SECTION_TOOLBAR: KbAnalysisToolbarPresentation = {
  phase: 'hidden',
  executeVisible: false,
  executeLabel: KB_ANALYSIS_UPDATE_BUTTON,
  executeEnabled: false,
  executeEmphasized: false,
};

export function KbDocumentAnalysisTab({
  doc,
  projectId,
  disabled = false,
  callMeta,
  taskContext,
  onUpdateDoc,
  onToolbarStateChange,
  reviewPanelOpen: reviewPanelOpenProp,
  onReviewPanelOpenChange,
}: KbDocumentAnalysisTabProps): React.ReactElement {
  const { provider, model } = useAIProvider();

  const [busy, setBusy] = React.useState(false);
  const [busyObservationId, setBusyObservationId] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [draft, setDraft] = React.useState(doc.documentAnalysisMarkdown);
  const [reviewItems, setReviewItems] = React.useState<KbAnalysisReviewSessionItem[] | null>(null);
  const [analysisStarted, setAnalysisStarted] = React.useState(
    () => Boolean(doc.agentAnalysisBaselineMarkdown?.trim())
  );
  const [hasManualEdit, setHasManualEdit] = React.useState(false);
  const [reviewPanelOpenInternal, setReviewPanelOpenInternal] = React.useState(true);

  const reviewPanelOpen = reviewPanelOpenProp ?? reviewPanelOpenInternal;
  const setReviewPanelOpen = onReviewPanelOpenChange ?? setReviewPanelOpenInternal;

  const inReviewSession = reviewItems !== null && reviewItems.length > 0;
  const showReviewPanel = inReviewSession && reviewPanelOpen;

  React.useEffect(() => {
    setDraft(doc.documentAnalysisMarkdown);
    setError(null);
    setReviewItems(null);
    setBusyObservationId(null);
    setAnalysisStarted(Boolean(doc.agentAnalysisBaselineMarkdown?.trim()));
    setHasManualEdit(false);
    setReviewPanelOpenInternal(true);
  }, [doc.id, doc.documentAnalysisMarkdown]);

  const repoId = doc.id?.trim() || doc.repositoryDocumentId?.trim() || undefined;
  const content = useKbDocumentContent(projectId, repoId, {
    localFallbackText: String(doc.markdownSnippet ?? '').trim(),
  });
  const canEdit = !disabled && doc.parseStatus !== 'parsing';
  const hasModel = Boolean(provider?.trim() && model?.trim());
  const hasRepo = Boolean(repoId);
  const baseline = doc.agentAnalysisBaselineMarkdown;

  const allConfirmed = reviewItems ? allReviewItemsConfirmed(reviewItems) : false;
  const confirmedCount = reviewItems ? countConfirmedReviewItems(reviewItems) : 0;
  const routeToObservationReview = shouldKbAnalysisRouteToObservationReview(baseline, draft);
  const reviewHasDisagreement = reviewItems ? hasReviewDisagreement(reviewItems) : false;

  const canRunAgent =
    canEdit && hasModel && Boolean(projectId?.trim()) && hasRepo && !busy;

  const canPropose = canRunAgent && !inReviewSession;
  const showGuide = !analysisStarted;

  React.useEffect(() => {
    if (inReviewSession && allConfirmed) {
      setReviewPanelOpen(false);
    }
  }, [inReviewSession, allConfirmed, setReviewPanelOpen]);

  const persistDraft = React.useCallback(
    (next: string) => {
      setHasManualEdit(true);
      setDraft(next);
      if (next !== doc.documentAnalysisMarkdown) {
        onUpdateDoc({ documentAnalysisMarkdown: next });
      }
    },
    [doc.documentAnalysisMarkdown, onUpdateDoc]
  );

  const applyAgentResult = React.useCallback(
    (markdown: string) => {
      const next = markdown.trim();
      setDraft(next);
      setHasManualEdit(false);
      setAnalysisStarted(true);
      onUpdateDoc({
        documentAnalysisMarkdown: next,
        agentAnalysisBaselineMarkdown: next,
        documentAnalysisSectionBaselines: buildKbSectionBaselinesFromMarkdown(next),
        ...clearKbRuntimeDistillCachePatch(),
      });
    },
    [onUpdateDoc]
  );

  const updateReviewItem = React.useCallback(
    (observationId: string, patch: Partial<KbAnalysisReviewSessionItem>) => {
      setReviewItems((prev) =>
        prev
          ? prev.map((item) =>
              item.observation.id === observationId ? { ...item, ...patch } : item
            )
          : prev
      );
    },
    []
  );

  const updateObservation = React.useCallback(
    (
      observationId: string,
      patch: Partial<KbAnalysisReviewSessionItem['observation']>
    ) => {
      setReviewItems((prev) =>
        prev
          ? prev.map((item) =>
              item.observation.id === observationId
                ? { ...item, observation: { ...item.observation, ...patch } }
                : item
            )
          : prev
      );
    },
    []
  );

  const onGuardiTu = React.useCallback(async () => {
    if (!canPropose || !projectId?.trim() || !repoId) return;
    setBusy(true);
    setError(null);
    setReviewItems(null);
    try {
      const result = await proposeKbDocumentAnalysis(
        apiBase(
          projectId.trim(),
          repoId,
          doc.name,
          content.text ?? '',
          taskContext,
          provider!,
          model!,
          callMeta
        )
      );
      applyAgentResult(result.documentAnalysisMarkdown);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }, [
    canPropose,
    projectId,
    repoId,
    doc.name,
    content.text,
    taskContext,
    provider,
    model,
    callMeta,
    applyAgentResult,
  ]);

  const onStartAnalysis = React.useCallback(async () => {
    if (!canRunAgent || !draft.trim() || !projectId?.trim() || !repoId) return;
    setBusy(true);
    setError(null);
    try {
      const base = apiBase(
        projectId.trim(),
        repoId,
        doc.name,
        content.text ?? '',
        taskContext,
        provider!,
        model!,
        callMeta
      );

      if (routeToObservationReview) {
        const review = await reviewKbDocumentAnalysisObservations({
          ...base,
          agentBaselineMarkdown: baseline,
          userDraftMarkdown: draft,
        });
        setReviewItems(createReviewSessionItems(review));
        setReviewPanelOpen(true);
        return;
      }

      const result = await refineKbDocumentAnalysis({
        ...base,
        draftMarkdown: draft,
      });
      applyAgentResult(result.documentAnalysisMarkdown);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }, [
    canRunAgent,
    draft,
    routeToObservationReview,
    projectId,
    repoId,
    doc.name,
    baseline,
    content.text,
    taskContext,
    provider,
    model,
    callMeta,
    applyAgentResult,
    setReviewPanelOpen,
  ]);

  const onFinalizeAnalysis = React.useCallback(async () => {
    if (!reviewItems || !allConfirmed || !projectId?.trim() || !repoId) return;
    setBusy(true);
    setError(null);
    try {
      const result = await finalizeKbDocumentAnalysis({
        ...apiBase(
          projectId.trim(),
          repoId,
          doc.name,
          content.text ?? '',
          taskContext,
          provider!,
          model!,
          callMeta
        ),
        agentBaselineMarkdown: baseline,
        userDraftMarkdown: draft,
        observations: observationsForFinalize(reviewItems),
      });
      applyAgentResult(result.documentAnalysisMarkdown);
      setReviewItems(null);
      setReviewPanelOpen(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }, [
    reviewItems,
    allConfirmed,
    projectId,
    repoId,
    doc.name,
    baseline,
    draft,
    content.text,
    taskContext,
    provider,
    model,
    callMeta,
    applyAgentResult,
    setReviewPanelOpen,
  ]);

  const onExecute = React.useCallback(() => {
    if (inReviewSession && allConfirmed) {
      void onFinalizeAnalysis();
      return;
    }
    void onStartAnalysis();
  }, [inReviewSession, allConfirmed, onFinalizeAnalysis, onStartAnalysis]);

  const toolbarPresentation = React.useMemo(
    () =>
      resolveKbAnalysisToolbarPresentation({
        baseline,
        draft,
        hasManualEdit,
        inReviewSession,
        allConfirmed,
        reviewHasDisagreement,
        canRunAgent,
      }),
    [
      baseline,
      draft,
      hasManualEdit,
      inReviewSession,
      allConfirmed,
      reviewHasDisagreement,
      canRunAgent,
    ]
  );

  const [sectionToolbarBridge, setSectionToolbarBridgeState] =
    React.useState<KbSectionToolbarBridge | null>(null);
  const lastSectionBridgeSigRef = React.useRef<string | null>(null);

  const setSectionToolbarBridge = React.useCallback((bridge: KbSectionToolbarBridge | null) => {
    if (bridge === null) {
      lastSectionBridgeSigRef.current = null;
      setSectionToolbarBridgeState(null);
      return;
    }
    const sig = JSON.stringify(bridge.presentation);
    if (lastSectionBridgeSigRef.current === sig) return;
    lastSectionBridgeSigRef.current = sig;
    setSectionToolbarBridgeState(bridge);
  }, []);

  React.useEffect(() => {
    lastSectionBridgeSigRef.current = null;
    setSectionToolbarBridgeState(null);
  }, [doc.id]);

  const sectionToolbarPresentationJson = sectionToolbarBridge
    ? JSON.stringify(sectionToolbarBridge.presentation)
    : null;

  const mergedToolbarPresentation = React.useMemo(
    () =>
      mergeKbAnalysisToolbarPresentations([
        toolbarPresentation,
        sectionToolbarBridge?.presentation ?? HIDDEN_SECTION_TOOLBAR,
      ]),
    [toolbarPresentation, sectionToolbarPresentationJson]
  );

  const { executeVisible, executeLabel, executeEnabled, executeEmphasized } =
    mergedToolbarPresentation;

  const onAgree = React.useCallback(
    (observationId: string) => {
      updateReviewItem(observationId, { status: 'confirmed', clarificationDraft: '' });
    },
    [updateReviewItem]
  );

  const onDisagree = React.useCallback(
    (observationId: string) => {
      updateReviewItem(observationId, { status: 'clarifying' });
      setReviewPanelOpen(true);
    },
    [updateReviewItem, setReviewPanelOpen]
  );

  const onClarificationDraftChange = React.useCallback(
    (observationId: string, text: string) => {
      updateReviewItem(observationId, { clarificationDraft: text });
    },
    [updateReviewItem]
  );

  const onSubmitClarification = React.useCallback(
    async (observationId: string) => {
      if (!projectId?.trim() || !repoId || !reviewItems) return;
      const item = reviewItems.find((i) => i.observation.id === observationId);
      if (!item || !item.clarificationDraft.trim()) return;

      setBusyObservationId(observationId);
      setError(null);
      try {
        const result = await clarifyKbDocumentAnalysisObservation({
          ...apiBase(
            projectId.trim(),
            repoId,
            doc.name,
            content.text ?? '',
            taskContext,
            provider!,
            model!,
            callMeta
          ),
          userText: item.observation.text,
          previousInterpretation: item.observation.interpretation,
          userCorrection: item.clarificationDraft.trim(),
        });
        updateObservation(observationId, {
          interpretation: result.interpretation,
          userCorrectionNote: item.clarificationDraft.trim(),
          ...(result.documentExcerpt ? { documentExcerpt: result.documentExcerpt } : {}),
          ...(result.excerptRationale ? { excerptRationale: result.excerptRationale } : {}),
        });
        updateReviewItem(observationId, {
          status: 'pending',
          clarificationDraft: '',
        });
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
      } finally {
        setBusyObservationId(null);
      }
    },
    [
      projectId,
      repoId,
      reviewItems,
      doc.name,
      content.text,
      taskContext,
      provider,
      model,
      callMeta,
      updateObservation,
      updateReviewItem,
    ]
  );

  const onToggleReviewPanel = React.useCallback(() => {
    setReviewPanelOpen(!reviewPanelOpen);
  }, [reviewPanelOpen, setReviewPanelOpen]);

  const onExecuteRef = React.useRef(onExecute);
  onExecuteRef.current = onExecute;
  const onToggleReviewPanelRef = React.useRef(onToggleReviewPanel);
  onToggleReviewPanelRef.current = onToggleReviewPanel;
  const sectionBridgeRef = React.useRef(sectionToolbarBridge);
  sectionBridgeRef.current = sectionToolbarBridge;
  const docToolbarRef = React.useRef(toolbarPresentation);
  docToolbarRef.current = toolbarPresentation;

  const mergedToolbarPresentationRef = React.useRef(mergedToolbarPresentation);
  mergedToolbarPresentationRef.current = mergedToolbarPresentation;

  const onMergedExecute = React.useCallback(() => {
    runMergedAnalysisToolbarAction(mergedToolbarPresentationRef.current, {
      documentPresentation: docToolbarRef.current,
      onDocumentExecute: () => onExecuteRef.current(),
      sectionPresentation: sectionBridgeRef.current?.presentation ?? null,
      onSectionExecute: sectionBridgeRef.current
        ? () => sectionBridgeRef.current!.runAction()
        : null,
    });
  }, []);

  const onMergedExecuteRef = React.useRef(onMergedExecute);
  onMergedExecuteRef.current = onMergedExecute;

  const stableOnToolbarExecute = React.useCallback(() => {
    onMergedExecuteRef.current();
  }, []);

  const stableOnToggleReviewPanel = React.useCallback(() => {
    onToggleReviewPanelRef.current();
  }, []);

  const lastToolbarSnapshotRef = React.useRef('');

  React.useEffect(() => {
    lastToolbarSnapshotRef.current = '';
  }, [doc.id]);

  React.useEffect(() => {
    if (!onToolbarStateChange) return;
    const sectionInReview =
      sectionToolbarBridge?.presentation.phase === 'review_observations';
    const executeBusy = busy || Boolean(sectionToolbarBridge && sectionInReview);
    const reviewToggleVisible = inReviewSession || sectionInReview;
    const snapshot = JSON.stringify({
      executeVisible,
      executeLabel,
      executeEnabled,
      executeEmphasized,
      analysisTabHighlight: executeEmphasized,
      executeBusy,
      reviewToggleVisible,
      reviewPanelOpen,
    });
    if (lastToolbarSnapshotRef.current === snapshot) return;
    lastToolbarSnapshotRef.current = snapshot;
    onToolbarStateChange({
      executeVisible,
      executeLabel,
      executeEnabled,
      executeEmphasized,
      analysisTabHighlight: executeEmphasized,
      executeBusy,
      onExecute: stableOnToolbarExecute,
      reviewToggleVisible,
      reviewPanelOpen,
      onToggleReviewPanel: stableOnToggleReviewPanel,
    });
  }, [
    onToolbarStateChange,
    executeVisible,
    executeLabel,
    executeEnabled,
    executeEmphasized,
    busy,
    inReviewSession,
    reviewPanelOpen,
    sectionToolbarPresentationJson,
    stableOnToolbarExecute,
    stableOnToggleReviewPanel,
  ]);

  React.useEffect(() => {
    return () => onToolbarStateChange?.(null);
  }, [onToolbarStateChange]);

  return (
    <div
      {...{ [TUTOR_ID_ATTR]: UI_IDS.kbAnalysisResult }}
      className="flex min-h-0 flex-1 flex-col gap-2 overflow-hidden p-2"
    >
      {showGuide ? (
        <div className="shrink-0 space-y-1.5 text-sm leading-relaxed text-slate-300">
          <p>{KB_ANALYSIS_GUIDE_DRAFT}</p>
          <p>
            {KB_ANALYSIS_GUIDE_PROPOSE_PREFIX}
            <button
              type="button"
              disabled={!canPropose}
              onClick={() => void onGuardiTu()}
              className="font-medium text-violet-200 underline decoration-violet-500/50 underline-offset-2 hover:text-violet-50 disabled:opacity-50"
            >
              {busy && !inReviewSession ? (
                <Loader2 className="mr-0.5 inline h-3.5 w-3.5 animate-spin align-text-bottom" aria-hidden />
              ) : null}
              {KB_ANALYSIS_GUIDE_CLICK_HERE}
            </button>
            {KB_ANALYSIS_GUIDE_PROPOSE_SUFFIX}
          </p>
        </div>
      ) : null}

      {!hasModel ? (
        <p className="shrink-0 text-xs text-amber-200/90" role="alert">
          Seleziona il modello LLM designer (Motore IA) per abilitare l&apos;analisi.
        </p>
      ) : null}

      {!hasRepo ? (
        <p className="shrink-0 text-xs text-amber-200/90" role="alert">
          Documento non ancora caricato nel repository — attendi il completamento dell&apos;upload.
        </p>
      ) : null}

      {error ? (
        <p className="shrink-0 rounded border border-red-800/70 bg-red-950/40 px-3 py-2 text-xs text-red-200">
          {error}
        </p>
      ) : null}

      <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
        {showReviewPanel && reviewItems ? (
          <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden rounded-md border border-violet-700/60 bg-violet-950/20">
            <KbAnalysisObservationReviewPanel
              items={reviewItems}
              confirmedCount={confirmedCount}
              busyObservationId={busyObservationId}
              globalBusy={busy}
              onAgree={onAgree}
              onDisagree={onDisagree}
              onClarificationDraftChange={onClarificationDraftChange}
              onSubmitClarification={(id) => void onSubmitClarification(id)}
            />
          </div>
        ) : (
          <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden rounded-md border border-slate-700/80 bg-slate-950/50">
            {analysisStarted ? (
              <p className="shrink-0 border-b border-slate-800/80 px-2 py-1 text-[10px] leading-snug text-slate-500">
                Sezioni colorate:{' '}
                <span className="text-cyan-300">Entities</span> ·{' '}
                <span className="text-amber-200">Sinonimi</span> ·{' '}
                <span className="text-violet-300">Dialogo</span> ·{' '}
                <span className="text-pink-300">Disambiguazione</span> ·{' '}
                <span className="text-orange-300">Dati mancanti</span> ·{' '}
                <span className="text-emerald-300">Mapping</span> ·{' '}
                <span className="text-stone-400 italic">Fonte:</span>
              </p>
            ) : null}
            {analysisStarted && repoId ? (
              <KbDocumentAnalysisEditProvider
                doc={doc}
                onUpdateDoc={onUpdateDoc}
                projectId={projectId}
                repositoryDocumentId={repoId}
                documentName={doc.name}
                documentSampleText={content.text ?? ''}
                taskContext={taskContext}
                provider={provider}
                model={model}
                callMeta={callMeta}
                disabled={!canEdit || busy}
                onSectionToolbarBridgeChange={setSectionToolbarBridge}
              >
                <KbDocumentAnalysisWorkspace
                  draft={draft}
                  agentBaseline={baseline}
                  onDraftChange={canEdit && !busy ? persistDraft : () => {}}
                  readOnly={!canEdit || busy}
                />
              </KbDocumentAnalysisEditProvider>
            ) : (
              <KbDocumentAnalysisWorkspace
                draft={draft}
                agentBaseline={baseline}
                onDraftChange={canEdit && !busy ? persistDraft : () => {}}
                readOnly={!canEdit || busy}
              />
            )}
          </div>
        )}
      </div>
    </div>
  );
}

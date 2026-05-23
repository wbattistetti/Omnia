/**
 * Tab «Analisi del documento»: guida, pannello revisione + splitter + Monaco.
 */

import React from 'react';
import { Loader2 } from 'lucide-react';
import type * as Monaco from 'monaco-editor';
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
  KB_ANALYSIS_FINALIZE_BUTTON,
  KB_ANALYSIS_GUIDE_CLICK_HERE,
  KB_ANALYSIS_GUIDE_DRAFT,
  KB_ANALYSIS_GUIDE_PROPOSE_PREFIX,
  KB_ANALYSIS_GUIDE_PROPOSE_SUFFIX,
} from '@domain/knowledgeBase/kbDocumentAnalysisGuide';
import {
  allReviewItemsConfirmed,
  countConfirmedReviewItems,
  createReviewSessionItems,
  observationsForFinalize,
  shouldRunObservationReview,
  type KbAnalysisReviewSessionItem,
} from '@domain/knowledgeBase/kbDocumentAnalysisWorkflow';
import { KbMarkdownMonaco } from '@components/workspaces/elevenlabs/kb/KbMarkdownMonaco';
import { KbAnalysisObservationReviewPanel } from './KbAnalysisObservationReviewPanel';
import { KbRowSplitter } from './KbRowSplitter';
import { useKbDocumentContent } from './useKbDocumentContent';

export interface KbDocumentAnalysisTabProps {
  doc: StagedKbDocument;
  projectId?: string;
  disabled?: boolean;
  callMeta?: AiCallMeta;
  taskContext?: KbDocumentAnalysisTaskContext;
  onUpdateDoc: (patch: KbDocumentPatch) => void;
}

const DEFAULT_REVIEW_SHARE = 0.38;
const MIN_REVIEW_PX = 120;
const MAX_REVIEW_SHARE = 0.72;

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

export function KbDocumentAnalysisTab({
  doc,
  projectId,
  disabled = false,
  callMeta,
  taskContext,
  onUpdateDoc,
}: KbDocumentAnalysisTabProps): React.ReactElement {
  const { provider, model } = useAIProvider();
  const editorRef = React.useRef<Monaco.editor.IStandaloneCodeEditor | null>(null);
  const splitBodyRef = React.useRef<HTMLDivElement>(null);
  const resizeRef = React.useRef<{ startY: number; startShare: number; height: number } | null>(
    null
  );

  const [busy, setBusy] = React.useState(false);
  const [busyObservationId, setBusyObservationId] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [draft, setDraft] = React.useState(doc.documentAnalysisMarkdown);
  const [reviewItems, setReviewItems] = React.useState<KbAnalysisReviewSessionItem[] | null>(null);
  const [reviewPanelShare, setReviewPanelShare] = React.useState(DEFAULT_REVIEW_SHARE);

  const inReview = reviewItems !== null && reviewItems.length > 0;

  React.useEffect(() => {
    setDraft(doc.documentAnalysisMarkdown);
    setError(null);
    setReviewItems(null);
    setBusyObservationId(null);
  }, [doc.id, doc.documentAnalysisMarkdown]);

  const repoId = doc.repositoryDocumentId?.trim();
  const content = useKbDocumentContent(projectId, repoId);
  const canEdit = !disabled && doc.parseStatus !== 'parsing';
  const hasModel = Boolean(provider?.trim() && model?.trim());
  const hasRepo = Boolean(repoId);
  const baseline = doc.agentAnalysisBaselineMarkdown;

  const canRunAgent =
    canEdit && hasModel && Boolean(projectId?.trim()) && hasRepo && !busy && !inReview;

  const canStartAnalysis = canRunAgent && draft.trim().length > 0;
  const canPropose = canRunAgent;
  const allConfirmed = reviewItems ? allReviewItemsConfirmed(reviewItems) : false;
  const confirmedCount = reviewItems ? countConfirmedReviewItems(reviewItems) : 0;

  const persistDraft = React.useCallback(
    (next: string) => {
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
      onUpdateDoc({
        documentAnalysisMarkdown: next,
        agentAnalysisBaselineMarkdown: next,
      });
    },
    [onUpdateDoc]
  );

  const focusEditor = React.useCallback(() => {
    editorRef.current?.focus();
  }, []);

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
      focusEditor();
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
    focusEditor,
  ]);

  const onStartAnalysis = React.useCallback(async () => {
    if (!canStartAnalysis || !projectId?.trim() || !repoId) return;
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

      if (shouldRunObservationReview(baseline, draft)) {
        const review = await reviewKbDocumentAnalysisObservations({
          ...base,
          agentBaselineMarkdown: baseline,
          userDraftMarkdown: draft,
        });
        setReviewItems(createReviewSessionItems(review));
        setReviewPanelShare(DEFAULT_REVIEW_SHARE);
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
    canStartAnalysis,
    projectId,
    repoId,
    doc.name,
    draft,
    baseline,
    content.text,
    taskContext,
    provider,
    model,
    callMeta,
    applyAgentResult,
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
  ]);

  const onDismissReview = React.useCallback(() => {
    setReviewItems(null);
    setError(null);
    focusEditor();
  }, [focusEditor]);

  const onAgree = React.useCallback(
    (observationId: string) => {
      updateReviewItem(observationId, { status: 'confirmed', clarificationDraft: '' });
    },
    [updateReviewItem]
  );

  const onDisagree = React.useCallback(
    (observationId: string) => {
      updateReviewItem(observationId, { status: 'clarifying' });
    },
    [updateReviewItem]
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

  const onReviewResizePointerDown = React.useCallback(
    (e: React.PointerEvent) => {
      e.preventDefault();
      const height = splitBodyRef.current?.clientHeight ?? 400;
      resizeRef.current = {
        startY: e.clientY,
        startShare: reviewPanelShare,
        height,
      };
      (e.target as HTMLElement).setPointerCapture(e.pointerId);
    },
    [reviewPanelShare]
  );

  const onReviewResizePointerMove = React.useCallback((e: React.PointerEvent) => {
    const st = resizeRef.current;
    if (!st || st.height <= 0) return;
    const delta = e.clientY - st.startY;
    setReviewPanelShare(
      Math.min(MAX_REVIEW_SHARE, Math.max(MIN_REVIEW_PX / st.height, st.startShare + delta / st.height))
    );
  }, []);

  const finishReviewResize = React.useCallback(() => {
    resizeRef.current = null;
  }, []);

  const reviewPanelHeight = `${Math.round(reviewPanelShare * 100)}%`;

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-hidden p-3">
      <div className="shrink-0 space-y-2 text-sm leading-relaxed text-slate-300">
        <p>{KB_ANALYSIS_GUIDE_DRAFT}</p>
        <p>
          {KB_ANALYSIS_GUIDE_PROPOSE_PREFIX}
          <button
            type="button"
            disabled={!canPropose}
            onClick={() => void onGuardiTu()}
            className="font-medium text-violet-200 underline decoration-violet-500/50 underline-offset-2 hover:text-violet-50 disabled:opacity-50"
          >
            {busy && !inReview ? (
              <Loader2 className="mr-0.5 inline h-3.5 w-3.5 animate-spin align-text-bottom" aria-hidden />
            ) : null}
            {KB_ANALYSIS_GUIDE_CLICK_HERE}
          </button>
          {KB_ANALYSIS_GUIDE_PROPOSE_SUFFIX}
        </p>
      </div>

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

      <div
        ref={splitBodyRef}
        className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden"
      >
        {inReview && reviewItems ? (
          <>
            <div
              className="min-h-0 shrink-0 overflow-hidden rounded-md border border-violet-700/60 bg-violet-950/20"
              style={{ height: reviewPanelHeight, minHeight: MIN_REVIEW_PX }}
            >
              <KbAnalysisObservationReviewPanel
                items={reviewItems}
                confirmedCount={confirmedCount}
                busyObservationId={busyObservationId}
                globalBusy={busy}
                onAgree={onAgree}
                onDisagree={onDisagree}
                onClarificationDraftChange={onClarificationDraftChange}
                onSubmitClarification={(id) => void onSubmitClarification(id)}
                onDismissReview={onDismissReview}
              />
            </div>
            <KbRowSplitter
              ariaLabel="Ridimensiona pannello revisione"
              onPointerDown={onReviewResizePointerDown}
              onPointerMove={onReviewResizePointerMove}
              onPointerEnd={finishReviewResize}
            />
          </>
        ) : null}

        <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden rounded-md border border-slate-700/80 bg-slate-950/50">
          <KbMarkdownMonaco
            value={draft}
            onChange={canEdit && !inReview ? persistDraft : undefined}
            readOnly={!canEdit || inReview}
            fillHeight
            appearance="plain"
            ariaLabel="Analisi del documento in Markdown"
            editorDidMount={(editor) => {
              editorRef.current = editor;
            }}
          />
        </div>
      </div>

      {inReview ? (
        <div className="flex shrink-0 justify-end">
          <button
            type="button"
            disabled={!allConfirmed || busy}
            onClick={() => void onFinalizeAnalysis()}
            className="inline-flex items-center gap-2 rounded-md border border-emerald-600/80 bg-emerald-950/50 px-4 py-2 text-sm font-medium text-emerald-50 hover:bg-emerald-900/50 disabled:opacity-50"
          >
            {busy ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : null}
            {KB_ANALYSIS_FINALIZE_BUTTON}
          </button>
        </div>
      ) : (
        <div className="flex shrink-0 justify-end">
          <button
            type="button"
            disabled={!canStartAnalysis}
            onClick={() => void onStartAnalysis()}
            className="inline-flex items-center gap-2 rounded-md border border-violet-600/80 bg-violet-950/50 px-4 py-2 text-sm font-medium text-violet-50 hover:bg-violet-900/50 disabled:opacity-50"
          >
            {busy ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : null}
            Avvia analisi
          </button>
        </div>
      )}
    </div>
  );
}

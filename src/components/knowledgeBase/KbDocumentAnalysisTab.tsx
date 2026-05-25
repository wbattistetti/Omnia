/**
 * Tab «Analisi del documento»: guida, pannello revisione a schermo intero o Monaco.
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
  KB_ANALYSIS_GUIDE_CLICK_HERE,
  KB_ANALYSIS_GUIDE_DRAFT,
  KB_ANALYSIS_GUIDE_PROPOSE_PREFIX,
  KB_ANALYSIS_GUIDE_PROPOSE_SUFFIX,
} from '@domain/knowledgeBase/kbDocumentAnalysisGuide';
import type { KbAnalysisToolbarState } from '@domain/knowledgeBase/kbAnalysisToolbarState';
import {
  allReviewItemsConfirmed,
  countConfirmedReviewItems,
  createReviewSessionItems,
  observationsForFinalize,
  resolveKbAnalysisToolbarPresentation,
  shouldRunObservationReview,
  type KbAnalysisReviewSessionItem,
} from '@domain/knowledgeBase/kbDocumentAnalysisWorkflow';
import { KbMarkdownMonaco } from '@components/workspaces/elevenlabs/kb/KbMarkdownMonaco';
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
  const editorRef = React.useRef<Monaco.editor.IStandaloneCodeEditor | null>(null);

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

  const repoId = doc.repositoryDocumentId?.trim();
  const content = useKbDocumentContent(projectId, repoId);
  const canEdit = !disabled && doc.parseStatus !== 'parsing';
  const hasModel = Boolean(provider?.trim() && model?.trim());
  const hasRepo = Boolean(repoId);
  const baseline = doc.agentAnalysisBaselineMarkdown;

  const allConfirmed = reviewItems ? allReviewItemsConfirmed(reviewItems) : false;
  const confirmedCount = reviewItems ? countConfirmedReviewItems(reviewItems) : 0;
  const draftDiffersFromBaseline = shouldRunObservationReview(baseline, draft);
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
    if (!canRunAgent || !draft.trim() || !projectId?.trim() || !repoId) return;
    setBusy(true);
    setError(null);
    setAnalysisStarted(true);
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

      if (draftDiffersFromBaseline) {
        const review = await reviewKbDocumentAnalysisObservations({
          ...base,
          agentBaselineMarkdown: baseline,
          userDraftMarkdown: draft,
        });
        setReviewItems(createReviewSessionItems(review));
        setReviewPanelShare(DEFAULT_REVIEW_SHARE);
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
    draftDiffersFromBaseline,
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

  const toolbarPresentation = resolveKbAnalysisToolbarPresentation({
    baseline,
    draft,
    hasManualEdit,
    inReviewSession,
    allConfirmed,
    reviewHasDisagreement,
    canRunAgent,
  });

  const { executeVisible, executeLabel, executeEnabled, executeEmphasized } =
    toolbarPresentation;

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

  React.useEffect(() => {
    if (!onToolbarStateChange) return;
    onToolbarStateChange({
      executeVisible,
      executeLabel,
      executeEnabled,
      executeEmphasized,
      analysisTabHighlight: executeEmphasized,
      executeBusy: busy,
      onExecute: () => onExecuteRef.current(),
      reviewToggleVisible: inReviewSession,
      reviewPanelOpen,
      onToggleReviewPanel: () => onToggleReviewPanelRef.current(),
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
            <KbMarkdownMonaco
              value={draft}
              onChange={canEdit && !busy ? persistDraft : undefined}
              readOnly={!canEdit || busy}
              fillHeight
              appearance="plain"
              ariaLabel="Analisi del documento in Markdown"
              editorDidMount={(editor) => {
                editorRef.current = editor;
              }}
            />
          </div>
        )}
      </div>
    </div>
  );
}

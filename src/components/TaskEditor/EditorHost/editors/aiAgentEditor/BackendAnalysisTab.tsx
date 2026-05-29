/**
 * Tab «Analisi dei backend»: stesso ciclo iterativo dell'analisi documento KB.
 */

import React from 'react';
import { Loader2 } from 'lucide-react';
import { useAIProvider } from '@context/AIProviderContext';
import { taskRepository } from '@services/TaskRepository';
import type { AiCallMeta } from '@services/aiAgentDesignApi';
import { AI_CALL_PURPOSE } from '@domain/aiCalls/purposes';
import {
  patchAgentBackendAnalysisBundle,
  readAgentBackendAnalysisBundle,
} from '@domain/backendAnalysis/agentBackendAnalysisBundle';
import { exportBackendAnalysisV2Markdown } from '@domain/backendAnalysis/exportBackendAnalysisV2Markdown';
import {
  ensureCatalogBackendsOnDocument,
  markdownToBackendAnalysisV2,
} from '@domain/backendAnalysis/migrateToBackendAnalysisV2';
import {
  clarifyBackendAnalysisObservation,
  finalizeBackendAnalysis,
  proposeBackendAnalysis,
  refineBackendAnalysis,
  reviewBackendAnalysisObservations,
} from '@domain/backendAnalysis/backendAnalysisApi';
import {
  BACKEND_ANALYSIS_DISMISS_REVIEW,
  BACKEND_ANALYSIS_EXCERPT_EMPTY,
  BACKEND_ANALYSIS_EXCERPT_LABEL,
  BACKEND_ANALYSIS_FINALIZE_BUTTON,
  BACKEND_ANALYSIS_GUIDE_CLICK_HERE,
  BACKEND_ANALYSIS_GUIDE_DRAFT,
  BACKEND_ANALYSIS_GUIDE_PROPOSE_PREFIX,
  BACKEND_ANALYSIS_GUIDE_PROPOSE_SUFFIX,
  BACKEND_ANALYSIS_REVIEW_PANEL_TITLE,
  BACKEND_ANALYSIS_STRUCTURE_BUTTON,
} from '@domain/backendAnalysis/backendAnalysisGuide';
import { useAgentBackendAnalysis } from './AgentBackendAnalysisContext';
import { BackendAnalysisWorkspace } from './BackendAnalysisWorkspace';
import { useRegisterBackendAnalysisDocumentActions } from './backendAnalysis/BackendAnalysisDocumentActionsContext';
import {
  useOptionalBackendAnalysisEdit,
} from './backendAnalysis/BackendAnalysisEditContext';
import { resolveCatalogEntryIdForObservation } from '@domain/backendAnalysis/resolveCatalogEntryIdForObservation';
import { buildSectionBaselinesFromDocument } from '@domain/backendAnalysis/backendAnalysisSectionBaselines';
import { buildBackendReferenceCorpus } from '@domain/backendAnalysis/buildBackendReferenceCorpus';
import { collectBackendAnalysisStructureContext } from '@domain/backendAnalysis/collectBackendAnalysisStructureContext';
import { structureBackendAnalysis } from '@domain/backendAnalysis/structureBackendAnalysis';
import {
  allReviewItemsConfirmed,
  countConfirmedReviewItems,
  createReviewSessionItems,
  observationsForFinalize,
  resolveBackendAnalysisToolbarPresentation,
  shouldRunObservationReview,
  type KbAnalysisReviewSessionItem,
} from '@domain/backendAnalysis/backendAnalysisWorkflow';
import type { ManualCatalogEntry } from '@domain/backendCatalog/catalogTypes';
import type { ProjectBackendCatalogBlob } from '@domain/backendCatalog/catalogTypes';
import type { KbDocumentAnalysisTaskContext } from '@domain/knowledgeBase/kbDocumentAnalysisApi';
import {
  KB_ANALYSIS_AGREE_NO,
  KB_ANALYSIS_AGREE_PROMPT,
  KB_ANALYSIS_AGREE_YES,
  KB_ANALYSIS_CLARIFY_PROMPT,
  KB_ANALYSIS_CLARIFY_SUBMIT,
  KB_ANALYSIS_CONFIRMED_BADGE,
  KB_ANALYSIS_EXCERPT_RATIONALE_LABEL,
  KB_ANALYSIS_RESPONSE_CHIP_LABEL,
  KB_ANALYSIS_STATUS_CLARIFYING,
  KB_ANALYSIS_STATUS_PENDING,
} from '@domain/knowledgeBase/kbDocumentAnalysisGuide';
import { KbAnalysisObservationReviewPanel } from '@components/knowledgeBase/KbAnalysisObservationReviewPanel';
import type { KbAnalysisObservationReviewCopy } from '@components/knowledgeBase/KbAnalysisObservationReviewPanel';
import type { StagedKbDocument } from '@domain/knowledgeBase/kbDocumentTypes';

const REVIEW_COPY: KbAnalysisObservationReviewCopy = {
  panelTitle: BACKEND_ANALYSIS_REVIEW_PANEL_TITLE,
  documentExcerptLabel: BACKEND_ANALYSIS_EXCERPT_LABEL,
  documentExcerptEmpty: BACKEND_ANALYSIS_EXCERPT_EMPTY,
  agentResponseLabel: 'Risposta',
  agreePrompt: KB_ANALYSIS_AGREE_PROMPT,
  agreeYes: KB_ANALYSIS_AGREE_YES,
  agreeNo: KB_ANALYSIS_AGREE_NO,
  clarifyPrompt: KB_ANALYSIS_CLARIFY_PROMPT,
  clarifySubmit: KB_ANALYSIS_CLARIFY_SUBMIT,
  confirmedBadge: KB_ANALYSIS_CONFIRMED_BADGE,
  excerptRationaleLabel: KB_ANALYSIS_EXCERPT_RATIONALE_LABEL,
  responseChipLabel: KB_ANALYSIS_RESPONSE_CHIP_LABEL,
  statusPending: KB_ANALYSIS_STATUS_PENDING,
  statusClarifying: KB_ANALYSIS_STATUS_CLARIFYING,
  userQuestionLabel: 'Domanda',
  userObservationLabel: 'Osservazione',
  createSpecLabel: 'Crea nuove specifiche',
  createSpecAlreadyLabel: 'Specifica già creata',
  specExtensionChipLabel: 'Bozza IA (review)',
  createSpecComposePrompt:
    'Indica cosa formalizzare nella specifica API (modifica il testo, poi genera).',
  createSpecComposeSubmit: 'Genera specifica',
  createSpecComposeCancel: 'Annulla',
};

function hasReviewDisagreement(items: readonly KbAnalysisReviewSessionItem[]): boolean {
  return items.some(
    (item) =>
      item.status === 'clarifying' ||
      Boolean(item.observation.userCorrectionNote?.trim())
  );
}

function buildKbContextMarkdown(documents: readonly StagedKbDocument[]): string {
  const blocks: string[] = [];
  for (const doc of documents) {
    const text = String(doc.documentAnalysisMarkdown ?? doc.markdownSnippet ?? '').trim();
    if (!text) continue;
    blocks.push(`### ${doc.name}\n${text.slice(0, 6_000)}`);
  }
  return blocks.join('\n\n');
}

export type BackendAnalysisTabProps = {
  projectId: string | undefined;
  agentTaskId: string;
  manualEntries: readonly ManualCatalogEntry[];
  backendCatalog: ProjectBackendCatalogBlob;
  onPersistCatalog: (next: ProjectBackendCatalogBlob) => void;
  taskContext?: KbDocumentAnalysisTaskContext;
  kbDocuments?: readonly StagedKbDocument[];
  callMeta?: AiCallMeta;
  disabled?: boolean;
};

export function BackendAnalysisTab({
  projectId,
  agentTaskId,
  manualEntries,
  backendCatalog,
  onPersistCatalog,
  taskContext,
  kbDocuments = [],
  callMeta,
  disabled = false,
}: BackendAnalysisTabProps): React.ReactElement {
  const { provider, model } = useAIProvider();
  const { analysisMarkdown: contextMarkdown, document: analysisDocument } =
    useAgentBackendAnalysis();
  const backendEdit = useOptionalBackendAnalysisEdit();

  const stored = readAgentBackendAnalysisBundle(backendCatalog, agentTaskId);
  const [busy, setBusy] = React.useState(false);
  const [busyObservationId, setBusyObservationId] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [draft, setDraft] = React.useState(stored.analysisMarkdown);
  const [reviewItems, setReviewItems] = React.useState<KbAnalysisReviewSessionItem[] | null>(null);
  const [analysisStarted, setAnalysisStarted] = React.useState(
    () => Boolean(stored.agentAnalysisBaselineMarkdown.trim())
  );
  const [hasManualEdit, setHasManualEdit] = React.useState(false);
  const [reviewPanelOpen, setReviewPanelOpen] = React.useState(true);

  const baseline = stored.agentAnalysisBaselineMarkdown;
  const inReviewSession = reviewItems !== null && reviewItems.length > 0;
  const showReviewPanel = inReviewSession && reviewPanelOpen;
  const canEdit = !disabled;
  const hasModel = Boolean(provider?.trim() && model?.trim());
  const hasBackends = manualEntries.length > 0;

  React.useEffect(() => {
    const next = readAgentBackendAnalysisBundle(backendCatalog, agentTaskId);
    setDraft(next.analysisMarkdown);
    setReviewItems(null);
    setBusyObservationId(null);
    setAnalysisStarted(Boolean(next.agentAnalysisBaselineMarkdown.trim()));
    setHasManualEdit(false);
    setReviewPanelOpen(true);
    setError(null);
    // Reset solo al cambio agente: persistDraft aggiorna backendCatalog senza chiudere la review.
  }, [agentTaskId, backendCatalog]);

  const referenceCorpus = React.useMemo(() => {
    const tasks = taskRepository.getAllTasks();
    return buildBackendReferenceCorpus({
      manualEntries,
      tasks,
      agentTaskSummary: taskContext?.agentTaskSummary,
      kbContextMarkdown: buildKbContextMarkdown(kbDocuments),
    });
  }, [manualEntries, taskContext?.agentTaskSummary, kbDocuments]);

  const structureContext = React.useMemo(
    () =>
      collectBackendAnalysisStructureContext(
        manualEntries,
        taskRepository.getAllTasks()
      ),
    [manualEntries]
  );

  const allConfirmed = reviewItems ? allReviewItemsConfirmed(reviewItems) : false;
  const confirmedCount = reviewItems ? countConfirmedReviewItems(reviewItems) : 0;
  const draftDiffersFromBaseline = shouldRunObservationReview(baseline, draft);
  const reviewHasDisagreement = reviewItems ? hasReviewDisagreement(reviewItems) : false;
  const showGuide = !analysisStarted;

  const canRunAgent =
    canEdit && hasModel && Boolean(projectId?.trim()) && hasBackends && !busy;

  const persistSnapshot = React.useCallback(
    (patch: {
      analysisMarkdown?: string;
      agentAnalysisBaselineMarkdown?: string;
      analysisDocument?: import('@domain/backendAnalysis/backendAnalysisDocumentV2').BackendAnalysisDocumentV2;
    }) => {
      onPersistCatalog(patchAgentBackendAnalysisBundle(backendCatalog, agentTaskId, patch));
    },
    [backendCatalog, agentTaskId, onPersistCatalog]
  );

  const persistDraft = React.useCallback(
    (next: string) => {
      setHasManualEdit(true);
      setDraft(next);
      if (next !== stored.analysisMarkdown) {
        persistSnapshot({ analysisMarkdown: next });
      }
    },
    [stored.analysisMarkdown, persistSnapshot]
  );

  const applyStructuredMarkdown = React.useCallback(
    (markdown: string) => {
      const tasks = taskRepository.getAllTasks();
      const doc = ensureCatalogBackendsOnDocument(
        markdownToBackendAnalysisV2(markdown, manualEntries, tasks),
        manualEntries,
        tasks
      );
      const exported = exportBackendAnalysisV2Markdown(doc);
      setDraft(exported);
      setHasManualEdit(false);
      setAnalysisStarted(true);
      persistSnapshot({
        analysisDocument: doc,
        analysisMarkdown: exported,
        agentAnalysisBaselineMarkdown: exported,
        sectionBaselines: buildSectionBaselinesFromDocument(doc),
      });
    },
    [manualEntries, persistSnapshot]
  );

  const onStructureDocument = React.useCallback(() => {
    if (!canEdit || busy) return;
    const source = draft.trim() || contextMarkdown.trim();
    const result = structureBackendAnalysis({
      rawText: source,
      context: structureContext,
      title: taskContext?.agentTaskSummary?.trim().split('\n')[0]?.slice(0, 80),
    });
    applyStructuredMarkdown(result.markdown);
    if (result.ambiguities.length > 0) {
      setError(
        `Documento strutturato. Ambiguità: ${result.ambiguities.slice(0, 2).join(' ')}`
      );
    } else {
      setError(null);
    }
  }, [
    canEdit,
    busy,
    draft,
    contextMarkdown,
    structureContext,
    taskContext?.agentTaskSummary,
    applyStructuredMarkdown,
  ]);

  const applyAgentResult = React.useCallback(
    (markdown: string) => {
      const trimmed = markdown.trim();
      const structured = structureBackendAnalysis({
        rawText: trimmed,
        context: structureContext,
        title: taskContext?.agentTaskSummary?.trim().split('\n')[0]?.slice(0, 80),
      });
      applyStructuredMarkdown(structured.markdown);
    },
    [applyStructuredMarkdown, structureContext, taskContext?.agentTaskSummary]
  );

  const apiBase = React.useCallback(
    () => ({
      projectId: projectId!.trim(),
      agentTaskId,
      referenceCorpus,
      taskContext,
      provider: provider!,
      model: model!,
      callMeta,
    }),
    [projectId, agentTaskId, referenceCorpus, taskContext, provider, model, callMeta]
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
    if (!canRunAgent || !projectId?.trim()) return;
    setBusy(true);
    setError(null);
    setReviewItems(null);
    try {
      const result = await proposeBackendAnalysis({
        ...apiBase(),
        purposeOverride: AI_CALL_PURPOSE.BACKEND_PROPOSE_ANALYSIS,
      });
      applyAgentResult(result.backendAnalysisMarkdown);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }, [canRunAgent, projectId, apiBase, applyAgentResult]);

  const onStartAnalysis = React.useCallback(async () => {
    if (!canRunAgent || !draft.trim() || !projectId?.trim()) return;
    setBusy(true);
    setError(null);
    setAnalysisStarted(true);
    try {
      const base = apiBase();
      if (draftDiffersFromBaseline) {
        const review = await reviewBackendAnalysisObservations({
          ...base,
          agentBaselineMarkdown: baseline,
          userDraftMarkdown: draft,
          purposeOverride: AI_CALL_PURPOSE.BACKEND_REVIEW_ANALYSIS_OBSERVATIONS,
        });
        setReviewItems(createReviewSessionItems(review));
        setReviewPanelOpen(true);
        return;
      }
      const result = await refineBackendAnalysis({
        ...base,
        draftMarkdown: draft,
        purposeOverride: AI_CALL_PURPOSE.BACKEND_REFINE_ANALYSIS,
      });
      applyAgentResult(result.backendAnalysisMarkdown);
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
    baseline,
    apiBase,
    applyAgentResult,
  ]);

  const onFinalizeAnalysis = React.useCallback(async () => {
    if (!reviewItems || !allConfirmed || !projectId?.trim()) return;
    setBusy(true);
    setError(null);
    try {
      const result = await finalizeBackendAnalysis({
        ...apiBase(),
        agentBaselineMarkdown: baseline,
        userDraftMarkdown: draft,
        observations: observationsForFinalize(reviewItems),
        purposeOverride: AI_CALL_PURPOSE.BACKEND_FINALIZE_ANALYSIS,
      });
      applyAgentResult(result.backendAnalysisMarkdown);
      setReviewItems(null);
      setReviewPanelOpen(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }, [reviewItems, allConfirmed, projectId, baseline, draft, apiBase, applyAgentResult]);

  const onExecute = React.useCallback(() => {
    if (inReviewSession && allConfirmed) {
      void onFinalizeAnalysis();
      return;
    }
    void onStartAnalysis();
  }, [inReviewSession, allConfirmed, onFinalizeAnalysis, onStartAnalysis]);

  const toolbar = resolveBackendAnalysisToolbarPresentation({
    baseline,
    draft,
    hasManualEdit,
    inReviewSession,
    allConfirmed,
    reviewHasDisagreement,
    canRunAgent,
  });

  const registerDocumentActions = useRegisterBackendAnalysisDocumentActions();
  React.useEffect(() => {
    registerDocumentActions({
      presentation: toolbar,
      busy,
      onExecute: () => onExecute(),
    });
    return () => registerDocumentActions(null);
  }, [registerDocumentActions, toolbar, busy, onExecute]);

  React.useEffect(() => {
    if (inReviewSession && allConfirmed) {
      setReviewPanelOpen(false);
    }
  }, [inReviewSession, allConfirmed]);

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
    [updateReviewItem]
  );

  const onSubmitClarification = React.useCallback(
    async (observationId: string) => {
      if (!projectId?.trim() || !reviewItems) return;
      const item = reviewItems.find((i) => i.observation.id === observationId);
      if (!item?.clarificationDraft.trim()) return;
      setBusyObservationId(observationId);
      setError(null);
      try {
        const res = await clarifyBackendAnalysisObservation({
          ...apiBase(),
          userText: item.observation.text,
          previousInterpretation: item.observation.interpretation,
          userCorrection: item.clarificationDraft.trim(),
          purposeOverride: AI_CALL_PURPOSE.BACKEND_CLARIFY_ANALYSIS_OBSERVATION,
        });
        updateObservation(observationId, {
          interpretation: res.interpretation,
          documentExcerpt: res.documentExcerpt,
          excerptRationale: res.excerptRationale,
          userCorrectionNote: item.clarificationDraft.trim(),
        });
        updateReviewItem(observationId, { status: 'pending', clarificationDraft: '' });
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
      } finally {
        setBusyObservationId(null);
      }
    },
    [projectId, reviewItems, apiBase, updateObservation, updateReviewItem]
  );

  const onCreateSuggestedFeature = React.useCallback(
    (observationId: string, designerBrief: string) => {
      if (!backendEdit || !reviewItems) return;
      const item = reviewItems.find((i) => i.observation.id === observationId);
      if (!item) return;
      const catalogEntryId = resolveCatalogEntryIdForObservation(
        item.observation.text,
        manualEntries,
        analysisDocument
      );
      if (!catalogEntryId) return;
      void backendEdit.createSuggestedFeatureForCatalogEntry(
        catalogEntryId,
        item.observation,
        designerBrief
      );
    },
    [backendEdit, reviewItems, manualEntries, analysisDocument]
  );

  const observationHasSuggestedFeature = React.useCallback(
    (observationId: string) =>
      backendEdit?.hasSuggestedFeatureForObservationAnyBackend(observationId) ?? false,
    [backendEdit]
  );

  return (
    <div className="relative flex min-h-0 flex-1 flex-col gap-2 overflow-hidden">
      <div className="flex shrink-0 flex-wrap items-center justify-between gap-2">
        <p className="text-xs text-slate-400">
          {manualEntries.length} backend · corpus {referenceCorpus.length.toLocaleString()} caratteri
        </p>
        <button
          type="button"
          disabled={!canEdit || busy || (!draft.trim() && !contextMarkdown.trim())}
          onClick={onStructureDocument}
          title="Normalizza nel formato Analisi backend + PayoffData"
          className="rounded-md border border-slate-600/80 bg-slate-900/60 px-3 py-1 text-sm font-medium text-slate-200 hover:bg-slate-800/80 disabled:opacity-50"
        >
          {BACKEND_ANALYSIS_STRUCTURE_BUTTON}
        </button>
      </div>

      {showGuide ? (
        <div className="shrink-0 space-y-1.5 text-sm leading-relaxed text-slate-300">
          <p>{BACKEND_ANALYSIS_GUIDE_DRAFT}</p>
          <p>
            {BACKEND_ANALYSIS_GUIDE_PROPOSE_PREFIX}
            <button
              type="button"
              disabled={!canRunAgent}
              onClick={() => void onGuardiTu()}
              className="font-medium text-violet-200 underline decoration-violet-500/50 underline-offset-2 hover:text-violet-50 disabled:opacity-50"
            >
              {busy && !inReviewSession ? (
                <Loader2 className="mr-0.5 inline h-3.5 w-3.5 animate-spin align-text-bottom" aria-hidden />
              ) : null}
              {BACKEND_ANALYSIS_GUIDE_CLICK_HERE}
            </button>
            {BACKEND_ANALYSIS_GUIDE_PROPOSE_SUFFIX}
          </p>
        </div>
      ) : null}

      {!hasModel ? (
        <p className="shrink-0 text-xs text-amber-200/90" role="alert">
          Seleziona il modello LLM designer per abilitare l&apos;analisi.
        </p>
      ) : null}

      {!hasBackends ? (
        <p className="shrink-0 text-xs text-amber-200/90" role="alert">
          Aggiungi almeno un backend nel catalogo prima di avviare l&apos;analisi.
        </p>
      ) : null}

      {error ? (
        <p className="shrink-0 rounded border border-red-800/70 bg-red-950/40 px-3 py-2 text-xs text-red-200">
          {error}
        </p>
      ) : null}

      <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
        {showReviewPanel && reviewItems ? (
          <div className="relative flex min-h-0 flex-1 flex-col overflow-hidden rounded-md border border-violet-700/60 bg-slate-950">
            <KbAnalysisObservationReviewPanel
              opaqueSurface
              copy={REVIEW_COPY}
              items={reviewItems}
              confirmedCount={confirmedCount}
              busyObservationId={busyObservationId}
              globalBusy={busy}
              onAgree={onAgree}
              onDisagree={onDisagree}
              onClarificationDraftChange={(id, text) =>
                updateReviewItem(id, { clarificationDraft: text })
              }
              onSubmitClarification={(id) => void onSubmitClarification(id)}
              onCreateSuggestedFeature={
                backendEdit ? onCreateSuggestedFeature : undefined
              }
              createSpecBusyObservationId={
                backendEdit?.createSpecBusyObservationId ?? busyObservationId
              }
              observationHasSuggestedFeature={
                backendEdit ? observationHasSuggestedFeature : undefined
              }
            />
            <footer className="flex shrink-0 items-center justify-between gap-2 border-t border-violet-900/40 px-3 py-2">
              <button
                type="button"
                disabled={busy}
                onClick={() => setReviewPanelOpen(false)}
                className="text-xs text-violet-300 underline hover:text-violet-100 disabled:opacity-50"
              >
                {BACKEND_ANALYSIS_DISMISS_REVIEW}
              </button>
              <button
                type="button"
                disabled={busy || !allConfirmed}
                onClick={() => void onFinalizeAnalysis()}
                className="inline-flex items-center gap-1.5 rounded-md border border-emerald-700/70 bg-emerald-950/50 px-3 py-1 text-sm font-medium text-emerald-100 hover:bg-emerald-900/40 disabled:opacity-50"
              >
                {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden /> : null}
                {BACKEND_ANALYSIS_FINALIZE_BUTTON}
              </button>
            </footer>
          </div>
        ) : (
          <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden rounded-md border border-slate-700/80 bg-slate-950/50 p-2">
            <BackendAnalysisWorkspace />
          </div>
        )}
      </div>

      {inReviewSession && !reviewPanelOpen ? (
        <button
          type="button"
          className="absolute bottom-3 right-3 z-10 rounded-md border border-violet-600/60 bg-violet-950/80 px-2 py-1 text-[11px] font-semibold text-violet-100"
          onClick={() => setReviewPanelOpen(true)}
        >
          Revisione ({confirmedCount}/{reviewItems!.length})
        </button>
      ) : null}
    </div>
  );
}

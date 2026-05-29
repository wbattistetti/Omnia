/**
 * Contesto edit/revisione per sezioni Monaco analisi backend (revisione su «Aggiorna»).
 */

import React from 'react';
import type { AiCallMeta } from '@services/aiAgentDesignApi';
import {
  clarifyBackendAnalysisObservation,
  proposeBackendAnalysis,
  refineBackendAnalysis,
  reviewBackendAnalysisObservations,
  createSuggestedFeatureFromObservation,
} from '@domain/backendAnalysis/backendAnalysisApi';
import { buildBackendReferenceCorpus } from '@domain/backendAnalysis/buildBackendReferenceCorpus';
import {
  buildCatalogEntryAnalysisDraft,
  catalogEntryHasCompleteIaAnalysis,
  catalogEntryNeedsIaAnalysis,
  catalogEntryHasSubstantiveAnalysis,
  catalogEntryMergeChangedContent,
  diagnoseCatalogEntryMerge,
  mergeCatalogEntryAnalysisFromMarkdown,
} from '@domain/backendAnalysis/mergeCatalogEntryAnalysis';
import { debugTextPreview, logBackendAnalysis } from '@domain/backendAnalysis/backendAnalysisDebug';
import { backendHasParameterAnalysis } from '@domain/backendAnalysis/backendAnalysisDisplayRules';
import { collectBackendAnalysisStructureContext } from '@domain/backendAnalysis/collectBackendAnalysisStructureContext';
import {
  resolveCatalogEntryOpenApiContentHash,
  withAnalysisOpenApiContentHash,
} from '@domain/backendAnalysis/catalogEntryAnalysisStaleAfterSpecRefresh';
import { structureBackendAnalysis } from '@domain/backendAnalysis/structureBackendAnalysis';
import type { ManualCatalogEntry } from '@domain/backendCatalog/catalogTypes';
import { taskRepository } from '@services/TaskRepository';
import {
  allReviewItemsConfirmed,
  createReviewSessionItems,
  resolveSectionEditsToolbarPresentation,
  shouldRunObservationReview,
  type KbAnalysisReviewSessionItem,
  type KbAnalysisToolbarPresentation,
} from '@domain/backendAnalysis/backendAnalysisWorkflow';
import type { KbDocumentAnalysisTaskContext } from '@domain/knowledgeBase/kbDocumentAnalysisApi';
import {
  patchAgentBackendAnalysisBundle,
  readAgentBackendAnalysisBundle,
} from '@domain/backendAnalysis/agentBackendAnalysisBundle';
import type { ProjectBackendCatalogBlob } from '@domain/backendCatalog/catalogTypes';
import {
  catalogEntryIdFromSectionId,
  sectionIdBelongsToCatalogEntry,
  sectionReviewHeading,
  type BackendAnalysisSectionId,
} from '@domain/backendAnalysis/backendAnalysisSectionIds';
import { AI_CALL_PURPOSE } from '@domain/aiCalls/purposes';
import type { KbAnalysisObservation } from '@domain/knowledgeBase/kbDocumentAnalysisWorkflow';
import { buildSectionBaselinesFromDocument } from '@domain/backendAnalysis/backendAnalysisSectionBaselines';
import {
  applyCatalogSectionDraftsToDocument,
  clearCatalogEntrySectionDrafts,
} from '@domain/backendAnalysis/applyCatalogSectionDraftsToDocument';
import { useAgentBackendAnalysis } from '../AgentBackendAnalysisContext';

export type BackendAnalysisEditContextValue = {
  getSectionBaseline: (sectionId: BackendAnalysisSectionId) => string;
  confirmSectionBaseline: (sectionId: BackendAnalysisSectionId, text: string) => void;
  getSectionReview: (sectionId: BackendAnalysisSectionId) => readonly KbAnalysisReviewSessionItem[] | null;
  sectionReviewBusy: boolean;
  busyObservationId: string | null;
  notifySectionDraftChange: (sectionId: BackendAnalysisSectionId, draft: string) => void;
  getSectionDraft: (sectionId: BackendAnalysisSectionId, fallback: string) => string;
  setSectionDraft: (sectionId: BackendAnalysisSectionId, draft: string) => void;
  flushCatalogEntryDraftsToDocument: (catalogEntryId: string) => void;
  sectionToolbarPresentation: KbAnalysisToolbarPresentation;
  runSectionToolbarAction: () => void;
  getBackendSectionToolbarPresentation: (catalogEntryId: string) => KbAnalysisToolbarPresentation;
  runBackendSectionToolbarAction: (catalogEntryId: string) => void;
  /** Avvia propose/refine IA per un backend del catalogo (dopo analisi globale). */
  runCatalogEntryAnalysis: (
    catalogEntryId: string,
    options?: { force?: boolean }
  ) => Promise<void>;
  catalogEntryAnalysisDoneId: string | null;
  catalogEntryAnalysisBusyId: string | null;
  catalogEntryAnalysisErrorId: string | null;
  catalogEntryAnalysisError: string | null;
  onAgree: (sectionId: BackendAnalysisSectionId, observationId: string) => void;
  onDisagree: (sectionId: BackendAnalysisSectionId, observationId: string) => void;
  onClarificationDraftChange: (
    sectionId: BackendAnalysisSectionId,
    observationId: string,
    text: string
  ) => void;
  onSubmitClarification: (sectionId: BackendAnalysisSectionId, observationId: string) => void;
  onCreateSuggestedFeature: (
    sectionId: BackendAnalysisSectionId,
    observationId: string,
    designerBrief: string
  ) => void;
  createSuggestedFeatureForCatalogEntry: (
    catalogEntryId: string,
    observation: KbAnalysisObservation,
    designerBrief: string
  ) => Promise<void>;
  hasSuggestedFeatureForObservation: (
    catalogEntryId: string,
    observationId: string
  ) => boolean;
  hasSuggestedFeatureForObservationAnyBackend: (observationId: string) => boolean;
  createSpecBusyObservationId: string | null;
  highlightSuggestedFeature: { catalogEntryId: string; featureId: string } | null;
  canRunReview: boolean;
};

const BackendAnalysisEditContext = React.createContext<BackendAnalysisEditContextValue | null>(
  null
);

export function useBackendAnalysisEdit(): BackendAnalysisEditContextValue {
  const ctx = React.useContext(BackendAnalysisEditContext);
  if (!ctx) {
    throw new Error('useBackendAnalysisEdit must be used within BackendAnalysisEditProvider');
  }
  return ctx;
}

export function useOptionalBackendAnalysisEdit(): BackendAnalysisEditContextValue | null {
  return React.useContext(BackendAnalysisEditContext);
}

export type BackendAnalysisEditProviderProps = {
  projectId: string | undefined;
  agentTaskId: string;
  manualEntries: readonly ManualCatalogEntry[];
  backendCatalog: ProjectBackendCatalogBlob;
  onPersistCatalog: (next: ProjectBackendCatalogBlob) => void;
  referenceCorpus: string;
  kbContextMarkdown?: string;
  taskContext?: KbDocumentAnalysisTaskContext;
  provider: string | undefined;
  model: string | undefined;
  callMeta?: AiCallMeta;
  disabled?: boolean;
  children: React.ReactNode;
};

export function BackendAnalysisEditProvider({
  projectId,
  agentTaskId,
  manualEntries,
  backendCatalog,
  onPersistCatalog,
  referenceCorpus,
  kbContextMarkdown = '',
  taskContext,
  provider,
  model,
  callMeta,
  disabled = false,
  children,
}: BackendAnalysisEditProviderProps): React.ReactElement {
  const { document, persistDocument } = useAgentBackendAnalysis();
  const catalogRef = React.useRef(backendCatalog);
  catalogRef.current = backendCatalog;

  const bundle = React.useMemo(
    () => readAgentBackendAnalysisBundle(backendCatalog, agentTaskId),
    [backendCatalog, agentTaskId]
  );

  const [sectionBaselines, setSectionBaselines] = React.useState<Record<string, string>>(
    () => ({ ...bundle.sectionBaselines })
  );
  const [reviewsBySection, setReviewsBySection] = React.useState<
    Record<string, KbAnalysisReviewSessionItem[]>
  >({});
  const [sectionReviewBusy, setSectionReviewBusy] = React.useState(false);
  const [busyObservationId, setBusyObservationId] = React.useState<string | null>(null);
  const [sectionDrafts, setSectionDrafts] = React.useState<Record<string, string>>({});
  const [pendingSectionIds, setPendingSectionIds] = React.useState<Set<string>>(() => new Set());
  const [catalogEntryAnalysisBusyId, setCatalogEntryAnalysisBusyId] = React.useState<
    string | null
  >(null);
  const [catalogEntryAnalysisErrorId, setCatalogEntryAnalysisErrorId] = React.useState<
    string | null
  >(null);
  const [catalogEntryAnalysisError, setCatalogEntryAnalysisError] = React.useState<string | null>(
    null
  );
  const [catalogEntryAnalysisDoneId, setCatalogEntryAnalysisDoneId] = React.useState<
    string | null
  >(null);
  const [createSpecBusyObservationId, setCreateSpecBusyObservationId] = React.useState<
    string | null
  >(null);
  const [highlightSuggestedFeature, setHighlightSuggestedFeature] = React.useState<{
    catalogEntryId: string;
    featureId: string;
  } | null>(null);

  React.useEffect(() => {
    setSectionBaselines({ ...bundle.sectionBaselines });
    setReviewsBySection({});
    setSectionDrafts({});
    setPendingSectionIds(new Set());
  }, [agentTaskId, bundle.sectionBaselines]);

  const persistBaselines = React.useCallback(
    (next: Record<string, string>) => {
      setSectionBaselines(next);
      onPersistCatalog(
        patchAgentBackendAnalysisBundle(catalogRef.current, agentTaskId, {
          sectionBaselines: next,
        })
      );
    },
    [agentTaskId, onPersistCatalog]
  );

  /** Prima apertura: baseline sezione da documento se non ancora salvate. */
  React.useEffect(() => {
    const stored = bundle.sectionBaselines;
    const hasStored = Object.values(stored).some((v) => v.trim());
    if (hasStored) return;
    const built = buildSectionBaselinesFromDocument(document);
    const hasBuilt = Object.values(built).some((v) => v.trim());
    if (!hasBuilt) return;
    persistBaselines(built);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- solo seed iniziale per agente
  }, [agentTaskId]);

  const getSectionBaseline = React.useCallback(
    (sectionId: BackendAnalysisSectionId) => sectionBaselines[sectionId] ?? '',
    [sectionBaselines]
  );

  const confirmSectionBaseline = React.useCallback(
    (sectionId: BackendAnalysisSectionId, text: string) => {
      const next = { ...sectionBaselines, [sectionId]: text };
      persistBaselines(next);
      setReviewsBySection((prev) => {
        const copy = { ...prev };
        delete copy[sectionId];
        return copy;
      });
      setPendingSectionIds((prev) => {
        const next = new Set(prev);
        next.delete(sectionId);
        return next;
      });
      setSectionDrafts((prev) => {
        const copy = { ...prev };
        delete copy[sectionId];
        return copy;
      });
    },
    [sectionBaselines, persistBaselines]
  );

  const getSectionReview = React.useCallback(
    (sectionId: BackendAnalysisSectionId) => reviewsBySection[sectionId] ?? null,
    [reviewsBySection]
  );

  const canRunReview =
    !disabled &&
    Boolean(projectId?.trim()) &&
    Boolean(provider?.trim()) &&
    Boolean(model?.trim());

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

  const runSectionReview = React.useCallback(
    async (sectionId: BackendAnalysisSectionId, draft: string) => {
      if (!canRunReview) return;
      const baseline = sectionBaselines[sectionId] ?? '';
      if (!shouldRunObservationReview(baseline, draft)) {
        setReviewsBySection((prev) => {
          const copy = { ...prev };
          delete copy[sectionId];
          return copy;
        });
        return;
      }
      setSectionReviewBusy(true);
      try {
        const heading = sectionReviewHeading(sectionId);
        const review = await reviewBackendAnalysisObservations({
          ...apiBase(),
          agentBaselineMarkdown: `${heading}\n\n${baseline}`,
          userDraftMarkdown: `${heading}\n\n${draft}`,
          purposeOverride: AI_CALL_PURPOSE.BACKEND_REVIEW_ANALYSIS_OBSERVATIONS,
        });
        setReviewsBySection((prev) => ({
          ...prev,
          [sectionId]: createReviewSessionItems(review),
        }));
      } catch {
        /* error surfaced at tab level if needed */
      } finally {
        setSectionReviewBusy(false);
      }
    },
    [canRunReview, sectionBaselines, apiBase]
  );

  const getSectionDraft = React.useCallback(
    (sectionId: BackendAnalysisSectionId, fallback: string) =>
      sectionDrafts[sectionId] ?? fallback,
    [sectionDrafts]
  );

  const setSectionDraft = React.useCallback(
    (sectionId: BackendAnalysisSectionId, draft: string) => {
      setSectionDrafts((prev) => ({ ...prev, [sectionId]: draft }));
    },
    []
  );

  const notifySectionDraftChange = React.useCallback(
    (sectionId: BackendAnalysisSectionId, draft: string) => {
      setSectionDrafts((prev) => ({ ...prev, [sectionId]: draft }));
      const baseline = sectionBaselines[sectionId] ?? '';
      setPendingSectionIds((prev) => {
        const next = new Set(prev);
        if (shouldRunObservationReview(baseline, draft)) {
          next.add(sectionId);
        } else {
          next.delete(sectionId);
        }
        return next;
      });
    },
    [sectionBaselines]
  );

  const flushCatalogEntryDraftsToDocument = React.useCallback(
    (catalogEntryId: string) => {
      const nextDoc = applyCatalogSectionDraftsToDocument(
        document,
        catalogEntryId,
        sectionDrafts
      );
      if (nextDoc !== document) {
        persistDocument(nextDoc);
      }
      setSectionDrafts((prev) => clearCatalogEntrySectionDrafts(prev, catalogEntryId));
    },
    [document, persistDocument, sectionDrafts]
  );

  const runPendingSectionReviews = React.useCallback(async () => {
    const ids = [...pendingSectionIds];
    for (const sectionId of ids) {
      const draft = sectionDrafts[sectionId];
      if (draft === undefined) continue;
      await runSectionReview(sectionId as BackendAnalysisSectionId, draft);
    }
  }, [pendingSectionIds, sectionDrafts, runSectionReview]);

  const sectionReviewMeta = React.useMemo(() => {
    const entries = Object.entries(reviewsBySection).filter(
      (pair): pair is [string, KbAnalysisReviewSessionItem[]] => {
        const items = pair[1];
        return Boolean(items && items.length > 0);
      }
    );
    const inReviewSession = entries.length > 0;
    const allConfirmed =
      inReviewSession &&
      entries.every(([, items]) => allReviewItemsConfirmed(items));
    const reviewHasDisagreement = entries.some(([, items]) =>
      items.some(
        (item) =>
          item.status === 'clarifying' ||
          Boolean(item.observation.userCorrectionNote?.trim())
      )
    );
    let readyToApplyCount = 0;
    for (const [, items] of entries) {
      if (allReviewItemsConfirmed(items)) readyToApplyCount += 1;
    }
    return { inReviewSession, allConfirmed, reviewHasDisagreement, readyToApplyCount };
  }, [reviewsBySection]);

  const sectionToolbarPresentation = React.useMemo(
    () =>
      resolveSectionEditsToolbarPresentation({
        pendingSectionCount: pendingSectionIds.size,
        inReviewSession: sectionReviewMeta.inReviewSession,
        allConfirmed: sectionReviewMeta.allConfirmed,
        reviewHasDisagreement: sectionReviewMeta.reviewHasDisagreement,
        canRunReview,
        readyToApplyCount: sectionReviewMeta.readyToApplyCount,
      }),
    [pendingSectionIds.size, sectionReviewMeta, canRunReview]
  );

  const applyConfirmedSections = React.useCallback(() => {
    for (const [sectionId, items] of Object.entries(reviewsBySection)) {
      if (!items?.length || !allReviewItemsConfirmed(items)) continue;
      const draft = sectionDrafts[sectionId];
      if (draft === undefined) continue;
      confirmSectionBaseline(sectionId as BackendAnalysisSectionId, draft);
    }
  }, [reviewsBySection, sectionDrafts, confirmSectionBaseline]);

  const runSectionToolbarAction = React.useCallback(() => {
    if (sectionToolbarPresentation.phase === 'request_review') {
      void runPendingSectionReviews();
      return;
    }
    if (sectionToolbarPresentation.phase === 'apply_update') {
      applyConfirmedSections();
    }
  }, [
    sectionToolbarPresentation.phase,
    runPendingSectionReviews,
    applyConfirmedSections,
  ]);

  const getBackendSectionToolbarPresentation = React.useCallback(
    (catalogEntryId: string): KbAnalysisToolbarPresentation => {
      const belongs = (sid: string) => sectionIdBelongsToCatalogEntry(sid, catalogEntryId);
      const pendingCount = [...pendingSectionIds].filter(belongs).length;
      const reviewEntries = Object.entries(reviewsBySection).filter(
        (pair): pair is [string, KbAnalysisReviewSessionItem[]] => {
          const items = pair[1];
          return Boolean(items?.length && belongs(pair[0]));
        }
      );
      const inReviewSession = reviewEntries.length > 0;
      const allConfirmed =
        inReviewSession &&
        reviewEntries.every(([, items]) => allReviewItemsConfirmed(items));
      const reviewHasDisagreement = reviewEntries.some(([, items]) =>
        items.some(
          (item) =>
            item.status === 'clarifying' ||
            Boolean(item.observation.userCorrectionNote?.trim())
        )
      );
      let readyToApplyCount = 0;
      for (const [, items] of reviewEntries) {
        if (allReviewItemsConfirmed(items)) readyToApplyCount += 1;
      }
      const resolved = resolveSectionEditsToolbarPresentation({
        pendingSectionCount: pendingCount,
        inReviewSession,
        allConfirmed,
        reviewHasDisagreement,
        canRunReview,
        readyToApplyCount,
      });
      if (resolved.phase === 'review_observations') {
        return { ...resolved, executeVisible: false };
      }
      return resolved;
    },
    [pendingSectionIds, reviewsBySection, canRunReview]
  );

  const runPendingSectionReviewsForBackend = React.useCallback(
    async (catalogEntryId: string) => {
      const belongs = (sid: string) => sectionIdBelongsToCatalogEntry(sid, catalogEntryId);
      const ids = [...pendingSectionIds].filter(belongs);
      for (const sectionId of ids) {
        const draft = sectionDrafts[sectionId];
        if (draft === undefined) continue;
        await runSectionReview(sectionId as BackendAnalysisSectionId, draft);
      }
    },
    [pendingSectionIds, sectionDrafts, runSectionReview]
  );

  const applyConfirmedSectionsForBackend = React.useCallback(
    (catalogEntryId: string) => {
      const belongs = (sid: string) => sectionIdBelongsToCatalogEntry(sid, catalogEntryId);
      const toConfirm: Array<{ sectionId: BackendAnalysisSectionId; draft: string }> = [];
      for (const [sectionId, items] of Object.entries(reviewsBySection)) {
        if (!belongs(sectionId)) continue;
        if (!items?.length || !allReviewItemsConfirmed(items)) continue;
        const draft = sectionDrafts[sectionId];
        if (draft === undefined) continue;
        toConfirm.push({ sectionId: sectionId as BackendAnalysisSectionId, draft });
      }
      flushCatalogEntryDraftsToDocument(catalogEntryId);
      for (const { sectionId, draft } of toConfirm) {
        confirmSectionBaseline(sectionId, draft);
      }
    },
    [
      reviewsBySection,
      sectionDrafts,
      confirmSectionBaseline,
      flushCatalogEntryDraftsToDocument,
    ]
  );

  const runBackendSectionToolbarAction = React.useCallback(
    (catalogEntryId: string) => {
      const presentation = getBackendSectionToolbarPresentation(catalogEntryId);
      if (presentation.phase === 'request_review') {
        void runPendingSectionReviewsForBackend(catalogEntryId);
        return;
      }
      if (presentation.phase === 'apply_update') {
        applyConfirmedSectionsForBackend(catalogEntryId);
      }
    },
    [
      getBackendSectionToolbarPresentation,
      runPendingSectionReviewsForBackend,
      applyConfirmedSectionsForBackend,
    ]
  );

  const runCatalogEntryAnalysis = React.useCallback(
    async (catalogEntryId: string, options?: { force?: boolean }) => {
      if (!canRunReview) {
        setCatalogEntryAnalysisErrorId(catalogEntryId);
        setCatalogEntryAnalysisError('Seleziona provider e modello IA nelle impostazioni.');
        return;
      }
      const entry = manualEntries.find((e) => e.id === catalogEntryId);
      if (!entry) return;

      const backend = document.backends[catalogEntryId];
      const isRetry = catalogEntryAnalysisErrorId === catalogEntryId;
      const force = Boolean(options?.force);
      if (
        backend &&
        catalogEntryHasCompleteIaAnalysis(backend) &&
        !isRetry &&
        !force
      ) {
        logBackendAnalysis('catalog.skip', {
          catalogEntryId,
          displayLabel: entry.label,
          reason: 'analisi_già_completa',
          howToUseChars: backend.howToUseMarkdown.trim().length,
        });
        return;
      }

      setCatalogEntryAnalysisBusyId(catalogEntryId);
      setCatalogEntryAnalysisErrorId(null);
      setCatalogEntryAnalysisError(null);
      setCatalogEntryAnalysisDoneId(null);
      try {
        const tasks = taskRepository.getAllTasks();
        const scopedCorpus = buildBackendReferenceCorpus({
          manualEntries,
          tasks,
          agentTaskSummary: taskContext?.agentTaskSummary,
          kbContextMarkdown,
          catalogEntryId,
        });
        if (!scopedCorpus.trim()) {
          throw new Error('Corpus di riferimento vuoto per questo backend.');
        }

        const displayLabel = entry.label?.trim() || entry.id;
        const draft = buildCatalogEntryAnalysisDraft(document, catalogEntryId, displayLabel);
        const useRefine = Boolean(backend && backendHasParameterAnalysis(backend));

        logBackendAnalysis('catalog.start', {
          catalogEntryId,
          displayLabel,
          endpointUrl: entry.endpointUrl,
          force,
          useRefine,
          corpusChars: scopedCorpus.length,
          corpusPreview: debugTextPreview(scopedCorpus, 320),
          beforeHowToChars: backend?.howToUseMarkdown.trim().length ?? 0,
          beforeParamCount: Object.keys(backend?.parameters ?? {}).length,
        });

        const result = useRefine
          ? await refineBackendAnalysis({
              ...apiBase(),
              referenceCorpus: scopedCorpus,
              draftMarkdown: draft,
              purposeOverride: AI_CALL_PURPOSE.BACKEND_REFINE_ANALYSIS,
            })
          : await proposeBackendAnalysis({
              ...apiBase(),
              referenceCorpus: scopedCorpus,
              purposeOverride: AI_CALL_PURPOSE.BACKEND_PROPOSE_ANALYSIS,
            });

        logBackendAnalysis('catalog.ia_response', {
          catalogEntryId,
          displayLabel,
          mode: useRefine ? 'refine' : 'propose',
          rawMarkdownChars: result.backendAnalysisMarkdown.length,
          rawPreview: debugTextPreview(result.backendAnalysisMarkdown),
        });

        const structured = structureBackendAnalysis({
          rawText: result.backendAnalysisMarkdown.trim(),
          context: collectBackendAnalysisStructureContext(manualEntries, tasks),
          title: taskContext?.agentTaskSummary?.trim().split('\n')[0]?.slice(0, 80),
        });

        const beforeBackend = document.backends[catalogEntryId];
        const mergeDiag = diagnoseCatalogEntryMerge(
          document,
          structured.markdown,
          catalogEntryId,
          manualEntries,
          tasks
        );
        logBackendAnalysis('catalog.structured', {
          catalogEntryId,
          structuredChars: structured.markdown.length,
          structuredPreview: debugTextPreview(structured.markdown),
          ambiguities: structured.ambiguities,
          mergeDiag,
        });

        const merged = mergeCatalogEntryAnalysisFromMarkdown(
          document,
          structured.markdown,
          catalogEntryId,
          manualEntries,
          tasks
        );
        const afterBackend = merged.backends[catalogEntryId];
        const mergeChanged = catalogEntryMergeChangedContent(beforeBackend, afterBackend);
        const hasSubstance = afterBackend
          ? catalogEntryHasSubstantiveAnalysis(afterBackend)
          : false;
        if (!afterBackend || (!mergeChanged && !hasSubstance)) {
          logBackendAnalysis('catalog.merge_rejected', {
            catalogEntryId,
            displayLabel,
            mergeChanged,
            hasSubstance,
            mergeDiag,
            afterHowToChars: afterBackend?.howToUseMarkdown.trim().length ?? 0,
          });
          throw new Error(
            `L'analisi IA non è stata applicata a «${displayLabel}» (sezione backend non riconosciuta o risposta vuota). ` +
              `Riprova con «Rigenera IA»: la risposta deve contenere ## Backend: ${displayLabel} [chip], tabella parametri e blocco PayoffData. ` +
              'Apri la console (F12): cerca [Omnia BackendAnalysis].'
          );
        }
        logBackendAnalysis('catalog.done', {
          catalogEntryId,
          displayLabel,
          mergeChanged,
          complete: afterBackend ? catalogEntryHasCompleteIaAnalysis(afterBackend) : false,
          afterHowToChars: afterBackend?.howToUseMarkdown.trim().length ?? 0,
          paramsWithSubstance: Object.values(afterBackend?.parameters ?? {}).filter(
            (p) =>
              Boolean(p.analysisSummary.trim()) ||
              Boolean(p.analysisDetailMarkdown.trim()) ||
              Boolean(p.descriptionShort.trim()) ||
              Boolean(p.role.trim())
          ).length,
        });
        const builtBaselines = buildSectionBaselinesFromDocument(merged);
        const nextBaselines = { ...sectionBaselines };
        for (const [sid, text] of Object.entries(builtBaselines)) {
          if (sectionIdBelongsToCatalogEntry(sid, catalogEntryId)) {
            nextBaselines[sid] = text;
          }
        }
        setSectionBaselines(nextBaselines);
        setSectionDrafts((prev) => clearCatalogEntrySectionDrafts(prev, catalogEntryId));
        const contentHash = resolveCatalogEntryOpenApiContentHash(
          entry,
          taskRepository.getTask(catalogEntryId)
        );
        const mergedWithHash = {
          ...merged,
          backends: {
            ...merged.backends,
            [catalogEntryId]: withAnalysisOpenApiContentHash(
              merged.backends[catalogEntryId]!,
              contentHash
            ),
          },
        };
        persistDocument(mergedWithHash, { sectionBaselines: nextBaselines });
        logBackendAnalysis('catalog.persisted', {
          catalogEntryId,
          howToUseChars: afterBackend?.howToUseMarkdown.trim().length ?? 0,
          baselineKeys: Object.keys(nextBaselines).filter((k) =>
            sectionIdBelongsToCatalogEntry(k, catalogEntryId)
          ).length,
        });
        setCatalogEntryAnalysisDoneId(catalogEntryId);
      } catch (e) {
        const message = e instanceof Error ? e.message : String(e);
        logBackendAnalysis('catalog.error', {
          catalogEntryId,
          displayLabel: entry.label?.trim() || catalogEntryId,
          message,
        });
        setCatalogEntryAnalysisErrorId(catalogEntryId);
        setCatalogEntryAnalysisError(message);
      } finally {
        setCatalogEntryAnalysisBusyId(null);
      }
    },
    [
      canRunReview,
      manualEntries,
      document,
      taskContext?.agentTaskSummary,
      kbContextMarkdown,
      apiBase,
      persistDocument,
      sectionBaselines,
      persistBaselines,
      catalogEntryAnalysisErrorId,
    ]
  );

  const updateReviewItem = React.useCallback(
    (
      sectionId: BackendAnalysisSectionId,
      observationId: string,
      patch: Partial<KbAnalysisReviewSessionItem>
    ) => {
      setReviewsBySection((prev) => {
        const items = prev[sectionId];
        if (!items) return prev;
        return {
          ...prev,
          [sectionId]: items.map((item) =>
            item.observation.id === observationId ? { ...item, ...patch } : item
          ),
        };
      });
    },
    []
  );

  const updateObservation = React.useCallback(
    (
      sectionId: BackendAnalysisSectionId,
      observationId: string,
      patch: Partial<KbAnalysisReviewSessionItem['observation']>
    ) => {
      setReviewsBySection((prev) => {
        const items = prev[sectionId];
        if (!items) return prev;
        return {
          ...prev,
          [sectionId]: items.map((item) =>
            item.observation.id === observationId
              ? { ...item, observation: { ...item.observation, ...patch } }
              : item
          ),
        };
      });
    },
    []
  );

  const onAgree = React.useCallback(
    (sectionId: BackendAnalysisSectionId, observationId: string) => {
      updateReviewItem(sectionId, observationId, { status: 'confirmed', clarificationDraft: '' });
    },
    [updateReviewItem]
  );

  const onDisagree = React.useCallback(
    (sectionId: BackendAnalysisSectionId, observationId: string) => {
      updateReviewItem(sectionId, observationId, { status: 'clarifying' });
    },
    [updateReviewItem]
  );

  const onClarificationDraftChange = React.useCallback(
    (sectionId: BackendAnalysisSectionId, observationId: string, text: string) => {
      updateReviewItem(sectionId, observationId, { clarificationDraft: text });
    },
    [updateReviewItem]
  );

  const onSubmitClarification = React.useCallback(
    async (sectionId: BackendAnalysisSectionId, observationId: string) => {
      if (!canRunReview) return;
      const items = reviewsBySection[sectionId];
      const item = items?.find((i) => i.observation.id === observationId);
      if (!item?.clarificationDraft.trim()) return;
      setBusyObservationId(observationId);
      try {
        const res = await clarifyBackendAnalysisObservation({
          ...apiBase(),
          userText: item.observation.text,
          previousInterpretation: item.observation.interpretation,
          userCorrection: item.clarificationDraft.trim(),
          purposeOverride: AI_CALL_PURPOSE.BACKEND_CLARIFY_ANALYSIS_OBSERVATION,
        });
        updateObservation(sectionId, observationId, {
          interpretation: res.interpretation,
          documentExcerpt: res.documentExcerpt,
          excerptRationale: res.excerptRationale,
          userCorrectionNote: item.clarificationDraft.trim(),
        });
        updateReviewItem(sectionId, observationId, { status: 'pending', clarificationDraft: '' });
      } finally {
        setBusyObservationId(null);
      }
    },
    [canRunReview, reviewsBySection, apiBase, updateObservation, updateReviewItem]
  );

  const hasSuggestedFeatureForObservation = React.useCallback(
    (catalogEntryId: string, observationId: string) => {
      const backend = document.backends[catalogEntryId];
      return (backend?.suggestedFeatures ?? []).some(
        (f) => f.sourceObservationId === observationId
      );
    },
    [document.backends]
  );

  const hasSuggestedFeatureForObservationAnyBackend = React.useCallback(
    (observationId: string) =>
      Object.keys(document.backends).some((id) =>
        hasSuggestedFeatureForObservation(id, observationId)
      ),
    [document.backends, hasSuggestedFeatureForObservation]
  );

  const appendSuggestedFeatureToBackend = React.useCallback(
    (
      catalogEntryId: string,
      feature: ReturnType<typeof materializeObservationSuggestedFeature>,
      observationId: string,
      source: 'review_draft' | 'ia_generate'
    ) => {
      if (!feature) return;
      const existing = document.backends[catalogEntryId];
      const entry = manualEntries.find((e) => e.id === catalogEntryId);
      const backendLabel =
        existing?.displayLabel ?? entry?.label?.trim() ?? catalogEntryId;
      const nextFeatures = [...(existing?.suggestedFeatures ?? []), feature];
      persistDocument({
        ...document,
        backends: {
          ...document.backends,
          [catalogEntryId]: {
            ...(existing ?? {
              catalogEntryId,
              displayLabel: backendLabel,
              howToUseMarkdown: '',
              parameters: {},
              suggestedFeatures: [],
            }),
            suggestedFeatures: nextFeatures,
          },
        },
      });
      setHighlightSuggestedFeature({
        catalogEntryId,
        featureId: feature.id,
      });
      logBackendAnalysis('suggestedFeature.created', {
        catalogEntryId,
        observationId,
        featureId: feature.id,
        title: feature.title,
        source,
      });
    },
    [document, manualEntries, persistDocument]
  );

  const createSuggestedFeatureForCatalogEntry = React.useCallback(
    async (
      catalogEntryId: string,
      observation: KbAnalysisObservation,
      designerBrief: string
    ) => {
      if (!canRunReview) return;
      const brief = designerBrief.trim();
      if (!brief) return;
      if (hasSuggestedFeatureForObservation(catalogEntryId, observation.id)) return;

      const backend = document.backends[catalogEntryId];
      const entry = manualEntries.find((e) => e.id === catalogEntryId);
      const backendLabel = backend?.displayLabel ?? entry?.label?.trim() ?? catalogEntryId;

      setCreateSpecBusyObservationId(observation.id);
      try {
        const feature = await createSuggestedFeatureFromObservation({
          ...apiBase(),
          backendLabel,
          designerQuestion: observation.text,
          confirmedInterpretation: brief,
          purposeOverride: AI_CALL_PURPOSE.BACKEND_CREATE_SUGGESTED_FEATURE,
        });
        appendSuggestedFeatureToBackend(
          catalogEntryId,
          { ...feature, sourceObservationId: observation.id },
          observation.id,
          'ia_generate'
        );
      } finally {
        setCreateSpecBusyObservationId(null);
      }
    },
    [
      apiBase,
      appendSuggestedFeatureToBackend,
      canRunReview,
      hasSuggestedFeatureForObservation,
      manualEntries,
      document.backends,
    ]
  );

  const onCreateSuggestedFeature = React.useCallback(
    async (
      sectionId: BackendAnalysisSectionId,
      observationId: string,
      designerBrief: string
    ) => {
      const catalogEntryId = catalogEntryIdFromSectionId(sectionId);
      if (!catalogEntryId) return;

      const items = reviewsBySection[sectionId];
      const item = items?.find((i) => i.observation.id === observationId);
      if (!item) return;

      await createSuggestedFeatureForCatalogEntry(
        catalogEntryId,
        item.observation,
        designerBrief
      );
    },
    [createSuggestedFeatureForCatalogEntry, reviewsBySection]
  );

  const value = React.useMemo(
    (): BackendAnalysisEditContextValue => ({
      getSectionBaseline,
      confirmSectionBaseline,
      getSectionReview,
      sectionReviewBusy,
      busyObservationId,
      notifySectionDraftChange,
      getSectionDraft,
      setSectionDraft,
      flushCatalogEntryDraftsToDocument,
      sectionToolbarPresentation,
      runSectionToolbarAction,
      getBackendSectionToolbarPresentation,
      runBackendSectionToolbarAction,
      runCatalogEntryAnalysis,
      catalogEntryAnalysisBusyId,
      catalogEntryAnalysisErrorId,
      catalogEntryAnalysisError,
      catalogEntryAnalysisDoneId,
      onAgree,
      onDisagree,
      onClarificationDraftChange,
      onSubmitClarification,
      onCreateSuggestedFeature,
      createSuggestedFeatureForCatalogEntry,
      hasSuggestedFeatureForObservation,
      hasSuggestedFeatureForObservationAnyBackend,
      createSpecBusyObservationId,
      highlightSuggestedFeature,
      canRunReview,
    }),
    [
      getSectionBaseline,
      confirmSectionBaseline,
      getSectionReview,
      sectionReviewBusy,
      busyObservationId,
      notifySectionDraftChange,
      getSectionDraft,
      setSectionDraft,
      flushCatalogEntryDraftsToDocument,
      sectionToolbarPresentation,
      runSectionToolbarAction,
      getBackendSectionToolbarPresentation,
      runBackendSectionToolbarAction,
      runCatalogEntryAnalysis,
      catalogEntryAnalysisBusyId,
      catalogEntryAnalysisErrorId,
      catalogEntryAnalysisError,
      catalogEntryAnalysisDoneId,
      onAgree,
      onDisagree,
      onClarificationDraftChange,
      onSubmitClarification,
      onCreateSuggestedFeature,
      createSuggestedFeatureForCatalogEntry,
      hasSuggestedFeatureForObservation,
      hasSuggestedFeatureForObservationAnyBackend,
      createSpecBusyObservationId,
      highlightSuggestedFeature,
      canRunReview,
    ]
  );

  return (
    <BackendAnalysisEditContext.Provider value={value}>
      {children}
    </BackendAnalysisEditContext.Provider>
  );
}

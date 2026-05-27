/**
 * Contesto edit/revisione per sezioni Monaco analisi backend (debounce + diff).
 */

import React from 'react';
import type { AiCallMeta } from '@services/aiAgentDesignApi';
import {
  clarifyBackendAnalysisObservation,
  reviewBackendAnalysisObservations,
} from '@domain/backendAnalysis/backendAnalysisApi';
import {
  createReviewSessionItems,
  shouldRunObservationReview,
  type KbAnalysisReviewSessionItem,
} from '@domain/backendAnalysis/backendAnalysisWorkflow';
import type { KbDocumentAnalysisTaskContext } from '@domain/knowledgeBase/kbDocumentAnalysisApi';
import {
  patchAgentBackendAnalysisBundle,
  readAgentBackendAnalysisBundle,
} from '@domain/backendAnalysis/agentBackendAnalysisBundle';
import type { ProjectBackendCatalogBlob } from '@domain/backendCatalog/catalogTypes';
import {
  sectionReviewHeading,
  type BackendAnalysisSectionId,
} from '@domain/backendAnalysis/backendAnalysisSectionIds';
import { AI_CALL_PURPOSE } from '@domain/aiCalls/purposes';
import { buildSectionBaselinesFromDocument } from '@domain/backendAnalysis/backendAnalysisSectionBaselines';
import { useAgentBackendAnalysis } from '../AgentBackendAnalysisContext';

const REVIEW_DEBOUNCE_MS = 420;

export type BackendAnalysisEditContextValue = {
  getSectionBaseline: (sectionId: BackendAnalysisSectionId) => string;
  confirmSectionBaseline: (sectionId: BackendAnalysisSectionId, text: string) => void;
  getSectionReview: (sectionId: BackendAnalysisSectionId) => readonly KbAnalysisReviewSessionItem[] | null;
  sectionReviewBusy: boolean;
  busyObservationId: string | null;
  scheduleSectionReanalysis: (sectionId: BackendAnalysisSectionId, draft: string) => void;
  onAgree: (sectionId: BackendAnalysisSectionId, observationId: string) => void;
  onDisagree: (sectionId: BackendAnalysisSectionId, observationId: string) => void;
  onClarificationDraftChange: (
    sectionId: BackendAnalysisSectionId,
    observationId: string,
    text: string
  ) => void;
  onSubmitClarification: (sectionId: BackendAnalysisSectionId, observationId: string) => void;
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
  backendCatalog: ProjectBackendCatalogBlob;
  onPersistCatalog: (next: ProjectBackendCatalogBlob) => void;
  referenceCorpus: string;
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
  backendCatalog,
  onPersistCatalog,
  referenceCorpus,
  taskContext,
  provider,
  model,
  callMeta,
  disabled = false,
  children,
}: BackendAnalysisEditProviderProps): React.ReactElement {
  const { document } = useAgentBackendAnalysis();
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
  const debounceTimers = React.useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  React.useEffect(() => {
    setSectionBaselines({ ...bundle.sectionBaselines });
    setReviewsBySection({});
  }, [agentTaskId, bundle.sectionBaselines]);

  React.useEffect(() => {
    return () => {
      for (const t of Object.values(debounceTimers.current)) clearTimeout(t);
    };
  }, []);

  const persistBaselines = React.useCallback(
    (next: Record<string, string>) => {
      setSectionBaselines(next);
      onPersistCatalog(
        patchAgentBackendAnalysisBundle(backendCatalog, agentTaskId, {
          sectionBaselines: next,
        })
      );
    },
    [agentTaskId, backendCatalog, onPersistCatalog]
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

  const scheduleSectionReanalysis = React.useCallback(
    (sectionId: BackendAnalysisSectionId, draft: string) => {
      const prev = debounceTimers.current[sectionId];
      if (prev) clearTimeout(prev);
      debounceTimers.current[sectionId] = setTimeout(() => {
        delete debounceTimers.current[sectionId];
        void runSectionReview(sectionId, draft);
      }, REVIEW_DEBOUNCE_MS);
    },
    [runSectionReview]
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

  const value = React.useMemo(
    (): BackendAnalysisEditContextValue => ({
      getSectionBaseline,
      confirmSectionBaseline,
      getSectionReview,
      sectionReviewBusy,
      busyObservationId,
      scheduleSectionReanalysis,
      onAgree,
      onDisagree,
      onClarificationDraftChange,
      onSubmitClarification,
      canRunReview,
    }),
    [
      getSectionBaseline,
      confirmSectionBaseline,
      getSectionReview,
      sectionReviewBusy,
      busyObservationId,
      scheduleSectionReanalysis,
      onAgree,
      onDisagree,
      onClarificationDraftChange,
      onSubmitClarification,
      canRunReview,
    ]
  );

  return (
    <BackendAnalysisEditContext.Provider value={value}>
      {children}
    </BackendAnalysisEditContext.Provider>
  );
}

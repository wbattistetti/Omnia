/**
 * Revisione per sezione ### nell'analisi documento KB (debounce + osservazioni).
 */

import React from 'react';
import type { AiCallMeta } from '@services/aiAgentDesignApi';
import { AI_CALL_PURPOSE } from '@domain/aiCalls/purposes';
import {
  clarifyKbDocumentAnalysisObservation,
  reviewKbDocumentAnalysisObservations,
  type KbDocumentAnalysisTaskContext,
} from '@domain/knowledgeBase/kbDocumentAnalysisApi';
import {
  createReviewSessionItems,
  shouldRunObservationReview,
  type KbAnalysisReviewSessionItem,
} from '@domain/knowledgeBase/kbDocumentAnalysisWorkflow';
import {
  kbSectionReviewHeading,
  type KbAnalysisSectionId,
} from '@domain/knowledgeBase/kbDocumentAnalysisSections';
import type { KbDocumentPatch, StagedKbDocument } from '@domain/knowledgeBase/kbDocumentTypes';
import { buildKbSectionBaselinesFromMarkdown } from '@domain/knowledgeBase/kbDocumentAnalysisSections';

const REVIEW_DEBOUNCE_MS = 420;

export type KbDocumentAnalysisEditContextValue = {
  getSectionBaseline: (sectionId: KbAnalysisSectionId) => string;
  confirmSectionBaseline: (sectionId: KbAnalysisSectionId, text: string) => void;
  getSectionReview: (sectionId: KbAnalysisSectionId) => readonly KbAnalysisReviewSessionItem[] | null;
  sectionReviewBusy: boolean;
  busyObservationId: string | null;
  scheduleSectionReanalysis: (
    sectionId: KbAnalysisSectionId,
    draft: string,
    heading: string
  ) => void;
  onAgree: (sectionId: KbAnalysisSectionId, observationId: string) => void;
  onDisagree: (sectionId: KbAnalysisSectionId, observationId: string) => void;
  onClarificationDraftChange: (
    sectionId: KbAnalysisSectionId,
    observationId: string,
    text: string
  ) => void;
  onSubmitClarification: (sectionId: KbAnalysisSectionId, observationId: string) => void;
  canRunReview: boolean;
};

const KbDocumentAnalysisEditContext = React.createContext<KbDocumentAnalysisEditContextValue | null>(
  null
);

export function useKbDocumentAnalysisEdit(): KbDocumentAnalysisEditContextValue {
  const ctx = React.useContext(KbDocumentAnalysisEditContext);
  if (!ctx) {
    throw new Error('useKbDocumentAnalysisEdit must be used within KbDocumentAnalysisEditProvider');
  }
  return ctx;
}

export type KbDocumentAnalysisEditProviderProps = {
  doc: StagedKbDocument;
  onUpdateDoc: (patch: KbDocumentPatch) => void;
  projectId: string | undefined;
  repositoryDocumentId: string;
  documentName: string;
  documentSampleText: string;
  taskContext?: KbDocumentAnalysisTaskContext;
  provider: string | undefined;
  model: string | undefined;
  callMeta?: AiCallMeta;
  disabled?: boolean;
  children: React.ReactNode;
};

export function KbDocumentAnalysisEditProvider({
  doc,
  onUpdateDoc,
  projectId,
  repositoryDocumentId,
  documentName,
  documentSampleText,
  taskContext,
  provider,
  model,
  callMeta,
  disabled = false,
  children,
}: KbDocumentAnalysisEditProviderProps): React.ReactElement {
  const [sectionBaselines, setSectionBaselines] = React.useState<Record<string, string>>(
    () => ({ ...(doc.documentAnalysisSectionBaselines ?? {}) })
  );
  const [reviewsBySection, setReviewsBySection] = React.useState<
    Record<string, KbAnalysisReviewSessionItem[]>
  >({});
  const [sectionReviewBusy, setSectionReviewBusy] = React.useState(false);
  const [busyObservationId, setBusyObservationId] = React.useState<string | null>(null);
  const debounceTimers = React.useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  React.useEffect(() => {
    setSectionBaselines({ ...(doc.documentAnalysisSectionBaselines ?? {}) });
    setReviewsBySection({});
  }, [doc.id, doc.documentAnalysisSectionBaselines]);

  React.useEffect(() => {
    return () => {
      for (const t of Object.values(debounceTimers.current)) clearTimeout(t);
    };
  }, []);

  const persistBaselines = React.useCallback(
    (next: Record<string, string>) => {
      setSectionBaselines(next);
      onUpdateDoc({ documentAnalysisSectionBaselines: next });
    },
    [onUpdateDoc]
  );

  React.useEffect(() => {
    const stored = doc.documentAnalysisSectionBaselines ?? {};
    const hasStored = Object.values(stored).some((v) => v.trim());
    if (hasStored) return;
    const built = buildKbSectionBaselinesFromMarkdown(doc.documentAnalysisMarkdown);
    if (!Object.values(built).some((v) => v.trim())) return;
    persistBaselines(built);
  }, [doc.id, doc.documentAnalysisMarkdown, doc.documentAnalysisSectionBaselines, persistBaselines]);

  const getSectionBaseline = React.useCallback(
    (sectionId: KbAnalysisSectionId) => sectionBaselines[sectionId] ?? '',
    [sectionBaselines]
  );

  const confirmSectionBaseline = React.useCallback(
    (sectionId: KbAnalysisSectionId, text: string) => {
      persistBaselines({ ...sectionBaselines, [sectionId]: text });
      setReviewsBySection((prev) => {
        const copy = { ...prev };
        delete copy[sectionId];
        return copy;
      });
    },
    [sectionBaselines, persistBaselines]
  );

  const getSectionReview = React.useCallback(
    (sectionId: KbAnalysisSectionId) => reviewsBySection[sectionId] ?? null,
    [reviewsBySection]
  );

  const canRunReview =
    !disabled &&
    Boolean(projectId?.trim()) &&
    Boolean(repositoryDocumentId.trim()) &&
    Boolean(provider?.trim()) &&
    Boolean(model?.trim());

  const apiBase = React.useCallback(
    () => ({
      projectId: projectId!.trim(),
      repositoryDocumentId,
      documentName,
      documentSampleText,
      taskContext,
      provider: provider!,
      model: model!,
      callMeta,
    }),
    [
      projectId,
      repositoryDocumentId,
      documentName,
      documentSampleText,
      taskContext,
      provider,
      model,
      callMeta,
    ]
  );

  const runSectionReview = React.useCallback(
    async (sectionId: KbAnalysisSectionId, draft: string, heading: string) => {
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
        const h = kbSectionReviewHeading(heading);
        const review = await reviewKbDocumentAnalysisObservations({
          ...apiBase(),
          agentBaselineMarkdown: `${h}\n\n${baseline}`,
          userDraftMarkdown: `${h}\n\n${draft}`,
          purposeOverride: AI_CALL_PURPOSE.KB_REVIEW_DOCUMENT_ANALYSIS_OBSERVATIONS,
        });
        setReviewsBySection((prev) => ({
          ...prev,
          [sectionId]: createReviewSessionItems(review, documentSampleText),
        }));
      } catch {
        /* tab-level error optional */
      } finally {
        setSectionReviewBusy(false);
      }
    },
    [canRunReview, sectionBaselines, apiBase, documentSampleText]
  );

  const scheduleSectionReanalysis = React.useCallback(
    (sectionId: KbAnalysisSectionId, draft: string, heading: string) => {
      const prev = debounceTimers.current[sectionId];
      if (prev) clearTimeout(prev);
      debounceTimers.current[sectionId] = setTimeout(() => {
        delete debounceTimers.current[sectionId];
        void runSectionReview(sectionId, draft, heading);
      }, REVIEW_DEBOUNCE_MS);
    },
    [runSectionReview]
  );

  const updateReviewItem = React.useCallback(
    (
      sectionId: KbAnalysisSectionId,
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
      sectionId: KbAnalysisSectionId,
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
    (sectionId: KbAnalysisSectionId, observationId: string) => {
      updateReviewItem(sectionId, observationId, { status: 'confirmed', clarificationDraft: '' });
    },
    [updateReviewItem]
  );

  const onDisagree = React.useCallback(
    (sectionId: KbAnalysisSectionId, observationId: string) => {
      updateReviewItem(sectionId, observationId, { status: 'clarifying' });
    },
    [updateReviewItem]
  );

  const onClarificationDraftChange = React.useCallback(
    (sectionId: KbAnalysisSectionId, observationId: string, text: string) => {
      updateReviewItem(sectionId, observationId, { clarificationDraft: text });
    },
    [updateReviewItem]
  );

  const onSubmitClarification = React.useCallback(
    async (sectionId: KbAnalysisSectionId, observationId: string) => {
      if (!canRunReview) return;
      const items = reviewsBySection[sectionId];
      const item = items?.find((i) => i.observation.id === observationId);
      if (!item?.clarificationDraft.trim()) return;
      setBusyObservationId(observationId);
      try {
        const res = await clarifyKbDocumentAnalysisObservation({
          ...apiBase(),
          userText: item.observation.text,
          previousInterpretation: item.observation.interpretation,
          userCorrection: item.clarificationDraft.trim(),
          purposeOverride: AI_CALL_PURPOSE.KB_CLARIFY_DOCUMENT_ANALYSIS_OBSERVATION,
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
    (): KbDocumentAnalysisEditContextValue => ({
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
    <KbDocumentAnalysisEditContext.Provider value={value}>
      {children}
    </KbDocumentAnalysisEditContext.Provider>
  );
}

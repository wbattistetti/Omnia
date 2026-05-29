/**
 * Revisione per sezione ### nell'analisi documento KB (review su azione toolbar).
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
  allReviewItemsConfirmed,
  createReviewSessionItems,
  resolveSectionEditsToolbarPresentation,
  shouldRunObservationReview,
  type KbAnalysisReviewSessionItem,
  type KbAnalysisToolbarPresentation,
} from '@domain/knowledgeBase/kbDocumentAnalysisWorkflow';
import {
  kbSectionReviewHeading,
  type KbAnalysisSectionId,
} from '@domain/knowledgeBase/kbDocumentAnalysisSections';
import type { KbDocumentPatch, StagedKbDocument } from '@domain/knowledgeBase/kbDocumentTypes';
import { buildKbSectionBaselinesFromMarkdown } from '@domain/knowledgeBase/kbDocumentAnalysisSections';

export type KbDocumentAnalysisEditContextValue = {
  getSectionBaseline: (sectionId: KbAnalysisSectionId) => string;
  confirmSectionBaseline: (sectionId: KbAnalysisSectionId, text: string) => void;
  getSectionReview: (sectionId: KbAnalysisSectionId) => readonly KbAnalysisReviewSessionItem[] | null;
  sectionReviewBusy: boolean;
  busyObservationId: string | null;
  notifySectionDraftChange: (
    sectionId: KbAnalysisSectionId,
    draft: string,
    heading: string
  ) => void;
  sectionToolbarPresentation: KbAnalysisToolbarPresentation;
  runSectionToolbarAction: () => void;
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

export type KbSectionToolbarBridge = {
  presentation: KbAnalysisToolbarPresentation;
  runAction: () => void;
};

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
  onSectionToolbarBridgeChange?: (bridge: KbSectionToolbarBridge | null) => void;
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
  onSectionToolbarBridgeChange,
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
  const [sectionDrafts, setSectionDrafts] = React.useState<Record<string, string>>({});
  const [sectionHeadings, setSectionHeadings] = React.useState<Record<string, string>>({});
  const [pendingSectionIds, setPendingSectionIds] = React.useState<Set<string>>(() => new Set());
  const lastSectionBaselinesJsonRef = React.useRef<string>('');
  const autoBaselinesPersistedForRef = React.useRef<string | null>(null);

  const docSectionBaselinesJson = React.useMemo(
    () => JSON.stringify(doc.documentAnalysisSectionBaselines ?? {}),
    [doc.documentAnalysisSectionBaselines]
  );

  React.useEffect(() => {
    if (lastSectionBaselinesJsonRef.current === docSectionBaselinesJson) return;
    lastSectionBaselinesJsonRef.current = docSectionBaselinesJson;
    setSectionBaselines({ ...(doc.documentAnalysisSectionBaselines ?? {}) });
    setReviewsBySection({});
    setSectionDrafts({});
    setSectionHeadings({});
    setPendingSectionIds(new Set());
    autoBaselinesPersistedForRef.current = null;
  }, [doc.id, docSectionBaselinesJson, doc.documentAnalysisSectionBaselines]);

  const persistBaselines = React.useCallback(
    (next: Record<string, string>) => {
      setSectionBaselines(next);
      onUpdateDoc({ documentAnalysisSectionBaselines: next });
    },
    [onUpdateDoc]
  );

  React.useEffect(() => {
    const persistKey = `${doc.id}\0${doc.documentAnalysisMarkdown}`;
    if (autoBaselinesPersistedForRef.current === persistKey) return;

    const stored = doc.documentAnalysisSectionBaselines ?? {};
    const hasStored = Object.values(stored).some((v) => v.trim());
    if (hasStored) {
      autoBaselinesPersistedForRef.current = persistKey;
      return;
    }

    const built = buildKbSectionBaselinesFromMarkdown(doc.documentAnalysisMarkdown);
    if (!Object.values(built).some((v) => v.trim())) return;

    autoBaselinesPersistedForRef.current = persistKey;
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

  const notifySectionDraftChange = React.useCallback(
    (sectionId: KbAnalysisSectionId, draft: string, heading: string) => {
      setSectionDrafts((prev) => ({ ...prev, [sectionId]: draft }));
      setSectionHeadings((prev) => ({ ...prev, [sectionId]: heading }));
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

  const runPendingSectionReviews = React.useCallback(async () => {
    const ids = [...pendingSectionIds];
    for (const sectionId of ids) {
      const draft = sectionDrafts[sectionId];
      const heading = sectionHeadings[sectionId] ?? sectionId;
      if (draft === undefined) continue;
      await runSectionReview(sectionId as KbAnalysisSectionId, draft, heading);
    }
  }, [pendingSectionIds, sectionDrafts, sectionHeadings, runSectionReview]);

  const stableReviewsBySectionJson = React.useMemo(
    () => JSON.stringify(reviewsBySection),
    [reviewsBySection]
  );

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
  }, [stableReviewsBySectionJson]);

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
    [
      pendingSectionIds.size,
      sectionReviewMeta.inReviewSession,
      sectionReviewMeta.allConfirmed,
      sectionReviewMeta.reviewHasDisagreement,
      sectionReviewMeta.readyToApplyCount,
      canRunReview,
    ]
  );

  const sectionToolbarPresentationJson = React.useMemo(
    () => JSON.stringify(sectionToolbarPresentation),
    [sectionToolbarPresentation]
  );

  const applyConfirmedSections = React.useCallback(() => {
    for (const [sectionId, items] of Object.entries(reviewsBySection)) {
      if (!items?.length || !allReviewItemsConfirmed(items)) continue;
      const draft = sectionDrafts[sectionId];
      if (draft === undefined) continue;
      confirmSectionBaseline(sectionId as KbAnalysisSectionId, draft);
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

  const runSectionToolbarActionRef = React.useRef(runSectionToolbarAction);
  runSectionToolbarActionRef.current = runSectionToolbarAction;

  const stableRunSectionToolbarAction = React.useCallback(() => {
    runSectionToolbarActionRef.current();
  }, []);

  const lastSectionBridgeSnapshotRef = React.useRef<string | null>(null);

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
      notifySectionDraftChange,
      sectionToolbarPresentation,
      runSectionToolbarAction,
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
      notifySectionDraftChange,
      sectionToolbarPresentation,
      runSectionToolbarAction,
      onAgree,
      onDisagree,
      onClarificationDraftChange,
      onSubmitClarification,
      canRunReview,
    ]
  );

  React.useEffect(() => {
    if (!onSectionToolbarBridgeChange) return;
    if (sectionToolbarPresentation.phase === 'hidden') {
      if (lastSectionBridgeSnapshotRef.current === null) return;
      lastSectionBridgeSnapshotRef.current = null;
      onSectionToolbarBridgeChange(null);
      return;
    }
    if (lastSectionBridgeSnapshotRef.current === sectionToolbarPresentationJson) return;
    lastSectionBridgeSnapshotRef.current = sectionToolbarPresentationJson;
    onSectionToolbarBridgeChange({
      presentation: sectionToolbarPresentation,
      runAction: stableRunSectionToolbarAction,
    });
  }, [
    onSectionToolbarBridgeChange,
    sectionToolbarPresentation,
    sectionToolbarPresentationJson,
    stableRunSectionToolbarAction,
  ]);

  React.useEffect(() => {
    return () => onSectionToolbarBridgeChange?.(null);
  }, [onSectionToolbarBridgeChange]);

  return (
    <KbDocumentAnalysisEditContext.Provider value={value}>
      {children}
    </KbDocumentAnalysisEditContext.Provider>
  );
}

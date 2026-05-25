/**
 * Hook: offerta revisione osservazioni + sessione accordion per un campo testo task.
 */

import React from 'react';
import { useAIProvider } from '@context/AIProviderContext';
import { DESIGNER_LLM_MISSING_MODEL_MESSAGE } from '@components/settings/designerLlm/designerLlmMessages';
import type { AiCallMeta } from '@services/aiAgentDesignApi';
import { AI_CALL_PURPOSE } from '@domain/aiCalls/purposes';
import {
  clarifyAgentTaskTextObservation,
  finalizeAgentTaskText,
  reviewAgentTaskTextObservations,
} from '@domain/aiAgent/agentTaskTextAnalysisApi';
import type { AgentTaskTextFieldId } from '@domain/aiAgent/agentTaskTextFieldIds';
import {
  allReviewItemsConfirmed,
  countConfirmedReviewItems,
  createReviewSessionItems,
  observationsForFinalize,
  shouldRunObservationReview,
  type KbAnalysisReviewSessionItem,
} from '@domain/knowledgeBase/kbDocumentAnalysisWorkflow';

export type UseAgentTaskTextObservationReviewParams = {
  fieldId: AgentTaskTextFieldId;
  currentText: string;
  baseline: string;
  onApplyFinalText: (text: string) => void;
  onCommitBaseline: (text: string) => void;
  projectId: string | undefined;
  buildCallMeta: (purpose: string) => AiCallMeta;
  offerDismissed: boolean;
  onDismissOffer: () => void;
  onClearOfferDismissed: () => void;
  generating: boolean;
  onError?: (message: string | null) => void;
};

export function useAgentTaskTextObservationReview(
  params: UseAgentTaskTextObservationReviewParams
): {
  showOffer: boolean;
  busy: boolean;
  reviewPanelOpen: boolean;
  setReviewPanelOpen: (open: boolean) => void;
  reviewItems: readonly KbAnalysisReviewSessionItem[] | null;
  confirmedCount: number;
  allConfirmed: boolean;
  busyObservationId: string | null;
  onAcceptOffer: () => void;
  onDismissOffer: () => void;
  onAgree: (observationId: string) => void;
  onDisagree: (observationId: string) => void;
  onClarificationDraftChange: (observationId: string, text: string) => void;
  onSubmitClarification: (observationId: string) => void;
  onFinalize: () => void;
  reviewBlocksEdit: boolean;
  reviewError: string | null;
} {
  const { provider, model } = useAIProvider();
  const [reviewError, setReviewError] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState(false);
  const [busyObservationId, setBusyObservationId] = React.useState<string | null>(null);
  const [reviewItems, setReviewItems] = React.useState<KbAnalysisReviewSessionItem[] | null>(null);
  const [reviewPanelOpen, setReviewPanelOpen] = React.useState(true);

  const inReviewSession = reviewItems !== null && reviewItems.length > 0;
  const allConfirmed = reviewItems ? allReviewItemsConfirmed(reviewItems) : false;
  const confirmedCount = reviewItems ? countConfirmedReviewItems(reviewItems) : 0;
  const draftDiffers = shouldRunObservationReview(params.baseline, params.currentText);

  const showOffer =
    !params.generating &&
    !params.offerDismissed &&
    !inReviewSession &&
    (busy || draftDiffers);

  React.useEffect(() => {
    if (!draftDiffers) {
      setReviewItems(null);
    }
  }, [draftDiffers, params.fieldId]);

  React.useEffect(() => {
    if (inReviewSession && allConfirmed) {
      setReviewPanelOpen(false);
    }
  }, [inReviewSession, allConfirmed]);

  const setError = React.useCallback(
    (message: string | null) => {
      setReviewError(message);
      params.onError?.(message);
    },
    [params]
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

  const onAcceptOffer = React.useCallback(() => {
    void (async () => {
      if (!provider?.trim() || !model?.trim()) {
        setError(DESIGNER_LLM_MISSING_MODEL_MESSAGE);
        return;
      }
      if (!draftDiffers) {
        setError(
          'Non c\'è differenza tra la tua versione e quella dell\'agente: modifica il testo e riprova.'
        );
        return;
      }
      setBusy(true);
      setError(null);
      try {
        const review = await reviewAgentTaskTextObservations({
          projectId: params.projectId?.trim() ?? '',
          fieldId: params.fieldId,
          agentBaselineMarkdown: params.baseline,
          userDraftMarkdown: params.currentText,
          provider,
          model,
          callMeta: params.buildCallMeta(AI_CALL_PURPOSE.AGENT_REVIEW_TASK_TEXT_OBSERVATIONS),
        });
        setReviewItems(createReviewSessionItems(review));
        setReviewPanelOpen(true);
        params.onClearOfferDismissed();
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
      } finally {
        setBusy(false);
      }
    })();
  }, [
    params,
    provider,
    model,
    draftDiffers,
    setError,
  ]);

  const onFinalize = React.useCallback(() => {
    void (async () => {
      if (!reviewItems || !allConfirmed) return;
      if (!provider?.trim() || !model?.trim()) {
        setError(DESIGNER_LLM_MISSING_MODEL_MESSAGE);
        return;
      }
      setBusy(true);
      setError(null);
      try {
        const result = await finalizeAgentTaskText({
          projectId: params.projectId?.trim() ?? '',
          fieldId: params.fieldId,
          agentBaselineMarkdown: params.baseline,
          userDraftMarkdown: params.currentText,
          observations: observationsForFinalize(reviewItems),
          provider,
          model,
          callMeta: params.buildCallMeta(AI_CALL_PURPOSE.AGENT_FINALIZE_TASK_TEXT),
        });
        const next = result.taskTextMarkdown.trim();
        params.onApplyFinalText(next);
        params.onCommitBaseline(next);
        setReviewItems(null);
        setReviewPanelOpen(false);
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
      } finally {
        setBusy(false);
      }
    })();
  }, [reviewItems, allConfirmed, params, provider, model, setError]);

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
    []
  );

  const onClarificationDraftChange = React.useCallback(
    (observationId: string, text: string) => {
      updateReviewItem(observationId, { clarificationDraft: text });
    },
    [updateReviewItem]
  );

  const onSubmitClarification = React.useCallback(
    (observationId: string) => {
      void (async () => {
        const item = reviewItems?.find((i) => i.observation.id === observationId);
        const correction = item?.clarificationDraft.trim();
        if (!item || !correction) return;
        if (!provider?.trim() || !model?.trim()) {
          setError(DESIGNER_LLM_MISSING_MODEL_MESSAGE);
          return;
        }
        setBusyObservationId(observationId);
        setError(null);
        try {
          const res = await clarifyAgentTaskTextObservation({
            projectId: params.projectId?.trim() ?? '',
            fieldId: params.fieldId,
            userText: item.observation.text,
            previousInterpretation: item.observation.interpretation,
            userCorrection: correction,
            userDraftMarkdown: params.currentText,
            provider,
            model,
            callMeta: params.buildCallMeta(AI_CALL_PURPOSE.AGENT_CLARIFY_TASK_TEXT_OBSERVATION),
          });
          updateObservation(observationId, {
            interpretation: res.interpretation,
            documentExcerpt: res.documentExcerpt,
            excerptRationale: res.excerptRationale,
            userCorrectionNote: correction,
          });
          updateReviewItem(observationId, { status: 'pending', clarificationDraft: '' });
        } catch (e) {
          setError(e instanceof Error ? e.message : String(e));
        } finally {
          setBusyObservationId(null);
        }
      })();
    },
    [reviewItems, params, provider, model, setError, updateObservation, updateReviewItem]
  );

  return {
    showOffer,
    busy,
    reviewPanelOpen,
    setReviewPanelOpen,
    reviewItems,
    confirmedCount,
    allConfirmed,
    busyObservationId,
    onAcceptOffer,
    onDismissOffer: params.onDismissOffer,
    onAgree,
    onDisagree,
    onClarificationDraftChange,
    onSubmitClarification,
    onFinalize,
    reviewBlocksEdit: busy || (inReviewSession && reviewPanelOpen),
    reviewError,
  };
}

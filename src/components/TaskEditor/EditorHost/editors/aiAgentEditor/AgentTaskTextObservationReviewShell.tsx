/**
 * Wraps a task text editor: offer pill + fullscreen observation review panel (KB-style flow).
 */

import React from 'react';
import { Loader2 } from 'lucide-react';
import type { AiCallMeta } from '@services/aiAgentDesignApi';
import type { AgentTaskTextFieldId } from '@domain/aiAgent/agentTaskTextFieldIds';
import { agentTaskTextFieldLabel } from '@domain/aiAgent/agentTaskTextFieldIds';
import {
  AGENT_TASK_TEXT_DISMISS_REVIEW,
  AGENT_TASK_TEXT_EXCERPT_EMPTY,
  AGENT_TASK_TEXT_EXCERPT_LABEL,
  AGENT_TASK_TEXT_FINALIZE_BUTTON,
  AGENT_TASK_TEXT_REVIEW_PANEL_TITLE,
} from '@domain/aiAgent/agentTaskTextAnalysisGuide';
import {
  KB_ANALYSIS_AGENT_RESPONSE_LABEL,
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
  KB_ANALYSIS_USER_OBSERVATION_LABEL,
  KB_ANALYSIS_USER_QUESTION_LABEL,
} from '@domain/knowledgeBase/kbDocumentAnalysisGuide';
import { KbAnalysisObservationReviewPanel } from '@components/knowledgeBase/KbAnalysisObservationReviewPanel';
import type { KbAnalysisObservationReviewCopy } from '@components/knowledgeBase/KbAnalysisObservationReviewPanel';
import { AgentTaskTextReviewOffer } from './AgentTaskTextReviewOffer';
import { useAgentTaskTextObservationReview } from './useAgentTaskTextObservationReview';

const TASK_TEXT_REVIEW_COPY: KbAnalysisObservationReviewCopy = {
  panelTitle: AGENT_TASK_TEXT_REVIEW_PANEL_TITLE,
  documentExcerptLabel: AGENT_TASK_TEXT_EXCERPT_LABEL,
  documentExcerptEmpty: AGENT_TASK_TEXT_EXCERPT_EMPTY,
  agentResponseLabel: KB_ANALYSIS_AGENT_RESPONSE_LABEL,
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
  userQuestionLabel: KB_ANALYSIS_USER_QUESTION_LABEL,
  userObservationLabel: KB_ANALYSIS_USER_OBSERVATION_LABEL,
};

export type AgentTaskTextObservationReviewShellProps = {
  fieldId: AgentTaskTextFieldId;
  currentText: string;
  baseline: string;
  onCommitAgentStabilizedText: (text: string) => void;
  projectId: string | undefined;
  buildCallMeta: (purpose: string) => AiCallMeta;
  offerDismissed: boolean;
  onDismissOffer: () => void;
  onClearOfferDismissed: () => void;
  generating: boolean;
  onError?: (message: string | null) => void;
  children: (ctx: { reviewBlocksEdit: boolean }) => React.ReactNode;
};

export function AgentTaskTextObservationReviewShell({
  fieldId,
  children,
  ...reviewParams
}: AgentTaskTextObservationReviewShellProps): React.ReactElement {
  const review = useAgentTaskTextObservationReview({ fieldId, ...reviewParams });
  const sectionTitle = agentTaskTextFieldLabel(fieldId);
  const inReview = review.reviewItems !== null && review.reviewItems.length > 0;
  const showPanel = inReview && review.reviewPanelOpen;

  return (
    <div className="relative flex min-h-0 flex-1 flex-col">
      {children({ reviewBlocksEdit: review.reviewBlocksEdit })}
      {review.reviewError ? (
        <div
          className="pointer-events-auto absolute top-2 left-2 right-24 z-40 rounded-md border border-red-500/50 bg-red-950/90 px-2.5 py-2 text-[11px] leading-snug text-red-100 shadow-lg"
          role="alert"
        >
          {review.reviewError}
        </div>
      ) : null}
      <AgentTaskTextReviewOffer
        visible={review.showOffer}
        busy={review.busy}
        onAccept={review.onAcceptOffer}
        onDismiss={review.onDismissOffer}
      />
      {showPanel ? (
        <div
          className="pointer-events-auto absolute inset-0 z-30 flex min-h-0 flex-col overflow-hidden rounded-md border border-violet-800/50 bg-slate-950 shadow-xl"
          role="dialog"
          aria-label={AGENT_TASK_TEXT_REVIEW_PANEL_TITLE}
        >
          <KbAnalysisObservationReviewPanel
            opaqueSurface
            copy={TASK_TEXT_REVIEW_COPY}
            items={review.reviewItems!}
            confirmedCount={review.confirmedCount}
            busyObservationId={review.busyObservationId}
            globalBusy={review.busy}
            onAgree={review.onAgree}
            onDisagree={review.onDisagree}
            onClarificationDraftChange={review.onClarificationDraftChange}
            onSubmitClarification={review.onSubmitClarification}
          />
          <footer className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-t border-violet-900/40 bg-slate-950 px-3 py-2">
            <button
              type="button"
              disabled={review.busy}
              onClick={() => review.setReviewPanelOpen(false)}
              className="text-xs text-violet-300 underline hover:text-violet-100 disabled:opacity-50"
            >
              {AGENT_TASK_TEXT_DISMISS_REVIEW}
            </button>
            <div className="flex items-center gap-2">
              <span className="text-[10px] text-slate-500">{sectionTitle}</span>
              <button
                type="button"
                disabled={review.busy || !review.allConfirmed}
                onClick={review.onFinalize}
                className="inline-flex items-center gap-1.5 rounded-md border border-emerald-700/70 bg-emerald-950/50 px-3 py-1 text-sm font-medium text-emerald-100 hover:bg-emerald-900/40 disabled:opacity-50"
              >
                {review.busy ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
                ) : null}
                {AGENT_TASK_TEXT_FINALIZE_BUTTON}
              </button>
            </div>
          </footer>
        </div>
      ) : null}
      {inReview && !review.reviewPanelOpen ? (
        <button
          type="button"
          className="absolute bottom-2 right-2 z-20 rounded-md border border-violet-600/60 bg-violet-950/80 px-2 py-1 text-[11px] font-semibold text-violet-100 hover:bg-violet-900/50"
          onClick={() => review.setReviewPanelOpen(true)}
        >
          Revisione ({review.confirmedCount}/{review.reviewItems!.length})
        </button>
      ) : null}
    </div>
  );
}

/**
 * Sezione ### analisi KB: Monaco con highlight + pannello revisione sotto.
 */

import React from 'react';
import { Loader2 } from 'lucide-react';
import { KbAnalysisObservationReviewPanel } from './KbAnalysisObservationReviewPanel';
import {
  allReviewItemsConfirmed,
  countConfirmedReviewItems,
} from '@domain/knowledgeBase/kbDocumentAnalysisWorkflow';
import {
  KB_ANALYSIS_AGREE_NO,
  KB_ANALYSIS_AGREE_PROMPT,
  KB_ANALYSIS_AGREE_YES,
  KB_ANALYSIS_CLARIFY_PROMPT,
  KB_ANALYSIS_CLARIFY_SUBMIT,
  KB_ANALYSIS_CONFIRMED_BADGE,
  KB_ANALYSIS_DOCUMENT_EXCERPT_EMPTY,
  KB_ANALYSIS_DOCUMENT_EXCERPT_LABEL,
  KB_ANALYSIS_EXCERPT_RATIONALE_LABEL,
  KB_ANALYSIS_RESPONSE_CHIP_LABEL,
  KB_ANALYSIS_REVIEW_PANEL_TITLE,
  KB_ANALYSIS_STATUS_CLARIFYING,
  KB_ANALYSIS_STATUS_PENDING,
} from '@domain/knowledgeBase/kbDocumentAnalysisGuide';
import type { KbAnalysisSectionId } from '@domain/knowledgeBase/kbDocumentAnalysisSections';
import { KbAnalysisEditableMonaco } from './KbAnalysisEditableMonaco';
import { useKbDocumentAnalysisEdit } from './KbDocumentAnalysisEditContext';

const REVIEW_COPY = {
  panelTitle: KB_ANALYSIS_REVIEW_PANEL_TITLE,
  documentExcerptLabel: KB_ANALYSIS_DOCUMENT_EXCERPT_LABEL,
  documentExcerptEmpty: KB_ANALYSIS_DOCUMENT_EXCERPT_EMPTY,
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
};

export type KbDocumentAnalysisSectionWithReviewProps = {
  sectionId: KbAnalysisSectionId;
  heading: string;
  value: string;
  onValueChange: (next: string) => void;
  readOnly?: boolean;
};

export function KbDocumentAnalysisSectionWithReview({
  sectionId,
  heading,
  value,
  onValueChange,
  readOnly = false,
}: KbDocumentAnalysisSectionWithReviewProps): React.ReactElement {
  const edit = useKbDocumentAnalysisEdit();
  const baseline = edit.getSectionBaseline(sectionId);
  const reviewItems = edit.getSectionReview(sectionId);
  const hasReview = reviewItems !== null && reviewItems.length > 0;
  const allConfirmed = reviewItems ? allReviewItemsConfirmed(reviewItems) : false;
  const confirmedCount = reviewItems ? countConfirmedReviewItems(reviewItems) : 0;

  const handleChange = React.useCallback(
    (next: string) => {
      onValueChange(next);
      if (!readOnly) edit.scheduleSectionReanalysis(sectionId, next, heading);
    },
    [edit, onValueChange, readOnly, sectionId, heading]
  );

  return (
    <div className="space-y-2 border-b border-slate-800/60 pb-3 last:border-0">
      <h4 className="text-[11px] font-semibold uppercase tracking-wide text-cyan-300/90">
        {heading}
      </h4>
      <div className="relative min-h-[100px]">
        <KbAnalysisEditableMonaco
          value={value}
          agentBaseline={baseline}
          onChange={handleChange}
          readOnly={readOnly}
          minHeightPx={100}
          ariaLabel={`Analisi: ${heading}`}
        />
        {edit.sectionReviewBusy && !hasReview ? (
          <div className="pointer-events-none absolute bottom-2 right-2 flex items-center gap-1 rounded bg-slate-900/90 px-2 py-0.5 text-[10px] text-violet-200">
            <Loader2 className="h-3 w-3 animate-spin" aria-hidden />
            Revisione…
          </div>
        ) : null}
      </div>

      {hasReview ? (
        <div className="rounded border border-violet-800/50 bg-violet-950/20">
          <KbAnalysisObservationReviewPanel
            copy={REVIEW_COPY}
            items={reviewItems}
            confirmedCount={confirmedCount}
            busyObservationId={edit.busyObservationId}
            globalBusy={edit.sectionReviewBusy}
            onAgree={(id) => edit.onAgree(sectionId, id)}
            onDisagree={(id) => edit.onDisagree(sectionId, id)}
            onClarificationDraftChange={(id, text) =>
              edit.onClarificationDraftChange(sectionId, id, text)
            }
            onSubmitClarification={(id) => edit.onSubmitClarification(sectionId, id)}
          />
          {allConfirmed ? (
            <div className="border-t border-violet-900/40 px-2 py-1.5">
              <button
                type="button"
                className="text-xs text-violet-300 underline hover:text-violet-100"
                onClick={() => edit.confirmSectionBaseline(sectionId, value)}
              >
                Conferma sezione e chiudi revisione
              </button>
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

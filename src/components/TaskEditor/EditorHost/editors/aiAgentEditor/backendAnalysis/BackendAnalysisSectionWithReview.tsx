/**
 * Sezione Monaco editabile + pannello «Revisione dei punti» sotto l'editor.
 */

import React from 'react';
import { Loader2 } from 'lucide-react';
import { KbAnalysisObservationReviewPanel } from '@components/knowledgeBase/KbAnalysisObservationReviewPanel';
import {
  allReviewItemsConfirmed,
  countConfirmedReviewItems,
} from '@domain/backendAnalysis/backendAnalysisWorkflow';
import {
  BACKEND_ANALYSIS_EXCERPT_EMPTY,
  BACKEND_ANALYSIS_EXCERPT_LABEL,
  BACKEND_ANALYSIS_REVIEW_PANEL_TITLE,
} from '@domain/backendAnalysis/backendAnalysisGuide';
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
import type { BackendAnalysisSectionId } from '@domain/backendAnalysis/backendAnalysisSectionIds';
import { BackendAnalysisEditableMonaco } from './BackendAnalysisEditableMonaco';
import { useBackendAnalysisEdit } from './BackendAnalysisEditContext';

const REVIEW_COPY = {
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
};

export type BackendAnalysisSectionWithReviewProps = {
  sectionId: BackendAnalysisSectionId;
  value: string;
  onValueChange: (next: string) => void;
  ariaLabel: string;
  minHeightPx?: number;
  readOnly?: boolean;
};

export function BackendAnalysisSectionWithReview({
  sectionId,
  value,
  onValueChange,
  ariaLabel,
  minHeightPx = 140,
  readOnly = false,
}: BackendAnalysisSectionWithReviewProps): React.ReactElement {
  const edit = useBackendAnalysisEdit();
  const baseline = edit.getSectionBaseline(sectionId);
  const reviewItems = edit.getSectionReview(sectionId);
  const hasReview = reviewItems !== null && reviewItems.length > 0;
  const allConfirmed = reviewItems ? allReviewItemsConfirmed(reviewItems) : false;
  const confirmedCount = reviewItems ? countConfirmedReviewItems(reviewItems) : 0;

  const handleChange = React.useCallback(
    (next: string) => {
      onValueChange(next);
      if (!readOnly) edit.scheduleSectionReanalysis(sectionId, next);
    },
    [edit, onValueChange, readOnly, sectionId]
  );

  return (
    <div className="space-y-2">
      <div className="relative min-h-[120px]">
        <BackendAnalysisEditableMonaco
          value={value}
          agentBaseline={baseline}
          onChange={handleChange}
          readOnly={readOnly}
          minHeightPx={minHeightPx}
          ariaLabel={ariaLabel}
        />
        {edit.sectionReviewBusy && !hasReview ? (
          <div className="pointer-events-none absolute bottom-2 right-2 flex items-center gap-1 rounded bg-slate-900/90 px-2 py-0.5 text-[10px] text-violet-200">
            <Loader2 className="h-3 w-3 animate-spin" aria-hidden />
            Revisione…
          </div>
        ) : null}
      </div>

      {hasReview && reviewItems ? (
        <div className="overflow-hidden rounded-md border border-violet-800/50 bg-violet-950/15">
          <div className="border-b border-violet-900/40 px-2 py-1 text-[11px] font-semibold uppercase tracking-wide text-violet-200/90">
            Revisione dei punti
            <span className="ml-2 font-normal text-slate-500">
              {confirmedCount}/{reviewItems.length}
            </span>
          </div>
          <div className="max-h-[min(320px,40vh)] overflow-y-auto">
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
              onSubmitClarification={(id) => void edit.onSubmitClarification(sectionId, id)}
            />
          </div>
          {allConfirmed ? (
            <footer className="flex justify-end border-t border-violet-900/30 px-2 py-1.5">
              <button
                type="button"
                className="rounded border border-emerald-700/60 bg-emerald-950/40 px-2 py-0.5 text-[11px] font-medium text-emerald-100 hover:bg-emerald-900/40"
                onClick={() => edit.confirmSectionBaseline(sectionId, value)}
              >
                Conferma sezione (mantieni testo)
              </button>
            </footer>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

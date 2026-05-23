/**
 * Pannello revisione osservazioni: accordion per punto, excerpt annidato, Sei d'accordo?
 */

import React from 'react';
import { Check, ChevronDown, Loader2 } from 'lucide-react';
import type { KbAnalysisReviewSessionItem } from '@domain/knowledgeBase/kbDocumentAnalysisWorkflow';
import {
  KB_ANALYSIS_AGENT_RESPONSE_LABEL,
  KB_ANALYSIS_AGREE_NO,
  KB_ANALYSIS_AGREE_PROMPT,
  KB_ANALYSIS_AGREE_YES,
  KB_ANALYSIS_CLARIFY_PROMPT,
  KB_ANALYSIS_CLARIFY_SUBMIT,
  KB_ANALYSIS_CONFIRMED_BADGE,
  KB_ANALYSIS_DISMISS_REVIEW,
  KB_ANALYSIS_DOCUMENT_EXCERPT_LABEL,
  KB_ANALYSIS_EXCERPT_RATIONALE_LABEL,
  KB_ANALYSIS_REVIEW_PANEL_TITLE,
  KB_ANALYSIS_STATUS_CLARIFYING,
  KB_ANALYSIS_STATUS_PENDING,
} from '@domain/knowledgeBase/kbDocumentAnalysisGuide';
import { observationHeaderPreview } from '@domain/knowledgeBase/kbDocumentExcerptValidation';

export type KbAnalysisObservationReviewPanelProps = {
  items: readonly KbAnalysisReviewSessionItem[];
  confirmedCount: number;
  busyObservationId: string | null;
  globalBusy: boolean;
  onAgree: (observationId: string) => void;
  onDisagree: (observationId: string) => void;
  onClarificationDraftChange: (observationId: string, text: string) => void;
  onSubmitClarification: (observationId: string) => void;
  onDismissReview: () => void;
};

function statusBadgeLabel(status: KbAnalysisReviewSessionItem['status']): string {
  if (status === 'confirmed') return KB_ANALYSIS_CONFIRMED_BADGE;
  if (status === 'clarifying') return KB_ANALYSIS_STATUS_CLARIFYING;
  return KB_ANALYSIS_STATUS_PENDING;
}

function statusBadgeClass(status: KbAnalysisReviewSessionItem['status']): string {
  if (status === 'confirmed') return 'border-emerald-700/60 bg-emerald-950/50 text-emerald-200';
  if (status === 'clarifying') return 'border-amber-700/60 bg-amber-950/40 text-amber-100';
  return 'border-slate-600/70 bg-slate-900/60 text-slate-300';
}

function interpretationLines(interpretation: string): readonly string[] {
  return interpretation
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);
}

function AgentResponseBody({ interpretation }: { interpretation: string }): React.ReactElement {
  const lines = interpretationLines(interpretation);
  if (lines.length <= 1) {
    return (
      <p className="whitespace-pre-wrap text-sm leading-relaxed text-sky-50/95">{interpretation}</p>
    );
  }
  return (
    <ul className="list-disc space-y-1 pl-4 text-sm leading-relaxed text-sky-50/95">
      {lines.map((line, idx) => (
        <li key={idx}>{line.replace(/^[-*•]\s+/, '')}</li>
      ))}
    </ul>
  );
}

function ObservationAccordionItem({
  item,
  expanded,
  busy,
  globalBusy,
  onToggle,
  onAgree,
  onDisagree,
  onClarificationDraftChange,
  onSubmitClarification,
}: {
  item: KbAnalysisReviewSessionItem;
  expanded: boolean;
  busy: boolean;
  globalBusy: boolean;
  onToggle: () => void;
  onAgree: (id: string) => void;
  onDisagree: (id: string) => void;
  onClarificationDraftChange: (id: string, text: string) => void;
  onSubmitClarification: (id: string) => void;
}): React.ReactElement {
  const { observation, status, clarificationDraft } = item;
  const confirmed = status === 'confirmed';
  const clarifying = status === 'clarifying';
  const canInteract = !globalBusy && !confirmed;
  const headerId = `kb-obs-header-${observation.id}`;
  const panelId = `kb-obs-panel-${observation.id}`;

  return (
    <article
      className={
        'overflow-hidden rounded-md border ' +
        (confirmed
          ? 'border-emerald-800/50 bg-emerald-950/15'
          : 'border-violet-800/50 bg-slate-950/60')
      }
      aria-label={`Osservazione ${observation.id}`}
    >
      <button
        type="button"
        id={headerId}
        aria-expanded={expanded}
        aria-controls={panelId}
        onClick={onToggle}
        className="flex w-full items-start gap-2 px-3 py-2.5 text-left hover:bg-slate-900/40"
      >
        <ChevronDown
          className={
            'mt-0.5 h-4 w-4 shrink-0 text-slate-400 transition-transform ' +
            (expanded ? 'rotate-0' : '-rotate-90')
          }
          aria-hidden
        />
        <span className="min-w-0 flex-1">
          <span className="mb-1 block text-xs font-medium uppercase tracking-wide text-slate-500">
            Punto {observation.id}
          </span>
          <span className="block text-sm font-medium leading-snug text-amber-50/95">
            {observationHeaderPreview(observation.text)}
          </span>
        </span>
        <span
          className={
            'inline-flex shrink-0 items-center gap-1 rounded border px-2 py-0.5 text-xs font-medium ' +
            statusBadgeClass(status)
          }
        >
          {confirmed ? <Check className="h-3 w-3" aria-hidden /> : null}
          {statusBadgeLabel(status)}
        </span>
      </button>

      {expanded ? (
        <div id={panelId} aria-labelledby={headerId} className="border-t border-slate-700/50 px-3 pb-3 pt-2">
          <p className="mb-1 whitespace-pre-wrap text-sm leading-relaxed text-amber-50/90">
            {observation.text}
          </p>

          <p className="mb-1 mt-3 text-xs font-semibold text-sky-200/90">
            {KB_ANALYSIS_AGENT_RESPONSE_LABEL}
          </p>
          <div className="mb-3">
            <AgentResponseBody interpretation={observation.interpretation} />
          </div>

          {observation.documentExcerpt ? (
            <details className="mb-3 rounded-md border border-emerald-800/40 bg-emerald-950/25">
              <summary className="cursor-pointer px-3 py-2 text-xs font-semibold text-emerald-200/90">
                {KB_ANALYSIS_DOCUMENT_EXCERPT_LABEL}
              </summary>
              <div className="space-y-2 border-t border-emerald-900/40 px-3 py-2">
                <blockquote className="border-l-2 border-emerald-600/60 pl-3 text-sm italic leading-relaxed text-emerald-50/90">
                  {observation.documentExcerpt}
                </blockquote>
                {observation.excerptRationale ? (
                  <p className="text-xs leading-relaxed text-emerald-200/80">
                    <span className="font-semibold">{KB_ANALYSIS_EXCERPT_RATIONALE_LABEL}: </span>
                    {observation.excerptRationale}
                  </p>
                ) : null}
              </div>
            </details>
          ) : null}

          {!confirmed ? (
            <>
              <p className="mb-2 text-xs font-medium text-slate-300">{KB_ANALYSIS_AGREE_PROMPT}</p>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  disabled={!canInteract || busy}
                  onClick={() => onAgree(observation.id)}
                  className="rounded-md border border-emerald-700/70 bg-emerald-950/40 px-3 py-1 text-sm font-medium text-emerald-100 hover:bg-emerald-900/40 disabled:opacity-50"
                >
                  {busy ? (
                    <Loader2 className="mr-1 inline h-3.5 w-3.5 animate-spin" aria-hidden />
                  ) : null}
                  {KB_ANALYSIS_AGREE_YES}
                </button>
                <button
                  type="button"
                  disabled={!canInteract || busy}
                  onClick={() => onDisagree(observation.id)}
                  className="rounded-md border border-slate-600/80 bg-slate-900/60 px-3 py-1 text-sm font-medium text-slate-200 hover:bg-slate-800/80 disabled:opacity-50"
                >
                  {KB_ANALYSIS_AGREE_NO}
                </button>
              </div>

              {clarifying ? (
                <div className="mt-3 space-y-2 border-t border-slate-700/60 pt-3">
                  <label
                    htmlFor={`kb-clarify-${observation.id}`}
                    className="block text-xs font-medium text-slate-300"
                  >
                    {KB_ANALYSIS_CLARIFY_PROMPT}
                  </label>
                  <textarea
                    id={`kb-clarify-${observation.id}`}
                    value={clarificationDraft}
                    disabled={busy}
                    rows={2}
                    onChange={(e) => onClarificationDraftChange(observation.id, e.target.value)}
                    className="w-full resize-y rounded-md border border-slate-600/80 bg-slate-950 px-2 py-1.5 text-sm text-slate-100 placeholder:text-slate-500 focus:border-violet-500/60 focus:outline-none disabled:opacity-60"
                  />
                  <button
                    type="button"
                    disabled={busy || !clarificationDraft.trim()}
                    onClick={() => onSubmitClarification(observation.id)}
                    className="inline-flex items-center gap-2 rounded-md border border-violet-600/70 bg-violet-950/50 px-3 py-1 text-sm font-medium text-violet-50 hover:bg-violet-900/40 disabled:opacity-50"
                  >
                    {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden /> : null}
                    {KB_ANALYSIS_CLARIFY_SUBMIT}
                  </button>
                </div>
              ) : null}
            </>
          ) : null}
        </div>
      ) : null}
    </article>
  );
}

function buildInitialExpandedIds(items: readonly KbAnalysisReviewSessionItem[]): Set<string> {
  const next = new Set<string>();
  if (items[0]) next.add(items[0].observation.id);
  items.forEach((item) => {
    if (item.status === 'clarifying') next.add(item.observation.id);
  });
  return next;
}

export function KbAnalysisObservationReviewPanel({
  items,
  confirmedCount,
  busyObservationId,
  globalBusy,
  onAgree,
  onDisagree,
  onClarificationDraftChange,
  onSubmitClarification,
  onDismissReview,
}: KbAnalysisObservationReviewPanelProps): React.ReactElement {
  const sessionKey = items.map((item) => item.observation.id).join(',');
  const [expandedIds, setExpandedIds] = React.useState<Set<string>>(() =>
    buildInitialExpandedIds(items)
  );

  React.useEffect(() => {
    setExpandedIds(buildInitialExpandedIds(items));
  }, [sessionKey]);

  React.useEffect(() => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      items.forEach((item) => {
        if (item.status === 'clarifying') next.add(item.observation.id);
      });
      return next;
    });
  }, [items]);

  const toggleExpanded = React.useCallback((observationId: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(observationId)) next.delete(observationId);
      else next.add(observationId);
      return next;
    });
  }, []);

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden">
      <header className="flex shrink-0 items-center justify-between gap-2 border-b border-violet-800/40 px-3 py-2">
        <div>
          <p className="text-sm font-medium text-violet-100">{KB_ANALYSIS_REVIEW_PANEL_TITLE}</p>
          <p className="text-xs text-slate-400">
            {confirmedCount}/{items.length} concordati
          </p>
        </div>
        <button
          type="button"
          disabled={globalBusy}
          onClick={onDismissReview}
          className="text-xs text-slate-400 underline decoration-slate-600 underline-offset-2 hover:text-slate-200 disabled:opacity-50"
        >
          {KB_ANALYSIS_DISMISS_REVIEW}
        </button>
      </header>
      <div className="min-h-0 flex-1 space-y-2 overflow-y-auto p-3">
        {items.map((item) => (
          <ObservationAccordionItem
            key={item.observation.id}
            item={item}
            expanded={expandedIds.has(item.observation.id)}
            busy={busyObservationId === item.observation.id}
            globalBusy={globalBusy}
            onToggle={() => toggleExpanded(item.observation.id)}
            onAgree={onAgree}
            onDisagree={onDisagree}
            onClarificationDraftChange={onClarificationDraftChange}
            onSubmitClarification={onSubmitClarification}
          />
        ))}
      </div>
    </div>
  );
}

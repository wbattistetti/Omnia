/**
 * Focus analisi + regole + promozione (no chat — chat lives in the right column).
 */

import React from 'react';
import type { StagedKbDocument, KbDocumentPatch } from '@domain/knowledgeBase/kbDocumentTypes';
import { KbRuleReviewCards } from './KbRuleReviewCards';
import type { useKbDocumentActions } from './useKbDocumentActions';
import { RefreshCw, CheckCircle2 } from 'lucide-react';
import { countDeferredOpenRules } from '@domain/knowledgeBase/kbAnalysisSession';
import { kbType } from './kbTypography';

export type KbFocusPanelProps = {
  doc: StagedKbDocument;
  disabled?: boolean;
  actions: ReturnType<typeof useKbDocumentActions>;
  onUpdateDoc: (patch: KbDocumentPatch) => void;
  readerError?: string | null;
  opaqueSurface?: boolean;
};

function resolveFocusError(
  actionError: string | null,
  doc: StagedKbDocument,
  readerError: string | null | undefined
): string | null {
  const parts: string[] = [];
  const push = (s: string | undefined | null) => {
    const t = s?.trim();
    if (t && !parts.includes(t)) parts.push(t);
  };
  push(actionError);
  if (doc.parseStatus === 'error') push(doc.parseError);
  push(doc.semanticError);
  push(readerError);
  return parts.length > 0 ? parts.join(' · ') : null;
}

export function KbFocusPanel({
  doc,
  disabled = false,
  actions,
  readerError = null,
  opaqueSurface = false,
}: KbFocusPanelProps): React.ReactElement {
  const {
    analyzeBusy,
    promoteBusy,
    actionError,
    canAnalyze,
    hasAnalyzed,
    hasUserChatQuestion,
    openRuleCount,
    runReanalyze,
    setRuleStatus,
    patchRule,
    confirmAllHighConfidence,
    focusRule,
    promoteConfirmedRules,
    signOffNoUseCases,
  } = actions;

  const focusError = resolveFocusError(actionError, doc, readerError);
  const showRuleCards = hasAnalyzed && doc.rules.filter((r) => !r.deleted).length > 0;
  const deferredCount = countDeferredOpenRules(doc.rules);
  const opaque = opaqueSurface;

  return (
    <div
      className={
        'flex min-h-0 flex-1 flex-col overflow-hidden p-2 text-inherit ' +
        (opaque ? 'bg-slate-950' : 'bg-slate-950/40')
      }
    >
      {doc.kbAnalysisComplete ? (
        <p className={'mb-2 shrink-0 rounded border border-emerald-700/50 bg-emerald-950/30 px-2 py-1 ' + kbType.body}>
          Analisi documento completata
        </p>
      ) : null}
      {doc.promotionStatus === 'partial' ? (
        <p className={'mb-2 shrink-0 rounded border border-amber-700/50 bg-amber-950/30 px-2 py-1 ' + kbType.warn}>
          Promozione parziale: verifica gli use case nel wizard.
        </p>
      ) : null}
      {deferredCount > 0 ? (
        <p className={'mb-2 shrink-0 ' + kbType.body + ' text-violet-300/90'}>
          {deferredCount} regola/e corrette in attesa: validale o promuovi le altre.
        </p>
      ) : null}

      <div className={'flex min-h-0 flex-1 flex-col gap-2 overflow-hidden ' + (opaque ? 'bg-slate-950' : '')}>
        {showRuleCards ? (
          <section className={'flex min-h-0 flex-1 flex-col gap-1 overflow-hidden ' + (opaque ? 'bg-slate-950' : '')}>
            <div className="flex shrink-0 items-center justify-between gap-2">
              <p className={kbType.label}>Regole</p>
              <button
                type="button"
                disabled={disabled || !canAnalyze || analyzeBusy || !hasUserChatQuestion}
                title={
                  !hasUserChatQuestion
                    ? 'Scrivi in chat che analisi vuoi fare, poi rianalizza'
                    : undefined
                }
                onClick={() => void runReanalyze()}
                className="inline-flex items-center gap-1 rounded border border-slate-600 px-1.5 py-0.5 text-inherit text-slate-400 hover:bg-slate-800 disabled:opacity-50"
              >
                <RefreshCw className="h-3 w-3" aria-hidden />
                Rianalizza
              </button>
            </div>
            <KbRuleReviewCards
              rules={doc.rules}
              currentRuleId={doc.currentRuleId}
              disabled={disabled || analyzeBusy}
              opaqueSurface={opaque}
              openRuleCount={openRuleCount}
              onFocusRule={focusRule}
              onSetRuleStatus={setRuleStatus}
              onPatchRule={patchRule}
              onConfirmAllHigh={confirmAllHighConfidence}
            />
          </section>
        ) : (
          <p className="flex flex-1 items-center justify-center px-4 text-center text-slate-500">
            {hasAnalyzed
              ? 'Nessuna regola estratta.'
              : 'Avvia l\'analisi dalla chat a destra.'}
          </p>
        )}

        {(doc.analysisPhase === 'phase_c' || openRuleCount === 0) && hasAnalyzed ? (
          <section className="flex shrink-0 flex-wrap gap-2">
            <button
              type="button"
              disabled={disabled || analyzeBusy || promoteBusy}
              onClick={() => void promoteConfirmedRules()}
              className="inline-flex items-center gap-1 rounded border border-emerald-600/70 px-2 py-1 text-inherit text-emerald-200 hover:bg-emerald-950/40 disabled:opacity-50"
            >
              <CheckCircle2 className="h-3 w-3" aria-hidden />
              {promoteBusy ? 'Promozione…' : 'Promuovi use case (IA)'}
            </button>
            <button
              type="button"
              disabled={disabled || doc.kbAnalysisComplete}
              onClick={signOffNoUseCases}
              className="rounded border border-slate-600 px-2 py-1 text-inherit text-slate-400 hover:bg-slate-800 disabled:opacity-50"
            >
              Nessun UC da questo doc
            </button>
          </section>
        ) : null}
      </div>

      {focusError ? <p className={'shrink-0 pt-1 ' + kbType.error}>{focusError}</p> : null}
    </div>
  );
}

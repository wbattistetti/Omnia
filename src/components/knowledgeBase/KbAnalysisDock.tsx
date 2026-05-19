/**
 * Right dock: focus pills, rule review cards, guided chat, promotion actions.
 */

import React from 'react';
import type { StagedKbDocument, KbDocumentPatch } from '@domain/knowledgeBase/kbDocumentTypes';
import { KbDataTypePills } from './KbDataTypePills';
import { KbRuleReviewCards } from './KbRuleReviewCards';
import { KbDocumentChatPanel } from './KbDocumentChatPanel';
import type { useKbDocumentActions } from './useKbDocumentActions';
import { RefreshCw, CheckCircle2, Maximize2, Minimize2 } from 'lucide-react';
import { countDeferredOpenRules } from '@domain/knowledgeBase/kbAnalysisSession';
import { KB_MSG_ANALYZING } from '@domain/knowledgeBase/kbChatCopy';
import { KB_HYPOTHESIS_INPUT_PLACEHOLDER } from '@domain/knowledgeBase/kbChatInteractive';
import { kbType } from './kbTypography';

export type KbAnalysisDockProps = {
  doc: StagedKbDocument;
  disabled?: boolean;
  actions: ReturnType<typeof useKbDocumentActions>;
  onUpdateDoc: (patch: KbDocumentPatch) => void;
  /** Repository reader fetch error (shown once in dock, not under document title). */
  readerError?: string | null;
  dockExpanded?: boolean;
  onToggleDockExpanded?: () => void;
};

function chatDisabledHint(
  doc: StagedKbDocument,
  canAnalyze: boolean,
  hasModel: boolean,
  hasAnalyzed: boolean,
  awaitingHypothesisChoice: boolean,
  awaitingHypothesisInput: boolean
): string | undefined {
  if (!hasModel) return 'Seleziona un modello IA in Impostazioni';
  if (doc.parseStatus === 'error') {
    return doc.parseError?.trim() || 'Errore caricamento documento';
  }
  if (doc.parseStatus === 'parsing') return 'Caricamento documento in corso…';
  if (!doc.repositoryDocumentId?.trim()) return 'Attendi il salvataggio del documento nel repository…';
  if (!canAnalyze) return 'Documento non pronto';
  if (awaitingHypothesisChoice) return 'Usa Sì o No nel messaggio sopra';
  if (awaitingHypothesisInput) return undefined;
  if (!hasAnalyzed) return 'Attendi l\'avvio dell\'analisi guidata';
  return undefined;
}

function resolveDockError(
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

function KbDockExpandButton({
  dockExpanded,
  onToggle,
}: {
  dockExpanded: boolean;
  onToggle: () => void;
}): React.ReactElement {
  return (
    <button
      type="button"
      onClick={onToggle}
      title={
        dockExpanded
          ? 'Riduci pannello (torna alla colonna destra)'
          : 'Espandi pannello (si sovrappone al documento)'
      }
      aria-label={dockExpanded ? 'Riduci pannello analisi' : 'Espandi pannello analisi'}
      aria-pressed={dockExpanded}
      className="inline-flex shrink-0 items-center justify-center rounded-md border border-slate-600/70 bg-slate-900/60 px-1.5 py-1 text-slate-300 hover:bg-slate-800 hover:text-slate-100"
    >
      {dockExpanded ? <Minimize2 size={14} aria-hidden /> : <Maximize2 size={14} aria-hidden />}
    </button>
  );
}

export function KbAnalysisDock({
  doc,
  disabled = false,
  actions,
  readerError = null,
  dockExpanded = false,
  onToggleDockExpanded,
}: KbAnalysisDockProps): React.ReactElement {
  const {
    analyzeBusy,
    promoteBusy,
    chatBusy,
    actionError,
    canAnalyze,
    hasModel,
    hasAnalyzed,
    awaitingHypothesisChoice,
    awaitingHypothesisInput,
    hasUserChatQuestion,
    chatFocusSignal,
    openRuleCount,
    runReanalyze,
    handleChatSend,
    handleInteractiveAction,
    patchRule,
    setRuleStatus,
    confirmAllHighConfidence,
    focusRule,
    promoteConfirmedRules,
    signOffNoUseCases,
    chatDraftSeed,
  } = actions;

  const repoReady = Boolean(doc.repositoryDocumentId?.trim());
  const analyzeFailed = doc.semanticStatus === 'error';
  const chatInputDisabled =
    disabled ||
    chatBusy ||
    !hasModel ||
    !repoReady ||
    analyzeBusy ||
    (!hasAnalyzed &&
      !awaitingHypothesisChoice &&
      !awaitingHypothesisInput &&
      !analyzeFailed);
  const chatDraft = chatDraftSeed ?? undefined;
  const focusChatDraft = Boolean(chatDraft) && !chatInputDisabled;
  const chatHint = chatDisabledHint(
    doc,
    canAnalyze,
    hasModel,
    hasAnalyzed,
    awaitingHypothesisChoice,
    awaitingHypothesisInput
  );
  const chatInputPlaceholder = awaitingHypothesisInput
    ? KB_HYPOTHESIS_INPUT_PLACEHOLDER
    : undefined;
  const dockError = resolveDockError(actionError, doc, readerError);
  const chatFooterStatus = chatBusy ? KB_MSG_ANALYZING : null;

  const showRuleCards =
    hasAnalyzed && doc.rules.filter((r) => !r.deleted).length > 0;

  const deferredCount = countDeferredOpenRules(doc.rules);
  const opaque = dockExpanded;

  return (
    <div
      className={
        'flex min-h-0 flex-1 flex-col overflow-hidden p-2 text-inherit ' +
        (opaque ? 'bg-slate-950' : '')
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

      {onToggleDockExpanded ? (
        doc.dataTypes.length > 0 ? (
          <section className={'shrink-0 pb-2 ' + (opaque ? 'bg-slate-950' : '')}>
            <div className="mb-1 flex items-center justify-between gap-2">
              <p className={kbType.label}>Focus analisi</p>
              <KbDockExpandButton dockExpanded={dockExpanded} onToggle={onToggleDockExpanded} />
            </div>
            <KbDataTypePills dataTypes={doc.dataTypes} />
          </section>
        ) : (
          <div className="flex shrink-0 justify-end pb-1">
            <KbDockExpandButton dockExpanded={dockExpanded} onToggle={onToggleDockExpanded} />
          </div>
        )
      ) : doc.dataTypes.length > 0 ? (
        <section className="shrink-0 pb-2">
          <p className={'mb-1 ' + kbType.label}>Focus analisi</p>
          <KbDataTypePills dataTypes={doc.dataTypes} />
        </section>
      ) : null}

      <div
        className={
          'flex min-h-0 flex-1 flex-col gap-2 overflow-hidden ' + (opaque ? 'bg-slate-950' : '')
        }
      >
        {showRuleCards ? (
          <section
            className={
              'flex min-h-[140px] max-h-[58%] flex-1 flex-col gap-1 overflow-hidden ' +
              (opaque ? 'bg-slate-950' : '')
            }
          >
            <div className="flex shrink-0 items-center justify-between gap-2">
              <p className={kbType.label}>Regole</p>
              <button
                type="button"
                disabled={
                  disabled || !canAnalyze || analyzeBusy || !hasUserChatQuestion
                }
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
        ) : null}

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

        <section
          className={
            'flex max-h-[min(220px,36vh)] min-h-[140px] shrink-0 flex-col overflow-hidden ' +
            (opaque ? 'bg-slate-950' : '')
          }
        >
          <KbDocumentChatPanel
            key={doc.id}
            messages={doc.chatMessages}
            busy={chatBusy || analyzeBusy}
            disabled={chatInputDisabled}
            disabledHint={chatHint}
            opaqueSurface={opaque}
            draftSeed={chatDraft}
            autoFocusDraft={focusChatDraft}
            focusInputSignal={chatFocusSignal}
            inputPlaceholder={chatInputPlaceholder}
            footerStatus={chatFooterStatus}
            onSend={handleChatSend}
            onInteractiveAction={handleInteractiveAction}
            className="min-h-0 flex-1"
          />
        </section>
      </div>

      {dockError ? <p className={'shrink-0 pt-1 ' + kbType.error}>{dockError}</p> : null}
    </div>
  );
}

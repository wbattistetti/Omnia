/**
 * Right dock: focus pills, rules accordion, guided chat.
 */

import React from 'react';
import type { StagedKbDocument, KbDocumentPatch } from '@domain/knowledgeBase/kbDocumentTypes';
import { KbDataTypePills } from './KbDataTypePills';
import { KbRulesAccordion } from './KbRulesAccordion';
import { KbDocumentChatPanel } from './KbDocumentChatPanel';
import type { useKbDocumentActions } from './useKbDocumentActions';
import { RefreshCw } from 'lucide-react';

export type KbAnalysisDockProps = {
  doc: StagedKbDocument;
  disabled?: boolean;
  actions: ReturnType<typeof useKbDocumentActions>;
  onUpdateDoc: (patch: KbDocumentPatch) => void;
};

function chatDisabledHint(
  doc: StagedKbDocument,
  canAnalyze: boolean,
  hasModel: boolean,
  hasAnalyzed: boolean
): string | undefined {
  if (!hasModel) return 'Seleziona un modello IA in Impostazioni';
  if (!doc.repositoryDocumentId?.trim()) return 'Attendi il salvataggio del documento nel repository…';
  if (!canAnalyze) return 'Documento non pronto';
  if (!hasAnalyzed) return 'Esegui Analyze per avviare chat e regole';
  return undefined;
}

export function KbAnalysisDock({
  doc,
  disabled = false,
  actions,
  onUpdateDoc,
}: KbAnalysisDockProps): React.ReactElement {
  const {
    analyzeBusy,
    chatBusy,
    actionError,
    canAnalyze,
    hasModel,
    hasAnalyzed,
    hasUserChatQuestion,
    runReanalyze,
    handleChatSend,
    notifyRulesEdited,
  } = actions;

  const repoReady = Boolean(doc.repositoryDocumentId?.trim());
  const chatInputDisabled =
    disabled || chatBusy || !hasModel || !repoReady || analyzeBusy || !hasAnalyzed;
  const chatHint = chatDisabledHint(doc, canAnalyze, hasModel, hasAnalyzed);

  const showRules = hasAnalyzed && (doc.rules.length > 0 || doc.chatStarted);

  const handleRulesChange = React.useCallback(
    (rules: StagedKbDocument['rules']) => {
      onUpdateDoc({ rules });
      notifyRulesEdited();
    },
    [onUpdateDoc, notifyRulesEdited]
  );

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden p-2">
      {doc.dataTypes.length > 0 ? (
        <section className="shrink-0 pb-2">
          <p className="mb-1 font-medium uppercase tracking-wide text-slate-500">
            Focus analisi
          </p>
          <KbDataTypePills dataTypes={doc.dataTypes} />
        </section>
      ) : null}

      <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-hidden">
        {showRules ? (
          <section className="flex min-h-0 flex-1 flex-col gap-1 overflow-hidden">
            <div className="flex shrink-0 items-center justify-between gap-2">
              <p className="font-semibold uppercase tracking-wide text-slate-500">Regole</p>
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
                className="inline-flex items-center gap-1 rounded border border-slate-600 px-1.5 py-0.5 text-slate-400 hover:bg-slate-800 disabled:opacity-50"
              >
                <RefreshCw className="h-3 w-3" aria-hidden />
                Rianalizza
              </button>
            </div>
            <KbRulesAccordion
              rules={doc.rules}
              disabled={disabled || analyzeBusy}
              onChange={handleRulesChange}
              className="min-h-0 flex-1"
            />
          </section>
        ) : null}

        <section className="flex h-[min(240px,42vh)] min-h-[168px] shrink-0 flex-col overflow-hidden">
          <KbDocumentChatPanel
            messages={doc.chatMessages}
            busy={chatBusy}
            disabled={chatInputDisabled}
            disabledHint={chatHint}
            onSend={handleChatSend}
            className="min-h-0 flex-1"
          />
        </section>
      </div>

      {actionError ? (
        <p className="shrink-0 pt-1 text-rose-300">{actionError}</p>
      ) : null}
    </div>
  );
}

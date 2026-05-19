/**
 * Right column: guided KB chat at full panel height.
 */

import React from 'react';
import type { StagedKbDocument } from '@domain/knowledgeBase/kbDocumentTypes';
import { KbDocumentChatPanel } from './KbDocumentChatPanel';
import type { useKbDocumentActions } from './useKbDocumentActions';
import { KB_HYPOTHESIS_INPUT_PLACEHOLDER } from '@domain/knowledgeBase/kbChatInteractive';

export type KbChatDockProps = {
  doc: StagedKbDocument;
  disabled?: boolean;
  actions: ReturnType<typeof useKbDocumentActions>;
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

export function KbChatDock({ doc, disabled = false, actions }: KbChatDockProps): React.ReactElement {
  const {
    analyzeBusy,
    chatBusy,
    canAnalyze,
    hasModel,
    hasAnalyzed,
    awaitingHypothesisChoice,
    awaitingHypothesisInput,
    handleChatSend,
    handleInteractiveAction,
    chatDraftSeed,
    chatFocusSignal,
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
  const chatInputPlaceholder = awaitingHypothesisInput ? KB_HYPOTHESIS_INPUT_PLACEHOLDER : undefined;

  return (
    <aside className="flex min-h-0 min-w-0 flex-col overflow-hidden bg-slate-950/80 p-1.5">
      <KbDocumentChatPanel
        key={doc.id}
        messages={doc.chatMessages}
        busy={chatBusy || analyzeBusy}
        disabled={chatInputDisabled}
        disabledHint={chatHint}
        opaqueSurface
        draftSeed={chatDraft}
        autoFocusDraft={focusChatDraft}
        focusInputSignal={chatFocusSignal}
        inputPlaceholder={chatInputPlaceholder}
        onSend={handleChatSend}
        onInteractiveAction={handleInteractiveAction}
        className="min-h-0 flex-1"
      />
    </aside>
  );
}

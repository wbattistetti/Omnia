/**
 * Italian copy for guided KB chat (short, operational messages).
 */

import type { KbInducedRule } from './kbRuleTypes';
import { kbHierarchyAnalysisSummary } from './kbRuleHierarchy';

export const KB_MSG_ANALYZING = 'Sto analizzando il documento…';

/** Transient assistant chat bubble while semantic analysis runs. */
export const KB_MSG_ANALYZING_ACK =
  'Ok, dammi qualche momento: sto analizzando il documento…';

export function kbRulesFoundSummary(rules: readonly KbInducedRule[]): string {
  return kbHierarchyAnalysisSummary(rules);
}

export function kbRulesEditedSummary(): string {
  return 'Ho registrato le modifiche alle regole. Se vuoi, posso finalizzare o rianalizzare in base alle tue note.';
}

export const KB_DEFAULT_CHAT_OPENER =
  'Analisi iniziale completata. Cosa vuoi approfondire? (es. vincoli su ID, routing tra prestazioni, campi obbligatori)';

/** Pre-filled chat reply when awaiting analysis consent. */
export const KB_CONSENT_REPLY_DEFAULT = 'Sì, analizza';

/** Alternative decline reply (user can edit before send). */
export const KB_CONSENT_DECLINE_DEFAULT = 'Non ora';

/** Pre-filled chat reply after analyze failure (timeout, etc.). */
export const KB_RETRY_REPLY_DEFAULT = 'Riprova';

/** Italian assistant message for analyze/chat failures shown in the thread. */
export function formatKbAnalyzeErrorForChat(rawError: string): string {
  const t = String(rawError || '').trim();
  if (/timeout/i.test(t)) {
    return (
      'La richiesta all\'IA è andata in timeout (limite di attesa superato). ' +
      'Con documenti grandi o analisi complesse può capitare: premi Invio per riprovare ' +
      '(«Riprova» è già nel campo messaggio).'
    );
  }
  if (!t) {
    return 'Analisi non riuscita. Puoi rispondere «Riprova» per un nuovo tentativo.';
  }
  return `Analisi non riuscita: ${t}. Puoi rispondere «Riprova» per un nuovo tentativo.`;
}

/**
 * Italian copy for guided KB chat (short, operational messages).
 */

import type { KbInducedRule } from './kbRuleTypes';

export const KB_MSG_ANALYZING = 'Sto analizzando il documento…';

export function kbRulesFoundSummary(rules: readonly KbInducedRule[]): string {
  const visible = rules.filter((r) => r.included && !r.deleted);
  const n = visible.length;
  if (n === 0) {
    return 'Analisi completata. Non ho aggiunto nuove regole per questa richiesta — possiamo approfondire?';
  }
  const titles = visible
    .slice(0, 4)
    .map((r) => r.title || r.field)
    .filter(Boolean)
    .join(', ');
  const more = n > 4 ? ` (+${n - 4})` : '';
  return `Ho trovato ${n} regola/e${titles ? `: ${titles}${more}` : ''}. Le trovi sopra. Vuoi continuare l'analisi?`;
}

export function kbRulesEditedSummary(): string {
  return 'Ho registrato le modifiche alle regole. Se vuoi, posso finalizzare o rianalizzare in base alle tue note.';
}

export const KB_DEFAULT_CHAT_OPENER =
  'Analisi iniziale completata. Cosa vuoi approfondire? (es. vincoli su ID, routing tra prestazioni, campi obbligatori)';

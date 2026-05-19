/**
 * Interactive blocks embedded in KB chat messages (buttons, inline inputs).
 */

import { createKbChatMessageId } from './kbRuleTypes';
import type { KbChatMessage } from './kbRuleTypes';

export type KbChatInteractive = { kind: 'hypothesis_choice' };

export const KB_HYPOTHESIS_QUESTION =
  'Hai già delle ipotesi sul documento e vuoi che io le verifichi?';

export const KB_HYPOTHESIS_INPUT_PLACEHOLDER = 'OK, scrivi qui le tue ipotesi';

/** Shown in chat after Sì; the designer types in the main input below. */
export const KB_HYPOTHESIS_INPUT_GUIDE =
  'Scrivi le tue ipotesi nel campo sotto e premi Invio per inviarle.';

export const KB_MSG_VERIFYING_HYPOTHESIS = 'Perfetto, sto verificando la tua ipotesi';

export const KB_MSG_AI_ANALYZE_DOC =
  'Nessun problema, analizzo io il documento e ti mostro quello che ho dedotto';

export function buildKbHypothesisChoiceMessages(): KbChatMessage[] {
  return [
    {
      id: createKbChatMessageId(),
      role: 'assistant',
      content: KB_HYPOTHESIS_QUESTION,
      interactive: { kind: 'hypothesis_choice' },
      createdAt: new Date().toISOString(),
    },
  ];
}

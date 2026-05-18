/**
 * Helpers for KB guided chat messages.
 */

import type { KbChatMessage } from './kbRuleTypes';

export function getLastKbUserMessage(messages: readonly KbChatMessage[]): string | null {
  for (let i = messages.length - 1; i >= 0; i--) {
    const m = messages[i];
    if (m?.role === 'user') {
      const text = String(m.content || '').trim();
      if (text) return text;
    }
  }
  return null;
}

export function hasKbUserChatQuestion(messages: readonly KbChatMessage[]): boolean {
  return getLastKbUserMessage(messages) != null;
}

export const KB_ANALYSIS_INTENT_REQUIRED_MSG =
  'Indica in chat che tipo di analisi vuoi fare (es. quali regole estrarre, quali campi approfondire). Poi usa Rianalizza o continua la conversazione.';

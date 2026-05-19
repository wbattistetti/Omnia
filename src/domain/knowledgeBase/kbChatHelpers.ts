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

export function isKbConsentAcceptReply(text: string): boolean {
  const lower = text.trim().toLowerCase();
  return /^(s[iì](\s*,?\s*analizza)?|ok|va bene|yes|analizza)/.test(lower);
}

export function isKbConsentDeclineReply(text: string): boolean {
  const lower = text.trim().toLowerCase();
  return /^(no|non ora|più tardi|piu tardi|annulla|stop)/.test(lower);
}

export function isKbRetryReply(text: string): boolean {
  return /^riprova$/i.test(String(text || '').trim());
}

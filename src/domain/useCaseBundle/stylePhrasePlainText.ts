/**
 * Testo plain per preview esempi stile (senza delimitatori `[…]` / `«…»`).
 */

import { splitAgentMessageParts } from './agentMessageTokenSyntax';

/** Rimuove wrapper token mantenendo il contenuto interno. */
export function agentMessageToPlainPreview(text: string): string {
  const parts = splitAgentMessageParts(text);
  return parts
    .map((part) => {
      if (part.kind === 'semantic' || part.kind === 'style') {
        return part.text.slice(1, -1);
      }
      return part.text;
    })
    .join('')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Chiave deduplicazione: stesso contenuto lessicale ignorando maiuscole, spazi e punteggiatura.
 */
export function normalizePlainPhraseKey(text: string): string {
  const plain = agentMessageToPlainPreview(text);
  return plain
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

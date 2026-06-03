/**
 * Utility per sostituire nomi token (slot_id) nel testo tokenizzato `[…]`.
 */

import { extractTokenNames } from '@domain/useCaseGeneratorWizard/tokenizedText';
import { normalizeSlotId, normalizeSurface } from './projectSlotLexicon';

/** Estrae il testo interno ai `[…]` in ordine di apparizione. */
export function extractBracketInnersInOrder(text: string): string[] {
  const out: string[] = [];
  let i = 0;
  while (i < text.length) {
    if (text[i] !== '[') {
      i += 1;
      continue;
    }
    const close = text.indexOf(']', i + 1);
    if (close === -1) break;
    const inner = text.slice(i + 1, close).trim();
    if (inner) out.push(inner);
    i = close + 1;
  }
  return out;
}

/**
 * Allinea token nel testo tokenizzato con la surface corrispondente nel messaggio naturale
 * (stessa posizione bracket).
 */
export function resolveNaturalSurfaceAtTokenIndex(
  naturalText: string,
  tokenizedText: string,
  tokenName: string
): string | null {
  const target = normalizeSlotId(tokenName);
  const tokenizedList = extractTokenNames(tokenizedText);
  let idx = -1;
  for (let i = 0; i < tokenizedList.length; i++) {
    if (normalizeSlotId(tokenizedList[i]) === target) {
      idx = i;
      break;
    }
  }
  if (idx < 0) return null;
  const naturals = extractBracketInnersInOrder(naturalText);
  if (idx >= naturals.length) return null;
  return naturals[idx];
}

/** Surface normalizzata per lookup lessico (stesso indice bracket del token tokenizzato). */
export function resolveNormalizedSurfaceAtTokenIndex(
  naturalText: string,
  tokenizedText: string,
  tokenName: string
): string | null {
  const surface = resolveNaturalSurfaceAtTokenIndex(naturalText, tokenizedText, tokenName);
  return surface ? normalizeSurface(surface) : null;
}

/**
 * Sostituisce ogni occorrenza `[oldToken]` con `[newSlotId]` (match sul nome interno normalizzato).
 */
export function replaceSlotIdInTokenizedText(
  tokenizedText: string,
  oldToken: string,
  newSlotId: string
): string {
  const oldNorm = normalizeSlotId(oldToken);
  const newNorm = normalizeSlotId(newSlotId);
  if (!oldNorm || !newNorm || oldNorm === newNorm) return tokenizedText;

  let out = '';
  let i = 0;
  while (i < tokenizedText.length) {
    if (tokenizedText[i] !== '[') {
      out += tokenizedText[i];
      i += 1;
      continue;
    }
    const close = tokenizedText.indexOf(']', i + 1);
    if (close === -1) {
      out += tokenizedText.slice(i);
      break;
    }
    const inner = tokenizedText.slice(i + 1, close);
    if (normalizeSlotId(inner) === oldNorm) {
      out += `[${newNorm}]`;
    } else {
      out += tokenizedText.slice(i, close + 1);
    }
    i = close + 1;
  }
  return out;
}

/** True se il testo contiene almeno un token con nome normalizzato uguale a `slotId`. */
export function tokenizedTextContainsSlot(tokenizedText: string, slotId: string): boolean {
  const norm = normalizeSlotId(slotId);
  return extractTokenNames(tokenizedText).some((n) => normalizeSlotId(n) === norm);
}

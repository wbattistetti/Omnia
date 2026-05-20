/**
 * Rilevamento modifiche «sostanziali» sulla descrizione task per proporre il polish IA
 * (stesso significato, migliore formattazione).
 */

import { DESIGN_DESCRIPTION_POLISH_MIN_CHAR_DELTA } from './constants';

/**
 * Conta caratteri diversi tra due stringhe (posizione per posizione + differenza di lunghezza).
 */
export function countTextCharDelta(a: string, b: string): number {
  const left = a.trim();
  const right = b.trim();
  if (left === right) return 0;
  let delta = Math.abs(left.length - right.length);
  const minLen = Math.min(left.length, right.length);
  for (let i = 0; i < minLen; i++) {
    if (left[i] !== right[i]) delta += 1;
  }
  return delta;
}

/**
 * True se il testo corrente differisce dalla baseline almeno di `minCharDelta` caratteri
 * e ha lunghezza minima utile per una chiamata polish.
 */
export function hasSignificantDesignDescriptionEdit(
  current: string,
  baseline: string,
  minCharDelta: number = DESIGN_DESCRIPTION_POLISH_MIN_CHAR_DELTA,
  minTextLen = 40
): boolean {
  const cur = current.trim();
  const base = baseline.trim();
  if (cur.length < minTextLen) return false;
  return countTextCharDelta(cur, base) >= minCharDelta;
}

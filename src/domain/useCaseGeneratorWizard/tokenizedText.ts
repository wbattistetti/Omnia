/**
 * Utility deterministiche per la frase tokenizzata del passo 3 «Tokenizzazione» del wizard.
 *
 * Modello stringa: testo libero che contiene placeholder tra parentesi quadre, es. `[data]`,
 * `[ora1]`, `[nome]`. I token sono INTERNI alla gente virtuale (es. ElevenLabs), non mappano a
 * variabili Omnia, non hanno GUID. Il nome è solo un hint sul TIPO di valore.
 *
 * Funzioni esposte:
 * - {@link validateTokenizedText}: brackets balanced + token names alfanumerici;
 * - {@link splitTokenizedText}: spezza in segmenti testo/token per evidenziare i placeholder in UI;
 * - {@link extractTokenNames}: lista dei nomi token (utility/debug).
 */

/**
 * Regex per il nome di un token: lowercase, deve iniziare con una lettera, poi alfanumerico.
 *
 * Coerente con la validazione lato backend in `AIAgentTokenizationService.js`.
 */
const TOKEN_NAME_REGEX = /^[a-z][a-z0-9]*$/;

/**
 * Contenuto ammesso tra `[ ]`: id runtime (`data`, `data1`) oppure surface leggibile
 * design-time (`8 giugno 2026`, `09:30`, `visita cardiologica`).
 */
export function isValidBracketInner(inner: string): boolean {
  const t = inner.trim();
  if (!t) return false;
  if (TOKEN_NAME_REGEX.test(t)) return true;
  if (t.length > 80 || /[\[\]]/.test(t)) return false;
  return /\p{L}/u.test(t) || /\d/.test(t);
}

export type TokenizedTextValidation =
  | { ok: true }
  | { ok: false; error: string };

/**
 * Validazione: brackets bilanciate, nessun annidamento, nomi token alfanumerici lowercase.
 *
 * @example
 * validateTokenizedText('Ti propongo [data] alle [ora].'); // { ok: true }
 * validateTokenizedText('Manca chiusura [data');           // { ok: false, error: 'unclosed bracket' }
 * validateTokenizedText('Token [Data] maiuscolo');         // { ok: false, error: 'invalid token name "Data"' }
 */
export function validateTokenizedText(t: string): TokenizedTextValidation {
  if (typeof t !== 'string') return { ok: false, error: 'not a string' };
  let depth = 0;
  let cur = '';
  for (let i = 0; i < t.length; i++) {
    const ch = t[i];
    if (ch === '[') {
      if (depth > 0) return { ok: false, error: 'nested or unclosed bracket' };
      depth = 1;
      cur = '';
      continue;
    }
    if (ch === ']') {
      if (depth !== 1) return { ok: false, error: 'unmatched close bracket' };
      if (!isValidBracketInner(cur)) {
        return { ok: false, error: `invalid bracket content "${cur}"` };
      }
      depth = 0;
      cur = '';
      continue;
    }
    if (depth === 1) cur += ch;
  }
  if (depth !== 0) return { ok: false, error: 'unclosed bracket' };
  return { ok: true };
}

export type TokenizedTextSegment =
  | { kind: 'text'; text: string }
  | { kind: 'token'; name: string };

/**
 * Spezza la stringa tokenizzata in segmenti `text` / `token`. Le porzioni di testo tra
 * parentesi quadre che NON sono token validi (es. `[Data]`, `[]`, `[a b]`) vengono trattate
 * come testo letterale: in questo modo la UI può sempre renderizzare qualcosa, mentre la
 * validazione separata segnala l'errore al designer.
 *
 * Garanzia: la concatenazione dei segmenti in `[text|`[${name}]`]` ricostruisce l'input.
 */
export function splitTokenizedText(t: string): TokenizedTextSegment[] {
  if (typeof t !== 'string' || t.length === 0) return [];
  const out: TokenizedTextSegment[] = [];
  let i = 0;
  let buffer = '';
  const flushText = (): void => {
    if (buffer.length > 0) {
      out.push({ kind: 'text', text: buffer });
      buffer = '';
    }
  };
  while (i < t.length) {
    const ch = t[i];
    if (ch === '[') {
      const close = t.indexOf(']', i + 1);
      if (close === -1) {
        buffer += t.slice(i);
        i = t.length;
        break;
      }
      const inner = t.slice(i + 1, close);
      if (isValidBracketInner(inner)) {
        flushText();
        out.push({ kind: 'token', name: inner.trim() });
        i = close + 1;
        continue;
      }
      /** Token mal formato: lo tratto come testo letterale (`[Data]` o `[ a b ]` ecc.). */
      buffer += t.slice(i, close + 1);
      i = close + 1;
      continue;
    }
    buffer += ch;
    i += 1;
  }
  flushText();
  return out;
}

/** Nomi dei token in ordine di apparizione (inclusi duplicati). */
export function extractTokenNames(t: string): string[] {
  return splitTokenizedText(t)
    .filter((s): s is { kind: 'token'; name: string } => s.kind === 'token')
    .map((s) => s.name);
}

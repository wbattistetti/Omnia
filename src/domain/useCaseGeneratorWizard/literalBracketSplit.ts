/**
 * Split per la modalità «literal» del rendering tokenizzato (canonico con valori reali tra
 * parentesi quadre, es. `[15 giugno 2026]`).
 *
 * Differenza chiave da {@link splitTokenizedText}:
 *  - `splitTokenizedText` valida il contenuto del bracket contro `^[a-z][a-z0-9]*$` e tratta
 *    i bracket non validi come testo letterale. È pensato per la fase RUNTIME dove i nomi
 *    placeholder devono essere valid identifiers.
 *  - `splitLiteralBracketed` accetta QUALSIASI contenuto tra `[` e `]` (spazi, accenti,
 *    cifre, punteggiatura, …) ed evidenzia il segmento come «literal». È pensato per la fase
 *    CANONICA, dove il designer ha racchiuso i valori variabili così come dovranno apparire
 *    al lettore (es. `[15 giugno 2026 alle 09:30]`).
 *
 * Bracket non bilanciati (apertura senza chiusura) vengono trattati come testo letterale: il
 * componente UI che si appoggia a questo split mostra comunque qualcosa, mentre la
 * compilazione lato dominio segnala il warning separatamente
 * ({@link buildCompilationWarnings}). Niente autoclose silenzioso.
 *
 * Garanzia: la concatenazione `text|`[${text}]`` ricostruisce esattamente l'input.
 */

export type LiteralBracketKind = 'text' | 'literal';

export interface LiteralBracketSegment {
  kind: LiteralBracketKind;
  /** Testo del segmento — per `literal`, il contenuto del bracket SENZA `[` e `]`. */
  text: string;
}

/**
 * Spezza una stringa in segmenti `text` / `literal`. Restituisce array vuoto se l'input non è
 * una stringa o è vuoto.
 */
export function splitLiteralBracketed(text: string): LiteralBracketSegment[] {
  if (typeof text !== 'string' || text.length === 0) return [];
  const out: LiteralBracketSegment[] = [];
  let i = 0;
  let buffer = '';
  const flushText = (): void => {
    if (buffer.length > 0) {
      out.push({ kind: 'text', text: buffer });
      buffer = '';
    }
  };
  while (i < text.length) {
    const ch = text[i];
    if (ch === '[') {
      const close = text.indexOf(']', i + 1);
      if (close === -1) {
        buffer += text.slice(i);
        i = text.length;
        break;
      }
      const inner = text.slice(i + 1, close);
      flushText();
      out.push({ kind: 'literal', text: inner });
      i = close + 1;
      continue;
    }
    buffer += ch;
    i += 1;
  }
  flushText();
  return out;
}

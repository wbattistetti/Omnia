/**
 * `splitTextBySeed` — domain helper puro per highlight di occorrenze di un seed
 * dentro un testo libero. Restituisce una lista alternata di porzioni `match` /
 * `non-match`, pronta per il rendering React (un componente di vista wrappa le
 * `match: true` in `<mark>` o equivalenti, le altre in plain text).
 *
 * Caratteristiche:
 *  - **Case-insensitive**: l'utente cerca «ord», noi matchiamo "Ordine", "ordinare", ecc.
 *  - **Substring** (no whole-word): coerente con la UX da search-as-you-type.
 *  - **Pure**: niente DOM, niente React — testabile con Vitest in modo deterministico.
 *  - **Fail-safe sugli edge case**: testo vuoto, seed vuoto, seed più lungo del testo
 *    o composto da soli spazi → ritorniamo sempre il testo intero come singola
 *    porzione `match: false` (così il caller non deve gestire `null`/`undefined`).
 *
 * Decisioni:
 *  - Niente regex con caratteri di gruppo: il seed può contenere metacaratteri
 *    (`.*?+()`); usiamo lookup lineare con `toLocaleLowerCase()` per evitare di
 *    introdurre vulnerabilità da seed malevolo o crash da regex non chiuse.
 *  - Locale di confronto: `toLocaleLowerCase()` senza locale esplicito — il browser
 *    sceglie quella di sistema. Sufficiente per IT/EN/ES; se servirà supporto
 *    Turkish (i ↔ İ) si potrà passare un locale via parametro opzionale.
 */

export interface HighlightPart {
  /** Porzione di testo originale (preserva il casing originale del `text`). */
  readonly text: string;
  /** True se questa porzione è un'occorrenza del seed; false altrimenti. */
  readonly match: boolean;
}

/**
 * Spezza `text` nelle porzioni che matchano `seed` (case-insensitive, substring) e
 * quelle che non matchano. La sequenza è sempre alternata e copre `text` per intero
 * (la concatenazione delle `text` ricostruisce l'originale).
 */
export function splitTextBySeed(text: string, seed: string): readonly HighlightPart[] {
  if (typeof text !== 'string' || text.length === 0) {
    return [{ text: text ?? '', match: false }];
  }
  const trimmedSeed = typeof seed === 'string' ? seed.trim() : '';
  if (trimmedSeed.length === 0 || trimmedSeed.length > text.length) {
    return [{ text, match: false }];
  }
  const lowerText = text.toLocaleLowerCase();
  const lowerSeed = trimmedSeed.toLocaleLowerCase();
  const out: HighlightPart[] = [];
  let cursor = 0;
  while (cursor < text.length) {
    const idx = lowerText.indexOf(lowerSeed, cursor);
    if (idx === -1) {
      out.push({ text: text.slice(cursor), match: false });
      break;
    }
    if (idx > cursor) {
      out.push({ text: text.slice(cursor, idx), match: false });
    }
    out.push({ text: text.slice(idx, idx + lowerSeed.length), match: true });
    cursor = idx + lowerSeed.length;
  }
  if (out.length === 0) return [{ text, match: false }];
  return out;
}

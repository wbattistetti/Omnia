/**
 * `SeedHighlightedText` — wrapper minimale che renderizza una stringa evidenziando
 * con un chip giallo le occorrenze di `seed`. Logica di splitting delegata al
 * domain helper {@link splitTextBySeed} (puro, testabile, case-insensitive).
 *
 * Decisioni:
 *  - Render `<span>` con `<mark>` per le porzioni match: semantica HTML corretta
 *    e screen reader friendly (vs. `<span class="highlight">` che è muto).
 *  - Stile chip giallo coerente con la palette UI: `bg-yellow-300/80 text-slate-900`
 *    — abbastanza saturo da spiccare sui fondi scuri delle card, ma con `text-slate-900`
 *    il contenuto resta leggibile (mai testo giallo su fondo giallo).
 *  - Quando `seed` è vuoto: il componente passa-attraverso, restituisce `text` plain
 *    senza wrapper extra (zero overhead nel caso comune "nessuna ricerca attiva").
 *  - Niente `dangerouslySetInnerHTML`: tutto tramite nodi React → no XSS anche se
 *    il testo arriva da un LLM (defensive against prompt-injection echo).
 */

import React from 'react';
import { splitTextBySeed } from '@domain/textSearch/splitTextBySeed';

export interface SeedHighlightedTextProps {
  /** Testo originale da renderizzare. */
  readonly text: string;
  /** Seed da evidenziare. Stringa vuota o solo-spazi → nessun highlight. */
  readonly seed: string;
  /**
   * Classe Tailwind opzionale per le porzioni match. Default = chip giallo.
   * Esposta perché in altri contesti (es. tabella scura) può servire variare il
   * contrast (es. `bg-yellow-400/90 text-black`); il default copre il 95% dei casi.
   */
  readonly markClassName?: string;
}

const DEFAULT_MARK_CLASS =
  'rounded px-0.5 bg-yellow-300/80 text-slate-900 font-semibold';

export function SeedHighlightedText({
  text,
  seed,
  markClassName = DEFAULT_MARK_CLASS,
}: SeedHighlightedTextProps): React.ReactElement {
  const trimmedSeed = seed.trim();
  if (trimmedSeed.length === 0) {
    return <>{text}</>;
  }
  const parts = splitTextBySeed(text, trimmedSeed);
  return (
    <>
      {parts.map((part, idx) =>
        part.match ? (
          <mark key={idx} className={markClassName}>
            {part.text}
          </mark>
        ) : (
          <React.Fragment key={idx}>{part.text}</React.Fragment>
        )
      )}
    </>
  );
}

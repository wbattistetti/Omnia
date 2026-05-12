/**
 * Rendering read-only di una frase con segmenti tra parentesi quadre evidenziati.
 *
 * Due modalità d'uso:
 *  - `runtime` (default): il testo è già tokenizzato (`[data]`, `[ora1]`, ...) — i nomi sono
 *    snake/lower e validati da {@link splitTokenizedText}. I bracket sono colorati ambra.
 *    Usato nelle bubble del Passo 2 e nel pannello DX «Testo tokenizzato con token runtime».
 *  - `literal`: il testo è canonico (`[15 giugno 2026]`, `[09:30]`) — i bracket contengono
 *    valori liberi inseriti dal designer. Sono colorati arancio per distinguerli dai token
 *    runtime e segnalare che NON sono ancora tokenizzati. Usato nel pannello DX «Testo
 *    tokenizzato in linguaggio naturale».
 *
 * In entrambe le modalità i caratteri fuori bracket mantengono il colore del contenitore.
 */

import React from 'react';
import { splitTokenizedText } from '@domain/useCaseGeneratorWizard/tokenizedText';
import { splitLiteralBracketed } from '@domain/useCaseGeneratorWizard/literalBracketSplit';

export type TokenizedHighlightedTextMode = 'runtime' | 'literal';

export interface TokenizedHighlightedTextProps {
  text: string;
  className?: string;
  /** Mostra il testo barrato (es. bubble suggestion `rejected`). */
  strike?: boolean;
  /** Default `runtime`. Vedi descrizione del modulo. */
  mode?: TokenizedHighlightedTextMode;
}

/** True per i nomi token generici del fallback compilatore: `slot`, `slot1`, `slot2`, ... */
function isGenericSlotName(name: string): boolean {
  return /^slot\d*$/.test(name);
}

export function TokenizedHighlightedText({
  text,
  className,
  strike = false,
  mode = 'runtime',
}: TokenizedHighlightedTextProps): React.ReactElement {
  const runtimeSegments = React.useMemo(
    () => (mode === 'runtime' ? splitTokenizedText(text) : []),
    [mode, text]
  );
  const literalSegments = React.useMemo(
    () => (mode === 'literal' ? splitLiteralBracketed(text) : []),
    [mode, text]
  );

  const baseClass = [className ?? '', strike ? 'line-through' : '']
    .filter(Boolean)
    .join(' ');

  if (mode === 'literal') {
    return (
      <p className={baseClass}>
        {literalSegments.map((s, i) => {
          if (s.kind === 'literal') {
            return (
              <span
                key={i}
                className="mx-[1px] rounded-[3px] border border-orange-400/55 bg-orange-950/35 px-[3px] py-[0.5px] font-mono text-[0.92em] text-orange-200"
                title="Valore literal — verrà sostituito da uno slot runtime"
              >
                [{s.text}]
              </span>
            );
          }
          return <span key={i}>{s.text}</span>;
        })}
      </p>
    );
  }

  return (
    <p className={baseClass}>
      {runtimeSegments.map((s, i) => {
        if (s.kind === 'token') {
          const generic = isGenericSlotName(s.name);
          return (
            <span
              key={i}
              className={
                generic
                  ? 'mx-[1px] rounded-[3px] border border-dashed border-amber-400/70 bg-amber-300/15 px-[3px] py-[0.5px] font-mono text-[0.92em] text-amber-200'
                  : 'mx-[1px] rounded-[3px] border border-amber-400/60 bg-amber-300/20 px-[3px] py-[0.5px] font-mono text-[0.92em] text-amber-300'
              }
              title={
                generic
                  ? `Placeholder generico "${s.name}" — il compilatore non ha potuto inferire un tipo specifico`
                  : `Placeholder runtime "${s.name}"`
              }
            >
              [{s.name}]
            </span>
          );
        }
        return <span key={i}>{s.text}</span>;
      })}
    </p>
  );
}

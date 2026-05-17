/**
 * Lista frasi generate dalla combinatoria delle varianti style token.
 */

import React from 'react';
import { BracketTokenHighlightedText } from './BracketTokenHighlightedTextarea';
import { MAX_STYLE_TOKEN_COMBINATIONS } from '@domain/useCaseBundle/styleTokenCombinatorics';

export type AgentMessageStyleExamplesPanelProps = {
  phrases: readonly string[];
  truncated?: boolean;
  className?: string;
};

export function AgentMessageStyleExamplesPanel({
  phrases,
  truncated = false,
  className = '',
}: AgentMessageStyleExamplesPanelProps): React.ReactElement {
  return (
    <div
      className={`rounded-md border border-sky-700/40 bg-sky-950/25 px-2.5 py-2 ${className}`.trim()}
      role="region"
      aria-label="Esempi di frase con varianti di stile"
    >
      <p className="mb-1.5 text-xs font-semibold text-sky-200/90">
        Versioni messaggio ({phrases.length}
        {truncated ? `, max ${MAX_STYLE_TOKEN_COMBINATIONS}` : ''})
      </p>
      {phrases.length === 0 ? (
        <p className="text-xs text-slate-400">
          Aggiungi almeno una variante per ogni token di stile nel messaggio.
        </p>
      ) : (
        <ol className="m-0 max-h-48 list-decimal space-y-1.5 overflow-y-auto pl-4 text-xs text-slate-100">
          {phrases.map((phrase, i) => (
            <li key={`${i}-${phrase.slice(0, 24)}`} className="leading-snug">
              <BracketTokenHighlightedText
                text={phrase}
                className="inline min-w-0 whitespace-pre-wrap"
              />
            </li>
          ))}
        </ol>
      )}
      {truncated ? (
        <p className="mt-1.5 text-[11px] text-sky-300/70">
          Mostrate le prime {MAX_STYLE_TOKEN_COMBINATIONS} combinazioni.
        </p>
      ) : null}
    </div>
  );
}

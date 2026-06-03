/**
 * Colonna icona messaggio: nuvoletta leggibile (sopra, indicatore) + nuvoletta semantica (sotto, toggle).
 */

import React from 'react';
import { MessageSquareText } from 'lucide-react';

export type SemanticLayerIconStackProps = {
  semanticOpen: boolean;
  onToggleSemantic: () => void;
  disabled?: boolean;
};

export function SemanticLayerIconStack({
  semanticOpen,
  onToggleSemantic,
  disabled = false,
}: SemanticLayerIconStackProps): React.ReactElement {
  return (
    <span
      className="inline-flex w-6 shrink-0 flex-col items-center justify-start gap-0"
      data-semantic-layer-icons
    >
      <span
        className="flex h-[14px] items-center justify-center text-emerald-300"
        title="Messaggio leggibile"
        aria-hidden
      >
        <MessageSquareText size={13} strokeWidth={2.25} />
      </span>
      <button
        type="button"
        disabled={disabled}
        aria-pressed={semanticOpen}
        aria-label={
          semanticOpen ? 'Nascondi token semantici' : 'Mostra token semantici'
        }
        title={
          semanticOpen
            ? 'Nascondi riga token semantici'
            : 'Mostra riga token semantici (modificabili)'
        }
        className={[
          'flex h-[14px] items-center justify-center rounded-sm transition-colors',
          'focus:outline-none focus-visible:ring-1 focus-visible:ring-violet-500/80',
          disabled ? 'cursor-not-allowed opacity-40' : 'hover:bg-slate-800/60',
        ].join(' ')}
        onClick={(e) => {
          e.stopPropagation();
          onToggleSemantic();
        }}
      >
        <MessageSquareText
          size={13}
          strokeWidth={semanticOpen ? 2.25 : 2}
          className={semanticOpen ? 'text-violet-300' : 'text-slate-500'}
          aria-hidden
        />
      </button>
    </span>
  );
}

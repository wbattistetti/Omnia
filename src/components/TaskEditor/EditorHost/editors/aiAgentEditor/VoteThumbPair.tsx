/**
 * Coppia pollice su/giù per validazione manuale campo (etichetta, scenario, messaggio).
 */

import * as React from 'react';
import { ThumbsDown, ThumbsUp } from 'lucide-react';

export interface VoteThumbPairProps {
  vote?: 'up' | 'down';
  disabled?: boolean;
  outerBtnClass: string;
  onVote: (choice: 'up' | 'down') => void;
}

export function VoteThumbPair(props: VoteThumbPairProps): React.ReactElement {
  const { vote, disabled, outerBtnClass, onVote } = props;
  return (
    <>
      <button
        type="button"
        disabled={disabled}
        title={vote === 'up' ? 'Rimuovi validazione' : 'Valida (testo verde)'}
        className={`${outerBtnClass} ${vote === 'up' ? 'text-emerald-400' : 'text-slate-500 hover:text-emerald-300/90'}`}
        onClick={(e) => {
          e.stopPropagation();
          onVote('up');
        }}
      >
        <ThumbsUp size={12} aria-hidden />
      </button>
      <button
        type="button"
        disabled={disabled}
        title={vote === 'down' ? 'Rimuovi invalidazione' : 'Invalida (testo rosso)'}
        className={`${outerBtnClass} ${vote === 'down' ? 'text-red-400' : 'text-slate-500 hover:text-red-300/90'}`}
        onClick={(e) => {
          e.stopPropagation();
          onVote('down');
        }}
      >
        <ThumbsDown size={12} aria-hidden />
      </button>
    </>
  );
}

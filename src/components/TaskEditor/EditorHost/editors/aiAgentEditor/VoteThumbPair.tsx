/**
 * Validazione manuale campo: su / giù / da approfondire (icona ?).
 */

import * as React from 'react';
import { HelpCircle, ThumbsDown, ThumbsUp } from 'lucide-react';
import type { DesignerFieldVote } from './useCaseComposerDesignerVotes';

export interface VoteThumbPairProps {
  vote?: DesignerFieldVote;
  disabled?: boolean;
  outerBtnClass: string;
  onVote: (choice: DesignerFieldVote) => void;
  /** Lucide icon size (default 12). */
  iconSize?: number;
}

export function VoteThumbPair(props: VoteThumbPairProps): React.ReactElement {
  const { vote, disabled, outerBtnClass, onVote, iconSize = 12 } = props;
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
        <ThumbsUp size={iconSize} aria-hidden />
      </button>
      <button
        type="button"
        disabled={disabled}
        title={vote === 'review' ? 'Rimuovi «da approfondire»' : 'Da approfondire (evidenza arancione)'}
        className={`${outerBtnClass} ${vote === 'review' ? 'text-orange-400' : 'text-slate-500 hover:text-orange-300/90'}`}
        onClick={(e) => {
          e.stopPropagation();
          onVote('review');
        }}
      >
        <HelpCircle size={iconSize} aria-hidden />
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
        <ThumbsDown size={iconSize} aria-hidden />
      </button>
    </>
  );
}

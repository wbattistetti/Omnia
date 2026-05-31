/**
 * Chip toolbar «Start»: marca al massimo un use case come apertura sessione.
 */

import React from 'react';

export type UseCaseStartChipProps = {
  active: boolean;
  disabled?: boolean;
  onToggle: () => void;
};

export function UseCaseStartChip({
  active,
  disabled = false,
  onToggle,
}: UseCaseStartChipProps): React.ReactElement {
  return (
    <button
      type="button"
      disabled={disabled}
      title={
        active
          ? 'Rimuovi come use case Start (apertura sessione)'
          : 'Imposta come use case Start (apertura sessione)'
      }
      aria-pressed={active}
      aria-label={active ? 'Use case Start attivo' : 'Imposta use case Start'}
      onClick={(e) => {
        e.stopPropagation();
        onToggle();
      }}
      className={`shrink-0 rounded px-1.5 py-px text-[10px] font-bold uppercase tracking-wide transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${
        active
          ? 'bg-orange-600/55 text-orange-50 ring-1 ring-orange-400/80'
          : 'border border-orange-600/45 bg-orange-950/25 text-orange-200/95 hover:bg-orange-900/45'
      }`}
    >
      Start
    </button>
  );
}

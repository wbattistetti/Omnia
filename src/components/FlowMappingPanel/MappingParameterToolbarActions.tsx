/**
 * Standard backend mapping parameter toolbar icon buttons.
 */

import React from 'react';
import { Pencil, Trash2, StickyNote, Table2, Settings2 } from 'lucide-react';

const iconSm = 'w-3 h-3';

export interface MappingParameterToolbarActionsProps {
  onEditName: () => void;
  onRemove: () => void;
  rowExtra: 'none' | 'notes' | 'values' | 'config';
  onToggleNotes: () => void;
  onToggleValues: () => void;
  showConstraint?: boolean;
  onToggleConstraint?: () => void;
}

export function MappingParameterToolbarActions({
  onEditName,
  onRemove,
  rowExtra,
  onToggleNotes,
  onToggleValues,
  showConstraint = false,
  onToggleConstraint,
}: MappingParameterToolbarActionsProps): React.ReactElement {
  return (
    <>
      <button
        type="button"
        className="rounded p-1 text-slate-400 hover:bg-slate-800 hover:text-amber-200"
        title="Modifica nome interno"
        aria-label="Modifica nome interno"
        onClick={onEditName}
      >
        <Pencil className={iconSm} strokeWidth={2} />
      </button>
      <button
        type="button"
        className="rounded p-1 text-slate-400 hover:bg-slate-800 hover:text-red-400"
        title="Rimuovi parametro"
        aria-label="Rimuovi parametro"
        onClick={onRemove}
      >
        <Trash2 className={iconSm} strokeWidth={2} />
      </button>
      <button
        type="button"
        className={`rounded p-1 hover:bg-slate-800 ${rowExtra === 'notes' ? 'text-amber-300' : 'text-slate-400 hover:text-amber-200'}`}
        title="Descrizione campo"
        aria-label="Descrizione campo"
        onClick={onToggleNotes}
      >
        <StickyNote className={iconSm} strokeWidth={2} />
      </button>
      <button
        type="button"
        className={`rounded p-1 hover:bg-slate-800 ${rowExtra === 'values' ? 'text-sky-300' : 'text-slate-400 hover:text-sky-200'}`}
        title="Dominio valori"
        aria-label="Dominio valori"
        onClick={onToggleValues}
      >
        <Table2 className={iconSm} strokeWidth={2} />
      </button>
      {showConstraint && onToggleConstraint ? (
        <button
          type="button"
          className={`rounded p-1 hover:bg-slate-800 ${rowExtra === 'config' ? 'text-sky-300' : 'text-slate-400 hover:text-sky-200'}`}
          title="Parameter constraint"
          aria-label="Parameter constraint"
          onClick={onToggleConstraint}
        >
          <Settings2 className={iconSm} strokeWidth={2} />
        </button>
      ) : null}
    </>
  );
}

export function MappingParameterInterfaceRemoveAction({
  onRemove,
}: {
  onRemove: () => void;
}): React.ReactElement {
  return (
    <button
      type="button"
      className="rounded p-1 text-slate-400 hover:bg-slate-800 hover:text-red-400"
      title="Rimuovi mapping"
      aria-label="Rimuovi mapping"
      onClick={onRemove}
    >
      <Trash2 className="w-3 h-3" strokeWidth={2} />
    </button>
  );
}

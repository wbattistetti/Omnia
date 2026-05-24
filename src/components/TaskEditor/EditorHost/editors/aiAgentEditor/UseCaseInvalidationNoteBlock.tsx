/**
 * Blocco nota invalidazione scenario: sola lettura con toolbar hover (matita / cestino),
 * modifica con textarea + spunta / X come gli altri campi wizard.
 */

import * as React from 'react';
import { Check, Pencil, Trash2, X } from 'lucide-react';
import {
  UC_CLASSIC_TEXTAREA_SCENARIO,
} from './useCaseComposerPresentation';

const UC_INVALIDATION_NOTE_TOOL_BTN =
  'rounded p-0.5 text-slate-400 hover:bg-slate-800/90 disabled:opacity-40';

export const USE_CASE_INVALIDATION_NOTE_PLACEHOLDER =
  'Spiega brevemente perché questo scenario non è valido.\nQueste informazioni sono fondamentali per aiutarmi a generare use case più corretti e per arricchire la conoscenza dell\'agente.';

export type UseCaseInvalidationNoteBlockProps = {
  note: string;
  disabled?: boolean;
  /** Evidenzia obbligatorietà quando la nota è ancora vuota dopo invalidazione. */
  required?: boolean;
  onNoteChange?: (next: string) => void;
  onNoteDelete?: () => void;
};

function InvalidationNoteShell(props: { children: React.ReactNode }): React.ReactElement {
  return (
    <div className="overflow-hidden border-t border-red-500/25 bg-red-950/20 px-2 py-2 transition-all duration-200 ease-out">
      {props.children}
    </div>
  );
}

export function UseCaseInvalidationNoteBlock(
  props: UseCaseInvalidationNoteBlockProps
): React.ReactElement {
  const { note, disabled, required, onNoteChange, onNoteDelete } = props;
  const committed = String(note ?? '');
  const [editing, setEditing] = React.useState(() => !committed.trim());
  const [draft, setDraft] = React.useState(committed);

  React.useEffect(() => {
    if (!editing) setDraft(committed);
  }, [committed, editing]);

  React.useEffect(() => {
    if (required && !committed.trim()) setEditing(true);
  }, [required, committed]);

  const beginEdit = React.useCallback(() => {
    if (disabled) return;
    setDraft(committed);
    setEditing(true);
  }, [committed, disabled]);

  const commitEdit = React.useCallback(() => {
    const trimmed = draft.trim();
    if (required && !trimmed) return;
    onNoteChange?.(trimmed);
    setEditing(false);
  }, [draft, onNoteChange, required]);

  const cancelEdit = React.useCallback(() => {
    setDraft(committed);
    setEditing(false);
  }, [committed]);

  const deleteNote = React.useCallback(() => {
    if (disabled) return;
    if (onNoteDelete) {
      onNoteDelete();
    } else {
      onNoteChange?.('');
    }
    setDraft('');
    setEditing(Boolean(required));
  }, [committed, disabled, onNoteChange, onNoteDelete, required]);

  const showRequired = Boolean(required && editing && !draft.trim());
  const label = (
    <span className="block text-[10px] font-semibold uppercase tracking-wide text-red-300/90">
      Nota di invalidazione {showRequired ? <span className="text-red-400">*</span> : null}
    </span>
  );

  if (editing) {
    return (
      <InvalidationNoteShell>
        {label}
        <div className="group/invalid-note mt-1 flex items-start gap-2">
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            disabled={disabled}
            rows={3}
            autoFocus
            placeholder={USE_CASE_INVALIDATION_NOTE_PLACEHOLDER}
            aria-invalid={showRequired || undefined}
            aria-required
            className={`${UC_CLASSIC_TEXTAREA_SCENARIO} min-h-[72px] min-w-0 flex-1 border-red-500/40 focus:ring-red-500/45 ${
              showRequired ? 'ring-2 ring-red-500/55 border-red-500/70' : ''
            }`}
            onKeyDown={(e) => {
              if (e.key === 'Escape') {
                e.preventDefault();
                cancelEdit();
              }
              if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
                e.preventDefault();
                commitEdit();
              }
            }}
          />
          <div className="flex shrink-0 items-center gap-0.5 self-start pt-0.5">
            <button
              type="button"
              title="Conferma"
              disabled={disabled || (required && !draft.trim())}
              className="rounded p-0.5 text-emerald-400 hover:bg-slate-800/90 disabled:opacity-40"
              onClick={(e) => {
                e.stopPropagation();
                commitEdit();
              }}
            >
              <Check size={14} aria-hidden />
            </button>
            <button
              type="button"
              title="Annulla"
              disabled={disabled}
              className="rounded p-0.5 text-slate-400 hover:bg-slate-800/90 disabled:opacity-40"
              onClick={(e) => {
                e.stopPropagation();
                cancelEdit();
              }}
            >
              <X size={14} aria-hidden />
            </button>
          </div>
        </div>
      </InvalidationNoteShell>
    );
  }

  return (
    <InvalidationNoteShell>
      <div
        className={`group/invalid-note relative ${
          !committed.trim() ? 'cursor-default' : 'cursor-pointer'
        }`}
        onDoubleClick={(e) => {
          if (disabled || (e.target as HTMLElement).closest('button')) return;
          e.preventDefault();
          e.stopPropagation();
          beginEdit();
        }}
      >
        {!disabled ? (
          <div className="absolute top-0 right-0 z-10 flex gap-0.5 opacity-0 transition-opacity group-hover/invalid-note:opacity-100">
            <button
              type="button"
              title="Modifica nota di invalidazione"
              className={`${UC_INVALIDATION_NOTE_TOOL_BTN} hover:text-sky-300`}
              onClick={(e) => {
                e.stopPropagation();
                beginEdit();
              }}
            >
              <Pencil size={12} aria-hidden />
            </button>
            {committed.trim() ? (
              <button
                type="button"
                title="Elimina nota di invalidazione"
                className={`${UC_INVALIDATION_NOTE_TOOL_BTN} hover:text-red-300/90`}
                onClick={(e) => {
                  e.stopPropagation();
                  deleteNote();
                }}
              >
                <Trash2 size={12} aria-hidden />
              </button>
            ) : null}
          </div>
        ) : null}
        {label}
        <p className="mt-1 whitespace-pre-wrap pr-8 text-xs leading-relaxed text-slate-200">
          {committed.trim() ? (
            committed
          ) : (
            <span className="text-slate-500 italic">
              — passa il mouse e usa la matita per spiegare perché non è valido
            </span>
          )}
        </p>
      </div>
    </InvalidationNoteShell>
  );
}

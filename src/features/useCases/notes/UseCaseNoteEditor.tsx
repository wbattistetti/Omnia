import React from 'react';
import { Check, Pencil, Trash2, X } from 'lucide-react';

/**
 * Note UI: either read mode (trash + pencil when a saved note exists) or edit mode (check + cancel only).
 */
export function UseCaseNoteEditor(props: {
  value: string;
  onChange: (next: string) => void;
  /** Persisted note text; used to revert when canceling edit on an existing note. */
  persistedNote: string;
  onConfirm: () => void;
  /** Called when discarding a new note (no saved content) — typically closes the panel. */
  onCancelNew: () => void;
  /** True when the use case already has a non-empty persisted note. */
  hasSavedNote: boolean;
  onDeleteNote?: () => void;
}) {
  const { value, onChange, persistedNote, onConfirm, onCancelNew, hasSavedNote, onDeleteNote } = props;
  const taRef = React.useRef<HTMLTextAreaElement>(null);

  const [isEditing, setIsEditing] = React.useState(() => !hasSavedNote);

  React.useEffect(() => {
    if (!hasSavedNote) {
      setIsEditing(true);
    }
  }, [hasSavedNote]);

  React.useEffect(() => {
    if (!isEditing) return;
    const el = taRef.current;
    if (!el) return;
    el.focus();
    const len = el.value.length;
    try {
      el.setSelectionRange(len, len);
    } catch {
      /* ignore */
    }
  }, [isEditing]);

  const enterEdit = React.useCallback(() => {
    setIsEditing(true);
  }, []);

  const handleCancelEdit = React.useCallback(() => {
    if (hasSavedNote) {
      onChange(persistedNote);
      setIsEditing(false);
    } else {
      onCancelNew();
    }
  }, [hasSavedNote, onChange, persistedNote, onCancelNew]);

  const iconColClass = 'absolute right-1 top-1/2 z-10 flex -translate-y-1/2 flex-col gap-0.5';

  return (
    <div className="relative mt-1 ml-6 rounded border border-amber-500/45 bg-black p-2 pr-1">
      <div className="mb-1 text-[10px] font-medium uppercase tracking-wide text-amber-500/80">nota</div>
      <div className="relative flex min-h-[3.25rem]">
        {isEditing ? (
          <textarea
            ref={taRef}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            rows={3}
            className="min-h-[3.25rem] w-full min-w-0 resize-y rounded-sm bg-slate-950/90 px-2 py-1.5 pr-[2.75rem] text-xs text-slate-100 placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-amber-500/35 border-0"
            aria-label="Use case note"
          />
        ) : (
          <textarea
            readOnly
            tabIndex={-1}
            value={persistedNote}
            rows={3}
            className="min-h-[3.25rem] w-full min-w-0 cursor-default resize-y rounded-sm border-0 bg-slate-950/90 px-2 py-1.5 pr-[2.75rem] text-xs text-amber-100/95 focus:outline-none"
            aria-label="Use case note (sola lettura)"
          />
        )}

        {isEditing ? (
          <div className={iconColClass}>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onConfirm();
              }}
              className="rounded p-1 text-emerald-400 hover:bg-slate-800"
              title="Salva nota"
              aria-label="Salva nota"
            >
              <Check size={14} />
            </button>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                handleCancelEdit();
              }}
              className="rounded p-1 text-rose-300 hover:bg-slate-800"
              title={hasSavedNote ? 'Annulla modifiche' : 'Annulla'}
              aria-label={hasSavedNote ? 'Annulla modifiche' : 'Annulla'}
            >
              <X size={14} />
            </button>
          </div>
        ) : (
          <div className={iconColClass}>
            {hasSavedNote && onDeleteNote ? (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onDeleteNote();
                }}
                className="rounded p-1 text-rose-300 hover:bg-slate-800"
                title="Cancella nota"
                aria-label="Cancella nota"
              >
                <Trash2 size={14} />
              </button>
            ) : null}
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                enterEdit();
              }}
              className="rounded p-1 text-amber-200/90 hover:bg-slate-800"
              title="Modifica nota"
              aria-label="Modifica nota"
            >
              <Pencil size={14} />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

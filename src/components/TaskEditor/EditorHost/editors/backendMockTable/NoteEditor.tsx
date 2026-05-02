/**
 * Icona nota + editor inline per annotazioni design-time (persistenza rowId + colonna).
 */

import React from 'react';
import { StickyNote } from 'lucide-react';

export type NoteEditorProps = {
  noteKey: string;
  value: string;
  onSave: (key: string, text: string) => void;
  compact?: boolean;
};

export function NoteEditor({ noteKey, value, onSave, compact: _compact }: NoteEditorProps) {
  const [open, setOpen] = React.useState(false);
  const [draft, setDraft] = React.useState(value);
  const hasNote = Boolean(value.trim());

  React.useEffect(() => {
    setDraft(value);
  }, [value, noteKey]);

  return (
    <span className="relative inline-flex flex-col items-end gap-0.5">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="p-0.5 rounded hover:bg-slate-700 text-slate-400"
        title={hasNote ? 'Modifica nota' : 'Aggiungi nota'}
        aria-label="Nota test"
      >
        <StickyNote size={14} className={hasNote ? 'text-amber-400' : 'text-slate-500'} />
      </button>
      {open ? (
        <div className="absolute right-0 top-5 z-20 min-w-[180px] max-w-[280px] rounded border border-slate-600 bg-slate-900 p-1.5 shadow-lg">
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            rows={3}
            className="w-full resize-y rounded border border-slate-600 bg-slate-950 px-1 py-0.5 text-[10px] text-slate-200"
            placeholder="Osservazioni sul test…"
          />
          <div className="mt-1 flex justify-end gap-1">
            <button
              type="button"
              className="rounded bg-slate-700 px-2 py-0.5 text-[10px] text-slate-200"
              onClick={() => setOpen(false)}
            >
              Chiudi
            </button>
            <button
              type="button"
              className="rounded bg-amber-700 px-2 py-0.5 text-[10px] text-white"
              onClick={() => {
                onSave(noteKey, draft);
                setOpen(false);
              }}
            >
              Salva
            </button>
          </div>
        </div>
      ) : null}
    </span>
  );
}

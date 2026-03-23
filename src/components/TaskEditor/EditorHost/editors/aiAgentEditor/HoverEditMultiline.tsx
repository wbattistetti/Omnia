/**
 * Read-only multiline label with hover pencil; edit mode with check / cancel and Escape to cancel.
 */

import React from 'react';
import { Check, Pencil, X } from 'lucide-react';

export interface HoverEditMultilineProps {
  /** Section title; omit or leave empty to hide the heading row (e.g. stacked notes in one card). */
  label: string;
  value: string;
  onChange: (next: string) => void;
  disabled?: boolean;
  rows?: number;
  /** Lighter chrome when nested inside a single outer panel. */
  compact?: boolean;
  /** Tailwind text color for body (read + edit); default slate. */
  contentClassName?: string;
}

export function HoverEditMultiline({
  label,
  value,
  onChange,
  disabled,
  rows = 3,
  compact = false,
  contentClassName = 'text-slate-300',
}: HoverEditMultilineProps) {
  const [editing, setEditing] = React.useState(false);
  const [draft, setDraft] = React.useState(value);
  const taRef = React.useRef<HTMLTextAreaElement>(null);

  React.useEffect(() => {
    if (!editing) setDraft(value);
  }, [value, editing]);

  React.useEffect(() => {
    if (editing) {
      taRef.current?.focus();
    }
  }, [editing]);

  const commit = React.useCallback(() => {
    onChange(draft);
    setEditing(false);
  }, [draft, onChange]);

  const cancel = React.useCallback(() => {
    setDraft(value);
    setEditing(false);
  }, [value]);

  React.useEffect(() => {
    if (!editing) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        cancel();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [editing, cancel]);

  const showLabel = Boolean(label?.trim());
  const shell = compact
    ? 'group rounded-none border-0 bg-transparent px-0 py-0.5'
    : 'group rounded border border-slate-800/80 bg-slate-950/50 p-2';

  return (
    <div className={shell}>
      <div className={`flex items-start justify-between gap-2 ${showLabel || compact ? '' : 'min-h-0'}`}>
        {showLabel ? (
          <span className="text-[10px] font-medium uppercase tracking-wide text-slate-500">{label}</span>
        ) : (
          <span className="flex-1 min-w-0" aria-hidden />
        )}
        {!editing && !disabled ? (
          <button
            type="button"
            className="shrink-0 p-0.5 rounded opacity-0 group-hover:opacity-100 text-slate-500 hover:text-violet-300"
            title="Modifica"
            onClick={() => setEditing(true)}
          >
            <Pencil size={12} aria-hidden />
          </button>
        ) : null}
      </div>
      {editing ? (
        <div className="mt-1 space-y-1">
          <textarea
            ref={taRef}
            rows={rows}
            disabled={disabled}
            className={`w-full rounded border border-violet-600/50 bg-slate-950 px-2 py-1.5 text-xs ${contentClassName}`}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
          />
          <div className="flex justify-end gap-1">
            <button
              type="button"
              className="p-1 rounded text-emerald-400 hover:bg-slate-800"
              title="Conferma"
              onClick={commit}
            >
              <Check size={14} />
            </button>
            <button
              type="button"
              className="p-1 rounded text-slate-400 hover:bg-slate-800"
              title="Annulla"
              onClick={cancel}
            >
              <X size={14} />
            </button>
          </div>
        </div>
      ) : (
        <p
          className={`mt-1 text-xs whitespace-pre-wrap break-words min-h-[2rem] ${contentClassName}`}
        >
          {value.trim() ? value : <span className="opacity-50 italic">Nessun testo.</span>}
        </p>
      )}
    </div>
  );
}

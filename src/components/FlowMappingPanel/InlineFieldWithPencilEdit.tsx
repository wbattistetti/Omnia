/**
 * Single backend mapping field: plain label in view; same slot becomes Autosize input when editing (matita / doppio click).
 */

import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Pencil } from 'lucide-react';
import { AutosizeOneLineInput } from './AutosizeOneLineInput';

const mirror10 = 'text-[10px] px-2 py-1 font-normal';

export interface InlineFieldWithPencilEditProps {
  value: string;
  placeholder: string;
  ariaLabel: string;
  /** datalist id for suggestions while editing */
  listId: string;
  /** Visual accent for view text and edit ring */
  accent: 'sky' | 'amber';
  onCommit: (next: string) => void;
  /** When true, not focusable (e.g. nome interno ancora da definire sulla riga). */
  suppressFocus?: boolean;
  /** tabIndex for the view-mode span (default 0); use -1 to keep Tab from stopping on this field. */
  viewTabIndex?: number;
}

export function InlineFieldWithPencilEdit({
  value,
  placeholder,
  ariaLabel,
  listId,
  accent,
  onCommit,
  suppressFocus = false,
  viewTabIndex = 0,
}: InlineFieldWithPencilEditProps) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const inputRef = useRef<HTMLInputElement>(null);
  const prevEditingRef = useRef(false);

  useEffect(() => {
    if (!editing) setDraft(value);
  }, [value, editing]);

  useLayoutEffect(() => {
    if (editing && !prevEditingRef.current) {
      const run = () => {
        const el = inputRef.current;
        if (el) {
          el.focus();
          el.select();
          return true;
        }
        return false;
      };
      if (!run()) requestAnimationFrame(run);
    }
    prevEditingRef.current = editing;
  }, [editing]);

  const finish = useCallback(() => {
    const t = draft.trim();
    setEditing(false);
    if (t !== (value ?? '').trim()) {
      onCommit(t);
    } else {
      setDraft(value);
    }
  }, [draft, value, onCommit]);

  const cancel = useCallback(() => {
    setDraft(value);
    setEditing(false);
  }, [value]);

  const viewTextClass =
    accent === 'sky'
      ? 'text-sky-200/95'
      : 'text-amber-100/95';
  const emptyClass = 'text-slate-500 italic font-normal';
  const ringEdit =
    accent === 'sky'
      ? 'border border-sky-400/50 ring-1 ring-sky-400/40 bg-slate-950/90 text-sky-100 placeholder:text-slate-500 shadow-[0_0_0_1px_rgba(56,189,248,0.12)] focus:ring-2 focus:ring-sky-400/55 focus:border-sky-300/65'
      : 'border border-amber-400/50 ring-1 ring-amber-400/40 bg-slate-950/90 text-amber-50/95 placeholder:text-slate-500 shadow-[0_0_0_1px_rgba(251,191,36,0.12)] focus:ring-2 focus:ring-amber-400/55 focus:border-amber-300/65';

  const showEmpty = !value?.trim();

  if (editing) {
    return (
      <AutosizeOneLineInput
        ref={inputRef}
        mirrorClassName={mirror10}
        inputClassName={`rounded text-[10px] px-2 py-1 font-normal min-w-[4rem] ${ringEdit} focus:outline-none focus:ring-offset-0`}
        maxWidthClassName="max-w-[min(16rem,92vw)]"
        minChars={3}
        list={listId}
        placeholder={placeholder}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={finish}
        onKeyDown={(e) => {
          if (e.key === 'Enter') finish();
          if (e.key === 'Escape') cancel();
        }}
        aria-label={ariaLabel}
      />
    );
  }

  const tabIdx = suppressFocus ? -1 : viewTabIndex;

  return (
    <div
      className={`inline-flex items-center gap-0.5 min-w-0 max-w-full group/field ${suppressFocus ? 'opacity-45 pointer-events-none' : ''}`}
    >
      <span
        className={`peer max-w-[min(16rem,92vw)] truncate rounded px-2 py-1 text-[10px] font-medium cursor-default select-none outline-none focus-visible:ring-1 focus-visible:ring-amber-500/50 min-h-[1.75rem] inline-flex items-center ${showEmpty ? emptyClass : viewTextClass}`}
        tabIndex={tabIdx}
        onDoubleClick={() => setEditing(true)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            setEditing(true);
          }
        }}
        title="Hover per matita · doppio click o Invio per modificare"
      >
        {showEmpty ? placeholder : value}
      </span>
      <button
        type="button"
        tabIndex={tabIdx}
        className="shrink-0 p-0.5 rounded text-slate-500 opacity-0 transition-opacity peer-hover:opacity-100 hover:opacity-100 peer-focus-visible:opacity-100 focus:opacity-100 focus:outline-none focus-visible:ring-1 focus-visible:ring-amber-500/60"
        aria-label={`Modifica ${placeholder}`}
        onClick={() => setEditing(true)}
      >
        <Pencil className="w-3 h-3" />
      </button>
    </div>
  );
}

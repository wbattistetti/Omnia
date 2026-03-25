/**
 * Segment label with pencil visible on label hover / focus-within; edits only that label (leaf paths).
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Pencil } from 'lucide-react';
import { AutosizeOneLineInput } from './AutosizeOneLineInput';

export interface LabelWithPencilEditProps {
  segment: string;
  /** Shown instead of `segment` when not editing (e.g. row label while path is stable id). */
  displayLabel?: string;
  /** When false, pencil hidden (e.g. group-only node). */
  editable: boolean;
  onCommit: (newSegment: string) => void;
  /** Parent signals one-shot open edit (e.g. new row from drag-drop). */
  editIntent?: boolean;
  onConsumeEditIntent?: () => void;
  /** Row uses a hidden placeholder segment (__omnia_n_*); show empty field and allow abandon. */
  ephemeralNew?: boolean;
  /** ESC or empty commit on ephemeral row: remove the new mapping row. */
  onAbandonEphemeral?: () => void;
}

export function LabelWithPencilEdit({
  segment,
  displayLabel,
  editable,
  onCommit,
  editIntent,
  onConsumeEditIntent,
  ephemeralNew,
  onAbandonEphemeral,
}: LabelWithPencilEditProps) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(() => (ephemeralNew ? '' : segment));
  const inputRef = useRef<HTMLInputElement>(null);
  const prevEditingRef = useRef(editing);

  useEffect(() => {
    if (!editable) return;
    if (ephemeralNew) return;
    setDraft(segment);
  }, [segment, ephemeralNew, editable]);

  /** Focus + select only on transition into edit; not on each keystroke (select() would keep replacing text). */
  useEffect(() => {
    if (editing && !prevEditingRef.current) {
      inputRef.current?.focus();
      inputRef.current?.select();
    }
    prevEditingRef.current = editing;
  }, [editing]);

  useEffect(() => {
    if (editIntent && editable) {
      setEditing(true);
      if (ephemeralNew) setDraft('');
      onConsumeEditIntent?.();
    }
  }, [editIntent, editable, ephemeralNew, onConsumeEditIntent]);

  const finish = useCallback(() => {
    const t = draft.trim();
    if (ephemeralNew) {
      if (!t) {
        onAbandonEphemeral?.();
        return;
      }
      onCommit(t);
      setEditing(false);
      return;
    }
    setEditing(false);
    if (t && t !== segment) {
      onCommit(t);
    } else {
      setDraft(segment);
    }
  }, [draft, segment, onCommit, ephemeralNew, onAbandonEphemeral]);

  const cancel = useCallback(() => {
    if (ephemeralNew) {
      onAbandonEphemeral?.();
      return;
    }
    setDraft(segment);
    setEditing(false);
  }, [segment, ephemeralNew, onAbandonEphemeral]);

  const viewLabel = displayLabel ?? segment;

  if (!editable) {
    return <span className="truncate text-slate-100 text-[11px] font-medium">{viewLabel}</span>;
  }

  const displaySegment = ephemeralNew ? '\u00a0' : viewLabel;

  if (editing) {
    return (
      <AutosizeOneLineInput
        ref={inputRef}
        mirrorClassName="text-[11px] px-1 py-0.5 font-medium"
        inputClassName="rounded border border-amber-500/70 bg-slate-950 text-[11px] font-medium text-slate-100"
        maxWidthClassName="max-w-[min(20rem,75vw)]"
        maxWidthPx={320}
        minChars={ephemeralNew ? 1 : 2}
        placeholder={ephemeralNew ? 'Nome parametro' : undefined}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={finish}
        onKeyDown={(e) => {
          if (e.key === 'Enter') finish();
          if (e.key === 'Escape') cancel();
        }}
        aria-label="Edit parameter name"
      />
    );
  }

  return (
    <div className="inline-flex items-center gap-0.5 min-w-0 max-w-full">
      <span
        className="peer whitespace-nowrap text-slate-100 text-[11px] font-medium cursor-default select-none rounded px-0.5 outline-none focus-visible:ring-1 focus-visible:ring-amber-500/60 overflow-hidden text-ellipsis min-w-0 max-w-full min-h-[1.1em]"
        tabIndex={0}
        onDoubleClick={() => setEditing(true)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            setEditing(true);
          }
        }}
        title="Hover per matita · doppio click o Invio per modificare"
      >
        {displaySegment}
      </span>
      <button
        type="button"
        className="shrink-0 p-0.5 rounded text-slate-500 opacity-0 transition-opacity peer-hover:opacity-100 hover:opacity-100 peer-focus-visible:opacity-100 focus:opacity-100 focus:outline-none focus-visible:ring-1 focus-visible:ring-amber-500"
        aria-label="Modifica nome"
        onClick={() => setEditing(true)}
      >
        <Pencil className="w-3 h-3" />
      </button>
    </div>
  );
}

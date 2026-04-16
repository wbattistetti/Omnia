/**
 * Segment label with optional inline pencil; ref exposes startEditing for toolbar-triggered edit.
 * In editing mode: focus sull'input, ✓ conferma, ✗ annulla, Esc annulla, Enter conferma.
 */

import React, { forwardRef, useCallback, useEffect, useImperativeHandle, useLayoutEffect, useRef, useState } from 'react';
import { Check, Pencil, X } from 'lucide-react';
import { AutosizeOneLineInput } from './AutosizeOneLineInput';

export type LabelWithPencilEditHandle = {
  startEditing: () => void;
};

export interface LabelWithPencilEditProps {
  segment: string;
  displayLabel?: string;
  editable: boolean;
  onCommit: (newSegment: string) => void;
  editIntent?: boolean;
  onConsumeEditIntent?: () => void;
  ephemeralNew?: boolean;
  onAbandonEphemeral?: () => void;
  inlinePencil?: boolean;
  viewTitle?: string;
  /** Fired when inline rename mode starts or ends (e.g. to hide sibling toolbars). */
  onEditingChange?: (editing: boolean) => void;
}

export const LabelWithPencilEdit = forwardRef<LabelWithPencilEditHandle, LabelWithPencilEditProps>(
  function LabelWithPencilEdit(
    {
      segment,
      displayLabel,
      editable,
      onCommit,
      editIntent,
      onConsumeEditIntent,
      ephemeralNew,
      onAbandonEphemeral,
      inlinePencil = true,
      viewTitle,
      onEditingChange,
    },
    ref
  ) {
    const [editing, setEditing] = useState(() => Boolean(ephemeralNew));
    const [draft, setDraft] = useState(() => (ephemeralNew ? '' : segment));
    const inputRef = useRef<HTMLInputElement>(null);
    const prevEditingRef = useRef(false);

    useImperativeHandle(
      ref,
      () => ({
        startEditing: () => {
          if (editable) setEditing(true);
        },
      }),
      [editable]
    );

    useEffect(() => {
      onEditingChange?.(editing);
      return () => {
        if (editing) onEditingChange?.(false);
      };
    }, [editing, onEditingChange]);

    useEffect(() => {
      if (!editable) return;
      if (ephemeralNew) return;
      setDraft(segment);
    }, [segment, ephemeralNew, editable]);

    useEffect(() => {
      if (!editable || !ephemeralNew) return;
      setEditing(true);
      setDraft('');
    }, [editable, ephemeralNew]);

    useEffect(() => {
      if (!editing || !ephemeralNew) return;
      const id = window.setTimeout(() => {
        inputRef.current?.focus();
        inputRef.current?.select();
      }, 0);
      return () => window.clearTimeout(id);
    }, [editing, ephemeralNew]);

    useLayoutEffect(() => {
      if (editIntent && editable) {
        setEditing(true);
        if (ephemeralNew) setDraft('');
        queueMicrotask(() => {
          onConsumeEditIntent?.();
        });
      }
    }, [editIntent, editable, ephemeralNew, onConsumeEditIntent]);

    useLayoutEffect(() => {
      if (editing && !prevEditingRef.current) {
        const focusInput = () => {
          const el = inputRef.current;
          if (el) {
            el.focus();
            el.select();
            return true;
          }
          return false;
        };
        if (!focusInput()) {
          requestAnimationFrame(() => {
            if (!focusInput()) {
              requestAnimationFrame(() => {
                focusInput();
              });
            }
          });
        }
      }
      prevEditingRef.current = editing;
    }, [editing]);

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
    const defaultTitle = 'Hover toolbar sopra il nome · doppio click per modificare';

    if (!editable) {
      return (
        <span className="truncate text-slate-100 text-[11px] font-medium" title={viewTitle ?? viewLabel}>
          {viewLabel}
        </span>
      );
    }

    const displaySegment = ephemeralNew ? '\u00a0' : viewLabel;

    if (editing) {
      return (
        <div className="inline-flex items-center gap-0.5 min-w-0 max-w-full">
          <AutosizeOneLineInput
            ref={inputRef}
            mirrorClassName="text-[11px] px-1 py-0.5 font-medium"
            inputClassName="rounded border border-amber-400/55 bg-slate-950/90 text-[11px] font-medium text-slate-100 ring-1 ring-amber-400/40 shadow-[0_0_0_1px_rgba(251,191,36,0.12)] focus:outline-none focus:ring-2 focus:ring-amber-400/55 focus:border-amber-300/70"
            maxWidthClassName="max-w-[min(16rem,80vw)]"
            maxWidthPx={320}
            minChars={ephemeralNew ? 1 : 2}
            placeholder={ephemeralNew ? 'Nome parametro' : undefined}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                finish();
              }
              if (e.key === 'Escape') {
                e.preventDefault();
                cancel();
              }
            }}
            aria-label="Edit parameter name"
            autoFocus
          />
          <button
            type="button"
            tabIndex={0}
            className="shrink-0 rounded p-0.5 text-emerald-400 hover:bg-emerald-500/20 hover:text-emerald-300"
            title="Conferma"
            aria-label="Conferma nome"
            onMouseDown={(e) => e.preventDefault()}
            onClick={finish}
          >
            <Check className="w-3.5 h-3.5" strokeWidth={2.5} />
          </button>
          <button
            type="button"
            tabIndex={0}
            className="shrink-0 rounded p-0.5 text-slate-400 hover:bg-slate-800 hover:text-red-400"
            title="Annulla"
            aria-label="Annulla modifica nome"
            onMouseDown={(e) => e.preventDefault()}
            onClick={cancel}
          >
            <X className="w-3.5 h-3.5" strokeWidth={2.5} />
          </button>
        </div>
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
          title={viewTitle ?? defaultTitle}
        >
          {displaySegment}
        </span>
        {inlinePencil ? (
          <button
            type="button"
            className="shrink-0 p-0.5 rounded text-slate-500 opacity-0 transition-opacity peer-hover:opacity-100 hover:opacity-100 peer-focus-visible:opacity-100 focus:opacity-100 focus:outline-none focus-visible:ring-1 focus-visible:ring-amber-500"
            aria-label="Modifica nome"
            onClick={() => setEditing(true)}
          >
            <Pencil className="w-3 h-3" />
          </button>
        ) : null}
      </div>
    );
  }
);

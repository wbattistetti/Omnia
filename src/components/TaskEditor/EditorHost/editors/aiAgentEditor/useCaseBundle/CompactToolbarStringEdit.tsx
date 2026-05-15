/**
 * Input compatto stile toolbar: testo + conferma (spunta), annulla (X), opzionale matita in sola lettura.
 * Larghezza input stimata in `ch` in base a contenuto e placeholder (autosize leggero).
 */

import React from 'react';
import { Check, Pencil, X } from 'lucide-react';

export interface CompactToolbarStringEditProps {
  busy: boolean;
  /** Valore persistito (fuori da sessione di modifica). */
  committed: string;
  /** Testo guida quando `committed` è vuoto (placeholder + minimo `ch`). */
  guidePlaceholder: string;
  onCommit: (trimmed: string) => void;
  /** Annulla modifica locale (non persiste). */
  onCancelEdit: () => void;
  /**
   * Se l'input è ancora «nuovo» (`committed` vuoto) e l'utente annulla, invoca rimozione
   * (es. parametro libero non confermato) invece di chiudere solo la bozza.
   */
  onAbortWhenCommittedEmpty?: () => void;
  /** Apre la modifica (matita in visualizzazione). */
  onBeginEdit?: () => void;
  /** Se `committed` è vuoto, parte in modifica. */
  startInEditWhenEmpty?: boolean;
  /** Etichetta accessibile per l'input. */
  ariaLabel: string;
  /** Contenuto in sola lettura quando non in modifica (es. chip con icona). */
  renderDisplay: (label: string) => React.ReactNode;
  /** Consenti commit stringa vuota (raro). */
  allowEmptyCommit?: boolean;
}

function inputWidthCh(value: string, placeholder: string, minCh: number, maxCh: number): number {
  const base = Math.max(value.length, placeholder.length, minCh);
  return Math.min(maxCh, base + 2);
}

export function CompactToolbarStringEdit({
  busy,
  committed,
  guidePlaceholder,
  onCommit,
  onCancelEdit,
  onAbortWhenCommittedEmpty,
  onBeginEdit,
  startInEditWhenEmpty = true,
  ariaLabel,
  renderDisplay,
  allowEmptyCommit = false,
}: CompactToolbarStringEditProps): React.ReactElement {
  const [editing, setEditing] = React.useState(
    () => Boolean(startInEditWhenEmpty && !committed.trim())
  );
  const [draft, setDraft] = React.useState(committed);

  React.useEffect(() => {
    if (!editing) setDraft(committed);
  }, [committed, editing]);

  const openEdit = React.useCallback(() => {
    if (busy) return;
    setDraft(committed);
    setEditing(true);
    onBeginEdit?.();
  }, [busy, committed, onBeginEdit]);

  const commit = React.useCallback(() => {
    const t = draft.trim();
    if (!t && !allowEmptyCommit) return;
    onCommit(allowEmptyCommit ? draft : t);
    setEditing(false);
  }, [allowEmptyCommit, draft, onCommit]);

  const cancel = React.useCallback(() => {
    if (!committed.trim() && onAbortWhenCommittedEmpty) {
      onAbortWhenCommittedEmpty();
      return;
    }
    setDraft(committed);
    setEditing(false);
    onCancelEdit();
  }, [committed, onAbortWhenCommittedEmpty, onCancelEdit]);

  const widthCh = inputWidthCh(draft, guidePlaceholder, 6, 36);

  if (!editing) {
    const displayText = committed.trim();
    return (
      <span className="inline-flex max-w-full items-center gap-0.5 rounded border border-amber-500/50 bg-transparent px-1.5 py-0.5 text-sm font-normal text-amber-100/95">
        {renderDisplay(displayText)}
        <button
          type="button"
          disabled={busy}
          title="Rinomina parametro"
          className="rounded p-0.5 text-amber-200/90 hover:bg-emerald-950/35 disabled:opacity-40"
          onClick={(e) => {
            e.stopPropagation();
            openEdit();
          }}
        >
          <Pencil size={13} aria-hidden />
        </button>
      </span>
    );
  }

  return (
    <span className="inline-flex max-w-full items-center gap-0.5 rounded border border-amber-500/55 bg-transparent px-1 py-0.5">
      <input
        type="text"
        disabled={busy}
        value={draft}
        aria-label={ariaLabel}
        placeholder={guidePlaceholder}
        spellCheck={false}
        className="min-h-[22px] rounded border border-amber-600/50 bg-transparent px-1 py-0.5 text-sm font-normal text-amber-50 placeholder:text-amber-200/50 focus:border-amber-400/80 focus:outline-none disabled:opacity-50"
        style={{ width: `${widthCh}ch`, maxWidth: 'min(100%, 28rem)' }}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            commit();
          }
          if (e.key === 'Escape') {
            e.preventDefault();
            cancel();
          }
        }}
        autoFocus
      />
      <button
        type="button"
        disabled={busy || (!allowEmptyCommit && !draft.trim())}
        title="Conferma"
        className="rounded p-0.5 text-emerald-400 hover:bg-slate-800/90 disabled:opacity-40"
        onClick={(e) => {
          e.stopPropagation();
          commit();
        }}
      >
        <Check size={14} aria-hidden />
      </button>
      <button
        type="button"
        disabled={busy}
        title="Annulla"
        className="rounded p-0.5 text-slate-400 hover:bg-slate-800/90 disabled:opacity-40"
        onClick={(e) => {
          e.stopPropagation();
          cancel();
        }}
      >
        <X size={14} aria-hidden />
      </button>
    </span>
  );
}

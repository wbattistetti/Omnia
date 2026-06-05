/**
 * Popover slot_id + descrizione (designer): stessa UX dello Slot Mapping, con metadati per runtime.
 */

import React from 'react';
import {
  normalizeSlotId,
  resolveSlotIdFromDraft,
  slugifySlotIdDraft,
} from '@domain/useCaseBundle/projectSlotLexicon';
import { getSlotDefinition } from '@domain/useCaseBundle/dynamicSlotRegistry';
import type { ProjectSlotLexicon } from '@domain/useCaseBundle/projectSlotLexicon';

export type SlotIdPickerCommitPayload = {
  slotId: string;
  description: string;
};

export interface SlotIdPickerPopoverProps {
  /** Token/slot corrente nel messaggio semantico. */
  currentToken: string;
  lexicon: ProjectSlotLexicon;
  mappedOptions: readonly string[];
  otherOptions: readonly string[];
  onCommit: (payload: SlotIdPickerCommitPayload) => void;
  onClose: () => void;
  anchorRef: React.RefObject<HTMLElement | null>;
  disabled?: boolean;
}

function filterOptions(options: readonly string[], query: string): string[] {
  if (!query) return [...options];
  return options.filter((o) => o.includes(query));
}

const POPOVER_MARGIN = 8;
const POPOVER_GAP = 4;

/** Posiziona il popover sotto l’ancora; se non c’è spazio, sopra; clamp orizzontale. */
function computePopoverPosition(
  anchorRect: DOMRect,
  panelWidth: number,
  panelHeight: number
): { top: number; left: number } {
  const vw = window.innerWidth;
  const vh = window.innerHeight;

  let left = anchorRect.left;
  left = Math.max(POPOVER_MARGIN, Math.min(left, vw - panelWidth - POPOVER_MARGIN));

  const spaceBelow = vh - anchorRect.bottom - POPOVER_MARGIN;
  const spaceAbove = anchorRect.top - POPOVER_MARGIN;
  const needed = panelHeight + POPOVER_GAP;
  const placeAbove = spaceBelow < needed && spaceAbove >= spaceBelow;

  let top = placeAbove
    ? anchorRect.top - panelHeight - POPOVER_GAP
    : anchorRect.bottom + POPOVER_GAP;

  if (top < POPOVER_MARGIN) {
    top = anchorRect.bottom + POPOVER_GAP;
  }
  if (top + panelHeight > vh - POPOVER_MARGIN) {
    top = Math.max(POPOVER_MARGIN, vh - panelHeight - POPOVER_MARGIN);
  }

  return { top, left };
}

function OptionRow({
  label,
  onPick,
}: {
  label: string;
  onPick: () => void;
}): React.ReactElement {
  return (
    <li>
      <button
        type="button"
        onClick={onPick}
        className="flex w-full px-2 py-1 text-left font-mono text-[11px] text-slate-100 hover:bg-violet-900/40"
      >
        {label}
      </button>
    </li>
  );
}

export function SlotIdPickerPopover({
  currentToken,
  lexicon,
  mappedOptions,
  otherOptions,
  onCommit,
  onClose,
  anchorRef,
  disabled = false,
}: SlotIdPickerPopoverProps): React.ReactElement | null {
  const currentNorm = normalizeSlotId(currentToken);
  const existingDef = getSlotDefinition(lexicon, currentNorm);

  const [slotDraft, setSlotDraft] = React.useState(currentNorm);
  const [description, setDescription] = React.useState(existingDef?.description ?? '');
  const panelRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    setSlotDraft(currentNorm);
    setDescription(existingDef?.description ?? '');
  }, [currentToken, currentNorm, existingDef?.description]);
  const [position, setPosition] = React.useState<{ top: number; left: number } | null>(null);

  const reposition = React.useCallback(() => {
    const anchor = anchorRef.current;
    const panel = panelRef.current;
    if (!anchor) return;
    const anchorRect = anchor.getBoundingClientRect();
    const panelWidth = panel?.offsetWidth ?? 288;
    const panelHeight = panel?.offsetHeight ?? 320;
    setPosition(computePopoverPosition(anchorRect, panelWidth, panelHeight));
  }, [anchorRef]);

  React.useLayoutEffect(() => {
    reposition();
    const raf = requestAnimationFrame(reposition);
    window.addEventListener('resize', reposition);
    window.addEventListener('scroll', reposition, true);
    const panel = panelRef.current;
    const ro =
      panel && typeof ResizeObserver !== 'undefined'
        ? new ResizeObserver(() => reposition())
        : null;
    ro?.observe(panel!);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', reposition);
      window.removeEventListener('scroll', reposition, true);
      ro?.disconnect();
    };
  }, [reposition, currentToken]);

  React.useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      const t = e.target as Node;
      if (panelRef.current?.contains(t) || anchorRef.current?.contains(t)) return;
      onClose();
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [anchorRef, onClose]);

  const f = slotDraft.trim().toLowerCase();
  const mappedFiltered = React.useMemo(() => filterOptions(mappedOptions, f), [mappedOptions, f]);
  const otherFiltered = React.useMemo(() => filterOptions(otherOptions, f), [otherOptions, f]);
  const hasOptions = mappedFiltered.length > 0 || otherFiltered.length > 0;

  const commit = React.useCallback(
    (slotId: string) => {
      const next = resolveSlotIdFromDraft(slotId);
      if (!next) return;
      onCommit({ slotId: next, description: description.trim() });
      onClose();
    },
    [description, onCommit, onClose]
  );

  const tryCommitDraft = React.useCallback(() => {
    commit(slotDraft);
  }, [commit, slotDraft]);

  const draftSlotId = resolveSlotIdFromDraft(slotDraft);
  const draftHintSlotId = draftSlotId ?? slugifySlotIdDraft(slotDraft);

  if (disabled) return null;

  return (
    <div
      ref={panelRef}
      role="dialog"
      aria-label="Modifica slot semantico"
      className="fixed z-[200] flex w-[min(18rem,calc(100vw-1rem))] flex-col rounded border border-violet-500/45 bg-slate-950 text-slate-100 shadow-xl"
      style={
        position
          ? { top: position.top, left: position.left }
          : { top: -9999, left: -9999, visibility: 'hidden' as const }
      }
    >
      <div className="border-b border-slate-700/80 px-2 py-1.5">
        <p className="text-[10px] font-semibold uppercase tracking-wide text-violet-300/90">
          Slot semantico
        </p>
        <input
          type="text"
          autoFocus
          disabled={disabled}
          placeholder="slot_id (snake_case)…"
          value={slotDraft}
          onChange={(e) => setSlotDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              tryCommitDraft();
            }
            if (e.key === 'Escape') {
              e.preventDefault();
              onClose();
            }
          }}
          className="mt-1 h-8 w-full rounded border border-slate-600 bg-slate-900 px-2 font-mono text-[11px] text-slate-100 outline-none focus-visible:ring-1 focus-visible:ring-violet-400/70"
        />
      </div>
      <div className="border-b border-slate-700/80 px-2 py-1.5">
        <label className="block text-[10px] text-slate-400">Descrizione (runtime / prompt)</label>
        <textarea
          rows={2}
          disabled={disabled}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Ruolo del token nel turno…"
          className="mt-0.5 w-full resize-none rounded border border-slate-600 bg-slate-900 px-2 py-1 text-[11px] text-slate-100 outline-none focus-visible:ring-1 focus-visible:ring-violet-400/70"
        />
      </div>
      <ul className="max-h-36 min-h-0 overflow-y-auto overscroll-contain py-0.5">
        {mappedFiltered.map((o) => (
          <OptionRow key={`mapped-${o}`} label={o} onPick={() => commit(o)} />
        ))}
        {mappedFiltered.length > 0 && otherFiltered.length > 0 ? (
          <li aria-hidden className="my-0.5 border-t border-slate-600/80" />
        ) : null}
        {otherFiltered.map((o) => (
          <OptionRow key={`other-${o}`} label={o} onPick={() => commit(o)} />
        ))}
        {!hasOptions ? (
          <li className="px-2 py-1 text-[10px] text-slate-500">
            {draftSlotId
              ? `Invio per usare «${draftSlotId}»`
              : 'Nessun risultato'}
          </li>
        ) : null}
      </ul>
      <div className="flex justify-end gap-1 border-t border-slate-700/80 px-2 py-1.5">
        <button
          type="button"
          className="rounded px-2 py-0.5 text-[11px] text-slate-400 hover:bg-slate-800"
          onClick={onClose}
        >
          Annulla
        </button>
        <button
          type="button"
          disabled={!draftSlotId}
          title={draftSlotId ? `Salva come ${draftSlotId}` : `Usa snake_case — es. ${draftHintSlotId || 'esame_obbligatorio'}`}
          className="rounded border border-violet-500/50 bg-violet-950/60 px-2 py-0.5 text-[11px] font-semibold text-violet-100 hover:bg-violet-900/40 disabled:opacity-40"
          onClick={tryCommitDraft}
        >
          Aggiorna
        </button>
      </div>
    </div>
  );
}

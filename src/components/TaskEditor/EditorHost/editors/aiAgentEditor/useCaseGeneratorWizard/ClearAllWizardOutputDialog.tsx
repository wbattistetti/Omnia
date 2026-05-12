/**
 * Popover di conferma per «Pulisci tutto» del wizard use case.
 *
 * Pattern allineato a {@link WizardAdvanceDialog}: popover non modale ancorato al pulsante
 * che ha richiesto l'azione (in genere subito sotto), con due bottoni («Annulla» rosso ghost
 * e «Pulisci tutto» distruttivo). Si chiude su Esc o pointer-down fuori dal popover.
 *
 * Motivazione UX: l'azione è distruttiva ma reversibile solo annullando la modifica del task;
 * non vogliamo bloccare l'intera UI con un modale full-screen, basta un'esplicita conferma
 * sotto al pulsante (anti-clic accidentale).
 *
 * Side-effect: nessun side-effect locale. Il caller passa `onConfirm`/`onCancel` e gestisce
 * la pulizia effettiva dello stato (vedi `useAIAgentEditorController.handleClearWizardOutput`
 * e `UseCaseGeneratorWizardModel.resetAll`).
 */
import React from 'react';
import { createPortal } from 'react-dom';
import { Trash2 } from 'lucide-react';

const POPOVER_GAP_PX = 8;
const VIEWPORT_MARGIN_PX = 8;

export interface ClearAllWizardOutputDialogProps {
  open: boolean;
  onConfirm: () => void;
  onCancel: () => void;
  /** Pulsante «Pulisci tutto» che ha aperto il flusso (popover sotto/sopra a questo). */
  anchorRef: React.RefObject<HTMLElement | null>;
  message?: string;
  confirmLabel?: string;
}

export function ClearAllWizardOutputDialog({
  open,
  onConfirm,
  onCancel,
  anchorRef,
  message = 'Confermi di voler eliminare use case, conversazioni, tokenizzazioni e JSON generati?',
  confirmLabel = 'Pulisci tutto',
}: ClearAllWizardOutputDialogProps): React.ReactElement | null {
  const panelRef = React.useRef<HTMLDivElement | null>(null);
  const cancelButtonRef = React.useRef<HTMLButtonElement | null>(null);
  const [style, setStyle] = React.useState<React.CSSProperties>({
    position: 'fixed',
    top: 0,
    left: 0,
    zIndex: 200,
    visibility: 'hidden',
  });

  const updatePosition = React.useCallback(() => {
    const anchor = anchorRef.current;
    const panel = panelRef.current;
    if (!panel) return;
    const pr = panel.getBoundingClientRect();
    const w = Math.max(pr.width, 1);
    const h = Math.max(pr.height, 1);

    if (!anchor) {
      setStyle({
        position: 'fixed',
        bottom: VIEWPORT_MARGIN_PX,
        right: VIEWPORT_MARGIN_PX,
        zIndex: 200,
        visibility: 'visible',
      });
      return;
    }

    const ar = anchor.getBoundingClientRect();
    const belowTop = ar.bottom + POPOVER_GAP_PX;
    const aboveTop = ar.top - POPOVER_GAP_PX - h;
    const spaceBelow = window.innerHeight - belowTop - VIEWPORT_MARGIN_PX;
    const spaceAbove = ar.top - VIEWPORT_MARGIN_PX - POPOVER_GAP_PX;

    let top: number;
    if (h <= spaceBelow || spaceBelow >= spaceAbove) {
      top = belowTop;
      if (top + h > window.innerHeight - VIEWPORT_MARGIN_PX) {
        top = Math.max(VIEWPORT_MARGIN_PX, window.innerHeight - VIEWPORT_MARGIN_PX - h);
      }
    } else if (aboveTop >= VIEWPORT_MARGIN_PX) {
      top = aboveTop;
    } else {
      top = Math.max(
        VIEWPORT_MARGIN_PX,
        Math.min(belowTop, window.innerHeight - VIEWPORT_MARGIN_PX - h)
      );
    }

    /** Allineato a destra del bottone: il pulsante vive nell'angolo dx della toolbar. */
    let left = ar.right - w;
    left = Math.max(
      VIEWPORT_MARGIN_PX,
      Math.min(left, window.innerWidth - VIEWPORT_MARGIN_PX - w)
    );

    setStyle({
      position: 'fixed',
      top,
      left,
      zIndex: 200,
      visibility: 'visible',
    });
  }, [anchorRef]);

  React.useLayoutEffect(() => {
    if (!open) return;
    updatePosition();
    const id = requestAnimationFrame(() => {
      updatePosition();
      cancelButtonRef.current?.focus();
    });
    return () => cancelAnimationFrame(id);
  }, [open, updatePosition]);

  React.useEffect(() => {
    if (!open) return;
    const onResize = () => updatePosition();
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, [open, updatePosition]);

  React.useEffect(() => {
    if (!open) return;
    const onDocPointerDown = (e: PointerEvent) => {
      const t = e.target;
      if (!(t instanceof Node)) return;
      if (panelRef.current?.contains(t)) return;
      if (anchorRef.current?.contains(t)) return;
      onCancel();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCancel();
    };
    document.addEventListener('pointerdown', onDocPointerDown, true);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', onDocPointerDown, true);
      document.removeEventListener('keydown', onKey);
    };
  }, [open, onCancel, anchorRef]);

  if (!open || typeof document === 'undefined') return null;

  return createPortal(
    <div
      ref={panelRef}
      role="dialog"
      aria-modal="false"
      aria-labelledby="clear-all-popover-title"
      style={style}
      className="w-[min(100vw-1rem,20rem)] rounded-lg border border-rose-500/55 bg-slate-900 p-3 text-slate-100 shadow-xl shadow-rose-950/40"
    >
      <p id="clear-all-popover-title" className="mb-3 text-sm leading-snug text-slate-100">
        {message}
      </p>
      <div className="flex flex-wrap justify-end gap-2">
        <button
          type="button"
          ref={cancelButtonRef}
          onClick={onCancel}
          className="rounded-md border border-slate-600 px-3 py-1.5 text-sm text-slate-200 hover:bg-slate-800"
        >
          Annulla
        </button>
        <button
          type="button"
          onClick={onConfirm}
          className="inline-flex items-center gap-1.5 rounded-md border border-rose-500/55 bg-rose-600/85 px-3 py-1.5 text-sm font-semibold text-white hover:bg-rose-500"
        >
          <Trash2 size={14} aria-hidden />
          {confirmLabel}
        </button>
      </div>
    </div>,
    document.body
  );
}

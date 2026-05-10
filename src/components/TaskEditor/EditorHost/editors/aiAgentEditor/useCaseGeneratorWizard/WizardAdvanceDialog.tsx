/**
 * Conferma «avanti senza modifiche»: popover non modale ancorato al pulsante che ha richiesto l’avanzamento.
 */

import React from 'react';
import { createPortal } from 'react-dom';

const POPOVER_GAP_PX = 8;
const VIEWPORT_MARGIN_PX = 8;

export interface WizardAdvanceDialogProps {
  open: boolean;
  message: string;
  onConfirm: () => void;
  onCancel: () => void;
  /** Pulsante o elemento che ha aperto il flusso (popover sopra/sotto rispetto a questo). */
  anchorRef: React.RefObject<HTMLElement | null>;
}

export function WizardAdvanceDialog({
  open,
  message,
  onConfirm,
  onCancel,
  anchorRef,
}: WizardAdvanceDialogProps) {
  const panelRef = React.useRef<HTMLDivElement | null>(null);
  const [style, setStyle] = React.useState<React.CSSProperties>({
    position: 'fixed',
    top: 0,
    left: 0,
    zIndex: 200,
    visibility: 'hidden' as const,
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
      top = Math.max(VIEWPORT_MARGIN_PX, Math.min(belowTop, window.innerHeight - VIEWPORT_MARGIN_PX - h));
    }

    let left = ar.left + ar.width / 2 - w / 2;
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
    const id = requestAnimationFrame(() => updatePosition());
    return () => cancelAnimationFrame(id);
  }, [open, message, updatePosition]);

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
      aria-labelledby="wizard-advance-popover-title"
      style={style}
      className="max-w-[min(100vw-2rem,22rem)] rounded-lg border border-slate-600 bg-slate-900 p-4 text-slate-100 shadow-xl"
    >
      <p id="wizard-advance-popover-title" className="mb-4 text-sm leading-relaxed">
        {message}
      </p>
      <div className="flex flex-wrap justify-end gap-2">
        <button
          type="button"
          className="rounded-md border border-slate-600 px-3 py-1.5 text-sm text-slate-200 hover:bg-slate-800"
          onClick={onCancel}
        >
          No prima verifico
        </button>
        <button
          type="button"
          className="rounded-md bg-violet-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-violet-500"
          onClick={onConfirm}
        >
          Sì, proseguo
        </button>
      </div>
    </div>,
    document.body
  );
}

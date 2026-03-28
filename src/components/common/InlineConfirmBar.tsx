/**
 * Barra di conferma compatta affiancata al trigger (stile Splash / landing: sfondo scuro, bordo verde).
 * Non usare portal: posizionare nel layout accanto al pulsante (es. a destra del cestino).
 */
import React from 'react';

export type InlineConfirmBarProps = {
  message: React.ReactNode;
  onConfirm: () => void;
  onCancel: () => void;
  confirmLabel?: string;
  cancelLabel?: string;
};

export function InlineConfirmBar({
  message,
  onConfirm,
  onCancel,
  confirmLabel = 'Conferma',
  cancelLabel = 'Annulla',
}: InlineConfirmBarProps) {
  return (
    <div
      role="group"
      aria-label="Conferma azione"
      className="flex max-w-[min(100%,18rem)] flex-col gap-1.5 rounded-md border border-emerald-500 bg-neutral-950 px-2 py-1.5 shadow-lg sm:max-w-[20rem] sm:flex-row sm:items-center sm:gap-2"
    >
      <span className="text-[11px] leading-snug text-amber-100/95">{message}</span>
      <div className="flex shrink-0 items-center gap-1">
        <button
          type="button"
          title="Conferma eliminazione"
          className="rounded bg-red-700 px-2 py-0.5 text-[11px] font-semibold text-amber-50 hover:bg-red-600"
          onClick={onConfirm}
        >
          {confirmLabel}
        </button>
        <button
          type="button"
          title="Annulla"
          className="px-1.5 py-0.5 text-[11px] font-semibold text-amber-100/90 hover:underline"
          onClick={onCancel}
        >
          {cancelLabel}
        </button>
      </div>
    </div>
  );
}

/**
 * Warning above read-only platform prompt previews (markdown/XML per target) and runtime JSON view.
 * Directs users to edit design sections to change behavior; this view is not the source of truth.
 */

import React from 'react';

export function ReadOnlyPlatformBanner() {
  return (
    <div
      className="rounded-md border border-amber-600/40 bg-amber-950/40 px-2 py-1.5 text-[11px] leading-snug text-amber-100/95"
      role="status"
    >
      <strong className="font-semibold">Anteprima piattaforma (sola lettura):</strong> per modificare il
      comportamento devi editare le sezioni: Descrizione, Scopo, Sequenza, Contesto, Vincoli, Personalità e Tono.
    </div>
  );
}

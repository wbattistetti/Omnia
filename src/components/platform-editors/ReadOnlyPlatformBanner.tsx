/**
 * Warning shown above platform-specific read-only previews: compiled prompt is derived from Omnia IR.
 */

import React from 'react';

export function ReadOnlyPlatformBanner() {
  return (
    <div
      className="rounded-md border border-amber-600/40 bg-amber-950/40 px-2 py-1.5 text-[11px] leading-snug text-amber-100/95"
      role="status"
    >
      <strong className="font-semibold">Attenzione:</strong> questa vista è derivata dall’IR e non è editabile. Le
      modifiche al prompt compilato non verrebbero sincronizzate con la fonte di verità (Prompt Ricco / IR).
    </div>
  );
}

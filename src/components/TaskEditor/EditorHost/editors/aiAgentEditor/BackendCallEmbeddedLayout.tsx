/**
 * Layout per editor Backend incassato (tab catalogo / agente).
 *
 * Struttura:
 *   [toolbar] shrink-0  ← non scrolla mai
 *   [body]    flex-1 min-h-0 overflow-hidden ← delega lo scroll ai figli (SEND/RECEIVE tree)
 *
 * Il contenitore padre (ManualBackendAccordion) allinea il corpo espanso alla colonna dell’URL
 * (rail w-9 + gap); niente padding orizzontale extra qui per non sfasare SEND/RECEIVE. */

import React from 'react';

export function BackendCallEmbeddedLayout({
  toolbar,
  children,
}: {
  toolbar: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="flex h-full min-h-0 min-w-0 flex-1 flex-col overflow-hidden bg-transparent">
      {toolbar ? <div className="shrink-0 pb-1 pt-0">{toolbar}</div> : null}
      <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">{children}</div>
    </div>
  );
}

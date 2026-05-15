/**
 * Layout per editor Backend incassato (tab catalogo / agente).
 *
 * Struttura:
 *   [toolbar] shrink-0  ← non scrolla mai
 *   [body]    flex-1 min-h-0 overflow-hidden ← delega lo scroll ai figli (SEND/RECEIVE tree)
 *
 * Il contenitore padre (ManualBackendAccordion) ha un'altezza esplicita h-[min(65vh,520px)],
 * quindi flex-1 qui risolve correttamente e l'unica scrollbar è quella dell'albero parametri.
 */

import React from 'react';

export function BackendCallEmbeddedLayout({
  toolbar,
  children,
}: {
  toolbar: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden bg-transparent">
      {toolbar ? <div className="shrink-0 px-[5px] pt-0">{toolbar}</div> : null}
      <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden px-[5px]">{children}</div>
    </div>
  );
}

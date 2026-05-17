/**
 * Layout per editor Backend incassato (tab catalogo / agente).
 *
 * Struttura:
 *   [toolbar] shrink-0  ← non scrolla mai
 *   [body]    flex-1 min-h-0 overflow-hidden ← delega lo scroll ai figli (SEND/RECEIVE tree)
 *
 * Con `deferScrollToParent`: corpo a altezza naturale; scroll sul contenitore padre (workspace inspector).
 */

import React from 'react';

export function BackendCallEmbeddedLayout({
  toolbar,
  children,
  deferScrollToParent = false,
}: {
  toolbar: React.ReactNode;
  children: React.ReactNode;
  /** Scroll sul contenitore padre (workspace inspector). */
  deferScrollToParent?: boolean;
}) {
  return (
    <div
      className={
        deferScrollToParent
          ? 'flex min-w-0 flex-col bg-transparent'
          : 'flex h-full min-h-0 min-w-0 flex-1 flex-col overflow-hidden bg-transparent'
      }
    >
      {toolbar ? <div className="shrink-0 pb-1 pt-0">{toolbar}</div> : null}
      <div
        className={
          deferScrollToParent
            ? 'flex min-w-0 flex-col'
            : 'flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden'
        }
      >
        {children}
      </div>
    </div>
  );
}

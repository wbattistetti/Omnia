/**
 * Split layout a due colonne: canvas a sinistra e pannello a destra.
 * Nessun overlay: entrambi sono flex item fratelli.
 */

import React from 'react';

export type FlowCanvasDockRowProps = {
  canvas: React.ReactNode;
  sidePanel: React.ReactNode;
};

export function FlowCanvasDockRow({ canvas, sidePanel }: FlowCanvasDockRowProps) {
  return (
    <div className="flex h-full w-full flex-row overflow-hidden min-h-0 min-w-0">
      <div className="flex-1 min-w-0 min-h-0 overflow-hidden relative">{canvas}</div>
      {sidePanel}
    </div>
  );
}

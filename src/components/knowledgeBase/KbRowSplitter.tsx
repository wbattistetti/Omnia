/**
 * Horizontal resize handle for stacked KB panels (review above Monaco).
 */

import React from 'react';

export type KbRowSplitterProps = {
  ariaLabel: string;
  onPointerDown: (e: React.PointerEvent) => void;
  onPointerMove: (e: React.PointerEvent) => void;
  onPointerEnd: (e: React.PointerEvent) => void;
};

export function KbRowSplitter({
  ariaLabel,
  onPointerDown,
  onPointerMove,
  onPointerEnd,
}: KbRowSplitterProps): React.ReactElement {
  return (
    <div
      role="separator"
      aria-orientation="horizontal"
      aria-label={ariaLabel}
      tabIndex={0}
      className="h-1.5 shrink-0 cursor-row-resize touch-none select-none bg-slate-900/80 hover:bg-violet-950/50"
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerEnd}
      onPointerCancel={onPointerEnd}
    />
  );
}

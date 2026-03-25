/**
 * Dock-drag preview for the Interface panel: same visual language as DockManager’s DockOverlay
 * (semi-transparent blue fill + blue border), sized/positioned where the panel will land.
 */

import React, { useMemo } from 'react';
import type { FlowInterfaceDockRegion } from './flowInterfaceDockStorage';

/** Matches Tailwind bottom-10 / top-10 used by the real panel chrome */
const EDGE_INSET_PX = 40;

const PREVIEW_STYLE: React.CSSProperties = {
  background: 'rgba(59, 130, 246, 0.18)',
  border: '1px solid rgba(59, 130, 246, 0.9)',
  boxShadow: '0 8px 28px rgba(59, 130, 246, 0.22)',
  pointerEvents: 'none',
};

export interface FlowInterfaceDockPreviewOverlayProps {
  preview: FlowInterfaceDockRegion | null;
  panelHeightPx: number;
  panelWidthPx: number;
}

export function FlowInterfaceDockPreviewOverlay({
  preview,
  panelHeightPx,
  panelWidthPx,
}: FlowInterfaceDockPreviewOverlayProps) {
  const rect = useMemo(() => {
    if (!preview) return null;
    const h = Math.max(panelHeightPx, 1);
    const w = Math.max(panelWidthPx, 1);
    const vw = typeof window !== 'undefined' ? window.innerWidth : 1200;
    const vh = typeof window !== 'undefined' ? window.innerHeight : 800;

    const verticalSpan = Math.max(vh - 2 * EDGE_INSET_PX, 1);

    switch (preview) {
      case 'bottom':
        return { left: 0, width: vw, height: h, bottom: EDGE_INSET_PX };
      case 'top':
        return { left: 0, width: vw, height: h, top: EDGE_INSET_PX };
      case 'left':
        return { left: 0, top: EDGE_INSET_PX, width: w, height: verticalSpan };
      case 'right':
        return { right: 0, top: EDGE_INSET_PX, width: w, height: verticalSpan };
      default:
        return null;
    }
  }, [preview, panelHeightPx, panelWidthPx]);

  if (!preview || !rect) return null;

  return (
    <div className="fixed inset-0 z-[100] pointer-events-none" aria-hidden>
      <div
        className="fixed rounded-sm"
        style={{
          ...PREVIEW_STYLE,
          ...rect,
        }}
      />
    </div>
  );
}

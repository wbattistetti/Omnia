/**
 * Dock-drag preview for the Interface panel: same visual language as DockManager’s DockOverlay.
 * Positioned inside the flow canvas area (absolute, not viewport-fixed).
 */

import React, { useMemo } from 'react';
import type { FlowInterfaceDockRegion } from './flowInterfaceDockStorage';

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

    switch (preview) {
      case 'bottom':
        return { left: 0, right: 0, bottom: 0, height: h };
      case 'top':
        return { left: 0, right: 0, top: 0, height: h };
      case 'left':
        return { left: 0, top: 0, bottom: 0, width: w };
      case 'right':
        return { right: 0, top: 0, bottom: 0, width: w };
      default:
        return null;
    }
  }, [preview, panelHeightPx, panelWidthPx]);

  if (!preview || !rect) return null;

  return (
    <div className="absolute inset-0 z-[100] pointer-events-none" aria-hidden>
      <div
        className="absolute rounded-sm"
        style={{
          ...PREVIEW_STYLE,
          ...rect,
        }}
      />
    </div>
  );
}

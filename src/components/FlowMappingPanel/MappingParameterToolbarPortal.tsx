/**
 * Toolbar rendered in document.body; anchored to value box top-right (no scroll clipping).
 */

import React, { useCallback, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useMappingParameterToolbarRect } from './useMappingParameterToolbarRect';

const HIDE_DELAY_MS = 120;

export interface MappingParameterToolbarPortalProps {
  anchorRef: React.RefObject<HTMLElement | null>;
  visible: boolean;
  onPointerHoverChange: (hovered: boolean) => void;
  children: React.ReactNode;
}

export function MappingParameterToolbarPortal({
  anchorRef,
  visible,
  onPointerHoverChange,
  children,
}: MappingParameterToolbarPortalProps): React.ReactElement | null {
  const hideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const rect = useMappingParameterToolbarRect(anchorRef, visible);

  const clearHideTimer = useCallback(() => {
    if (hideTimerRef.current != null) {
      clearTimeout(hideTimerRef.current);
      hideTimerRef.current = null;
    }
  }, []);

  const onToolbarEnter = useCallback(() => {
    clearHideTimer();
    onPointerHoverChange(true);
  }, [clearHideTimer, onPointerHoverChange]);

  const onToolbarLeave = useCallback(() => {
    clearHideTimer();
    hideTimerRef.current = setTimeout(() => onPointerHoverChange(false), HIDE_DELAY_MS);
  }, [clearHideTimer, onPointerHoverChange]);

  if (!visible || !rect) return null;

  return createPortal(
    <div
      role="toolbar"
      aria-label="Azioni parametro"
      className="fixed z-[300] flex items-center gap-0.5 rounded-md bg-slate-900/95 px-0.5 py-0.5 shadow-lg ring-1 ring-slate-600/50"
      style={{
        left: rect.right,
        top: rect.top,
        transform: 'translate(-100%, calc(-100% - 2px))',
      }}
      onMouseEnter={onToolbarEnter}
      onMouseLeave={onToolbarLeave}
    >
      {children}
    </div>,
    document.body
  );
}

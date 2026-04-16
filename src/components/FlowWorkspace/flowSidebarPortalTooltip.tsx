/**
 * Tooltip ancorato in hover reso in portal su document.body (evita clip da overflow nei pannelli laterali).
 */

import React, { useCallback, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

const OPEN_MS = 120;
const CLOSE_MS = 220;

export function useSidebarHoverPortal() {
  const [active, setActive] = useState(false);
  const openT = useRef<ReturnType<typeof setTimeout> | null>(null);
  const closeT = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearOpen = useCallback(() => {
    if (openT.current) {
      clearTimeout(openT.current);
      openT.current = null;
    }
  }, []);

  const clearClose = useCallback(() => {
    if (closeT.current) {
      clearTimeout(closeT.current);
      closeT.current = null;
    }
  }, []);

  const anchorEnter = useCallback(() => {
    clearClose();
    clearOpen();
    openT.current = setTimeout(() => setActive(true), OPEN_MS);
  }, [clearClose, clearOpen]);

  const anchorLeave = useCallback(() => {
    clearOpen();
    closeT.current = setTimeout(() => setActive(false), CLOSE_MS);
  }, [clearOpen]);

  const panelEnter = useCallback(() => {
    clearClose();
  }, [clearClose]);

  const panelLeave = useCallback(() => {
    closeT.current = setTimeout(() => setActive(false), CLOSE_MS);
  }, []);

  return { active, anchorEnter, anchorLeave, panelEnter, panelLeave };
}

export function SidebarPortalTooltip({
  anchorRef,
  active,
  panelEnter,
  panelLeave,
  children,
  className = '',
}: {
  anchorRef: React.RefObject<HTMLElement | null>;
  active: boolean;
  panelEnter: () => void;
  panelLeave: () => void;
  children: React.ReactNode;
  className?: string;
}) {
  const [style, setStyle] = useState<React.CSSProperties>({ visibility: 'hidden' });

  useLayoutEffect(() => {
    if (!active) return;
    const update = () => {
      const el = anchorRef.current;
      if (!el) return;
      const r = el.getBoundingClientRect();
      const maxW = Math.min(288, window.innerWidth - 16);
      let left = r.left + r.width / 2 - maxW / 2;
      left = Math.max(8, Math.min(left, window.innerWidth - maxW - 8));
      const top = r.bottom + 6;
      setStyle({
        position: 'fixed',
        left,
        top,
        width: maxW,
        zIndex: 400,
        visibility: 'visible',
      });
    };
    update();
    window.addEventListener('scroll', update, true);
    window.addEventListener('resize', update);
    return () => {
      window.removeEventListener('scroll', update, true);
      window.removeEventListener('resize', update);
    };
  }, [active, anchorRef]);

  if (!active || typeof document === 'undefined') return null;

  return createPortal(
    <div
      role="tooltip"
      className={`rounded-md border border-slate-600/60 bg-[#0f1218] p-2.5 text-left shadow-xl ${className}`}
      style={style}
      onMouseEnter={panelEnter}
      onMouseLeave={panelLeave}
    >
      {children}
    </div>,
    document.body
  );
}

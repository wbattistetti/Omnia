/**
 * Layout SEND/RECEIVE: impilato (stretto) o affiancato con separatore ridimensionabile.
 */

import React, { useCallback, useEffect, useRef } from 'react';
import type { FlowMappingLayoutMode } from './useContainerWidth';

const CLAMP = (n: number) => Math.min(0.82, Math.max(0.28, n));

export type BackendSendReceivePanelsProps = {
  layoutMode: FlowMappingLayoutMode;
  /** Quando false, solo SEND occupa tutta la larghezza (layout affiancato). */
  receiveVisible: boolean;
  /** Quota larghezza SEND (0.28–0.82) se receive è visibile e layout affiancato. */
  sendBasisRatio: number;
  onSendBasisRatioChange?: (ratio: number) => void;
  compactGap: boolean;
  splitContainerRef: React.RefObject<HTMLDivElement | null>;
  send: React.ReactNode;
  receive: React.ReactNode;
};

export function BackendSendReceivePanels({
  layoutMode,
  receiveVisible,
  sendBasisRatio,
  onSendBasisRatioChange,
  compactGap,
  splitContainerRef,
  send,
  receive,
}: BackendSendReceivePanelsProps) {
  const gap = compactGap ? 'gap-2' : 'gap-3';
  const dragRef = useRef<{ pointerId: number; startX: number; startRatio: number } | null>(null);

  const onSplitPointerDown = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (!onSendBasisRatioChange || layoutMode !== 'sideBySide' || !receiveVisible) return;
      e.preventDefault();
      dragRef.current = {
        pointerId: e.pointerId,
        startX: e.clientX,
        startRatio: CLAMP(sendBasisRatio),
      };
      e.currentTarget.setPointerCapture(e.pointerId);
    },
    [layoutMode, onSendBasisRatioChange, receiveVisible, sendBasisRatio]
  );

  useEffect(() => {
    const onMove = (e: PointerEvent) => {
      const d = dragRef.current;
      if (!d || e.pointerId !== d.pointerId || !onSendBasisRatioChange || !splitContainerRef.current) return;
      const rect = splitContainerRef.current.getBoundingClientRect();
      const w = rect.width;
      if (w < 48) return;
      const dx = e.clientX - d.startX;
      onSendBasisRatioChange(CLAMP(d.startRatio + dx / w));
    };
    const end = (e: PointerEvent) => {
      const d = dragRef.current;
      if (!d || e.pointerId !== d.pointerId) return;
      dragRef.current = null;
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', end);
    window.addEventListener('pointercancel', end);
    return () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', end);
      window.removeEventListener('pointercancel', end);
    };
  }, [onSendBasisRatioChange, splitContainerRef]);

  if (layoutMode === 'stacked') {
    return (
      <div className={`flex flex-col ${gap} flex-1 min-h-0 min-w-0`}>
        {send}
        {receiveVisible ? receive : null}
      </div>
    );
  }

  const pct = Math.round(CLAMP(sendBasisRatio) * 100);

  return (
    <div ref={splitContainerRef} className="flex flex-row flex-1 min-h-0 min-w-0 items-stretch gap-0">
      <div
        className="flex min-h-0 min-w-0 flex-col"
        style={
          receiveVisible
            ? { flex: `0 0 ${pct}%`, minWidth: 0 }
            : { flex: '1 1 auto', minWidth: 0, width: '100%' }
        }
      >
        {send}
      </div>
      {receiveVisible ? (
        <>
          <div
            role="separator"
            aria-orientation="vertical"
            aria-label="Ridimensiona pannelli SEND e RECEIVE"
            onPointerDown={onSplitPointerDown}
            className="group relative w-2.5 shrink-0 cursor-col-resize touch-none select-none"
          >
            <div className="pointer-events-none absolute inset-y-2 left-1/2 w-px -translate-x-1/2 bg-slate-600/90 group-hover:bg-teal-400/90" />
          </div>
          <div className="flex min-h-0 min-w-0 flex-1 flex-col" style={{ flex: '1 1 0%', minWidth: 0 }}>
            {receive}
          </div>
        </>
      ) : null}
    </div>
  );
}

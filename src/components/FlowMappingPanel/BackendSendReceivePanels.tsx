/**
 * Layout SEND/RECEIVE: impilato (stretto) o affiancato con separatore ridimensionabile.
 */

import React, { useCallback, useEffect, useMemo, useRef } from 'react';
import type { FlowMappingLayoutMode } from './useContainerWidth';

const DEFAULT_SEND_BASIS_CLAMP = { min: 0.28, max: 0.82 } as const;

export type BackendSendReceivePanelsProps = {
  layoutMode: FlowMappingLayoutMode;
  /** Quando false, solo SEND occupa tutta la larghezza (layout affiancato). */
  receiveVisible: boolean;
  /** Quota larghezza SEND (0.28–0.82) se receive è visibile e layout affiancato. */
  sendBasisRatio: number;
  onSendBasisRatioChange?: (ratio: number) => void;
  compactGap: boolean;
  /**
   * Limiti sulla frazione SEND (0–1) per il drag e il flex-basis.
   * In catalogo embedded si usano massimi più bassi così RECEIVE non finisce compresso a destra.
   */
  sendBasisClamp?: { readonly min: number; readonly max: number };
  splitContainerRef: React.RefObject<HTMLDivElement | null>;
  send: React.ReactNode;
  receive: React.ReactNode;
  /** Colonne a altezza naturale; scroll sul contenitore padre. */
  growWithContent?: boolean;
};

export function BackendSendReceivePanels({
  layoutMode,
  receiveVisible,
  sendBasisRatio,
  onSendBasisRatioChange,
  compactGap,
  sendBasisClamp = DEFAULT_SEND_BASIS_CLAMP,
  splitContainerRef,
  send,
  receive,
  growWithContent = false,
}: BackendSendReceivePanelsProps) {
  const gap = compactGap ? 'gap-2' : 'gap-3';
  const dragRef = useRef<{ pointerId: number; startX: number; startRatio: number } | null>(null);

  const clampRatio = useMemo(() => {
    const lo = Math.min(sendBasisClamp.min, sendBasisClamp.max);
    const hi = Math.max(sendBasisClamp.min, sendBasisClamp.max);
    return (n: number) => Math.min(hi, Math.max(lo, n));
  }, [sendBasisClamp.min, sendBasisClamp.max]);

  const onSplitPointerDown = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (!onSendBasisRatioChange || layoutMode !== 'sideBySide' || !receiveVisible) return;
      e.preventDefault();
      dragRef.current = {
        pointerId: e.pointerId,
        startX: e.clientX,
        startRatio: clampRatio(sendBasisRatio),
      };
      e.currentTarget.setPointerCapture(e.pointerId);
    },
    [clampRatio, layoutMode, onSendBasisRatioChange, receiveVisible, sendBasisRatio]
  );

  useEffect(() => {
    const onMove = (e: PointerEvent) => {
      const d = dragRef.current;
      if (!d || e.pointerId !== d.pointerId || !onSendBasisRatioChange || !splitContainerRef.current) return;
      const rect = splitContainerRef.current.getBoundingClientRect();
      const w = rect.width;
      if (w < 48) return;
      const dx = e.clientX - d.startX;
      onSendBasisRatioChange(clampRatio(d.startRatio + dx / w));
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
  }, [clampRatio, onSendBasisRatioChange, splitContainerRef]);

  if (layoutMode === 'stacked') {
    return (
      <div className={`flex flex-col ${gap} ${growWithContent ? 'min-w-0' : 'flex-1 min-h-0 min-w-0'}`}>
        {send}
        {receiveVisible ? receive : null}
      </div>
    );
  }

  const pct = Math.round(clampRatio(sendBasisRatio) * 100);
  /** In compact: niente min-width percentuale sul SEND (prima forzava ~metà riga e spingeva RECEIVE). */
  const sendPanelMin =
    compactGap && receiveVisible ? 'min-w-0' : compactGap ? 'min-w-[12rem]' : 'min-w-0';
  const receivePanelMin =
    compactGap && receiveVisible ? 'min-w-[min(11rem,36%)]' : compactGap ? 'min-w-[12rem]' : 'min-w-0';

  return (
    <div
      ref={splitContainerRef}
      className={`flex flex-row min-w-0 items-stretch gap-0 ${growWithContent ? '' : 'flex-1 min-h-0'}`}
    >
      <div
        className={`flex flex-col ${growWithContent ? '' : 'min-h-0'} ${sendPanelMin}`}
        style={
          receiveVisible
            ? { flex: `0 0 ${pct}%` }
            : { flex: '1 1 auto', width: '100%' }
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
          <div
            className={`flex flex-col ${growWithContent ? '' : 'min-h-0 flex-1'} ${receivePanelMin}`}
            style={{ flex: '1 1 0%' }}
          >
            {receive}
          </div>
        </>
      ) : null}
    </div>
  );
}

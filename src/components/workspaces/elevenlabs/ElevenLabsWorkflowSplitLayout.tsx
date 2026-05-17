/**
 * Resizable split: workflow canvas (left) + node inspector (right).
 */

import React from 'react';

const INSPECTOR_WIDTH_STORAGE_KEY = 'omnia.elWs.inspectorWidthPx';
const INSPECTOR_MIN_PX = 280;
const INSPECTOR_MAX_VIEWPORT_FRAC = 0.65;
const INSPECTOR_DEFAULT_PX = 420;

function clampInspectorWidth(px: number, viewportWidth: number): number {
  const max = Math.max(INSPECTOR_MIN_PX, Math.floor(viewportWidth * INSPECTOR_MAX_VIEWPORT_FRAC));
  return Math.min(Math.max(INSPECTOR_MIN_PX, Math.round(px)), max);
}

function readInitialInspectorWidth(): number {
  if (typeof window === 'undefined') return INSPECTOR_DEFAULT_PX;
  const vw = window.innerWidth;
  let stored: number | null = null;
  try {
    const raw = sessionStorage.getItem(INSPECTOR_WIDTH_STORAGE_KEY);
    if (raw) stored = parseInt(raw, 10);
  } catch {
    /* ignore */
  }
  const fallback = Math.min(INSPECTOR_DEFAULT_PX, Math.floor(vw * 0.38));
  const base =
    typeof stored === 'number' && Number.isFinite(stored) && stored >= INSPECTOR_MIN_PX
      ? stored
      : fallback;
  return clampInspectorWidth(base, vw);
}

export type ElevenLabsWorkflowSplitLayoutProps = {
  canvas: React.ReactNode;
  inspector: React.ReactNode;
};

function useViewportMinLg(): boolean {
  const [lg, setLg] = React.useState(() =>
    typeof window !== 'undefined' ? window.matchMedia('(min-width: 1024px)').matches : true
  );
  React.useEffect(() => {
    if (typeof window === 'undefined') return;
    const mq = window.matchMedia('(min-width: 1024px)');
    const onChange = () => setLg(mq.matches);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);
  return lg;
}

export function ElevenLabsWorkflowSplitLayout({
  canvas,
  inspector,
}: ElevenLabsWorkflowSplitLayoutProps): React.ReactElement {
  const isLg = useViewportMinLg();
  const [inspectorWidthPx, setInspectorWidthPx] = React.useState(readInitialInspectorWidth);
  const resizeActiveRef = React.useRef(false);

  React.useEffect(() => {
    if (typeof window === 'undefined') return;
    const onResize = () => {
      setInspectorWidthPx((w) => clampInspectorWidth(w, window.innerWidth));
    };
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  const onSplitterPointerDown = React.useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    e.preventDefault();
    resizeActiveRef.current = true;
    e.currentTarget.setPointerCapture(e.pointerId);
  }, []);

  const onSplitterPointerMove = React.useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    if (!resizeActiveRef.current) return;
    const fromRight = window.innerWidth - e.clientX;
    setInspectorWidthPx(clampInspectorWidth(fromRight, window.innerWidth));
  }, []);

  const finishResize = React.useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    if (!resizeActiveRef.current) return;
    resizeActiveRef.current = false;
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {
      /* ignore */
    }
    const w = clampInspectorWidth(window.innerWidth - e.clientX, window.innerWidth);
    setInspectorWidthPx(w);
    try {
      sessionStorage.setItem(INSPECTOR_WIDTH_STORAGE_KEY, String(w));
    } catch {
      /* quota */
    }
    window.dispatchEvent(new Event('resize'));
  }, []);

  return (
    <div className="flex h-full min-h-0 flex-1 flex-col lg:flex-row lg:items-stretch">
      <div className="flex min-h-[240px] min-w-0 flex-1 flex-col overflow-hidden border-b border-slate-800 lg:min-h-0 lg:border-b-0">
        <div className="flex min-h-0 flex-1 flex-col h-full">{canvas}</div>
      </div>
      <div
        role="separator"
        aria-orientation="vertical"
        aria-label="Ridimensiona pannello ispettore"
        tabIndex={0}
        className="hidden w-2 shrink-0 cursor-col-resize touch-none select-none flex-col items-stretch justify-center border-x border-slate-700/80 bg-slate-900/60 hover:bg-violet-950/40 lg:flex"
        onPointerDown={onSplitterPointerDown}
        onPointerMove={onSplitterPointerMove}
        onPointerUp={finishResize}
        onPointerCancel={finishResize}
      >
        <span className="mx-auto h-14 w-1 rounded-full bg-slate-500/90" aria-hidden />
      </div>
      <aside
        className="flex min-h-[200px] w-full min-w-0 shrink-0 flex-col overflow-hidden lg:min-h-0 lg:self-stretch"
        style={
          isLg
            ? {
                width: inspectorWidthPx,
                minWidth: INSPECTOR_MIN_PX,
                maxWidth: `${Math.floor(INSPECTOR_MAX_VIEWPORT_FRAC * 100)}vw`,
              }
            : { width: '100%' }
        }
      >
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden">{inspector}</div>
      </aside>
    </div>
  );
}
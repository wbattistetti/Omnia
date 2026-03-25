/**
 * Persisted layout for the flow Interface dock panel (edge, size).
 */

export type FlowInterfaceDockRegion = 'bottom' | 'top' | 'left' | 'right';

const DOCK_KEY = 'omnia.flowInterface.dockRegion';
const HEIGHT_KEY = 'omnia.flowInterface.panelHeightPx';
const WIDTH_KEY = 'omnia.flowInterface.panelWidthPx';

const MIN_H = 160;
const MIN_W = 200;
const DEFAULT_H = 320;
const DEFAULT_W = 320;

function clampHeight(px: number): number {
  if (typeof window === 'undefined') return px;
  const max = Math.max(MIN_H, Math.round(window.innerHeight * 0.88) - 72);
  return Math.min(max, Math.max(MIN_H, Math.round(px)));
}

function clampWidth(px: number): number {
  if (typeof window === 'undefined') return px;
  const max = Math.max(MIN_W, Math.round(window.innerWidth * 0.55));
  return Math.min(max, Math.max(MIN_W, Math.round(px)));
}

export function readDockRegion(): FlowInterfaceDockRegion {
  try {
    const v = localStorage.getItem(DOCK_KEY) as FlowInterfaceDockRegion | null;
    if (v === 'bottom' || v === 'top' || v === 'left' || v === 'right') return v;
  } catch {
    /* ignore */
  }
  return 'bottom';
}

export function writeDockRegion(r: FlowInterfaceDockRegion): void {
  try {
    localStorage.setItem(DOCK_KEY, r);
  } catch {
    /* ignore */
  }
}

export function readPanelHeight(): number {
  try {
    const raw = localStorage.getItem(HEIGHT_KEY);
    if (raw) {
      const n = parseInt(raw, 10);
      if (!Number.isNaN(n)) return clampHeight(n);
    }
  } catch {
    /* ignore */
  }
  if (typeof window !== 'undefined') {
    return clampHeight(Math.min(Math.round(window.innerHeight * 0.36), 520));
  }
  return DEFAULT_H;
}

export function writePanelHeight(px: number): void {
  try {
    localStorage.setItem(HEIGHT_KEY, String(clampHeight(px)));
  } catch {
    /* ignore */
  }
}

export function readPanelWidth(): number {
  try {
    const raw = localStorage.getItem(WIDTH_KEY);
    if (raw) {
      const n = parseInt(raw, 10);
      if (!Number.isNaN(n)) return clampWidth(n);
    }
  } catch {
    /* ignore */
  }
  if (typeof window !== 'undefined') {
    return clampWidth(Math.min(Math.round(window.innerWidth * 0.28), 420));
  }
  return DEFAULT_W;
}

export function writePanelWidth(px: number): void {
  try {
    localStorage.setItem(WIDTH_KEY, String(clampWidth(px)));
  } catch {
    /* ignore */
  }
}

export { clampHeight, clampWidth, MIN_H, MIN_W };

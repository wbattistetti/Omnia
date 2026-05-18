/**
 * DOM helpers scoped to a single Omnia flow canvas host (avoids cross-canvas querySelector bugs).
 */

/** Root element for one FlowEditor instance (`data-flow-canvas-id`). */
export function getFlowCanvasHost(flowCanvasId: string): HTMLElement | null {
  const id = String(flowCanvasId ?? 'main').trim() || 'main';
  if (typeof document === 'undefined') return null;
  try {
    return document.querySelector(
      `[data-flow-canvas-id="${CSS.escape(id)}"]`
    ) as HTMLElement | null;
  } catch {
    return document.querySelector(`[data-flow-canvas-id="${id}"]`) as HTMLElement | null;
  }
}

export function queryWithinFlowCanvasHost(
  host: HTMLElement | null | undefined,
  selector: string
): HTMLElement | null {
  if (!host) return null;
  return host.querySelector(selector) as HTMLElement | null;
}

export function queryAllFlowNodesInHost(host: HTMLElement | null | undefined): HTMLElement[] {
  if (!host) return [];
  return Array.from(host.querySelectorAll('.react-flow__node')) as HTMLElement[];
}

export function queryAllFlowNodesInCanvas(flowCanvasId: string): HTMLElement[] {
  return queryAllFlowNodesInHost(getFlowCanvasHost(flowCanvasId));
}

/** On-screen RF canvas root (same element RF uses for screenToFlow bounds). */
export function resolveFlowPaneElement(host: HTMLElement | null): HTMLElement | null {
  if (!host) return null;
  return (
    (host.querySelector('.react-flow') as HTMLElement | null) ??
    (host.querySelector('.react-flow__renderer') as HTMLElement | null) ??
    (host.querySelector('.react-flow__viewport') as HTMLElement | null) ??
    host
  );
}

/**
 * Measures the flow canvas shell (primary ref, optional fallback host).
 * Shared by pre-mount readiness and ReactFlowContainerResize.
 */

export type FlowContainerMeasureRefs = {
  primary: () => HTMLElement | null;
  fallback?: () => HTMLElement | null;
};

export type FlowContainerSize = { width: number; height: number };

export function measureFlowContainerSize(refs: FlowContainerMeasureRefs): FlowContainerSize {
  const sources = [refs.primary, refs.fallback].filter(Boolean) as Array<() => HTMLElement | null>;
  for (const getEl of sources) {
    const el = getEl();
    if (!el) continue;
    const rect = el.getBoundingClientRect();
    const width = Math.round(rect.width);
    const height = Math.round(rect.height);
    if (width >= 2 && height >= 2) return { width, height };
  }
  return { width: 0, height: 0 };
}

export function isFlowContainerSized(size: FlowContainerSize): boolean {
  return size.width >= 2 && size.height >= 2;
}

/**
 * After the dock tree adds a lateral split (flow + chat), flex layout and React Flow's internal
 * ResizeObserver can settle on different frames. A window `resize` tick nudges @reactflow/core's
 * `updateDimensions` so the canvas matches the final pane width without a visible “wide then narrow” flash.
 */
export function scheduleDockLayoutRefresh(): void {
  queueMicrotask(() => {
    requestAnimationFrame(() => {
      window.dispatchEvent(new Event('resize'));
    });
  });
}

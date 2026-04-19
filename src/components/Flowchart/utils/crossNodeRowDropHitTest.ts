/**
 * Hit-test at drop time for cross-node row DnD: distinguishes portal row vs normal row vs empty chrome
 * inside a React Flow custom node, so orchestration can route to structural parent move vs subflow portal.
 */

import { isDndOperationInstrumentEnabled } from '@utils/dndOperationInstrument';

export type CrossNodeDropTargetRegion = 'portal' | 'row' | 'node';

export type CrossNodeDropHitResult = {
  /** Row id under the pointer when over a `.node-row-outer`; null if chrome-only. */
  targetRowId: string | null;
  targetRegion: CrossNodeDropTargetRegion;
  /** Portal row id on this node (from DOM), if any; useful for diagnostics. */
  portalRowIdOnTargetNode: string | null;
};

/** Optional logging context for `[DnD:hitTest]` (instrumentation only). */
export type CrossNodeDropHitInstrument = {
  operationId: string;
  dragCloneHidden: boolean;
};

/**
 * Whether the pointer (from hit-test payload) targets the portal row for "enter subflow" handling.
 * Used by {@link useCrossFlowRowMoveOrchestrator} (defer structural move) and portal capture handler (run apply).
 */
export function dropTargetsSubflowPortalRow(params: {
  targetRegion?: CrossNodeDropTargetRegion;
  targetRowId?: string | null;
  portalTaskRowId: string | null | undefined;
}): boolean {
  const pid = String(params.portalTaskRowId || '').trim();
  if (!pid) return false;
  if (params.targetRegion === 'portal') return true;
  return String(params.targetRowId ?? '').trim() === pid;
}

function queryRfNodeRoot(targetNodeId: string): HTMLElement | null {
  try {
    return document.querySelector(`[data-id="${CSS.escape(targetNodeId)}"]`) as HTMLElement | null;
  } catch {
    return document.querySelector(`[data-id="${targetNodeId}"]`) as HTMLElement | null;
  }
}

/**
 * Resolves drop routing using `elementsFromPoint` and row data attributes on `.node-row-outer`.
 *
 * - **portal**: pointer is over the row marked `data-omnia-subflow-portal-row="true"`.
 * - **row**: pointer is over another task row.
 * - **node**: pointer is inside the RF node but not over any row (padding, header, gaps).
 */
export function resolveCrossNodeDropHitTest(
  clientX: number,
  clientY: number,
  targetNodeId: string,
  instrument?: CrossNodeDropHitInstrument
): CrossNodeDropHitResult {
  const root = queryRfNodeRoot(targetNodeId);
  const portalEl = root?.querySelector('.node-row-outer[data-omnia-subflow-portal-row="true"]') as HTMLElement | null;
  const portalRowIdOnTargetNode =
    (portalEl?.getAttribute('data-omnia-flow-row-id') ||
      portalEl?.getAttribute('data-row-id') ||
      '').trim() || null;

  const finish = (hit: CrossNodeDropHitResult): CrossNodeDropHitResult => {
    if (instrument && isDndOperationInstrumentEnabled()) {
      console.log('[DnD:hitTest]', {
        operationId: instrument.operationId,
        targetRegion: hit.targetRegion,
        targetRowId: hit.targetRowId,
        targetNodeId,
        dragCloneHidden: instrument.dragCloneHidden,
      });
    }
    return hit;
  };

  if (!root) {
    return finish({ targetRowId: null, targetRegion: 'node', portalRowIdOnTargetNode });
  }

  let stack: Element[] = [];
  try {
    stack = [...document.elementsFromPoint(clientX, clientY)];
  } catch {
    /* noop */
  }

  for (const el of stack) {
    const rowEl = el instanceof Element ? (el.closest('.node-row-outer') as HTMLElement | null) : null;
    if (!rowEl || !root.contains(rowEl)) continue;

    const rowId =
      (rowEl.getAttribute('data-omnia-flow-row-id') || rowEl.getAttribute('data-row-id') || '').trim() || null;
    const isPortal = rowEl.getAttribute('data-omnia-subflow-portal-row') === 'true';

    if (isPortal) {
      return finish({
        targetRowId: rowId,
        targetRegion: 'portal',
        portalRowIdOnTargetNode: rowId || portalRowIdOnTargetNode,
      });
    }
    return finish({
      targetRowId: rowId,
      targetRegion: 'row',
      portalRowIdOnTargetNode,
    });
  }

  let top: Element | null = null;
  try {
    top = document.elementFromPoint(clientX, clientY);
  } catch {
    top = null;
  }
  if (top && root.contains(top)) {
    return finish({ targetRowId: null, targetRegion: 'node', portalRowIdOnTargetNode });
  }

  return finish({ targetRowId: null, targetRegion: 'node', portalRowIdOnTargetNode });
}

/** Alias for search / parity with docs — same implementation as {@link resolveCrossNodeDropHitTest}. */
export const crossNodeRowDropHitTest = resolveCrossNodeDropHitTest;

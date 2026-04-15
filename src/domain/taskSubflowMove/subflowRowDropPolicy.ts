/**
 * Domain rules for drag/drop of Subflow portal rows onto flow canvases.
 * Prevents placing a Subflow task instance on the canvas that implements its nested flow (recursive call).
 */

import type { Task } from '@types/taskTypes';
import { TaskType } from '@types/taskTypes';

import { getSubflowSyncFlows } from './subflowSyncFlowsRef';

/** Nested flow id stored on a Subflow task (same source as portal resolution). */
export function getChildFlowIdFromSubflowTask(
  task: { flowId?: string; parameters?: Array<{ parameterId?: string; value?: unknown }> } | null | undefined
): string | null {
  if (!task) return null;
  const direct = String(task.flowId || '').trim();
  if (direct) return direct;
  const params = Array.isArray(task.parameters) ? task.parameters : [];
  const p = params.find((x) => String(x?.parameterId || '').trim() === 'flowId');
  return String(p?.value || '').trim() || null;
}

/**
 * True when `flowCanvasId` is the flow canvas for the Subflow task's nested flow slice
 * (dropping the portal here would nest the subflow inside its own implementation).
 */
export function flowCanvasIdImplementsSubflowNestedFlow(flowCanvasId: string, nestedFlowId: string): boolean {
  const c = String(flowCanvasId || '').trim();
  const nf = String(nestedFlowId || '').trim();
  if (!nf) return false;
  if (c === nf) return true;
  try {
    const slice = getSubflowSyncFlows()[c] as { id?: string } | undefined;
    const sid = String(slice?.id || '').trim();
    if (sid && sid === nf) return true;
  } catch {
    /* noop */
  }
  return false;
}

export type SubflowPortalRowDropContext = {
  /** True when moving a row onto another node on the same flow canvas (different React Flow node id). */
  sameFlowCrossNodeDrop: boolean;
};

/**
 * Whether a Subflow portal row may be dropped for the given target flow canvas.
 * Non-Subflow rows always return true (caller may apply other rules).
 */
export function canAcceptSubflowPortalRowDrop(
  task: Task | null | undefined,
  targetFlowCanvasId: string,
  ctx: SubflowPortalRowDropContext
): boolean {
  if (!task || task.type !== TaskType.Subflow) {
    return true;
  }
  if (ctx.sameFlowCrossNodeDrop) {
    return false;
  }
  const childFlowId = getChildFlowIdFromSubflowTask(task);
  if (!childFlowId) {
    return true;
  }
  const target = String(targetFlowCanvasId || '').trim() || 'main';
  if (flowCanvasIdImplementsSubflowNestedFlow(target, childFlowId)) {
    return false;
  }
  return true;
}

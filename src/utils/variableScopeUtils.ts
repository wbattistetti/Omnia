/**
 * Per-flow variable visibility for authoring (conditions, pickers, flow rail).
 * Task-bound rows are visible only on flow canvases that contain that task as a row.
 * Flow-scoped manual rows only on matching canvas. Project-scoped manual rows (no task)
 * are not part of a single flow namespace and are hidden from per-flow surfaces.
 */

import type { VariableInstance, VariableScope } from '@types/variableTypes';
import { FlowWorkspaceSnapshot } from '../flows/FlowWorkspaceSnapshot';

/**
 * Normalizes a VariableInstance from API or legacy rows (missing scope defaults to project).
 */
export function normalizeVariableInstance(
  raw: Partial<VariableInstance> & { varId: string }
): VariableInstance {
  const varId = typeof raw.varId === 'string' ? raw.varId.trim() : '';
  let scope: VariableScope = raw.scope === 'flow' ? 'flow' : 'project';
  let scopeFlowId =
    typeof raw.scopeFlowId === 'string' && raw.scopeFlowId.trim()
      ? raw.scopeFlowId.trim()
      : null;

  if (scope === 'flow' && !scopeFlowId) {
    scope = 'project';
    scopeFlowId = null;
  }

  return {
    varId,
    varName: typeof raw.varName === 'string' ? raw.varName.trim() : String(raw.varName ?? ''),
    taskInstanceId: raw.taskInstanceId ?? '',
    nodeId: raw.nodeId ?? '',
    ddtPath: raw.ddtPath ?? '',
    scope,
    scopeFlowId: scope === 'flow' ? scopeFlowId ?? '' : undefined,
  };
}

/**
 * Collects task instance ids (flow row ids) present on the given flow canvas graph.
 */
export function getTaskInstanceIdsOnFlowCanvas(flowCanvasId: string): Set<string> {
  const flow = FlowWorkspaceSnapshot.getFlowById(flowCanvasId);
  const ids = new Set<string>();
  if (!flow) {
    return ids;
  }
  for (const node of flow.nodes || []) {
    const rows = (node as { data?: { rows?: unknown[] } })?.data?.rows;
    if (!Array.isArray(rows)) {
      continue;
    }
    for (const row of rows) {
      const taskId = String((row as { id?: string })?.id || '').trim();
      if (taskId) {
        ids.add(taskId);
      }
    }
  }
  return ids;
}

/**
 * Returns true if this variable row should appear when authoring on the given flow canvas.
 */
export function isVariableVisibleInFlow(v: VariableInstance, flowCanvasId: string): boolean {
  const taskId = String(v.taskInstanceId ?? '').trim();
  if (taskId.length > 0) {
    return getTaskInstanceIdsOnFlowCanvas(flowCanvasId).has(taskId);
  }
  const scope: VariableScope = v.scope ?? 'project';
  if (scope === 'flow') {
    return String(v.scopeFlowId ?? '').trim() === String(flowCanvasId ?? '').trim();
  }
  return false;
}

/**
 * Compares a row's scope bucket to an intended scope (for name collision checks).
 */
export function sameVariableScopeBucket(
  v: VariableInstance,
  scope: VariableScope,
  scopeFlowId?: string | null
): boolean {
  const vs: VariableScope = v.scope ?? 'project';
  if (vs !== scope) {
    return false;
  }
  if (scope === 'project') {
    return true;
  }
  return String(v.scopeFlowId ?? '').trim() === String(scopeFlowId ?? '').trim();
}

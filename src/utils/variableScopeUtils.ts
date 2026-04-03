/**
 * Per-flow variable visibility for authoring (conditions, pickers, flow rail).
 * Task-bound rows belong to a single flow namespace (scope flow + scopeFlowId); legacy rows
 * fall back to the workspace graph. Manual globals (scope project, no task) are visible on every flow.
 */

import type { VariableInstance, VariableScope } from '@types/variableTypes';
import type { WorkspaceState } from '../flows/FlowTypes';
import { FlowWorkspaceSnapshot } from '../flows/FlowWorkspaceSnapshot';

/**
 * Normalizes a VariableInstance from API or legacy rows (missing scope defaults to project).
 */
export function normalizeVariableInstance(
  raw: Partial<VariableInstance> & { id: string }
): VariableInstance {
  const id = typeof raw.id === 'string' ? raw.id.trim() : '';
  const taskBound = String(raw.taskInstanceId ?? '').trim().length > 0;
  let scope: VariableScope = raw.scope === 'flow' ? 'flow' : 'project';
  let scopeFlowId =
    typeof raw.scopeFlowId === 'string' && raw.scopeFlowId.trim()
      ? raw.scopeFlowId.trim()
      : null;

  if (scope === 'flow' && !scopeFlowId) {
    if (taskBound) {
      scope = 'flow';
      scopeFlowId = '';
    } else {
      scope = 'project';
      scopeFlowId = null;
    }
  }

  const base: VariableInstance = {
    id,
    varName: typeof raw.varName === 'string' ? raw.varName.trim() : String(raw.varName ?? ''),
    taskInstanceId: raw.taskInstanceId ?? '',
    dataPath: raw.dataPath ?? '',
    scope,
    scopeFlowId: scope === 'flow' ? scopeFlowId ?? '' : undefined,
  };
  const bf = (raw as VariableInstance).bindingFrom;
  const bt = (raw as VariableInstance).bindingTo;
  if (typeof bf === 'string' && bf.trim()) base.bindingFrom = bf.trim();
  if (typeof bt === 'string' && bt.trim()) base.bindingTo = bt.trim();
  return base;
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
 * Same task row ids as {@link getTaskInstanceIdsOnFlowCanvas} but read from an in-memory `flows`
 * map (e.g. FlowStore). Use when authoring UI has `flows` but {@link FlowWorkspaceSnapshot} is stale.
 */
export function getTaskInstanceIdsOnFlowCanvasFromFlows(
  flowCanvasId: string,
  flows: WorkspaceState['flows'] | null | undefined
): Set<string> {
  const ids = new Set<string>();
  const fid = String(flowCanvasId ?? '').trim();
  if (!fid || !flows) return ids;
  const flow = flows[fid];
  if (!flow?.nodes) return ids;
  for (const node of flow.nodes) {
    const rows = (node as { data?: { rows?: unknown[] } })?.data?.rows;
    if (!Array.isArray(rows)) continue;
    for (const row of rows) {
      const taskId = String((row as { id?: string })?.id || '').trim();
      if (taskId) ids.add(taskId);
    }
  }
  return ids;
}

/**
 * Index: task row id → flow canvas id, built from the full workspace snapshot (all flows).
 */
export function getTaskInstanceIdToFlowIdMap(): Map<string, string> {
  const map = new Map<string, string>();
  for (const flowId of FlowWorkspaceSnapshot.getAllFlowIds()) {
    for (const taskId of getTaskInstanceIdsOnFlowCanvas(flowId)) {
      map.set(taskId, flowId);
    }
  }
  return map;
}

/**
 * Returns true if this variable row should appear when authoring on the given flow canvas.
 *
 * @param flows - When provided, task-row membership is resolved from this workspace graph instead of
 *   {@link FlowWorkspaceSnapshot} only. Pass the same `flows` as variable pickers / editors use.
 */
export function isVariableVisibleInFlow(
  v: VariableInstance,
  flowCanvasId: string,
  flows?: WorkspaceState['flows'] | null
): boolean {
  const fid = String(flowCanvasId ?? '').trim();
  const taskId = String(v.taskInstanceId ?? '').trim();

  if (!taskId) {
    const scope: VariableScope = v.scope ?? 'project';
    if (scope === 'project') {
      return true;
    }
    if (scope === 'flow') {
      return String(v.scopeFlowId ?? '').trim() === fid;
    }
    return false;
  }

  const explicitFlow = String(v.scopeFlowId ?? '').trim();
  if (explicitFlow.length > 0) {
    return explicitFlow === fid;
  }

  // Union in-memory `flows` with FlowWorkspaceSnapshot: either can lag during tab/editor updates.
  if (flows != null) {
    const fromFlows = getTaskInstanceIdsOnFlowCanvasFromFlows(fid, flows);
    const fromSnapshot = getTaskInstanceIdsOnFlowCanvas(fid);
    const merged = new Set<string>([...fromFlows, ...fromSnapshot]);
    return merged.has(taskId);
  }
  return getTaskInstanceIdsOnFlowCanvas(fid).has(taskId);
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

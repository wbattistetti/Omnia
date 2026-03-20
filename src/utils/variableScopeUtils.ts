/**
 * Helpers for variable visibility: project-wide vs flow-scoped (manual/slot variables).
 * Task-bound variables (non-empty taskInstanceId) are always visible in every flow.
 */

import type { VariableInstance, VariableScope } from '@types/variableTypes';

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
 * Returns true if this variable row should appear when authoring conditions on the given flow canvas.
 */
export function isVariableVisibleInFlow(v: VariableInstance, flowCanvasId: string): boolean {
  const taskId = String(v.taskInstanceId ?? '').trim();
  if (taskId.length > 0) {
    return true;
  }
  const scope: VariableScope = v.scope ?? 'project';
  if (scope === 'project') {
    return true;
  }
  return String(v.scopeFlowId ?? '').trim() === String(flowCanvasId ?? '').trim();
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

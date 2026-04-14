/**
 * ChildRequiredVariables: VarIds that must be wired as parent→child INPUT parameters.
 * Excludes the moved task's own variables and any variable already present in the child flow
 * (e.g. sibling tasks moved earlier), so a reference in the task JSON does not imply an external input.
 */

import type {
  ChildRequiredVariables,
  ReferencedTaskVariables,
  TaskVariables,
  VarId,
} from '../guidModel/types';

/**
 * Collects `varId`s whose rows are scoped to `childFlowId` (already materialised in the subflow canvas).
 */
export function childFlowExistingVarIdsFromProjectVariables(
  allProjectVariables: readonly { id?: string; scopeFlowId?: string | null }[],
  childFlowId: string
): Set<VarId> {
  const cid = String(childFlowId || '').trim();
  const out = new Set<VarId>();
  if (!cid) return out;
  for (const v of allProjectVariables) {
    if (String(v.scopeFlowId || '').trim() !== cid) continue;
    const id = String(v.id || '').trim();
    if (id) out.add(id as VarId);
  }
  return out;
}

export function childRequiredVariablesFromReferencedTaskVariablesAndTaskVariables(
  referencedTaskVariables: ReferencedTaskVariables,
  taskVariables: TaskVariables,
  childFlowExistingVarIds?: ReadonlySet<VarId>
): ChildRequiredVariables {
  const out = new Set<VarId>();
  const alreadyInChild = childFlowExistingVarIds ?? new Set<VarId>();
  for (const v of referencedTaskVariables) {
    if (taskVariables.has(v)) continue;
    if (alreadyInChild.has(v)) continue;
    out.add(v);
  }
  return out;
}

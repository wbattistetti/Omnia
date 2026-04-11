/**
 * VarsReferencedInOrigin: subset of TaskVariables still referenced elsewhere in the origin (parent) workspace.
 */

import type { TaskVariables, VarId, VarsReferencedInOrigin } from '../guidModel/types';

export function varsReferencedInOriginFromTaskVariablesAndParentReferences(
  taskVariables: TaskVariables,
  parentWorkspaceReferencedVarIds: ReadonlySet<string>
): VarsReferencedInOrigin {
  const out = new Set<VarId>();
  for (const v of taskVariables) {
    if (parentWorkspaceReferencedVarIds.has(String(v))) out.add(v);
  }
  return out;
}

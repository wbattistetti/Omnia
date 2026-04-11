/**
 * DeletableOriginVariables: TaskVariables that may be removed from the parent (not referenced there).
 */

import type { DeletableOriginVariables, TaskVariables, VarId, VarsReferencedInOrigin } from '../guidModel/types';

export function deletableOriginVariablesFromTaskVariablesAndVarsReferencedInOrigin(
  taskVariables: TaskVariables,
  varsReferencedInOrigin: VarsReferencedInOrigin
): DeletableOriginVariables {
  const out = new Set<VarId>();
  for (const v of taskVariables) {
    if (!varsReferencedInOrigin.has(v)) out.add(v);
  }
  return out;
}

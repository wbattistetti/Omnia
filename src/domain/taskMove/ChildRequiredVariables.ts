/**
 * ChildRequiredVariables: external VarIds cited by the moved task corpus that are not part of TaskVariables (real inputs).
 */

import type {
  ChildRequiredVariables,
  ReferencedTaskVariables,
  TaskVariables,
  VarId,
} from '../guidModel/types';

export function childRequiredVariablesFromReferencedTaskVariablesAndTaskVariables(
  referencedTaskVariables: ReferencedTaskVariables,
  taskVariables: TaskVariables
): ChildRequiredVariables {
  const out = new Set<VarId>();
  for (const v of referencedTaskVariables) {
    if (!taskVariables.has(v)) out.add(v);
  }
  return out;
}

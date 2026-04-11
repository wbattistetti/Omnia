/**
 * TaskVariables: VarIds for the moved task instance (store ∪ infer), same GUIDs in parent/child.
 */

import type { VariableInstance } from '../../types/variableTypes';
import type { TaskVariables, VarId } from '../guidModel/types';

export function taskVariablesFromTaskVariableRows(rows: VariableInstance[]): TaskVariables {
  const out = new Set<VarId>();
  for (const r of rows) {
    const id = String(r.id || '').trim();
    if (id) out.add(id as VarId);
  }
  return out;
}

/**
 * Canonical step: variable GUIDs for the moved task after store ∪ inference merge.
 */

import type { VariableInstance } from '@types/variableTypes';
import type { VariableId } from '../types';

export type GetTaskVariableIdsInput = {
  mergedVariableRows: readonly VariableInstance[];
};

/**
 * Returns the set of task-bound variable ids (same as task tree varIds / GUIDs).
 */
export function GetTaskVariableIds(input: GetTaskVariableIdsInput): ReadonlySet<VariableId> {
  return new Set(
    input.mergedVariableRows.map((v) => String(v.id || '').trim()).filter(Boolean) as VariableId[]
  );
}

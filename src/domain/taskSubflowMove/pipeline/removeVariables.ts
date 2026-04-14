/**
 * Canonical step: remove unreferenced task variable rows from the in-memory store (linked move prune).
 */

import type { VariableStoreAdapter } from '../adapters/variableStoreAdapter';
import type { VariableId } from '../types';

export type RemoveVariablesInput = {
  projectId: string;
  taskInstanceId: string;
  unreferencedVarIds: readonly VariableId[];
  variableStore: VariableStoreAdapter;
};

export type RemoveVariablesOutput = number;

export function RemoveVariables(input: RemoveVariablesInput): RemoveVariablesOutput {
  if (input.unreferencedVarIds.length === 0) return 0;
  return input.variableStore.removeTaskVariableRowsForIds(
    input.projectId,
    input.taskInstanceId,
    input.unreferencedVarIds
  );
}

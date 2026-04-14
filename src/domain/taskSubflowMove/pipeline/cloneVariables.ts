/**
 * Canonical step: merge store ∪ inferred variable rows and persist S2 set on the task instance.
 */

import type { WorkspaceState } from '@flows/FlowTypes';
import type { VariableInstance } from '@types/variableTypes';
import type { VariableStoreAdapter } from '../adapters/variableStoreAdapter';
import {
  inferTaskVariableInstancesForSubflowInterfaceMerge,
  mergeVariableRowsByIdPreferStore,
} from '../inferTaskVariableInstancesForSubflowMerge';

export type CloneVariablesInput = {
  projectId: string;
  taskInstanceId: string;
  childFlowId: string;
  flows: WorkspaceState['flows'];
  storeRows: VariableInstance[];
  linkedSubflow: boolean;
  variableStore: VariableStoreAdapter;
};

export type CloneVariablesOutput = {
  mergedRows: VariableInstance[];
};

/**
 * Store ∪ inference; when linked, replaces task variable rows in the store (same GUIDs).
 */
export function CloneVariables(input: CloneVariablesInput): CloneVariablesOutput {
  if (!input.linkedSubflow) {
    return { mergedRows: [...input.storeRows] };
  }
  const inferred = inferTaskVariableInstancesForSubflowInterfaceMerge(
    input.taskInstanceId,
    input.childFlowId,
    input.flows
  );
  let merged = mergeVariableRowsByIdPreferStore(input.storeRows, inferred);
  if (merged.length > 0) {
    input.variableStore.replaceTaskVariableRowsForInstance(
      input.projectId,
      input.taskInstanceId,
      merged,
      input.flows
    );
    merged = input.variableStore.getVariablesByTaskInstanceId(input.projectId, input.taskInstanceId);
  }
  return { mergedRows: merged };
}

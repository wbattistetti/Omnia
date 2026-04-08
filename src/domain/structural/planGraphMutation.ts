/**
 * Pure graph transforms for structural commands (no VariableStore / TaskRepository side effects).
 */

import type { WorkspaceState } from '@flows/FlowTypes';
import type { NodeRowData } from '@types/project';
import {
  appendRowToFlowNode,
  moveTaskRowBetweenFlows,
  removeRowByIdFromFlow,
} from '@domain/taskSubflowMove/moveTaskRowInFlows';

export { moveTaskRowBetweenFlows };

export type AppendIntoSubflowGraphParams = {
  parentFlowId: string;
  childFlowId: string;
  targetNodeId: string;
  taskInstanceId: string;
  row: NodeRowData;
};

/**
 * Removes the task row from the parent flow and appends it to a node in the child flow.
 * Matches legacy `structuralAppend` in applyTaskMoveToSubflow.
 */
export function applyAppendTaskRowIntoSubflowGraph(
  flows: WorkspaceState['flows'],
  p: AppendIntoSubflowGraphParams
): WorkspaceState['flows'] {
  let next = removeRowByIdFromFlow(flows, p.parentFlowId, p.taskInstanceId);
  next = appendRowToFlowNode(next, {
    targetFlowId: p.childFlowId,
    targetNodeId: p.targetNodeId,
    row: p.row as Record<string, unknown>,
  });
  return next;
}

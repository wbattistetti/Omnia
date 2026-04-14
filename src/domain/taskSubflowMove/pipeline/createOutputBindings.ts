/**
 * Canonical step: write S2 subflowBindings on the parent Subflow task from child OUTPUT interface rows.
 */

import { autoFillSubflowBindingsForMovedTask } from '../autoFillSubflowBindings';
import type { WorkspaceState } from '@flows/FlowTypes';

export type CreateOutputBindingsInput = {
  projectId: string;
  parentFlowId: string;
  parentFlow: WorkspaceState['flows'][string] | undefined;
  childFlow: WorkspaceState['flows'][string] | undefined;
  subflowTaskId: string;
  taskVariableIds: readonly string[];
};

export type CreateOutputBindingsOutput = boolean;

export function CreateOutputBindings(input: CreateOutputBindingsInput): CreateOutputBindingsOutput {
  return autoFillSubflowBindingsForMovedTask({
    projectId: input.projectId,
    parentFlowId: input.parentFlowId,
    parentFlow: input.parentFlow,
    childFlow: input.childFlow,
    subflowTaskId: input.subflowTaskId,
    taskVariableIds: input.taskVariableIds,
  });
}

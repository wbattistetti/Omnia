/**
 * Variable store port for the canonical pipeline (delegates to VariableCreationService).
 */

import type { WorkspaceState } from '@flows/FlowTypes';
import type { VariableInstance } from '@types/variableTypes';
import { variableCreationService } from '@services/VariableCreationService';

export type VariableStoreAdapter = {
  hydrateVariablesFromFlow(projectId: string, flows: WorkspaceState['flows']): void;
  getAllVariables(projectId: string): VariableInstance[];
  getVariablesByTaskInstanceId(projectId: string, taskInstanceId: string): VariableInstance[];
  replaceTaskVariableRowsForInstance(
    projectId: string,
    taskInstanceId: string,
    rows: VariableInstance[],
    flows: WorkspaceState['flows']
  ): void;
  removeTaskVariableRowsForIds(
    projectId: string,
    taskInstanceId: string,
    varIds: readonly string[]
  ): number;
};

export function createDefaultVariableStoreAdapter(): VariableStoreAdapter {
  return {
    hydrateVariablesFromFlow: (projectId, flows) => variableCreationService.hydrateVariablesFromFlow(projectId, flows),
    getAllVariables: (projectId) => variableCreationService.getAllVariables(projectId) ?? [],
    getVariablesByTaskInstanceId: (projectId, taskInstanceId) =>
      variableCreationService.getVariablesByTaskInstanceId(projectId, taskInstanceId),
    replaceTaskVariableRowsForInstance: (projectId, taskInstanceId, rows, flows) =>
      variableCreationService.replaceTaskVariableRowsForInstance(projectId, taskInstanceId, rows, flows),
    removeTaskVariableRowsForIds: (projectId, taskInstanceId, varIds) =>
      variableCreationService.removeTaskVariableRowsForIds(projectId, taskInstanceId, varIds),
  };
}

/**
 * Shared parameter and result types for task → subflow move (canonical + legacy parity tests).
 */

import type { WorkspaceState } from '@flows/FlowTypes';
import type { NodeRowData } from '@types/project';
import type { ProjectConditionLike } from './collectReferencedVarIds';

export type ApplyTaskMoveToSubflowParams = {
  projectId: string;
  parentFlowId: string;
  childFlowId: string;
  taskInstanceId: string;
  subflowDisplayTitle: string;
  parentSubflowTaskRowId: string;
  flows: WorkspaceState['flows'];
  conditions?: ProjectConditionLike[];
  translations?: Record<string, string>;
  projectData?: unknown;
  deleteUnreferencedTaskVariableRows?: boolean;
  structuralMove?: {
    sourceFlowId: string;
    targetFlowId: string;
    sourceNodeId: string;
    targetNodeId: string;
  };
  structuralAppend?: {
    targetFlowId: string;
    targetNodeId: string;
    row: NodeRowData;
  };
  skipMaterialization?: boolean;
  skipStructuralPhase?: boolean;
  isLinkedSubflowMove?: boolean;
  secondPass?: boolean;
  exposeAllTaskVariablesInChildInterface?: boolean;
  /** Optional: correlates portal DnD → apply → rename (`crossNodeRowMove` detail `dndTraceId`). */
  dndTraceId?: string;
  /** Same uuid as `dndTraceId` when set from row DnD — explicit key for `[Subflow:*]` logs. */
  operationId?: string;
};

export type MaterializeMovedTaskSummary = {
  ok: boolean;
  parentFlowContainedRowBeforeStrip: boolean;
  parentFlowContainsRowAfter: boolean;
  childFlowContainsRow: boolean;
  taskFoundInRepository: boolean;
  repositoryPatchApplied: boolean;
  errorMessage?: string;
};

export type ApplyTaskMoveToSubflowResult = {
  referencedVarIdsForMovedTask: string[];
  unreferencedVarIdsForMovedTask: string[];
  guidMappingParentSubflow: Array<{ id: string }>;
  renamed: Array<{ id: string; previousName: string; nextName: string }>;
  parentAutoRenames: Array<{ id: string; previousName: string; nextName: string }>;
  removedUnreferencedVariableRows: number;
  taskMaterialization: MaterializeMovedTaskSummary;
  secondPassDisplayLabelUpdates: number;
  flowsNext: WorkspaceState['flows'];
  flowStoreCommitOk?: boolean;
};

/**
 * Orchestrates child local variable names, child flow interface outputs, and Subflow outputBindings
 * when a task instance is moved to a subflow.
 *
 * Child task variables keep **local** `varName` (e.g. `colore`). Parent fully-qualified names
 * (`dati_personali.colore`) are created only on **separate** manual proxy rows via
 * `syncProxyBindingsForSubflowTask` (outputBindings: child varId → parent proxy varId).
 */

import { createMappingEntry } from '@components/FlowMappingPanel/mappingTypes';
import { localLabelForSubflowTaskVariable } from '@domain/variableProxyNaming';
import type { WorkspaceState } from '@flows/FlowTypes';
import type { VariableInstance } from '@types/variableTypes';
import { invalidateChildFlowInterfaceCache } from '@services/childFlowInterfaceService';
import { taskRepository } from '@services/TaskRepository';
import { syncProxyBindingsForSubflowTask } from '@services/subflowProjectSync';
import { variableCreationService } from '@services/VariableCreationService';
import type { NodeRowData } from '@types/project';

import {
  collectReferencedVarIdsForParentFlowWorkspace,
  type ProjectConditionLike,
} from './collectReferencedVarIds';
import { compileTranslationsToInternalMap } from './referenceScanCompile';
import { materializeMovedTaskForSubflow } from './materializeTaskInSubflow';
import { appendRowToFlowNode, moveTaskRowBetweenFlows, removeRowByIdFromFlow } from './moveTaskRowInFlows';
import { restoreChildTaskBoundVariablesToLocalNames } from './subflowVariableProxyRestore';

export type ApplyTaskMoveToSubflowParams = {
  projectId: string;
  parentFlowId: string;
  childFlowId: string;
  /** Task / row instance id being moved. */
  taskInstanceId: string;
  /** Human title of the subflow for proxy naming (e.g. "Dati anagrafici"). */
  subflowDisplayTitle: string;
  /** Parent canvas row id of the Subflow task that targets `childFlowId` (for outputBindings sync). */
  parentSubflowTaskRowId: string;
  flows: WorkspaceState['flows'];
  conditions?: ProjectConditionLike[];
  translations?: Record<string, string>;
  /**
   * Full project payload for reference scanning: all condition expressions, meta, etc.
   * When set, condition expressions from every category are included in the corpus.
   */
  projectData?: unknown;
  /**
   * When true, removes in-memory VariableInstance rows for moved-task varIds that are not
   * referenced in the parent corpus. Unsafe if the task template still needs those rows for
   * authoring; default false. Prefer leaving rows and relying on flow-scoped visibility.
   */
  deleteUnreferencedTaskVariableRows?: boolean;
  /** Optional: move the row in the graph after variable + interface updates. */
  structuralMove?: {
    sourceFlowId: string;
    targetFlowId: string;
    sourceNodeId: string;
    targetNodeId: string;
  };
  /**
   * When the row was already removed from the parent graph (e.g. cross-node drag) but must be
   * appended to the child flow after interface / variable updates.
   */
  structuralAppend?: {
    targetFlowId: string;
    targetNodeId: string;
    row: NodeRowData;
  };
  /**
   * When true, skips stripping parent/child rows and TaskRepository authoring patch (used when the graph
   * + repository were already updated and only interface merge / bindings sync is needed).
   */
  skipMaterialization?: boolean;
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
  /** varIds of the moved task that appear anywhere in the parent reference corpus. */
  referencedVarIdsForMovedTask: string[];
  /** Task varIds not found in the parent reference corpus (no parent proxy required). */
  unreferencedVarIdsForMovedTask: string[];
  /**
   * GUID-stable child varIds that remain wired through the subflow interface into the parent
   * (referenced). Parent-facing FQ names use separate proxy varIds (outputBindings).
   */
  guidMappingParentSubflow: Array<{ id: string }>;
  renamed: Array<{ id: string; previousName: string; nextName: string }>;
  /** Count of rows removed when deleteUnreferencedTaskVariableRows was true. */
  removedUnreferencedVariableRows: number;
  /** Task row placement + TaskRepository snapshot after move (see materializeTaskInSubflow). */
  taskMaterialization: MaterializeMovedTaskSummary;
  flowsNext: WorkspaceState['flows'];
};

/**
 * Merges MappingEntry rows into the child flow's interface output for each task variable (stable GUID).
 * When `onlyVarIds` is set, only those varIds are exposed (proxy-backed outputs in the parent).
 * Uses local labels only for child interface (no parent FQ in paths). `variableRefId` stays the child slot GUID.
 */
export function mergeChildFlowInterfaceOutputsForVariables(
  flows: WorkspaceState['flows'],
  childFlowId: string,
  variables: VariableInstance[],
  options?: { onlyVarIds?: ReadonlySet<string>; projectId?: string }
): WorkspaceState['flows'] {
  const flow = flows[childFlowId];
  if (!flow) return flows;
  const only = options?.onlyVarIds;
  const optPid = String(options?.projectId || '').trim();
  const vars =
    only !== undefined
      ? only.size > 0
        ? variables.filter((v) => only.has(String(v.id || '').trim()))
        : []
      : variables;
  const meta = { ...(flow.meta || {}) } as {
    flowInterface?: { input?: unknown[]; output?: unknown[] };
  };
  const fi = { ...(meta.flowInterface || {}) };
  const prev: unknown[] = Array.isArray(fi.output) ? [...fi.output] : [];
  const seen = new Set(
    prev.map((e) => String((e as { variableRefId?: string }).variableRefId || '').trim()).filter(Boolean)
  );

  for (const v of vars) {
    const vid = String(v.id || '').trim();
    if (!vid || seen.has(vid)) continue;
    let rawName = String(v.varName || '').trim();
    if (!rawName && optPid) {
      rawName = String(variableCreationService.getVarNameById(optPid, vid) || '').trim();
    }
    if (!rawName) rawName = vid;
    const local = localLabelForSubflowTaskVariable(rawName);
    const label = local || rawName;
    prev.push(
      createMappingEntry({
        internalPath: label,
        externalName: label,
        variableRefId: vid,
        linkedVariable: label,
      })
    );
    seen.add(vid);
  }

  const nextFlow = {
    ...flow,
    meta: {
      ...meta,
      flowInterface: {
        input: Array.isArray(fi.input) ? fi.input : [],
        output: prev,
      },
    },
    hasLocalChanges: true,
  };
  return { ...flows, [childFlowId]: nextFlow };
}

/**
 * Applies renames for referenced variables, merges child interface outputs, syncs Subflow bindings,
 * and optionally performs the structural row move.
 */
export function applyTaskMoveToSubflow(params: ApplyTaskMoveToSubflowParams): ApplyTaskMoveToSubflowResult {
  const {
    projectId,
    parentFlowId,
    childFlowId,
    taskInstanceId,
    subflowDisplayTitle,
    parentSubflowTaskRowId,
    flows,
    conditions,
    translations,
    structuralMove,
    structuralAppend,
    projectData,
    deleteUnreferencedTaskVariableRows,
    skipMaterialization,
  } = params;

  const pid = String(projectId || '').trim();
  const parentFlow = flows[parentFlowId];
  if (!pid || !parentFlow) {
    return {
      referencedVarIdsForMovedTask: [],
      unreferencedVarIdsForMovedTask: [],
      guidMappingParentSubflow: [],
      renamed: [],
      removedUnreferencedVariableRows: 0,
      taskMaterialization: {
        ok: false,
        parentFlowContainedRowBeforeStrip: false,
        parentFlowContainsRowAfter: false,
        childFlowContainsRow: false,
        taskFoundInRepository: false,
        repositoryPatchApplied: false,
        errorMessage: 'missing_project_or_parent_flow',
      },
      flowsNext: flows,
    };
  }
  if (structuralMove && structuralAppend) {
    throw new Error('applyTaskMoveToSubflow: use either structuralMove or structuralAppend, not both.');
  }

  const movedTask = taskRepository.getTask(taskInstanceId);
  const extraCorpusChunks: string[] = [];
  if (movedTask) {
    extraCorpusChunks.push(JSON.stringify(movedTask));
  }

  const allVars = variableCreationService.getAllVariables(pid) ?? [];
  const translationsInternal = translations
    ? compileTranslationsToInternalMap(translations, allVars)
    : undefined;

  const referencedInParent = collectReferencedVarIdsForParentFlowWorkspace({
    projectId: pid,
    parentFlowId,
    flows,
    conditions,
    translationsInternal,
    projectData,
    useAllProjectConditionsForReferenceScan: projectData !== undefined && projectData !== null,
    extraCorpusChunks,
  });

  const taskVars = variableCreationService.getVariablesByTaskInstanceId(pid, taskInstanceId);
  const taskVarIdSet = new Set(taskVars.map((v) => String(v.id || '').trim()));
  const referencedForMovedTask = [...referencedInParent].filter((id) => taskVarIdSet.has(id));
  const refSet = new Set(referencedForMovedTask);
  const unreferencedForMovedTask = [...taskVarIdSet].filter((id) => !refSet.has(id));

  let removedUnreferencedVariableRows = 0;
  if (deleteUnreferencedTaskVariableRows && unreferencedForMovedTask.length > 0) {
    removedUnreferencedVariableRows = variableCreationService.removeTaskVariableRowsForIds(
      pid,
      taskInstanceId,
      unreferencedForMovedTask
    );
  }

  const renamed = restoreChildTaskBoundVariablesToLocalNames(pid, taskInstanceId, refSet).map((r) => ({
    id: r.id,
    previousName: r.previousName,
    nextName: r.nextName,
  }));

  const taskVarsAfterLocal = variableCreationService.getVariablesByTaskInstanceId(pid, taskInstanceId);

  let flowsNext = mergeChildFlowInterfaceOutputsForVariables(flows, childFlowId, taskVarsAfterLocal, {
    onlyVarIds: refSet,
    projectId: pid,
  });

  const outSlice = flowsNext[childFlowId]?.meta as
    | { flowInterface?: { output?: unknown[] } }
    | undefined;
  const outputs = Array.isArray(outSlice?.flowInterface?.output)
    ? (outSlice!.flowInterface!.output as any[])
    : [];

  syncProxyBindingsForSubflowTask(
    pid,
    parentFlowId,
    parentSubflowTaskRowId,
    childFlowId,
    outputs,
    flowsNext
  );

  invalidateChildFlowInterfaceCache(pid, childFlowId);

  if (structuralMove) {
    flowsNext = moveTaskRowBetweenFlows(flowsNext, {
      ...structuralMove,
      rowId: taskInstanceId,
    });
  } else if (structuralAppend) {
    const { targetFlowId, targetNodeId, row } = structuralAppend;
    flowsNext = removeRowByIdFromFlow(flowsNext, parentFlowId, taskInstanceId);
    flowsNext = appendRowToFlowNode(flowsNext, {
      targetFlowId,
      targetNodeId,
      row: row as Record<string, unknown>,
    });
  }

  const guidMappingParentSubflow = referencedForMovedTask.map((id) => ({ id }));

  let taskMaterialization: MaterializeMovedTaskSummary;
  if (skipMaterialization) {
    taskMaterialization = {
      ok: true,
      parentFlowContainedRowBeforeStrip: false,
      parentFlowContainsRowAfter: false,
      childFlowContainsRow: true,
      taskFoundInRepository: !!movedTask,
      repositoryPatchApplied: false,
    };
  } else {
    const mat = materializeMovedTaskForSubflow({
      projectId: pid,
      parentFlowId,
      childFlowId,
      taskInstanceId,
      flows: flowsNext,
    });
    flowsNext = mat.flowsNext;
    taskMaterialization = {
      ok: mat.ok,
      parentFlowContainedRowBeforeStrip: mat.parentFlowContainedRowBeforeStrip,
      parentFlowContainsRowAfter: mat.parentFlowContainsRowAfter,
      childFlowContainsRow: mat.childFlowContainsRow,
      taskFoundInRepository: mat.taskFoundInRepository,
      repositoryPatchApplied: mat.repositoryPatchApplied,
      ...(mat.errorMessage ? { errorMessage: mat.errorMessage } : {}),
    };
  }

  return {
    referencedVarIdsForMovedTask: referencedForMovedTask,
    unreferencedVarIdsForMovedTask: unreferencedForMovedTask,
    guidMappingParentSubflow,
    renamed,
    removedUnreferencedVariableRows,
    taskMaterialization,
    flowsNext,
  };
}

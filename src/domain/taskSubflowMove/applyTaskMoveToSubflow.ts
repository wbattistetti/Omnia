/**
 * Orchestrates child local variable names and child flow interface outputs when a task moves to a subflow.
 * Subflow wiring uses policy S2 (`subflowBindings` on the Subflow task); no proxy sync here.
 */

import { createMappingEntry, type MappingEntry } from '@components/FlowMappingPanel/mappingTypes';
import { localLabelForSubflowTaskVariable } from '@domain/variableProxyNaming';
import type { WorkspaceState } from '@flows/FlowTypes';
import { stripLegacyVariablesFromFlowMeta } from '../../flows/flowMetaSanitize';
import type { VariableInstance } from '@types/variableTypes';
import { TaskType } from '@types/taskTypes';
import { invalidateChildFlowInterfaceCache } from '@services/childFlowInterfaceService';
import { taskRepository } from '@services/TaskRepository';
import { variableCreationService } from '@services/VariableCreationService';
import { getVariableLabel } from '@utils/getVariableLabel';
import { getProjectTranslationsTable } from '@utils/projectTranslationsRegistry';
import { isUuidString, makeTranslationKey } from '@utils/translationKeys';
import { logTaskSubflowMove } from '@utils/taskSubflowMoveDebug';
import type { NodeRowData } from '@types/project';

import {
  collectReferencedVarIdsForParentFlowWorkspace,
  type ProjectConditionLike,
} from './collectReferencedVarIds';
import { compileTranslationsToInternalMap } from './referenceScanCompile';
import { materializeMovedTaskForSubflow } from './materializeTaskInSubflow';
import { appendRowToFlowNode, moveTaskRowBetweenFlows, removeRowByIdFromFlow } from './moveTaskRowInFlows';
import { restoreChildTaskBoundVariablesToLocalNames } from './subflowVariableProxyRestore';
import { autoFillSubflowBindingsForMovedTask } from './autoFillSubflowBindings';
import { autoRenameParentVariablesForMovedTask } from './autoRenameParentVariables';

export type ApplyTaskMoveToSubflowParams = {
  projectId: string;
  parentFlowId: string;
  childFlowId: string;
  /** Task / row instance id being moved. */
  taskInstanceId: string;
  /** Human title of the subflow for display naming / labels (e.g. "Dati anagrafici"). */
  subflowDisplayTitle: string;
  /** Parent canvas row id of the Subflow task that targets `childFlowId`. */
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
  /**
   * When true, structural move/append is skipped (row already on child flow). Use for a second idempotent
   * pass after hydrate when the graph was updated in a previous applyTaskMoveToSubflow call.
   */
  skipStructuralPhase?: boolean;
  /**
   * When false, the task is moved to another flow without Subflow wiring (no child interface merge).
   */
  isLinkedSubflowMove?: boolean;
  /**
   * When true, logs apply:secondPass:* and indicates a wiring-only pass after variableStore is populated.
   */
  secondPass?: boolean;
  /**
   * When true, merges every task variable into child output (ignore parent reference scan filter).
   * When false and the scan finds no referenced varIds, still merges all task variables (fallback).
   */
  exposeAllTaskVariablesInChildInterface?: boolean;
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
  /** Task varIds not found in the parent reference corpus (no parent-side binding required for move logic). */
  unreferencedVarIdsForMovedTask: string[];
  /**
   * GUID-stable child varIds referenced in the parent (authoring); parent-facing tokens use S2 `subflowBindings`.
   */
  guidMappingParentSubflow: Array<{ id: string }>;
  renamed: Array<{ id: string; previousName: string; nextName: string }>;
  /** Parent variable renames (`prefix.leaf`) after move when leaf labels matched the child interface. */
  parentAutoRenames: Array<{ id: string; previousName: string; nextName: string }>;
  /** Count of rows removed when deleteUnreferencedTaskVariableRows was true. */
  removedUnreferencedVariableRows: number;
  /** Task row placement + TaskRepository snapshot after move (see materializeTaskInSubflow). */
  taskMaterialization: MaterializeMovedTaskSummary;
  /** Parent/child GUID → FQ label entries written in the second pass (subflow proxy display). */
  secondPassDisplayLabelUpdates: number;
  flowsNext: WorkspaceState['flows'];
};

/**
 * Merges MappingEntry rows into the child flow's interface output for each task variable (stable GUID).
 * When `onlyVarIds` is set, only those varIds are exposed on the child interface (parent wiring is via `subflowBindings`).
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
  /** Empty set from parent scan: expose all task variables (scan may miss GUID substrings). */
  const vars =
    only === undefined
      ? variables
      : only.size > 0
        ? variables.filter((v) => only.has(String(v.id || '').trim()))
        : variables;
  const meta = { ...(flow.meta || {}) } as {
    flowInterface?: { input?: unknown[]; output?: unknown[] };
    translations?: Record<string, string>;
  };
  const tr: Record<string, string> = {
    ...(typeof meta.translations === 'object' && meta.translations ? meta.translations : {}),
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
    if (!rawName) {
      rawName = getVariableLabel(vid, getProjectTranslationsTable());
    }
    if (!rawName) rawName = vid;
    const local = localLabelForSubflowTaskVariable(rawName);
    const label = local || rawName;
    let labelKey: string | undefined;
    try {
      if (isUuidString(vid)) {
        labelKey = makeTranslationKey('interface', vid);
      }
    } catch {
      labelKey = undefined;
    }
    prev.push(
      createMappingEntry({
        internalPath: label,
        externalName: label,
        variableRefId: vid,
        linkedVariable: label,
        ...(labelKey ? { labelKey } : {}),
      })
    );
    if (labelKey) {
      tr[labelKey] = label;
    }
    seen.add(vid);
    logTaskSubflowMove('merge:interfaceOutputRow', {
      childFlowId,
      variableRefId: vid,
      resolvedLabel: label,
      rawNameSource: rawName,
      onlyVarIdsMode: only !== undefined,
    });
  }

  const nextFlow = {
    ...flow,
    meta: stripLegacyVariablesFromFlowMeta({
      ...meta,
      translations: tr,
      flowInterface: {
        input: Array.isArray(fi.input) ? fi.input : [],
        output: prev,
      },
    }) as (typeof flow)['meta'],
    hasLocalChanges: true,
  };
  return { ...flows, [childFlowId]: nextFlow };
}

/**
 * Populates child `flowInterface.input` from the parent Subflow portal task's `subflowBindings` (S2),
 * so the child flow document lists expected parameters without deducing from the canvas.
 */
function mergeChildFlowInterfaceInputsFromSubflowPortal(
  flows: WorkspaceState['flows'],
  projectId: string,
  childFlowId: string,
  subflowTaskId: string
): WorkspaceState['flows'] {
  const pid = String(projectId || '').trim();
  const cid = String(childFlowId || '').trim();
  const sid = String(subflowTaskId || '').trim();
  if (!pid || !cid || !sid) return flows;

  const portal = taskRepository.getTask(sid);
  const bindings = portal?.subflowBindings;
  if (!portal || portal.type !== TaskType.Subflow || !Array.isArray(bindings) || bindings.length === 0) {
    return flows;
  }

  const flow = flows[cid];
  if (!flow) return flows;

  const meta = { ...(flow.meta || {}) } as {
    flowInterface?: { input?: unknown[]; output?: unknown[] };
    translations?: Record<string, string>;
  };
  const fi = { ...(meta.flowInterface || {}) };
  const prevIn: unknown[] = Array.isArray(fi.input) ? [...fi.input] : [];
  const seen = new Set(
    prevIn.map((e) => String((e as { variableRefId?: string }).variableRefId || '').trim()).filter(Boolean)
  );
  const tr: Record<string, string> = {
    ...(typeof meta.translations === 'object' && meta.translations ? meta.translations : {}),
  };

  for (const b of bindings) {
    const iid = String(b?.interfaceParameterId || '').trim();
    if (!iid || seen.has(iid)) continue;

    let rawName = String(
      variableCreationService.getAllVariables(pid).find((v) => String(v.id) === iid)?.varName || ''
    ).trim();
    if (!rawName) rawName = getVariableLabel(iid, getProjectTranslationsTable());
    if (!rawName) rawName = iid;
    const local = localLabelForSubflowTaskVariable(rawName);
    const label = local || rawName;
    let labelKey: string | undefined;
    try {
      if (isUuidString(iid)) {
        labelKey = makeTranslationKey('interface', iid);
      }
    } catch {
      labelKey = undefined;
    }
    prevIn.push(
      createMappingEntry({
        internalPath: label,
        externalName: label,
        variableRefId: iid,
        linkedVariable: label,
        ...(labelKey ? { labelKey } : {}),
      })
    );
    if (labelKey) {
      tr[labelKey] = label;
    }
    seen.add(iid);
  }

  const nextFlow = {
    ...flow,
    meta: stripLegacyVariablesFromFlowMeta({
      ...meta,
      translations: tr,
      flowInterface: {
        input: prevIn,
        output: Array.isArray(fi.output) ? fi.output : [],
      },
    }) as (typeof flow)['meta'],
    hasLocalChanges: true,
  };
  return { ...flows, [cid]: nextFlow };
}

/**
 * Pipeline (GUID-centric): optional structural move/append onto child flow →
 * VariableCreationService.hydrateVariablesFromFlow (utterance + task rows on canvas) →
 * parent reference scan (CASO A/B) → child interface merge + bindings (linked subflow only) → materialize.
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
    skipStructuralPhase,
    isLinkedSubflowMove,
    secondPass,
    exposeAllTaskVariablesInChildInterface,
  } = params;

  const exposeAll = !!exposeAllTaskVariablesInChildInterface;

  const linkedSubflow = isLinkedSubflowMove !== false;
  const shouldDeleteUnreferenced = deleteUnreferencedTaskVariableRows !== false;

  const pid = String(projectId || '').trim();
  const parentFlow = flows[parentFlowId];
  if (!pid || !parentFlow) {
    logTaskSubflowMove('apply:abort', {
      reason: 'missing_project_or_parent_flow',
      projectId: pid || '(empty)',
      parentFlowId,
      hasParentFlow: !!parentFlow,
    });
    return {
      referencedVarIdsForMovedTask: [],
      unreferencedVarIdsForMovedTask: [],
      guidMappingParentSubflow: [],
      renamed: [],
      parentAutoRenames: [],
      removedUnreferencedVariableRows: 0,
      secondPassDisplayLabelUpdates: 0,
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

  logTaskSubflowMove('apply:enter', {
    projectId: pid,
    parentFlowId,
    childFlowId,
    taskInstanceId,
    subflowDisplayTitle,
    parentSubflowTaskRowId,
    linkedSubflow,
    shouldDeleteUnreferenced,
    skipMaterialization: !!skipMaterialization,
    skipStructuralPhase: !!skipStructuralPhase,
    secondPass: !!secondPass,
    hasStructuralMove: !!structuralMove,
    hasStructuralAppend: !!structuralAppend,
    extraCorpusChunksCount: extraCorpusChunks.length,
  });

  let flowsWorking: WorkspaceState['flows'] = flows;

  if (!skipStructuralPhase && structuralMove) {
    flowsWorking = moveTaskRowBetweenFlows(flowsWorking, {
      ...structuralMove,
      rowId: taskInstanceId,
    });
    logTaskSubflowMove('apply:structuralMoveEarly', { ...structuralMove, rowId: taskInstanceId });
  } else if (!skipStructuralPhase && structuralAppend) {
    const { targetFlowId, targetNodeId, row } = structuralAppend;
    flowsWorking = removeRowByIdFromFlow(flowsWorking, parentFlowId, taskInstanceId);
    flowsWorking = appendRowToFlowNode(flowsWorking, {
      targetFlowId,
      targetNodeId,
      row: row as Record<string, unknown>,
    });
    logTaskSubflowMove('apply:structuralAppendEarly', {
      parentFlowId,
      targetFlowId,
      targetNodeId,
      rowId: taskInstanceId,
    });
  }

  /** Always hydrate before reading task variables so merge sees rows even when structural phase was applied earlier (orchestrator pre-hydrates). */
  variableCreationService.hydrateVariablesFromFlow(pid, flowsWorking);
  logTaskSubflowMove('apply:hydrateVariablesFromFlowAfterStructural', {
    parentFlowId,
    childFlowId,
    taskInstanceId,
    skipStructuralPhase: !!skipStructuralPhase,
  });

  const allVars = variableCreationService.getAllVariables(pid) ?? [];
  const translationsInternal = translations
    ? compileTranslationsToInternalMap(translations, allVars)
    : undefined;

  const taskVars = variableCreationService.getVariablesByTaskInstanceId(pid, taskInstanceId);
  logTaskSubflowMove('apply:taskVariableRowsInStore', {
    taskInstanceId,
    count: taskVars.length,
    projectVariableCount: allVars.length,
    rows: taskVars.map((v) => ({
      id: v.id,
      varName: v.varName,
      scopeFlowId: v.scopeFlowId,
      taskInstanceId: v.taskInstanceId,
    })),
  });

  if (secondPass && taskVars.length > 0) {
    logTaskSubflowMove('apply:secondPass:enter', {
      taskInstanceId,
      taskVarCount: taskVars.length,
      childFlowId,
    });
  }

  const referencedInParent = collectReferencedVarIdsForParentFlowWorkspace({
    projectId: pid,
    parentFlowId,
    flows: flowsWorking,
    conditions,
    translationsInternal,
    projectData,
    useAllProjectConditionsForReferenceScan: false,
    extraCorpusChunks,
  });

  const taskVarIdSet = new Set(taskVars.map((v) => String(v.id || '').trim()));
  const referencedForMovedTask = [...referencedInParent].filter((id) => taskVarIdSet.has(id));
  const refSet = new Set(referencedForMovedTask);
  const unreferencedForMovedTask = [...taskVarIdSet].filter((id) => !refSet.has(id));

  logTaskSubflowMove('apply:referenceScan', {
    taskVarCount: taskVarIdSet.size,
    referencedCount: referencedForMovedTask.length,
    unreferencedCount: unreferencedForMovedTask.length,
    referencedVarIds: referencedForMovedTask,
    unreferencedVarIds: unreferencedForMovedTask,
  });

  let removedUnreferencedVariableRows = 0;
  if (shouldDeleteUnreferenced && unreferencedForMovedTask.length > 0) {
    removedUnreferencedVariableRows = variableCreationService.removeTaskVariableRowsForIds(
      pid,
      taskInstanceId,
      unreferencedForMovedTask
    );
    logTaskSubflowMove('apply:removedUnreferencedRows', {
      count: removedUnreferencedVariableRows,
      varIds: unreferencedForMovedTask,
    });
  }

  const renamed = restoreChildTaskBoundVariablesToLocalNames(pid, taskInstanceId, refSet).map((r) => ({
    id: r.id,
    previousName: r.previousName,
    nextName: r.nextName,
  }));

  const taskVarsAfterLocal = variableCreationService.getVariablesByTaskInstanceId(pid, taskInstanceId);

  if (renamed.length > 0) {
    logTaskSubflowMove('apply:childLocalRenames', { renamed });
  }

  let flowsNext: WorkspaceState['flows'] = { ...flowsWorking };
  let secondPassDisplayLabelUpdates = 0;
  let parentAutoRenames: ApplyTaskMoveToSubflowResult['parentAutoRenames'] = [];

  if (linkedSubflow) {
    const mergeOnlyVarIds: ReadonlySet<string> | undefined = exposeAll
      ? undefined
      : refSet.size > 0
        ? refSet
        : undefined;

    flowsNext = mergeChildFlowInterfaceOutputsForVariables(flowsNext, childFlowId, taskVarsAfterLocal, {
      onlyVarIds: mergeOnlyVarIds,
      projectId: pid,
    });

    const outSlice = flowsNext[childFlowId]?.meta as
      | { flowInterface?: { output?: unknown[] } }
      | undefined;
    const outputs = Array.isArray(outSlice?.flowInterface?.output)
      ? (outSlice!.flowInterface!.output as any[])
      : [];

    if (secondPass) {
      logTaskSubflowMove('apply:secondPass:mergeChildInterface', {
        exposedOutputCount: outputs.length,
        variableRefIdsInOutput: outputs
          .map((o: { variableRefId?: string }) => String(o?.variableRefId || '').trim())
          .filter(Boolean),
        mergeFilter: exposeAll ? 'all' : mergeOnlyVarIds ? [...mergeOnlyVarIds] : 'all_fallback',
        referencedInParentScan: [...refSet],
      });
    } else {
      logTaskSubflowMove('apply:mergeChildInterface', {
        exposedOutputCount: outputs.length,
        variableRefIdsInOutput: outputs
          .map((o: { variableRefId?: string }) => String(o?.variableRefId || '').trim())
          .filter(Boolean),
        mergeFilter: exposeAll ? 'all' : mergeOnlyVarIds ? [...mergeOnlyVarIds] : 'all_fallback',
        referencedInParentScan: [...refSet],
      });
    }

    const portalRowId = String(parentSubflowTaskRowId || '').trim();
    if (portalRowId) {
      const ok = autoFillSubflowBindingsForMovedTask({
        projectId: pid,
        parentFlowId,
        parentFlow: flowsNext[parentFlowId],
        childFlow: flowsNext[childFlowId],
        subflowTaskId: portalRowId,
        referencedVarIds: referencedForMovedTask,
      });
      logTaskSubflowMove('apply:autoFillSubflowBindings', {
        parentSubflowTaskRowId: portalRowId,
        ok,
        bindingCount: referencedForMovedTask.length,
      });

      flowsNext = mergeChildFlowInterfaceInputsFromSubflowPortal(flowsNext, pid, childFlowId, portalRowId);
    }

    const ar = autoRenameParentVariablesForMovedTask({
      projectId: pid,
      parentFlowId,
      parentFlow: flowsNext[parentFlowId],
      childFlow: flowsNext[childFlowId],
      subflowDisplayTitle,
      referencedVarIds: referencedForMovedTask,
    });
    parentAutoRenames = ar.renamed;
    logTaskSubflowMove('apply:autoRenameParentVariables', { count: parentAutoRenames.length });

    logTaskSubflowMove('apply:subflowS2Bindings', {
      parentSubflowTaskRowId,
      qualifiedSubflowTitle: subflowDisplayTitle,
    });

    invalidateChildFlowInterfaceCache(pid, childFlowId);
  } else {
    logTaskSubflowMove('apply:skipSubflowWiring', { reason: 'isLinkedSubflowMove false' });
  }

  const guidMappingParentSubflow = referencedForMovedTask.map((id) => ({ id }));

  let taskMaterialization: MaterializeMovedTaskSummary;
  if (skipMaterialization) {
    logTaskSubflowMove('apply:materializeSkipped', { reason: 'skipMaterialization' });
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
    logTaskSubflowMove('apply:materialize', {
      ok: mat.ok,
      parentFlowContainedRowBeforeStrip: mat.parentFlowContainedRowBeforeStrip,
      parentFlowContainsRowAfter: mat.parentFlowContainsRowAfter,
      childFlowContainsRow: mat.childFlowContainsRow,
      taskFoundInRepository: mat.taskFoundInRepository,
      repositoryPatchApplied: mat.repositoryPatchApplied,
      errorMessage: mat.errorMessage,
    });
  }

  logTaskSubflowMove('apply:done', {
    referencedVarIdsForMovedTask: referencedForMovedTask,
    unreferencedVarIdsForMovedTask: unreferencedForMovedTask,
    guidMappingCount: guidMappingParentSubflow.length,
    renamedCount: renamed.length,
    parentAutoRenameCount: parentAutoRenames.length,
    secondPassDisplayLabelUpdates,
    removedUnreferencedVariableRows,
    taskMaterializationOk: taskMaterialization.ok,
  });

  return {
    referencedVarIdsForMovedTask: referencedForMovedTask,
    unreferencedVarIdsForMovedTask: unreferencedForMovedTask,
    guidMappingParentSubflow,
    renamed,
    parentAutoRenames,
    removedUnreferencedVariableRows,
    taskMaterialization,
    secondPassDisplayLabelUpdates,
    flowsNext,
  };
}

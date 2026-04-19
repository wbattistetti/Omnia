/**
 * Canonical orchestrator: task → subflow move using the 14-function pipeline + structural/materialize glue.
 * @see ./pipeline/index.ts — Legacy reference: {@link applyTaskMoveToSubflowLegacy} in applyTaskMoveToSubflow.legacy.ts
 */

import type { VarId } from '@domain/guidModel/types';
import {
  childFlowExistingVarIdsFromProjectVariables,
  childRequiredVariablesFromReferencedTaskVariablesAndTaskVariables,
} from '@domain/taskMove/ChildRequiredVariables';
import { interfaceInputVarsFromChildRequiredVariables } from '@domain/taskMove/InterfaceInputVars';
import { referencedTaskVariablesForMovedTask } from '@domain/taskMove/ReferencedTaskVariables';
import { taskVariablesFromTaskVariableRows } from '@domain/taskMove/TaskVariables';
import type { WorkspaceState } from '@flows/FlowTypes';
import { logTaskSubflowMove, logTaskSubflowMoveTrace } from '@utils/taskSubflowMoveDebug';
import { logS2Diag } from '@utils/s2WiringDiagnostic';
import { getActiveDndOperationId, isDndOperationInstrumentEnabled } from '@utils/dndOperationInstrument';

import { createDefaultCacheAdapter } from './adapters/cacheAdapter';
import { createDefaultTaskRepositoryAdapter } from './adapters/taskRepositoryAdapter';
import { createDefaultVariableStoreAdapter } from './adapters/variableStoreAdapter';
import type {
  ApplyTaskMoveToSubflowParams,
  ApplyTaskMoveToSubflowResult,
  MaterializeMovedTaskSummary,
} from './applyTaskMoveToSubflowParams';
import { collectSayMessageTranslationKeysFromTask } from './collectSayMessageTranslationKeys';
import {
  collectReferencedVarIdsForParentFlowWorkspace,
  type ProjectConditionLike,
} from './collectReferencedVarIds';
import {
  CloneTranslations,
  CloneVariables,
  CreateInputBindings,
  CreateOutputBindings,
  GetSubTaskInstanceIds,
  GetTaskObjectGuids,
  GetTaskVariableIds,
  GetTranslations,
  BuildInputInterface,
  BuildOutputInterface,
  InvalidateChildInterfaceCache,
  RemoveTranslations,
  RemoveVariables,
  SetPrefixToTranslations,
} from './pipeline';
import { compileTranslationsToInternalMap } from './referenceScanCompile';
import { materializeMovedTaskForSubflow } from './materializeTaskInSubflow';
import { appendRowToFlowNode, moveTaskRowBetweenFlows, removeRowByIdFromFlow } from './moveTaskRowInFlows';
import { restoreChildTaskBoundVariablesToLocalNames } from './subflowVariableProxyRestore';
import { autoRenameReferencedVariablesForMovedTask } from './autoRenameParentVariables';
import {
  partitionMovedTaskVariableIdsByParentReference,
  wiringVariableIdsForSubflow,
} from './subflowMoveParentPolicy';
import { varTranslationKeysForIds } from './taskMoveTranslationPipeline';

export type { ApplyTaskMoveToSubflowParams, ApplyTaskMoveToSubflowResult, MaterializeMovedTaskSummary } from './applyTaskMoveToSubflowParams';

/** Re-export for tests and callers that import from this module. */
export { mergeChildFlowInterfaceOutputsForVariables } from './pipeline';

export type { ProjectConditionLike };

/**
 * Applies task → subflow move using the canonical pipeline (14 functions) and existing glue for graph / materialize.
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
    dndTraceId: dndTraceIdParam,
    operationId: operationIdParam,
  } = params;

  const traceId = String(dndTraceIdParam || '').trim();
  const operationIdForLog =
    String(operationIdParam || '').trim() || traceId || String(getActiveDndOperationId() || '').trim();

  const variableStore = createDefaultVariableStoreAdapter();
  const taskRepo = createDefaultTaskRepositoryAdapter();
  const cache = createDefaultCacheAdapter();

  const linkedSubflow = isLinkedSubflowMove !== false;
  const exposeAll = exposeAllTaskVariablesInChildInterface === true;
  const allowDeleteUnreferenced =
    !exposeAll && deleteUnreferencedTaskVariableRows !== false;

  const pid = String(projectId || '').trim();
  const parentFlow = flows[parentFlowId];

  if (!pid || !parentFlow) {
    logS2Diag('applyTaskMoveToSubflow', 'ABORT missing project or parent flow', {
      projectId: pid || '(empty)',
      parentFlowId,
      hasParentFlow: !!parentFlow,
    });
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

  logTaskSubflowMoveTrace('apply:enter', {
    dndTraceId: traceId || undefined,
    operationId: operationIdForLog || undefined,
    projectId: pid,
    parentFlowId,
    childFlowId,
    taskInstanceId,
    linkedSubflow,
    skipStructuralPhase: !!skipStructuralPhase,
    hasStructuralAppend: !!structuralAppend,
    hasStructuralMove: !!structuralMove,
  });

  if (structuralMove && structuralAppend) {
    throw new Error('applyTaskMoveToSubflow: use either structuralMove or structuralAppend, not both.');
  }

  const movedTask = taskRepo.getTask(taskInstanceId);
  SetPrefixToTranslations({ prefix: '', entries: {} });

  const extraCorpusChunks: string[] = [];

  logTaskSubflowMove('apply:enter', {
    projectId: pid,
    parentFlowId,
    childFlowId,
    taskInstanceId,
    subflowDisplayTitle,
    parentSubflowTaskRowId,
    linkedSubflow,
    exposeAll,
    allowDeleteUnreferenced,
    skipMaterialization: !!skipMaterialization,
    skipStructuralPhase: !!skipStructuralPhase,
    secondPass: !!secondPass,
    hasStructuralMove: !!structuralMove,
    hasStructuralAppend: !!structuralAppend,
    extraCorpusChunksCount: extraCorpusChunks.length,
    movedTaskInstanceIdForReferenceScan: taskInstanceId,
  });
  logS2Diag('applyTaskMoveToSubflow', 'enter', {
    projectId: pid,
    parentFlowId,
    childFlowId,
    taskInstanceId,
    parentSubflowTaskRowId: String(parentSubflowTaskRowId || '').trim() || '(EMPTY — binding/rename saltati)',
    linkedSubflow,
    exposeAll,
    skipStructuralPhase: !!skipStructuralPhase,
    skipMaterialization: !!skipMaterialization,
    secondPass: !!secondPass,
    structuralMove: structuralMove ?? null,
    structuralAppend: structuralAppend
      ? {
          targetFlowId: structuralAppend.targetFlowId,
          targetNodeId: structuralAppend.targetNodeId,
          rowId: (structuralAppend.row as { id?: string })?.id,
        }
      : null,
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
      row: row as unknown as Record<string, unknown>,
    });
    logTaskSubflowMove('apply:structuralAppendEarly', {
      parentFlowId,
      targetFlowId,
      targetNodeId,
      rowId: taskInstanceId,
    });
  }

  variableStore.hydrateVariablesFromFlow(pid, flowsWorking, { skipGlobalMerge: true });
  logTaskSubflowMove('apply:hydrateVariablesFromFlowAfterStructural', {
    parentFlowId,
    childFlowId,
    taskInstanceId,
    skipStructuralPhase: !!skipStructuralPhase,
  });

  GetSubTaskInstanceIds({ taskInstanceId, taskRepository: taskRepo });
  GetTaskObjectGuids({ taskInstanceId, taskRepository: taskRepo });

  const allVars = variableStore.getAllVariables(pid);
  const translationsInternal = translations
    ? compileTranslationsToInternalMap(translations, allVars)
    : undefined;

  const taskVars = variableStore.getVariablesByTaskInstanceId(pid, taskInstanceId);
  logTaskSubflowMove('apply:taskVariableRowsInStore', {
    taskInstanceId,
    count: taskVars.length,
    projectVariableCount: allVars.length,
    rows: taskVars.map((v) => ({
      id: v.id,
      scopeFlowId: v.scopeFlowId,
      taskInstanceId: v.taskInstanceId,
    })),
  });

  if (linkedSubflow && !secondPass && parentFlowId !== childFlowId) {
    const logical = GetTranslations({ movedTask, taskVariableRows: taskVars });
    if (logical.size > 0) {
      flowsWorking = CloneTranslations({
        flows: flowsWorking,
        parentFlowId,
        childFlowId,
        logicalKeys: logical,
      });
      logTaskSubflowMove('apply:cloneTranslationsToChild', {
        parentFlowId,
        childFlowId,
        keyCount: logical.size,
        messageKeyCount: collectSayMessageTranslationKeysFromTask(movedTask ?? undefined).length,
        varKeyCount: varTranslationKeysForIds(taskVars.map((v) => String(v.id || '').trim())).length,
      });
    }
  }

  const { mergedRows: taskVarsForS2Merge } = CloneVariables({
    projectId: pid,
    taskInstanceId,
    childFlowId,
    flows: flowsWorking,
    storeRows: taskVars,
    linkedSubflow,
    variableStore,
  });

  logS2Diag('applyTaskMoveToSubflow', 'after S2 variable set (store ∪ infer, replace)', {
    mergedCount: taskVarsForS2Merge.length,
    s2VarIdsSample: taskVarsForS2Merge.slice(0, 8).map((v) => v.id),
    childFlowSliceExists: !!flowsWorking[childFlowId],
  });
  if (linkedSubflow && taskVarsForS2Merge.length === 0) {
    logS2Diag(
      'applyTaskMoveToSubflow',
      'WARNING: zero task variables for S2 — interfaccia OUTPUT sarà vuota; verifica tipo task (utterance/classify) o hydrate',
      { taskInstanceId, childFlowId }
    );
  }

  if (secondPass && taskVarsForS2Merge.length > 0) {
    logTaskSubflowMove('apply:secondPass:enter', {
      taskInstanceId,
      taskVarCount: taskVarsForS2Merge.length,
      childFlowId,
    });
  }

  if (secondPass && isDndOperationInstrumentEnabled()) {
    console.log('[SecondPass]', {
      operationId: operationIdForLog || undefined,
      skipStructuralPhase: !!skipStructuralPhase,
      taskVariableRowsInStore: taskVars.length,
    });
  }

  const taskVarIdSet = GetTaskVariableIds({ mergedVariableRows: taskVarsForS2Merge });

  const referencedInParent = collectReferencedVarIdsForParentFlowWorkspace({
    projectId: pid,
    parentFlowId,
    flows: flowsWorking,
    conditions,
    translationsInternal,
    projectData,
    useAllProjectConditionsForReferenceScan: false,
    extraCorpusChunks,
    movedTaskInstanceIdForReferenceScan: taskInstanceId,
  });

  const {
    referencedForMovedTask: referencedVarIdsSorted,
    unreferencedForMovedTask,
    referencedSet: refSet,
  } = partitionMovedTaskVariableIdsByParentReference(taskVarIdSet, referencedInParent);

  logTaskSubflowMove('apply:referenceScan', {
    taskVarCount: taskVarIdSet.size,
    referencedCount: referencedVarIdsSorted.length,
    unreferencedCount: unreferencedForMovedTask.length,
    referencedVarIds: referencedVarIdsSorted,
    unreferencedVarIds: unreferencedForMovedTask,
  });

  let removedUnreferencedVariableRows = 0;
  if (allowDeleteUnreferenced && unreferencedForMovedTask.length > 0) {
    removedUnreferencedVariableRows = RemoveVariables({
      projectId: pid,
      taskInstanceId,
      unreferencedVarIds: unreferencedForMovedTask,
      variableStore,
    });
    logTaskSubflowMove('apply:removedUnreferencedRows', {
      count: removedUnreferencedVariableRows,
      varIds: unreferencedForMovedTask,
    });
  }

  const renamed = restoreChildTaskBoundVariablesToLocalNames(pid, taskInstanceId, taskVarIdSet, {
    operationId: operationIdForLog || traceId || undefined,
    subflowDisplayTitle: subflowDisplayTitle,
  }).map((r) => ({
    id: r.id,
    previousName: r.previousName,
    nextName: r.nextName,
  }));

  const s2TaskVarIds = taskVarsForS2Merge.map((v) => String(v.id || '').trim()).filter(Boolean).sort();
  const wiringVarIds = wiringVariableIdsForSubflow(s2TaskVarIds, referencedVarIdsSorted, exposeAll);

  if (isDndOperationInstrumentEnabled()) {
    console.log('[Subflow:referenceScan]', {
      operationId: operationIdForLog || undefined,
      referencedVarIdsSorted,
      s2TaskVarIds,
      exposeAll,
    });
    console.log('[Subflow:wiringVarIds]', {
      operationId: operationIdForLog || undefined,
      wiringVarIds,
    });
  }

  logTaskSubflowMoveTrace('apply:wiringPolicy', {
    dndTraceId: traceId || undefined,
    parentFlowId,
    taskInstanceId,
    exposeAll,
    s2TaskVarIds,
    referencedVarIdsSorted,
    referencedInParentCount: referencedVarIdsSorted.length,
    wiringVarIds,
    wiringVarCount: wiringVarIds.length,
    renamedFromChildLocalRestore: renamed.map((r) => ({ id: r.id, prev: r.previousName, next: r.nextName })),
  });

  if (renamed.length > 0) {
    logTaskSubflowMove('apply:childLocalRenames', { renamed });
  }

  let flowsNext: WorkspaceState['flows'] = { ...flowsWorking };
  let secondPassDisplayLabelUpdates = 0;
  let parentAutoRenames: ApplyTaskMoveToSubflowResult['parentAutoRenames'] = [];

  if (linkedSubflow) {
    flowsNext = BuildOutputInterface({
      flows: flowsNext,
      childFlowId,
      variables: taskVarsForS2Merge,
      onlyVarIds: exposeAll ? undefined : refSet,
      projectId: pid,
      parentFlowId,
    });

    const outSlice = flowsNext[childFlowId]?.meta as
      | { flowInterface?: { output?: unknown[] } }
      | undefined;
    const outputs = Array.isArray(outSlice?.flowInterface?.output)
      ? (outSlice!.flowInterface!.output as Array<{ variableRefId?: string }>)
      : [];

    const mergeFilterLabel = exposeAll ? 'all_task_variables_s2_legacy' : 'referenced_in_parent';

    if (secondPass) {
      logTaskSubflowMove('apply:secondPass:mergeChildInterface', {
        exposedOutputCount: outputs.length,
        variableRefIdsInOutput: outputs
          .map((o) => String(o?.variableRefId || '').trim())
          .filter(Boolean),
        mergeFilter: mergeFilterLabel,
        referencedInParentScanDiagnostic: [...refSet],
        s2TaskVarIds,
        wiringVarIds,
        exposeAll,
      });
    } else {
      logTaskSubflowMove('apply:mergeChildInterface', {
        exposedOutputCount: outputs.length,
        variableRefIdsInOutput: outputs
          .map((o) => String(o?.variableRefId || '').trim())
          .filter(Boolean),
        mergeFilter: mergeFilterLabel,
        referencedInParentScanDiagnostic: [...refSet],
        s2TaskVarIds,
        wiringVarIds,
        exposeAll,
      });
    }

    const portalRowId = String(parentSubflowTaskRowId || '').trim();
    if (!portalRowId) {
      logS2Diag(
        'applyTaskMoveToSubflow',
        'WARNING: parentSubflowTaskRowId vuoto — skip autoFill subflowBindings e merge INPUT da portale',
        { parentFlowId, childFlowId, taskInstanceId }
      );
    }
    if (portalRowId) {
      const ok = CreateOutputBindings({
        projectId: pid,
        parentFlowId,
        parentFlow: flowsNext[parentFlowId],
        childFlow: flowsNext[childFlowId],
        subflowTaskId: portalRowId,
        taskVariableIds: wiringVarIds,
      });
      CreateInputBindings({});
      logTaskSubflowMove('apply:autoFillSubflowBindings', {
        parentSubflowTaskRowId: portalRowId,
        ok,
        bindingCount: wiringVarIds.length,
      });
      logS2Diag('applyTaskMoveToSubflow', 'autoFillSubflowBindings result', {
        portalRowId,
        ok,
        taskVariableIdsCount: wiringVarIds.length,
      });

      const allVarsFresh = variableStore.getAllVariables(pid);
      const knownProjectVarIds = new Set(allVarsFresh.map((v) => String(v.id || '').trim()).filter(Boolean));
      const childFlowExistingVarIds = childFlowExistingVarIdsFromProjectVariables(allVarsFresh, childFlowId);
      const taskVariables = taskVariablesFromTaskVariableRows(taskVarsForS2Merge);
      const referencedTaskVariables = referencedTaskVariablesForMovedTask(taskInstanceId, knownProjectVarIds);
      const childRequiredVariables = childRequiredVariablesFromReferencedTaskVariablesAndTaskVariables(
        referencedTaskVariables,
        taskVariables,
        childFlowExistingVarIds
      );
      const stableOrderVarIds = (ids: Iterable<VarId>): VarId[] =>
        [...ids].map((x) => String(x)).sort() as VarId[];
      const interfaceInputVars = interfaceInputVarsFromChildRequiredVariables(
        childRequiredVariables,
        stableOrderVarIds
      );

      logTaskSubflowMove('apply:interfaceInputVarsDomain', {
        childRequiredCount: childRequiredVariables.size,
        interfaceInputVarIds: [...interfaceInputVars],
        childFlowExistingVarIdCount: childFlowExistingVarIds.size,
      });

      flowsNext = BuildInputInterface({
        flows: flowsNext,
        projectId: pid,
        childFlowId,
        interfaceInputVars,
        parentFlowId,
      });
      const inSlice = flowsNext[childFlowId]?.meta as { flowInterface?: { input?: unknown[] } } | undefined;
      const inputLen = Array.isArray(inSlice?.flowInterface?.input) ? inSlice!.flowInterface!.input.length : 0;
      logS2Diag('applyTaskMoveToSubflow', 'child flowInterface dopo merge OUTPUT+INPUT', {
        childFlowId,
        outputRows:
          (flowsNext[childFlowId]?.meta as { flowInterface?: { output?: unknown[] } } | undefined)?.flowInterface
            ?.output?.length ?? 0,
        inputRows: inputLen,
      });
    }

    const ar = autoRenameReferencedVariablesForMovedTask({
      projectId: pid,
      parentFlowId,
      parentFlow: flowsNext[parentFlowId],
      childFlow: flowsNext[childFlowId],
      subflowDisplayTitle,
      taskVariableIds: wiringVarIds,
      flows: flowsNext,
      dndTraceId: traceId || undefined,
      operationId: operationIdForLog || traceId || undefined,
    });
    flowsNext = ar.flowsNext;
    parentAutoRenames = ar.renamed;
    logTaskSubflowMove('apply:autoRenameParentVariables', { count: parentAutoRenames.length });
    logS2Diag('applyTaskMoveToSubflow', 'parent auto-rename (prefix.leaf)', {
      count: parentAutoRenames.length,
      renames: parentAutoRenames.map((r) => ({ id: r.id, prev: r.previousName, next: r.nextName })),
    });

    const sayKeysForRemoval = collectSayMessageTranslationKeysFromTask(movedTask ?? undefined);
    const removeKeys = new Set<string>([
      ...varTranslationKeysForIds(unreferencedForMovedTask),
      ...sayKeysForRemoval,
    ]);
    if (removeKeys.size > 0) {
      flowsNext = RemoveTranslations({
        flows: flowsNext,
        flowId: parentFlowId,
        keys: removeKeys,
      });
      logTaskSubflowMove('apply:removeTranslationKeysFromParent', {
        parentFlowId,
        keyCount: removeKeys.size,
        unreferencedVarCount: unreferencedForMovedTask.length,
        sayKeyCount: sayKeysForRemoval.length,
      });
    }

    logTaskSubflowMove('apply:subflowS2Bindings', {
      parentSubflowTaskRowId,
      qualifiedSubflowTitle: subflowDisplayTitle,
    });

    InvalidateChildInterfaceCache(cache, { projectId: pid, childFlowId });
  } else {
    logTaskSubflowMove('apply:skipSubflowWiring', { reason: 'isLinkedSubflowMove false' });
    logS2Diag('applyTaskMoveToSubflow', 'SKIP wiring S2 (isLinkedSubflowMove false) — niente merge interfaccia/binding/rename', {
      taskInstanceId,
      childFlowId,
    });
  }

  const guidMappingParentSubflow = wiringVarIds.map((id) => ({ id }));

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
    if (mat.errorMessage || !mat.ok) {
      logS2Diag('applyTaskMoveToSubflow', 'materialize FAILED o parziale — riga su child/parent o TaskRepository', {
        ok: mat.ok,
        errorMessage: mat.errorMessage ?? null,
        childFlowContainsRow: mat.childFlowContainsRow,
        parentFlowContainsRowAfter: mat.parentFlowContainsRowAfter,
        repositoryPatchApplied: mat.repositoryPatchApplied,
        taskFoundInRepository: mat.taskFoundInRepository,
      });
    }
  }

  logTaskSubflowMoveTrace('apply:summary', {
    dndTraceId: traceId || undefined,
    taskInstanceId,
    parentFlowId,
    childFlowId,
    referencedVarIdsForMovedTask: referencedVarIdsSorted,
    wiringVarIds,
    parentAutoRenames: parentAutoRenames.map((r) => ({
      id: r.id,
      previousName: r.previousName,
      nextName: r.nextName,
    })),
    childLocalRenames: renamed,
  });

  logTaskSubflowMove('apply:done', {
    referencedVarIdsForMovedTask: referencedVarIdsSorted,
    unreferencedVarIdsForMovedTask: unreferencedForMovedTask,
    guidMappingCount: guidMappingParentSubflow.length,
    renamedCount: renamed.length,
    parentAutoRenameCount: parentAutoRenames.length,
    secondPassDisplayLabelUpdates,
    removedUnreferencedVariableRows,
    taskMaterializationOk: taskMaterialization.ok,
  });
  logS2Diag('applyTaskMoveToSubflow', 'done (riepilogo)', {
    taskInstanceId,
    childFlowId,
    parentFlowId,
    s2OutputVarCount: s2TaskVarIds.length,
    parentAutoRenames: parentAutoRenames.length,
    materializeOk: taskMaterialization.ok,
    materializeError: taskMaterialization.errorMessage ?? null,
  });

  return {
    referencedVarIdsForMovedTask: referencedVarIdsSorted,
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

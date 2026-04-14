/**
 * LEGACY implementation of task → subflow move (pre-canonical pipeline).
 * Kept for golden-test parity and regression comparison; not used by production entry point.
 * @see applyTaskMoveToSubflow in applyTaskMoveToSubflow.ts (canonical orchestrator)
 */

import { uniqueWireKeyFromLabel } from '@components/FlowMappingPanel/flowInterfaceDragTypes';
import { createFlowInterfaceMappingEntry, type MappingEntry } from '@components/FlowMappingPanel/mappingTypes';
import type { VarId } from '@domain/guidModel/types';
import { labelKey } from '@domain/guidModel/labelKey';
import {
  childFlowExistingVarIdsFromProjectVariables,
  childRequiredVariablesFromReferencedTaskVariablesAndTaskVariables,
} from '@domain/taskMove/ChildRequiredVariables';
import { interfaceInputVarsFromChildRequiredVariables } from '@domain/taskMove/InterfaceInputVars';
import { referencedTaskVariablesForMovedTask } from '@domain/taskMove/ReferencedTaskVariables';
import { taskVariablesFromTaskVariableRows } from '@domain/taskMove/TaskVariables';
import type { WorkspaceState } from '@flows/FlowTypes';
import { stripLegacyVariablesFromFlowMeta } from '../../flows/flowMetaSanitize';
import type { VariableInstance } from '@types/variableTypes';
import { invalidateChildFlowInterfaceCache } from '@services/childFlowInterfaceService';
import { taskRepository } from '@services/TaskRepository';
import { variableCreationService } from '@services/VariableCreationService';
import { getProjectTranslationsTable } from '@utils/projectTranslationsRegistry';
import { leafLabelForNewInterfaceOutputRow } from '@utils/resolveVariableDisplayName';
import { isUuidString, makeTranslationKey } from '@utils/translationKeys';
import { logTaskSubflowMove } from '@utils/taskSubflowMoveDebug';
import { logS2Diag } from '@utils/s2WiringDiagnostic';
import type { NodeRowData } from '@types/project';

import { collectSayMessageTranslationKeysFromTask } from './collectSayMessageTranslationKeys';
import {
  collectReferencedVarIdsForParentFlowWorkspace,
  type ProjectConditionLike,
} from './collectReferencedVarIds';
import {
  CloneTranslationsCollisionError,
  buildTranslationKeysForTaskMove,
  cloneTranslationsToChild,
  removeTranslationKeysFromFlowSlice,
  varTranslationKeysForIds,
} from './taskMoveTranslationPipeline';
import { compileTranslationsToInternalMap } from './referenceScanCompile';
import { materializeMovedTaskForSubflow } from './materializeTaskInSubflow';
import { appendRowToFlowNode, moveTaskRowBetweenFlows, removeRowByIdFromFlow } from './moveTaskRowInFlows';
import { restoreChildTaskBoundVariablesToLocalNames } from './subflowVariableProxyRestore';
import { autoFillSubflowBindingsForMovedTask } from './autoFillSubflowBindings';
import { autoRenameReferencedVariablesForMovedTask } from './autoRenameParentVariables';
import {
  inferTaskVariableInstancesForSubflowInterfaceMerge,
  mergeVariableRowsByIdPreferStore,
} from './inferTaskVariableInstancesForSubflowMerge';
import type {
  ApplyTaskMoveToSubflowParams,
  ApplyTaskMoveToSubflowResult,
  MaterializeMovedTaskSummary,
} from './applyTaskMoveToSubflowParams';

export type { ApplyTaskMoveToSubflowParams, ApplyTaskMoveToSubflowResult, MaterializeMovedTaskSummary };

/**
 * @deprecated Use canonical pipeline via applyTaskMoveToSubflow; retained for golden tests only.
 */
export function applyTaskMoveToSubflowLegacy(params: ApplyTaskMoveToSubflowParams): ApplyTaskMoveToSubflowResult {
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
  if (structuralMove && structuralAppend) {
    throw new Error('applyTaskMoveToSubflow: use either structuralMove or structuralAppend, not both.');
  }

  const movedTask = taskRepository.getTask(taskInstanceId);
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
      row: row as Record<string, unknown>,
    });
    logTaskSubflowMove('apply:structuralAppendEarly', {
      parentFlowId,
      targetFlowId,
      targetNodeId,
      rowId: taskInstanceId,
    });
  }

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
      scopeFlowId: v.scopeFlowId,
      taskInstanceId: v.taskInstanceId,
    })),
  });

  if (linkedSubflow && !secondPass && parentFlowId !== childFlowId) {
    const logical = buildTranslationKeysForTaskMove(movedTask ?? undefined, taskVars);
    if (logical.size > 0) {
      try {
        flowsWorking = cloneTranslationsToChild(flowsWorking, parentFlowId, childFlowId, logical);
        logTaskSubflowMove('apply:cloneTranslationsToChild', {
          parentFlowId,
          childFlowId,
          keyCount: logical.size,
          messageKeyCount: collectSayMessageTranslationKeysFromTask(movedTask ?? undefined).length,
          varKeyCount: varTranslationKeysForIds(taskVars.map((v) => String(v.id || '').trim())).length,
        });
      } catch (e) {
        if (e instanceof CloneTranslationsCollisionError) {
          logTaskSubflowMove('apply:cloneTranslationsToChild:collision', {
            childFlowId: e.childFlowId,
            keys: e.keys,
          });
        }
        throw e;
      }
    }
  }

  const inferredForS2 = linkedSubflow
    ? inferTaskVariableInstancesForSubflowInterfaceMerge(taskInstanceId, childFlowId, flowsWorking)
    : [];
  let taskVarsForS2Merge = mergeVariableRowsByIdPreferStore(taskVars, inferredForS2);
  if (linkedSubflow && inferredForS2.length > 0 && taskVars.length < taskVarsForS2Merge.length) {
    logTaskSubflowMove('apply:mergedInferWithStoreForS2', {
      taskInstanceId,
      storeCount: taskVars.length,
      inferredCount: inferredForS2.length,
      mergedCount: taskVarsForS2Merge.length,
    });
  }
  if (linkedSubflow && taskVarsForS2Merge.length > 0) {
    variableCreationService.replaceTaskVariableRowsForInstance(pid, taskInstanceId, taskVarsForS2Merge, flowsWorking);
    taskVarsForS2Merge = variableCreationService.getVariablesByTaskInstanceId(pid, taskInstanceId);
  }
  logS2Diag('applyTaskMoveToSubflow', 'after S2 variable set (store ∪ infer, replace)', {
    inferredCount: inferredForS2.length,
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

  const taskVarIdSet = new Set(taskVarsForS2Merge.map((v) => String(v.id || '').trim()));
  const referencedForMovedTask = [...referencedInParent].filter((id) => taskVarIdSet.has(id));
  const refSet = new Set(referencedForMovedTask);
  const referencedVarIdsSorted = [...referencedForMovedTask].sort();
  const unreferencedForMovedTask = [...taskVarIdSet].filter((id) => !refSet.has(id));

  logTaskSubflowMove('apply:referenceScan', {
    taskVarCount: taskVarIdSet.size,
    referencedCount: referencedForMovedTask.length,
    unreferencedCount: unreferencedForMovedTask.length,
    referencedVarIds: referencedForMovedTask,
    unreferencedVarIds: unreferencedForMovedTask,
  });

  let removedUnreferencedVariableRows = 0;
  if (allowDeleteUnreferenced && unreferencedForMovedTask.length > 0) {
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

  const renamed = restoreChildTaskBoundVariablesToLocalNames(pid, taskInstanceId, taskVarIdSet).map((r) => ({
    id: r.id,
    previousName: r.previousName,
    nextName: r.nextName,
  }));

  const s2TaskVarIds = taskVarsForS2Merge.map((v) => String(v.id || '').trim()).filter(Boolean).sort();
  const wiringVarIds = exposeAll ? s2TaskVarIds : referencedVarIdsSorted;

  if (renamed.length > 0) {
    logTaskSubflowMove('apply:childLocalRenames', { renamed });
  }

  let flowsNext: WorkspaceState['flows'] = { ...flowsWorking };
  let secondPassDisplayLabelUpdates = 0;
  let parentAutoRenames: ApplyTaskMoveToSubflowResult['parentAutoRenames'] = [];

  if (linkedSubflow) {
    flowsNext = mergeChildFlowInterfaceOutputsForVariablesLegacy(flowsNext, childFlowId, taskVarsForS2Merge, {
      onlyVarIds: exposeAll ? undefined : refSet,
      projectId: pid,
      parentFlowId,
    });

    const outSlice = flowsNext[childFlowId]?.meta as
      | { flowInterface?: { output?: unknown[] } }
      | undefined;
    const outputs = Array.isArray(outSlice?.flowInterface?.output)
      ? (outSlice!.flowInterface!.output as any[])
      : [];

    const mergeFilterLabel = exposeAll ? 'all_task_variables_s2_legacy' : 'referenced_in_parent';

    if (secondPass) {
      logTaskSubflowMove('apply:secondPass:mergeChildInterface', {
        exposedOutputCount: outputs.length,
        variableRefIdsInOutput: outputs
          .map((o: { variableRefId?: string }) => String(o?.variableRefId || '').trim())
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
          .map((o: { variableRefId?: string }) => String(o?.variableRefId || '').trim())
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
      const ok = autoFillSubflowBindingsForMovedTask({
        projectId: pid,
        parentFlowId,
        parentFlow: flowsNext[parentFlowId],
        childFlow: flowsNext[childFlowId],
        subflowTaskId: portalRowId,
        taskVariableIds: wiringVarIds,
      });
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

      const allVarsFresh = variableCreationService.getAllVariables(pid) ?? [];
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

      flowsNext = mergeChildFlowInterfaceInputsFromInterfaceInputVarsLegacy(
        flowsNext,
        pid,
        childFlowId,
        interfaceInputVars,
        { parentFlowId }
      );
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
      flowsNext = removeTranslationKeysFromFlowSlice(flowsNext, parentFlowId, removeKeys);
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

    invalidateChildFlowInterfaceCache(pid, childFlowId);
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

/** @deprecated Legacy duplicate; canonical implementation: BuildOutputInterface / mergeChildFlowInterfaceOutputsForVariables in pipeline. */
export function mergeChildFlowInterfaceOutputsForVariablesLegacy(
  flows: WorkspaceState['flows'],
  childFlowId: string,
  variables: VariableInstance[],
  options?: { onlyVarIds?: ReadonlySet<string>; projectId?: string; parentFlowId?: string }
): WorkspaceState['flows'] {
  const flow = flows[childFlowId];
  if (!flow) {
    logS2Diag('mergeChildInterfaceOutput', 'SKIP: child flow slice mancante in flows', { childFlowId });
    return flows;
  }
  if (variables.length === 0) {
    logS2Diag('mergeChildInterfaceOutput', 'WARNING: variables[] vuoto — nessuna riga OUTPUT aggiunta', {
      childFlowId,
    });
  }
  const only = options?.onlyVarIds;
  const vars =
    only === undefined
      ? variables
      : only.size > 0
        ? variables.filter((v) => only.has(String(v.id || '').trim()))
        : [];
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

  const labelOpts = {
    parentFlowId: options?.parentFlowId,
    compiledProjectTranslations: getProjectTranslationsTable(),
  };

  for (const v of vars) {
    const vid = String(v.id || '').trim();
    if (!vid || seen.has(vid)) continue;
    const labelText = leafLabelForNewInterfaceOutputRow(vid, childFlowId, flows, tr, labelOpts);
    const wireKey = uniqueWireKeyFromLabel(
      labelText,
      prev.map((row) => {
        const r = row as { id?: string; wireKey?: string };
        return { id: String(r.id || ''), wireKey: String(r.wireKey || '') };
      }),
      ''
    );
    const labelKey = isUuidString(vid) ? makeTranslationKey('var', vid) : undefined;
    prev.push(
      createFlowInterfaceMappingEntry({
        variableRefId: vid,
        wireKey,
        ...(labelKey ? { labelKey } : {}),
      })
    );
    if (labelKey) {
      tr[labelKey] = labelText;
    }
    seen.add(vid);
    logTaskSubflowMove('merge:interfaceOutputRow', {
      childFlowId,
      variableRefId: vid,
      resolvedLabel: labelText,
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

function mergeChildFlowInterfaceInputsFromInterfaceInputVarsLegacy(
  flows: WorkspaceState['flows'],
  projectId: string,
  childFlowId: string,
  interfaceInputVars: readonly VarId[],
  options?: { parentFlowId?: string }
): WorkspaceState['flows'] {
  const pid = String(projectId || '').trim();
  const cid = String(childFlowId || '').trim();
  if (!pid || !cid) return flows;

  const flow = flows[cid];
  if (!flow) {
    logS2Diag('mergeChildInterfaceInput', 'SKIP: child flow slice mancante', { childFlowId: cid });
    return flows;
  }

  const meta = { ...(flow.meta || {}) } as {
    flowInterface?: { input?: unknown[]; output?: unknown[] };
    translations?: Record<string, string>;
  };
  const fi = { ...(meta.flowInterface || {}) };
  const prevOut = Array.isArray(fi.output) ? [...fi.output] : [];
  const tr: Record<string, string> = {
    ...(typeof meta.translations === 'object' && meta.translations ? meta.translations : {}),
  };
  const prevIn: unknown[] = [];
  const seen = new Set<string>();

  const labelOptsIn = {
    parentFlowId: options?.parentFlowId,
    compiledProjectTranslations: getProjectTranslationsTable(),
  };

  for (const vidRaw of interfaceInputVars) {
    const vid = String(vidRaw || '').trim();
    if (!vid || seen.has(vid)) continue;
    seen.add(vid);

    const labelText = leafLabelForNewInterfaceOutputRow(vid, cid, flows, tr, labelOptsIn);
    const wireKey = uniqueWireKeyFromLabel(
      labelText,
      prevIn.map((row) => {
        const r = row as { id?: string; wireKey?: string };
        return { id: String(r.id || ''), wireKey: String(r.wireKey || '') };
      }),
      ''
    );
    const labelKeyStr = isUuidString(vid) ? labelKey(vid as VarId) : undefined;
    prevIn.push(
      createFlowInterfaceMappingEntry({
        variableRefId: vid,
        wireKey,
        ...(labelKeyStr ? { labelKey: labelKeyStr } : {}),
      })
    );
    if (labelKeyStr) {
      tr[labelKeyStr] = labelText;
    }
  }

  const nextFlow = {
    ...flow,
    meta: stripLegacyVariablesFromFlowMeta({
      ...meta,
      translations: tr,
      flowInterface: {
        input: prevIn,
        output: prevOut,
      },
    }) as (typeof flow)['meta'],
    hasLocalChanges: true,
  };
  return { ...flows, [cid]: nextFlow };
}

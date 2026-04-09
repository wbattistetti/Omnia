/**
 * Single entry point for structural mutations: deterministic pipeline (graph → reconcile variables → apply wiring).
 * UI and TaskRepository must dispatch commands here instead of calling hydrate / applyTaskMoveToSubflow directly.
 */

import type { WorkspaceState } from '@flows/FlowTypes';
import { TaskType } from '@types/taskTypes';
import { applyTaskMoveToSubflow, type ApplyTaskMoveToSubflowResult } from '@domain/taskSubflowMove/applyTaskMoveToSubflow';
import type { ProjectConditionLike } from '@domain/taskSubflowMove/collectReferencedVarIds';
import {
  findParentFlowIdContainingSubflowRow,
  parseSubflowTaskRowIdFromChildCanvasId,
} from '@domain/taskSubflowMove/subflowParentLookup';
import { getSubflowSyncFlows, getSubflowSyncTranslations, upsertFlowSlicesFromSubflowSync } from '@domain/taskSubflowMove/subflowSyncFlowsRef';
import { registerSubflowWiringSecondPass } from '@domain/taskSubflowMove/subflowWiringAfterVariableStore';
import { executeSubflowWiringSecondPassCore } from './subflowWiringSecondPassCore';
import { variableCreationService } from '@services/VariableCreationService';
import { logTaskSubflowMove } from '@utils/taskSubflowMoveDebug';
import { logStructuralOrchestratorCommitSnapshot } from '@utils/flowStructuralCommitDiagnostic';
import { logSubflowSliceMutation } from '@utils/subflowCanvasDebug';
import { affectedTaskFlowPairs } from './affectedTasks';
import { emptyRepositoryPlan } from './planRepositoryMutation';
import { applyAppendTaskRowIntoSubflowGraph } from './planGraphMutation';
import { reconcileUtteranceVariableStoreWithFlowGraph } from './reconcileVariableStore';
import { enqueueStructuralForProject } from './structuralQueue';
import { assertVariableStoreCoherent } from './invariantChecks';
import type {
  MoveTaskRowCommand,
  MoveTaskRowToCanvasCommand,
  MoveTaskRowIntoSubflowCommand,
  ResyncSubflowInterfaceCommand,
  StructuralCommand,
  SubflowWiringSecondPassCommand,
} from './commands';
import { moveTaskRowBetweenFlows } from './planGraphMutation';
import { taskRepository } from '@services/TaskRepository';

export type StructuralOrchestratorContext = {
  projectId: string;
  getFlows: () => WorkspaceState['flows'];
  /** Push updated slices into FlowStore */
  commitFlowSlices: (flowsNext: WorkspaceState['flows'], flowIds: string[]) => void;
  projectData?: unknown;
  getTranslations?: () => Record<string, string> | undefined;
};

function flattenProjectConditions(projectData: unknown): ProjectConditionLike[] {
  const conditions = (projectData as { conditions?: Array<{ items?: unknown[] }> })?.conditions || [];
  const out: ProjectConditionLike[] = [];
  for (const cat of conditions) {
    for (const item of cat.items || []) {
      const it = item as { id?: string; _id?: string; expression?: ProjectConditionLike['expression'] };
      const cid = String(it.id || it._id || '').trim();
      if (!cid) continue;
      out.push({ id: cid, expression: it.expression });
    }
  }
  return out;
}

function emitVariableStoreUpdated(): void {
  try {
    document.dispatchEvent(new CustomEvent('variableStore:updated', { bubbles: true }));
  } catch {
    /* noop */
  }
}

function logPipeline(step: string, command: StructuralCommand): void {
  logTaskSubflowMove(`orchestrator:${step}`, {
    commandType: command.type,
    commandId: command.commandId,
    source: command.source,
  });
}

function buildMinimalStructuralApplyResult(
  flowsNext: WorkspaceState['flows'],
  taskInstanceId: string
): ApplyTaskMoveToSubflowResult {
  const tid = String(taskInstanceId || '').trim();
  return {
    referencedVarIdsForMovedTask: [],
    unreferencedVarIdsForMovedTask: [],
    guidMappingParentSubflow: [],
    renamed: [],
    parentAutoRenames: [],
    removedUnreferencedVariableRows: 0,
    taskMaterialization: {
      ok: true,
      parentFlowContainedRowBeforeStrip: false,
      parentFlowContainsRowAfter: false,
      childFlowContainsRow: true,
      taskFoundInRepository: !!taskRepository.getTask(tid),
      repositoryPatchApplied: false,
    },
    secondPassDisplayLabelUpdates: 0,
    flowsNext,
  };
}

function runMoveTaskRow(ctx: StructuralOrchestratorContext, command: MoveTaskRowCommand): ApplyTaskMoveToSubflowResult {
  const pid = String(ctx.projectId || '').trim();
  const rowId = String(command.rowId || '').trim();
  const fromF = String(command.fromFlowId || '').trim();
  const toF = String(command.toFlowId || '').trim();
  const fromN = String(command.fromNodeId || '').trim();
  const toN = String(command.toNodeId || '').trim();

  logPipeline('moveTaskRow:begin', command);

  if (!pid || !rowId || !fromF || !toF || !fromN || !toN) {
    logTaskSubflowMove('orchestrator:moveTaskRow:abort', { reason: 'missing_ids', command });
    return buildMinimalStructuralApplyResult(ctx.getFlows(), rowId);
  }

  const flows0 = ctx.getFlows();
  const flowsWorking = moveTaskRowBetweenFlows(flows0, {
    sourceFlowId: fromF,
    targetFlowId: toF,
    sourceNodeId: fromN,
    targetNodeId: toN,
    rowId,
  });

  emptyRepositoryPlan();
  reconcileUtteranceVariableStoreWithFlowGraph(pid, flowsWorking);
  emitVariableStoreUpdated();

  const needsLinkedSubflowApply = toF.startsWith('subflow_');

  if (!needsLinkedSubflowApply) {
    const ids = Array.from(new Set([fromF, toF].filter(Boolean)));
    logStructuralOrchestratorCommitSnapshot('runMoveTaskRow:doneNoSubflowApply', flowsWorking, ids);
    ctx.commitFlowSlices(flowsWorking, ids);
    logPipeline('moveTaskRow:doneNoSubflowApply', command);
    return buildMinimalStructuralApplyResult(flowsWorking, rowId);
  }

  const childFlowId = toF;
  const portalRowId = parseSubflowTaskRowIdFromChildCanvasId(childFlowId);
  if (!portalRowId) {
    logStructuralOrchestratorCommitSnapshot('runMoveTaskRow:noPortalRowId', flowsWorking, [fromF, toF]);
    ctx.commitFlowSlices(flowsWorking, [fromF, toF]);
    logTaskSubflowMove('orchestrator:moveTaskRow:noPortalRowId', { childFlowId });
    return buildMinimalStructuralApplyResult(flowsWorking, rowId);
  }

  const parentFlowId = findParentFlowIdContainingSubflowRow(flowsWorking, portalRowId) || 'main';
  const childSlice = flowsWorking[childFlowId];
  const subflowDisplayTitle = String((childSlice as { title?: string })?.title || '').trim() || 'Subflow';

  const conditions = flattenProjectConditions(ctx.projectData);
  const translationsRaw = ctx.getTranslations?.();
  const translationsArg =
    translationsRaw && Object.keys(translationsRaw).length > 0 ? translationsRaw : undefined;

  let result = applyTaskMoveToSubflow({
    projectId: pid,
    parentFlowId,
    childFlowId,
    taskInstanceId: rowId,
    subflowDisplayTitle,
    parentSubflowTaskRowId: portalRowId,
    flows: flowsWorking,
    conditions,
    translations: translationsArg,
    projectData: ctx.projectData,
    skipStructuralPhase: true,
    isLinkedSubflowMove: true,
  });

  if (variableCreationService.getVariablesByTaskInstanceId(pid, rowId).length === 0) {
    const flushed = registerSubflowWiringSecondPass({
      projectId: pid,
      parentFlowId,
      childFlowId,
      taskInstanceId: rowId,
      subflowDisplayTitle,
      parentSubflowTaskRowId: portalRowId,
      conditions,
      translations: translationsArg,
      projectData: ctx.projectData,
    });
    if (flushed) result = flushed;
  }

  for (const pair of affectedTaskFlowPairs(command)) {
    if (pair.flowId) {
      try {
        assertVariableStoreCoherent(pid, pair.taskInstanceId, pair.flowId, result.flowsNext);
      } catch (e) {
        if (import.meta.env.DEV) console.warn('[StructuralOrchestrator]', e);
      }
    }
  }

  const sliceIdsForCommit = Array.from(
    new Set(
      [fromF, toF, parentFlowId, childFlowId]
        .map((x) => String(x || '').trim())
        .filter(Boolean)
    )
  );
  logStructuralOrchestratorCommitSnapshot('runMoveTaskRow:subflowApply', result.flowsNext, sliceIdsForCommit);
  ctx.commitFlowSlices(result.flowsNext, sliceIdsForCommit);
  logSubflowSliceMutation('AFTER', childFlowId, result.flowsNext);
  logPipeline('moveTaskRow:done', command);
  return result;
}

function runMoveTaskRowToCanvas(ctx: StructuralOrchestratorContext, command: MoveTaskRowToCanvasCommand): ApplyTaskMoveToSubflowResult {
  const pid = String(ctx.projectId || '').trim();
  const rowId = String(command.rowId || '').trim();
  const fromF = String(command.fromFlowId || '').trim();
  const toF = String(command.toFlowId || '').trim();
  const fromN = String(command.fromNodeId || '').trim();
  const newNodeId = String(command.newNodeId || '').trim();
  const pos = command.position;

  logPipeline('moveTaskRowToCanvas:begin', command);

  if (
    !pid ||
    !rowId ||
    !fromF ||
    !toF ||
    !fromN ||
    !newNodeId ||
    pos == null ||
    typeof pos.x !== 'number' ||
    typeof pos.y !== 'number'
  ) {
    logTaskSubflowMove('orchestrator:moveTaskRowToCanvas:abort', { reason: 'missing_ids', command });
    return buildMinimalStructuralApplyResult(ctx.getFlows(), rowId);
  }

  const flows0 = ctx.getFlows();
  const flowsWorking = moveTaskRowBetweenFlows(flows0, {
    sourceFlowId: fromF,
    targetFlowId: toF,
    sourceNodeId: fromN,
    targetNodeId: newNodeId,
    rowId,
    createTargetNodeIfMissing: { x: pos.x, y: pos.y },
  });

  emptyRepositoryPlan();
  reconcileUtteranceVariableStoreWithFlowGraph(pid, flowsWorking);
  emitVariableStoreUpdated();

  const needsLinkedSubflowApply = toF.startsWith('subflow_');

  if (!needsLinkedSubflowApply) {
    const ids = Array.from(new Set([fromF, toF].filter(Boolean)));
    logStructuralOrchestratorCommitSnapshot('runMoveTaskRowToCanvas:doneNoSubflowApply', flowsWorking, ids);
    ctx.commitFlowSlices(flowsWorking, ids);
    logPipeline('moveTaskRowToCanvas:doneNoSubflowApply', command);
    return buildMinimalStructuralApplyResult(flowsWorking, rowId);
  }

  const childFlowId = toF;
  const portalRowId = parseSubflowTaskRowIdFromChildCanvasId(childFlowId);
  if (!portalRowId) {
    logStructuralOrchestratorCommitSnapshot('runMoveTaskRowToCanvas:noPortalRowId', flowsWorking, [fromF, toF]);
    ctx.commitFlowSlices(flowsWorking, [fromF, toF]);
    logTaskSubflowMove('orchestrator:moveTaskRowToCanvas:noPortalRowId', { childFlowId });
    return buildMinimalStructuralApplyResult(flowsWorking, rowId);
  }

  const parentFlowId = findParentFlowIdContainingSubflowRow(flowsWorking, portalRowId) || 'main';
  const childSlice = flowsWorking[childFlowId];
  const subflowDisplayTitle = String((childSlice as { title?: string })?.title || '').trim() || 'Subflow';

  const conditions = flattenProjectConditions(ctx.projectData);
  const translationsRaw = ctx.getTranslations?.();
  const translationsArg =
    translationsRaw && Object.keys(translationsRaw).length > 0 ? translationsRaw : undefined;

  let result = applyTaskMoveToSubflow({
    projectId: pid,
    parentFlowId,
    childFlowId,
    taskInstanceId: rowId,
    subflowDisplayTitle,
    parentSubflowTaskRowId: portalRowId,
    flows: flowsWorking,
    conditions,
    translations: translationsArg,
    projectData: ctx.projectData,
    skipStructuralPhase: true,
    isLinkedSubflowMove: true,
  });

  if (variableCreationService.getVariablesByTaskInstanceId(pid, rowId).length === 0) {
    const flushed = registerSubflowWiringSecondPass({
      projectId: pid,
      parentFlowId,
      childFlowId,
      taskInstanceId: rowId,
      subflowDisplayTitle,
      parentSubflowTaskRowId: portalRowId,
      conditions,
      translations: translationsArg,
      projectData: ctx.projectData,
    });
    if (flushed) result = flushed;
  }

  for (const pair of affectedTaskFlowPairs(command)) {
    if (pair.flowId) {
      try {
        assertVariableStoreCoherent(pid, pair.taskInstanceId, pair.flowId, result.flowsNext);
      } catch (e) {
        if (import.meta.env.DEV) console.warn('[StructuralOrchestrator]', e);
      }
    }
  }

  logStructuralOrchestratorCommitSnapshot('runMoveTaskRowToCanvas:subflowApply', result.flowsNext, [parentFlowId, childFlowId]);
  ctx.commitFlowSlices(result.flowsNext, [parentFlowId, childFlowId]);
  logSubflowSliceMutation('AFTER', childFlowId, result.flowsNext);
  logPipeline('moveTaskRowToCanvas:done', command);
  return result;
}

/**
 * Default context for TaskRepository / second-pass handlers (uses subflow sync refs).
 */
export function createDefaultStructuralOrchestratorContext(projectId: string): StructuralOrchestratorContext {
  const pid = String(projectId || '').trim();
  return {
    projectId: pid,
    getFlows: getSubflowSyncFlows,
    commitFlowSlices: upsertFlowSlicesFromSubflowSync,
    projectData: typeof window !== 'undefined' ? (window as unknown as { __projectData?: unknown }).__projectData : undefined,
    getTranslations: () => getSubflowSyncTranslations(),
  };
}

function runMoveTaskRowIntoSubflow(
  ctx: StructuralOrchestratorContext,
  command: MoveTaskRowIntoSubflowCommand
): ApplyTaskMoveToSubflowResult {
  const pid = String(ctx.projectId || '').trim();
  logPipeline('pipeline:1-begin', command);
  const flows0 = ctx.getFlows();
  logSubflowSliceMutation('BEFORE', command.childFlowId, flows0);

  logPipeline('pipeline:2-3-graph', command);
  const flowsWorking = applyAppendTaskRowIntoSubflowGraph(flows0, {
    parentFlowId: command.parentFlowId,
    childFlowId: command.childFlowId,
    targetNodeId: command.targetNodeId,
    taskInstanceId: command.rowId,
    row: command.rowData,
  });

  logPipeline('pipeline:4-repositoryPlan', command);
  emptyRepositoryPlan();

  logPipeline('pipeline:6-reconcileVariables', command);
  reconcileUtteranceVariableStoreWithFlowGraph(pid, flowsWorking);
  emitVariableStoreUpdated();

  const conditions = flattenProjectConditions(ctx.projectData);
  const translationsRaw = ctx.getTranslations?.();
  const translationsArg =
    translationsRaw && Object.keys(translationsRaw).length > 0 ? translationsRaw : undefined;

  logPipeline('pipeline:7-8-applyWiring', command);
  let result = applyTaskMoveToSubflow({
    projectId: pid,
    parentFlowId: command.parentFlowId,
    childFlowId: command.childFlowId,
    taskInstanceId: command.rowId,
    subflowDisplayTitle: command.subflowDisplayTitle,
    parentSubflowTaskRowId: command.parentSubflowTaskRowId,
    flows: flowsWorking,
    conditions,
    translations: translationsArg,
    projectData: ctx.projectData,
    skipStructuralPhase: true,
  });

  const taskRowId = command.rowId;
  let flushed: ApplyTaskMoveToSubflowResult | null = null;
  if (variableCreationService.getVariablesByTaskInstanceId(pid, taskRowId).length === 0) {
    flushed = registerSubflowWiringSecondPass({
      projectId: pid,
      parentFlowId: command.parentFlowId,
      childFlowId: command.childFlowId,
      taskInstanceId: taskRowId,
      subflowDisplayTitle: command.subflowDisplayTitle,
      parentSubflowTaskRowId: command.parentSubflowTaskRowId,
      conditions,
      translations: translationsArg,
      projectData: ctx.projectData,
    });
  }
  if (flushed) {
    result = flushed;
    logTaskSubflowMove('orchestrator:secondPassFlush', { taskInstanceId: taskRowId });
  }

  logPipeline('pipeline:9-invariants', command);
  for (const pair of affectedTaskFlowPairs(command)) {
    if (pair.flowId) {
      try {
        assertVariableStoreCoherent(pid, pair.taskInstanceId, pair.flowId, result.flowsNext);
      } catch (e) {
        if (import.meta.env.DEV) console.warn('[StructuralOrchestrator]', e);
      }
    }
  }

  logStructuralOrchestratorCommitSnapshot('runMoveTaskRowIntoSubflow', result.flowsNext, [command.parentFlowId, command.childFlowId]);
  ctx.commitFlowSlices(result.flowsNext, [command.parentFlowId, command.childFlowId]);
  logPipeline('pipeline:10-finalize', command);
  logSubflowSliceMutation('AFTER', command.childFlowId, result.flowsNext);
  return result;
}

function runResyncSubflowInterface(
  ctx: StructuralOrchestratorContext,
  command: ResyncSubflowInterfaceCommand
): (ApplyTaskMoveToSubflowResult & { parentFlowId: string; childFlowId: string }) | null {
  const pid = String(ctx.projectId || '').trim();
  const tid = String(command.taskInstanceId || '').trim();
  const next = String(command.authoringFlowCanvasId || '').trim();
  if (!pid || !tid) return null;
  if (command.taskType === TaskType.Subflow) return null;
  if (!next.startsWith('subflow_')) return null;

  const portalRowId = parseSubflowTaskRowIdFromChildCanvasId(next);
  if (!portalRowId) return null;

  const flows = ctx.getFlows();
  const parentFlowId = findParentFlowIdContainingSubflowRow(flows, portalRowId) || 'main';
  const childFlowId = next;

  if (!flows[parentFlowId] || !flows[childFlowId]) return null;

  logPipeline('resync:begin', command);
  const childSlice = flows[childFlowId];
  const subflowDisplayTitle = String((childSlice as { title?: string })?.title || '').trim() || 'Subflow';
  const translations = ctx.getTranslations?.();
  const translationsArg =
    translations && Object.keys(translations).length > 0 ? translations : undefined;
  const conditions = flattenProjectConditions(ctx.projectData);
  const exposeAll = !!command.exposeAllTaskVariablesInChildInterface;

  logSubflowSliceMutation('BEFORE', childFlowId, flows);
  reconcileUtteranceVariableStoreWithFlowGraph(pid, flows);
  emitVariableStoreUpdated();

  const first = applyTaskMoveToSubflow({
    projectId: pid,
    parentFlowId,
    childFlowId,
    taskInstanceId: tid,
    subflowDisplayTitle,
    parentSubflowTaskRowId: portalRowId,
    flows,
    conditions,
    translations: translationsArg,
    projectData: ctx.projectData,
    skipMaterialization: true,
    exposeAllTaskVariablesInChildInterface: exposeAll,
  });

  reconcileUtteranceVariableStoreWithFlowGraph(pid, first.flowsNext);
  emitVariableStoreUpdated();

  const flushed = registerSubflowWiringSecondPass({
    projectId: pid,
    parentFlowId,
    childFlowId,
    taskInstanceId: tid,
    subflowDisplayTitle,
    parentSubflowTaskRowId: portalRowId,
    conditions,
    translations: translationsArg,
    projectData: ctx.projectData,
    exposeAllTaskVariablesInChildInterface: exposeAll,
  });
  const out = flushed ?? first;
  logStructuralOrchestratorCommitSnapshot('runResyncSubflowInterface', out.flowsNext, [parentFlowId, childFlowId]);
  ctx.commitFlowSlices(out.flowsNext, [parentFlowId, childFlowId]);
  logSubflowSliceMutation('AFTER', childFlowId, out.flowsNext);
  return { ...out, parentFlowId, childFlowId };
}

function runSubflowWiringSecondPass(
  ctx: StructuralOrchestratorContext,
  command: SubflowWiringSecondPassCommand
): ApplyTaskMoveToSubflowResult | null {
  const pid = String(ctx.projectId || '').trim();
  const tid = String(command.taskInstanceId || '').trim();
  logPipeline('secondPass:begin', command);
  const flows = ctx.getFlows();
  const result = executeSubflowWiringSecondPassCore(flows, ctx.commitFlowSlices, {
    projectId: pid,
    parentFlowId: command.parentFlowId,
    childFlowId: command.childFlowId,
    taskInstanceId: tid,
    subflowDisplayTitle: command.subflowDisplayTitle,
    parentSubflowTaskRowId: command.parentSubflowTaskRowId,
    conditions: flattenProjectConditions(ctx.projectData),
    translations: ctx.getTranslations?.(),
    projectData: ctx.projectData,
    exposeAllTaskVariablesInChildInterface: command.exposeAllTaskVariablesInChildInterface,
  });
  if (result) {
    logTaskSubflowMove('orchestrator:secondPass:done', { taskInstanceId: tid });
  }
  return result;
}

function executeStructuralCommandImpl(
  ctx: StructuralOrchestratorContext,
  command: StructuralCommand
):
  | ApplyTaskMoveToSubflowResult
  | (ApplyTaskMoveToSubflowResult & { parentFlowId: string; childFlowId: string })
  | null
  | void {
  logPipeline('begin', command);
  try {
    switch (command.type) {
      case 'moveTaskRowIntoSubflow':
        return runMoveTaskRowIntoSubflow(ctx, command);
      case 'resyncSubflowInterface':
        return runResyncSubflowInterface(ctx, command);
      case 'subflowWiringSecondPass':
        return runSubflowWiringSecondPass(ctx, command);
      case 'moveTaskRow':
        return runMoveTaskRow(ctx, command);
      case 'moveTaskRowToCanvas':
        return runMoveTaskRowToCanvas(ctx, command);
      case 'createSubflow':
      case 'duplicateTask':
      case 'switchAuthoringCanvas':
        throw new Error(`[StructuralOrchestrator] command not implemented: ${command.type}`);
      default: {
        const _exhaustive: never = command;
        return _exhaustive;
      }
    }
  } finally {
    logPipeline('end', command);
  }
}

/**
 * Synchronous pipeline (TaskRepository, portal handler). Prefer this when callers need an immediate result.
 */
export function runStructuralCommandSync(
  ctx: StructuralOrchestratorContext,
  command: StructuralCommand
):
  | ApplyTaskMoveToSubflowResult
  | (ApplyTaskMoveToSubflowResult & { parentFlowId: string; childFlowId: string })
  | null
  | void {
  return executeStructuralCommandImpl(ctx, command);
}

/**
 * Same pipeline, serialized per project via a FIFO queue (async boundary).
 */
export function runStructuralCommand(
  ctx: StructuralOrchestratorContext,
  command: StructuralCommand
): Promise<
  | ApplyTaskMoveToSubflowResult
  | (ApplyTaskMoveToSubflowResult & { parentFlowId: string; childFlowId: string })
  | null
  | void
> {
  return enqueueStructuralForProject(ctx.projectId, () => Promise.resolve(executeStructuralCommandImpl(ctx, command)));
}

/** UI / TaskRepository: same as {@link runStructuralCommandSync} — explicit command dispatch. */
export const dispatchStructuralCommand = runStructuralCommandSync;

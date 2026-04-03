/**
 * Defers subflow interface merge + bindings to a second applyTaskMoveToSubflow pass when the variable
 * store is still empty after the first pass. Flushes when document `variableStore:updated` fires (emitted
 * after FlowCanvasHost / VariableCreationService hydrate) and taskInstanceId has variable rows.
 */

import { variableCreationService } from '@services/VariableCreationService';
import { logTaskSubflowMove } from '@utils/taskSubflowMoveDebug';
import { applyTaskMoveToSubflow, type ApplyTaskMoveToSubflowResult } from './applyTaskMoveToSubflow';
import type { ProjectConditionLike } from './collectReferencedVarIds';
import { getSubflowSyncFlows, upsertFlowSlicesFromSubflowSync } from './subflowSyncFlowsRef';

export type SubflowWiringSecondPassRequest = {
  projectId: string;
  parentFlowId: string;
  childFlowId: string;
  taskInstanceId: string;
  subflowDisplayTitle: string;
  parentSubflowTaskRowId: string;
  conditions?: ProjectConditionLike[];
  projectData?: unknown;
  translations?: Record<string, string>;
};

const pending = new Map<string, SubflowWiringSecondPassRequest>();
const flushing = new Set<string>();

let listenerAttached = false;

function onVariableStoreUpdated(): void {
  for (const tid of [...pending.keys()]) {
    const req = pending.get(tid);
    if (req) void tryFlushSubflowSecondPassForTask(req.projectId, tid);
  }
}

function ensureListener(): void {
  if (listenerAttached || typeof document === 'undefined') return;
  listenerAttached = true;
  document.addEventListener('variableStore:updated', onVariableStoreUpdated);
}

/**
 * Call after a linked-subflow first pass when task variable rows were not in the store yet.
 * A later `variableStore:updated` (or immediate tryFlush if rows already exist) runs wiring only.
 * @returns the second-pass apply result if the store already had variables and a flush ran, else null.
 */
export function registerSubflowWiringSecondPass(
  req: SubflowWiringSecondPassRequest
): ApplyTaskMoveToSubflowResult | null {
  const tid = String(req.taskInstanceId || '').trim();
  if (!tid) return null;
  ensureListener();
  pending.set(tid, { ...req });
  logTaskSubflowMove('subflowSecondPass:registered', { taskInstanceId: tid, childFlowId: req.childFlowId });
  return tryFlushSubflowSecondPassForTask(req.projectId, tid);
}

export function unregisterSubflowWiringSecondPass(taskInstanceId: string): void {
  pending.delete(String(taskInstanceId || '').trim());
}

/**
 * Runs the second pass if this task is pending and the variable store now has rows for it.
 * Used by the variableStore:updated listener and can be invoked right after register.
 * @returns the apply result when a second pass ran, otherwise null.
 */
export function tryFlushSubflowSecondPassForTask(
  projectId: string,
  taskInstanceId: string
): ApplyTaskMoveToSubflowResult | null {
  const pid = String(projectId || '').trim();
  const tid = String(taskInstanceId || '').trim();
  if (!pid || !tid) return null;
  const req = pending.get(tid);
  if (!req) return null;
  if (flushing.has(tid)) return null;

  const vars = variableCreationService.getVariablesByTaskInstanceId(pid, tid);
  if (vars.length === 0) return null;

  const flows = getSubflowSyncFlows();
  if (!flows[req.parentFlowId] || !flows[req.childFlowId]) {
    logTaskSubflowMove('subflowSecondPass:flushSkipped', {
      reason: 'missing_flow_slices',
      taskInstanceId: tid,
      hasParent: !!flows[req.parentFlowId],
      hasChild: !!flows[req.childFlowId],
    });
    return null;
  }

  flushing.add(tid);
  try {
    const result = applyTaskMoveToSubflow({
      projectId: pid,
      parentFlowId: req.parentFlowId,
      childFlowId: req.childFlowId,
      taskInstanceId: tid,
      subflowDisplayTitle: req.subflowDisplayTitle,
      parentSubflowTaskRowId: req.parentSubflowTaskRowId,
      flows,
      conditions: req.conditions,
      translations: req.translations,
      projectData: req.projectData,
      skipStructuralPhase: true,
      skipMaterialization: true,
      isLinkedSubflowMove: true,
      secondPass: true,
    });

    upsertFlowSlicesFromSubflowSync(result.flowsNext, [req.parentFlowId, req.childFlowId]);
    pending.delete(tid);
    logTaskSubflowMove('subflowSecondPass:done', {
      taskInstanceId: tid,
      referencedCount: result.referencedVarIdsForMovedTask.length,
      exposedOutputs:
        (result.flowsNext[req.childFlowId]?.meta as { flowInterface?: { output?: unknown[] } } | undefined)
          ?.flowInterface?.output?.length ?? 0,
    });
    return result;
  } catch (e) {
    console.error('[subflowWiringAfterVariableStore] second pass failed', e);
    return null;
  } finally {
    flushing.delete(tid);
  }
}

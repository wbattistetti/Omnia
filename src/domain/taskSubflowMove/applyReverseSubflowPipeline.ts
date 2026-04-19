/**
 * S2 reverse pipeline: when a task row moves from a `subflow_*` canvas back to a non-subflow slice,
 * merges parent proxy variables (A) into child canonical ids (B) using only `subflowBindings` on the
 * portal Subflow task, then cleans child interface + portal bindings.
 *
 * @see StructuralOrchestrator — runs after `moveTaskRowBetweenFlows`, before variable store reconcile.
 */

import type { WorkspaceState } from '@flows/FlowTypes';
import { TaskType, type Task } from '@types/taskTypes';
import { stripLegacyVariablesFromFlowMeta } from '@flows/flowMetaSanitize';
import { taskRepository } from '@services/TaskRepository';
import { variableCreationService } from '@services/VariableCreationService';
import { isUuidString, makeTranslationKey } from '@utils/translationKeys';
import { logTaskSubflowMove, logTaskSubflowMoveTrace } from '@utils/taskSubflowMoveDebug';
import { logS2Diag } from '@utils/s2WiringDiagnostic';

import { findParentFlowIdContainingSubflowRow, parseSubflowTaskRowIdFromChildCanvasId } from './subflowParentLookup';
import { removeTranslationKeysFromFlowSlice, varTranslationKeysForIds } from './taskMoveTranslationPipeline';

export type ApplyReverseSubflowPipelineParams = {
  projectId: string;
  flows: WorkspaceState['flows'];
  /** Child canvas id (`subflow_<portalRowId>`). */
  fromFlowId: string;
  /** Target canvas (non-subflow). */
  toFlowId: string;
  movedTaskId: string;
  /** Optional: mutate condition expressions in place (same reference as orchestrator context). */
  projectData?: unknown;
  /** Correlates with structural `moveTaskRow` / DnD trace. */
  dndTraceId?: string;
};

export type BindingPair = { parentVarId: string; childVarId: string };

export type ApplyReverseSubflowPipelineResult = {
  flowsNext: WorkspaceState['flows'];
  pairs: BindingPair[];
  replacedParentProxyIds: string[];
  clearedPortalBindings: boolean;
};

const SUBFLOW_PREFIX = 'subflow_';

/** True when structural move exits a subflow canvas toward a normal flow slice. */
export function isReverseSubflowMove(fromFlowId: string, toFlowId: string): boolean {
  const fromF = String(fromFlowId || '').trim();
  const toF = String(toFlowId || '').trim();
  return fromF.startsWith(SUBFLOW_PREFIX) && !toF.startsWith(SUBFLOW_PREFIX);
}

function replaceGuidStringsDeep<T>(value: T, replacements: ReadonlyMap<string, string>): T {
  if (value === null || value === undefined) return value;
  if (typeof value === 'string') {
    let s = value;
    for (const [from, to] of replacements) {
      if (!from || from === to) continue;
      if (s === from) return to as T;
      if (s.includes(from)) s = s.split(from).join(to);
    }
    return s as T;
  }
  if (typeof value !== 'object') return value;
  if (Array.isArray(value)) {
    return value.map((x) => replaceGuidStringsDeep(x, replacements)) as T;
  }
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
    out[k] = replaceGuidStringsDeep(v, replacements);
  }
  return out as T;
}

function collectTaskRowIdsFromFlowSlice(flowSlice: WorkspaceState['flows'][string] | undefined): string[] {
  const ids: string[] = [];
  const nodes = (flowSlice?.nodes || []) as Array<{ data?: { rows?: unknown[] } }>;
  for (const node of nodes) {
    const rows = Array.isArray(node?.data?.rows) ? node.data!.rows! : [];
    for (const row of rows) {
      if ((row as { included?: boolean }).included === false) continue;
      const id = String((row as { id?: string }).id || '').trim();
      if (id) ids.push(id);
    }
  }
  return ids;
}

function mergeTranslationsBWinParent(
  flows: WorkspaceState['flows'],
  parentFlowId: string,
  childFlowId: string,
  childVarIds: ReadonlySet<string>
): WorkspaceState['flows'] {
  const parent = flows[parentFlowId];
  const child = flows[childFlowId];
  if (!parent?.meta || !child?.meta) return flows;
  const childTr =
    typeof child.meta.translations === 'object' && child.meta.translations
      ? (child.meta.translations as Record<string, string>)
      : {};
  const parentTr = {
    ...(typeof parent.meta.translations === 'object' && parent.meta.translations
      ? (parent.meta.translations as Record<string, string>)
      : {}),
  };
  let changed = false;
  for (const vid of childVarIds) {
    if (!isUuidString(vid)) continue;
    try {
      const k = makeTranslationKey('var', vid);
      const cv = childTr[k];
      if (cv !== undefined && String(cv).trim() !== '') {
        parentTr[k] = String(cv);
        changed = true;
      }
    } catch {
      /* skip invalid guid */
    }
  }
  if (!changed) return flows;
  const nextMeta = stripLegacyVariablesFromFlowMeta({
    ...(parent.meta || {}),
    translations: parentTr,
  }) as typeof parent.meta;
  return {
    ...flows,
    [parentFlowId]: { ...parent, meta: nextMeta, hasLocalChanges: true },
  };
}

function mutateProjectConditions(projectData: unknown, replacements: ReadonlyMap<string, string>): void {
  const pd = projectData as { conditions?: Array<{ items?: unknown[] }> } | null | undefined;
  if (!pd?.conditions) return;
  for (const cat of pd.conditions) {
    for (const item of cat.items || []) {
      const it = item as { expression?: unknown };
      if (it.expression !== undefined) {
        it.expression = replaceGuidStringsDeep(it.expression, replacements);
      }
    }
  }
}

function stripChildInterfaceRowsForVarRefs(
  flows: WorkspaceState['flows'],
  childFlowId: string,
  varRefIds: ReadonlySet<string>
): WorkspaceState['flows'] {
  const flow = flows[childFlowId];
  if (!flow) return flows;
  const meta = { ...(flow.meta || {}) } as {
    flowInterface?: { input?: unknown[]; output?: unknown[] };
    translations?: Record<string, string>;
  };
  const fi = { ...(meta.flowInterface || {}) };
  const filterRows = (rows: unknown[] | undefined): unknown[] => {
    if (!Array.isArray(rows)) return [];
    return rows.filter((r) => !varRefIds.has(String((r as { variableRefId?: string }).variableRefId || '').trim()));
  };
  const output = filterRows(fi.output as unknown[]);
  const input = filterRows(fi.input as unknown[]);
  const nextMeta = stripLegacyVariablesFromFlowMeta({
    ...meta,
    flowInterface: {
      input,
      output,
    },
  }) as typeof flow.meta;
  return {
    ...flows,
    [childFlowId]: { ...flow, meta: nextMeta, hasLocalChanges: true },
  };
}

function remainingChildInterfaceVarRefs(flows: WorkspaceState['flows'], childFlowId: string): Set<string> {
  const flow = flows[childFlowId];
  const out = new Set<string>();
  const meta = flow?.meta as { flowInterface?: { input?: unknown[]; output?: unknown[] } } | undefined;
  const scan = (rows: unknown[] | undefined) => {
    if (!Array.isArray(rows)) return;
    for (const r of rows) {
      const id = String((r as { variableRefId?: string }).variableRefId || '').trim();
      if (id) out.add(id);
    }
  };
  scan(meta?.flowInterface?.output);
  scan(meta?.flowInterface?.input);
  return out;
}

/**
 * Applies reverse subflow wiring after a row has been moved onto `toFlowId` (parent canvas).
 */
export function applyReverseSubflowPipeline(params: ApplyReverseSubflowPipelineParams): ApplyReverseSubflowPipelineResult {
  const pid = String(params.projectId || '').trim();
  const fromF = String(params.fromFlowId || '').trim();
  const toF = String(params.toFlowId || '').trim();
  const movedTaskId = String(params.movedTaskId || '').trim();

  logTaskSubflowMoveTrace('reverse:enter', {
    dndTraceId: String(params.dndTraceId || '').trim() || undefined,
    fromFlowId: fromF,
    toFlowId: toF,
    movedTaskId,
  });

  const empty: ApplyReverseSubflowPipelineResult = {
    flowsNext: params.flows,
    pairs: [],
    replacedParentProxyIds: [],
    clearedPortalBindings: false,
  };

  if (!pid || !fromF || !toF || !movedTaskId || !isReverseSubflowMove(fromF, toF)) {
    return empty;
  }

  const portalRowId = parseSubflowTaskRowIdFromChildCanvasId(fromF);
  if (!portalRowId) {
    logS2Diag('applyReverseSubflowPipeline', 'skip: no portal row id from child canvas id', { fromF });
    return empty;
  }

  const portalTask = taskRepository.getTask(portalRowId);
  if (!portalTask || portalTask.type !== TaskType.Subflow) {
    logTaskSubflowMove('reverse:skip', { reason: 'portal_task_missing_or_not_subflow', portalRowId });
    return empty;
  }

  const rawBindings = Array.isArray(portalTask.subflowBindings) ? portalTask.subflowBindings : [];
  const pairs: BindingPair[] = rawBindings
    .map((b) => ({
      parentVarId: String(b?.parentVariableId || '').trim(),
      childVarId: String(b?.interfaceParameterId || '').trim(),
    }))
    .filter((p) => p.parentVarId && p.childVarId);

  if (pairs.length === 0) {
    logTaskSubflowMove('reverse:noBindingRows', { portalRowId, movedTaskId });
    taskRepository.updateTask(movedTaskId, { authoringFlowCanvasId: toF }, pid, {
      merge: true,
      skipSubflowInterfaceSync: true,
    });
    return { ...empty, flowsNext: params.flows };
  }

  const replacementMap = new Map<string, string>();
  const replacedParentProxyIds: string[] = [];
  for (const p of pairs) {
    if (p.parentVarId !== p.childVarId) {
      replacementMap.set(p.parentVarId, p.childVarId);
      replacedParentProxyIds.push(p.parentVarId);
    }
  }

  let flowsNext: WorkspaceState['flows'] = { ...params.flows };

  const childVarIdsForMerge = new Set(pairs.map((p) => p.childVarId));
  flowsNext = mergeTranslationsBWinParent(flowsNext, toF, fromF, childVarIdsForMerge);

  const parentSlice = flowsNext[toF];
  if (parentSlice) {
    flowsNext = {
      ...flowsNext,
      [toF]: {
        ...parentSlice,
        ...replaceGuidStringsDeep(parentSlice, replacementMap),
        hasLocalChanges: true,
      },
    };
  }

  const taskIdsToPatch = new Set<string>([...collectTaskRowIdsFromFlowSlice(flowsNext[toF]), portalRowId]);
  for (const tid of taskIdsToPatch) {
    if (tid === portalRowId) continue;
    const t = taskRepository.getTask(tid);
    if (!t) continue;
    const cloned =
      typeof structuredClone !== 'undefined' ? structuredClone(t) : (JSON.parse(JSON.stringify(t)) as Task);
    const nextDoc = replaceGuidStringsDeep(cloned, replacementMap);
    taskRepository.overwriteTaskDocument(tid, nextDoc);
  }

  if (replacementMap.size > 0) {
    mutateProjectConditions(params.projectData, replacementMap);
  }

  const keysToRemoveParent = new Set<string>();
  for (const p of pairs) {
    if (p.parentVarId === p.childVarId) continue;
    for (const k of varTranslationKeysForIds([p.parentVarId])) {
      keysToRemoveParent.add(k);
    }
  }
  if (keysToRemoveParent.size > 0) {
    flowsNext = removeTranslationKeysFromFlowSlice(flowsNext, toF, keysToRemoveParent);
  }

  const proxyIdsToDrop = pairs.filter((p) => p.parentVarId !== p.childVarId).map((p) => p.parentVarId);
  if (proxyIdsToDrop.length > 0) {
    variableCreationService.removeVariableRowsByGuids(pid, proxyIdsToDrop);
  }

  const distinctChildVarIds = [...new Set(pairs.map((p) => p.childVarId))];
  for (const targetId of distinctChildVarIds) {
    variableCreationService.retargetVariableRowScope(pid, targetId, {
      scopeFlowId: toF,
      taskInstanceId: movedTaskId,
      clearSubflowAutoRenameLock: true,
    });
  }

  const strippedChildVarIds = new Set(pairs.map((x) => x.childVarId));
  flowsNext = stripChildInterfaceRowsForVarRefs(flowsNext, fromF, strippedChildVarIds);

  const remainingIface = remainingChildInterfaceVarRefs(flowsNext, fromF);
  const filteredBindings = rawBindings.filter((b) => {
    const c = String(b?.interfaceParameterId || '').trim();
    return c && remainingIface.has(c);
  });

  let clearedPortalBindings = false;
  if (filteredBindings.length === 0) {
    clearedPortalBindings = taskRepository.clearSubflowS2BindingFields(portalRowId);
  } else {
    taskRepository.updateTask(
      portalRowId,
      {
        subflowBindingsSchemaVersion: 1,
        subflowBindings: filteredBindings,
      },
      pid,
      { merge: true, skipSubflowInterfaceSync: true }
    );
  }

  taskRepository.updateTask(
    movedTaskId,
    { authoringFlowCanvasId: toF },
    pid,
    { merge: true, skipSubflowInterfaceSync: true }
  );

  logTaskSubflowMove('reverse:done', {
    fromFlowId: fromF,
    toFlowId: toF,
    movedTaskId,
    pairCount: pairs.length,
    replacedProxies: replacedParentProxyIds.length,
    clearedPortalBindings,
  });
  logS2Diag('applyReverseSubflowPipeline', 'done', {
    portalRowId,
    pairs: pairs.length,
    replacedProxies: replacedParentProxyIds.length,
  });

  return {
    flowsNext,
    pairs,
    replacedParentProxyIds,
    clearedPortalBindings,
  };
}

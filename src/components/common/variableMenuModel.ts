/**
 * Builds variable picker items for the active flow using the same visibility rules as
 * {@link variableCreationService.getVariablesForFlowScope} (via shared per-flow scoping).
 *
 * Phase 1: utterance locals are a pure GUID filter — {@link collectUtteranceNodeGuidSetForFlow} ∩ in-memory store.
 * This module must not create or mutate utterance variables (no sync/ensure).
 */
import { TaskType, isUtteranceInterpretationTask, type TaskTreeNode } from '../../types/taskTypes';
import { taskRepository } from '../../services/TaskRepository';
import { buildStandaloneTaskTreeView } from '../../utils/buildStandaloneTaskTreeView';
import { getMainNodes } from '@responseEditor/core/domain';
import { variableCreationService } from '../../services/VariableCreationService';
import type { WorkspaceState } from '../../flows/FlowTypes';
import type { VariableInstance } from '../../types/variableTypes';
import type { MappingEntry } from '../FlowMappingPanel/mappingTypes';
import { loadFlow } from '../../flows/FlowPersistence';
import {
  fetchChildFlowInterfaceOutputs,
  invalidateChildFlowInterfaceCache,
} from '../../services/childFlowInterfaceService';
import { isVariableMenuDebugEnabled, logVariableMenuDebug } from '../../utils/variableMenuDebug';
import { subflowInterfaceOutputMappingKey } from './subflowVariableMappingKey';
import {
  getTaskInstanceIdsOnFlowCanvas,
  getTaskInstanceIdsOnFlowCanvasFromFlows,
  isVariableVisibleInFlow,
} from '../../utils/variableScopeUtils';
import { getActiveFlowMetaTranslationsFlattened } from '../../utils/activeFlowTranslations';
import { getProjectTranslationsTable } from '../../utils/projectTranslationsRegistry';
import { resolveVariableDisplayName } from '../../utils/resolveVariableDisplayName';
import { stripLegacyVariablesFromFlowMeta } from '../../flows/flowMetaSanitize';

/**
 * Optional overrides when building picker items.
 * Pass {@link ProjectTranslationsContextType.compiledTranslations} (global + flow `meta.translations`),
 * not raw global-only `translations`, so `var:<guid>` labels on the canvas resolve in the menu.
 */
export type BuildVariableMenuItemsOptions = {
  translationsByGuid?: Record<string, string> | null;
};

export type VariableMenuItem = {
  /** Variable row GUID (= TaskTreeNode.id for task-bound). */
  id: string;
  varLabel: string;
  tokenLabel: string;
  ownerFlowId: string;
  ownerFlowTitle: string;
  isExposed: boolean;
  isFromActiveFlow: boolean;
  sourceTaskRowLabel?: string;
  /** Subflow task row id in the parent flow (interface outputs only). */
  subflowTaskId?: string;
  /** Present when this item is a parent var resolved from a bound subflow output (still tagged with `subflowTaskId` for per-row menus). */
  resolvedFromSubflowOutputBinding?: boolean;
  /** Legacy: unbound child interface output; S2 move auto-fills `subflowBindings` for referenced vars. */
  isInterfaceUnbound?: boolean;
  /**
   * Interface row has no child variable GUID yet (`variableRefId` absent).
   * Shown in the picker; inserting a token requires wiring the interface first.
   */
  missingChildVariableRef?: boolean;
};

/** Delegates to shared child-flow interface cache (see childFlowInterfaceService). */
export function invalidateInterfaceOutputCache(projectId?: string, childFlowId?: string): void {
  invalidateChildFlowInterfaceCache(projectId, childFlowId);
}

function extractRows(node: any): any[] {
  const rows = node?.data?.rows;
  return Array.isArray(rows) ? rows : [];
}

function collectTaskIdsForFlow(flowId: string, flows: WorkspaceState['flows']): Set<string> {
  const out = new Set<string>();
  const flow = flows[flowId];
  if (!flow) return out;
  for (const node of flow.nodes || []) {
    for (const row of extractRows(node)) {
      const taskId = String(row?.id || '').trim();
      if (taskId) out.add(taskId);
    }
  }
  return out;
}

function walkTaskTreeNodeIds(node: TaskTreeNode, out: Set<string>): void {
  const id = String(node?.id || '').trim();
  if (id) out.add(id);
  for (const sub of node.subNodes || []) {
    walkTaskTreeNodeIds(sub, out);
  }
}

/**
 * GUIDs for every TaskTreeNode under utterance-like tasks included on the flow canvas.
 * Utterance menu items are {@link VariableInstance.id} values present in this set (memory is authoritative).
 */
export function collectUtteranceNodeGuidSetForFlow(
  flowId: string,
  flows: WorkspaceState['flows'] | null | undefined
): Set<string> {
  const guidSet = new Set<string>();
  const fid = String(flowId ?? '').trim();
  if (!fid || !flows?.[fid]) return guidSet;
  const flow = flows[fid];
  for (const graphNode of flow.nodes || []) {
    for (const row of extractRows(graphNode)) {
      if ((row as { included?: boolean }).included === false) continue;
      const taskId = String((row as { id?: string }).id || '').trim();
      if (!taskId) continue;
      const task = taskRepository.getTask(taskId);
      if (!task) continue;
      const utteranceLike =
        isUtteranceInterpretationTask(task) || task.type === TaskType.ClassifyProblem;
      if (!utteranceLike) continue;
      const tree = buildStandaloneTaskTreeView(task);
      if (!tree) continue;
      const roots = getMainNodes(tree);
      for (const root of roots) walkTaskTreeNodeIds(root, guidSet);
    }
  }
  return guidSet;
}

function isUtteranceLikeTaskInstance(taskInstanceId: string): boolean {
  const task = taskRepository.getTask(String(taskInstanceId || '').trim());
  return !!(
    task &&
    (isUtteranceInterpretationTask(task) || task.type === TaskType.ClassifyProblem)
  );
}

/**
 * Utterance-bound variables: only those whose id is in `utteranceGuidSet`.
 * Other locals: existing visibility rules, excluding utterance-task rows not in the current tree GUID set.
 */
function filterLocalVariablesForActiveFlow(
  allVars: VariableInstance[],
  activeFlowId: string,
  flows: WorkspaceState['flows'],
  utteranceGuidSet: Set<string>
): VariableInstance[] {
  const utteranceVars = allVars.filter((v) =>
    utteranceGuidSet.has(String((v as VariableInstance).id || '').trim())
  );
  const nonUtterance = allVars.filter((v) => {
    const vid = String((v as VariableInstance).id || '').trim();
    if (!vid || utteranceGuidSet.has(vid)) return false;
    const tid = String((v as VariableInstance).taskInstanceId || '').trim();
    if (tid && isUtteranceLikeTaskInstance(tid)) return false;
    return isVariableVisibleInFlow(v as VariableInstance, activeFlowId, flows);
  });
  return [...utteranceVars, ...nonUtterance];
}

/**
 * Dev / opt-in: explains utterance branch of {@link filterLocalVariablesForActiveFlow}
 * (guidSet ∩ store vs rest with isVariableVisibleInFlow).
 */
/** Merged map for menu-style resolution (project registry + active flow meta). */
function menuMergedTranslations(): Record<string, string> {
  return { ...getProjectTranslationsTable(), ...getActiveFlowMetaTranslationsFlattened() };
}

function menuResolvedLabel(guid: string, merged: Record<string, string>): string {
  return resolveVariableDisplayName(guid, 'menuVariables', {
    compiledTranslations: merged,
    flowMetaTranslations: merged,
  });
}

function logUtteranceFilterStep(
  projectId: string,
  menuFlowId: string,
  allVars: VariableInstance[],
  utteranceGuidSet: Set<string>,
  localVars: VariableInstance[]
): void {
  const idsInStore = new Set(
    allVars.map((v) => String((v as VariableInstance).id || '').trim()).filter(Boolean)
  );
  const guidList = [...utteranceGuidSet];
  const missingInStore = guidList.filter((id) => !idsInStore.has(id));
  const utteranceFromStore = allVars.filter((v) =>
    utteranceGuidSet.has(String((v as VariableInstance).id || '').trim())
  );
  const dbgTr = menuMergedTranslations();

  const fullPayload = {
    projectId,
    menuFlowId,
    filterRule:
      'utterance: VariableInstance.id in guidSet (from flow TaskTree nodes); others: isVariableVisibleInFlow unless utterance task row without guid match',
    storeVarCount: allVars.length,
    storeVariables: allVars.map((v) => {
      const id = String((v as VariableInstance).id || '').trim();
      return {
        id,
        taskInstanceId: String((v as VariableInstance).taskInstanceId || '').trim(),
        displayLabel: menuResolvedLabel(id, dbgTr),
        scopeFlowId: String((v as VariableInstance).scopeFlowId || '').trim(),
      };
    }),
    utteranceGuidSetSize: utteranceGuidSet.size,
    utteranceGuidSet: guidList,
    expectedGuidsNotInStore: missingInStore,
    utteranceVarsKeptFromStore: utteranceFromStore.map((v) => {
      const id = String((v as VariableInstance).id || '').trim();
      return {
        id,
        displayLabel: menuResolvedLabel(id, dbgTr),
      };
    }),
    localVarsAfterFilter: localVars.length,
    localVarIdsAfterFilter: localVars.map((v) => String((v as VariableInstance).id || '').trim()),
  };

  if (isVariableMenuDebugEnabled()) {
    logVariableMenuDebug('variableMenu:utteranceFilter', fullPayload);
  } else if (import.meta.env.DEV && utteranceGuidSet.size > 0) {
    console.log('[Omnia][variableMenu] utteranceFilter (summary)', {
      projectId,
      menuFlowId,
      storeVarCount: allVars.length,
      utteranceGuidSet: guidList,
      expectedGuidsNotInStore: missingInStore,
      localVarsAfterFilter: localVars.length,
    });
  }

  const allExpectedMissing =
    guidList.length > 0 && missingInStore.length === guidList.length && utteranceFromStore.length === 0;
  if (import.meta.env.DEV && allExpectedMissing) {
    console.warn(
      '[Omnia][variableMenu] Utterance GUIDs on canvas but none in VariableCreationService store. ' +
        'localStorage omnia.variableMenuDebug=1 for full dump. Check hydrateVariablesFromFlow timing and DB variable rows (must have id).',
      { projectId, menuFlowId, expectedGuids: guidList, storeVarCount: allVars.length }
    );
  }
}

function resolveSubflowId(task: any): string | null {
  const direct = String(task?.flowId || '').trim();
  if (direct) return direct;
  const params = Array.isArray(task?.parameters) ? task.parameters : [];
  const fromParam = params.find((p: any) => String(p?.parameterId || '').trim() === 'flowId');
  const value = String(fromParam?.value || '').trim();
  return value || null;
}

function collectLevelOneFlowIds(rootFlowId: string, flows: WorkspaceState['flows']): Set<string> {
  const out = new Set<string>([rootFlowId]);
  const root = flows[rootFlowId];
  if (!root) return out;
  for (const node of root.nodes || []) {
    for (const row of extractRows(node)) {
      const task = taskRepository.getTask(String(row?.id || '').trim());
      if (!task || task.type !== TaskType.Subflow) continue;
      const childFlowId = resolveSubflowId(task);
      if (childFlowId) out.add(childFlowId);
    }
  }
  return out;
}

export type SubflowInstanceInfo = {
  subflowTaskId: string;
  flowId: string;
  rowLabel: string;
};

/**
 * One entry per Subflow row in the active flow (same child flow may appear multiple times).
 */
export function collectLevelOneSubflowInstances(
  rootFlowId: string,
  flows: WorkspaceState['flows']
): SubflowInstanceInfo[] {
  const out: SubflowInstanceInfo[] = [];
  const root = flows[rootFlowId];
  if (!root) return out;
  for (const node of root.nodes || []) {
    for (const row of extractRows(node)) {
      const taskId = String(row?.id || '').trim();
      if (!taskId) continue;
      const task = taskRepository.getTask(taskId);
      if (!task || task.type !== TaskType.Subflow) continue;
      const childFlowId = resolveSubflowId(task);
      if (!childFlowId) continue;
      const rawRowLabel = String(row?.text || task?.label || task?.name || '').trim() || 'Subflow';
      const rowLabel = variableCreationService.normalizeTaskLabel(rawRowLabel);
      out.push({ subflowTaskId: taskId, flowId: childFlowId, rowLabel });
    }
  }
  return out;
}

function safeJsonForFingerprint(x: unknown): string {
  try {
    return JSON.stringify(x ?? null);
  } catch {
    return '';
  }
}

/**
 * Stable content key for React effect deps: updates when canvas/meta relevant to the variable picker
 * changes, not when the Redux `flows` map is replaced with the same data.
 */
export function getVariableMenuRebuildFingerprint(
  flows: WorkspaceState['flows'],
  menuFlowId: string
): string {
  const root = flows[menuFlowId];
  if (!root) {
    return `missing:${menuFlowId}`;
  }
  const parts: string[] = [
    menuFlowId,
    safeJsonForFingerprint(root.nodes),
    safeJsonForFingerprint(root.meta),
  ];
  const instances = collectLevelOneSubflowInstances(menuFlowId, flows);
  for (const inst of instances) {
    const cf = flows[inst.flowId];
    parts.push(inst.flowId);
    parts.push(safeJsonForFingerprint(cf?.meta));
  }
  return parts.join('\x1e');
}

function collectLevelOneSubflowInstancesFromNodes(nodes: any[]): SubflowInstanceInfo[] {
  const out: SubflowInstanceInfo[] = [];
  for (const node of nodes || []) {
    for (const row of extractRows(node)) {
      const taskId = String(row?.id || '').trim();
      if (!taskId) continue;
      const task = taskRepository.getTask(taskId);
      if (!task || task.type !== TaskType.Subflow) continue;
      const childFlowId = resolveSubflowId(task);
      if (!childFlowId) continue;
      const rawRowLabel = String(row?.text || task?.label || task?.name || '').trim() || 'Subflow';
      const rowLabel = variableCreationService.normalizeTaskLabel(rawRowLabel);
      out.push({ subflowTaskId: taskId, flowId: childFlowId, rowLabel });
    }
  }
  return out;
}

function getBoundChildOutputVariableIds(subflowTask: any): Set<string> {
  const out = new Set<string>();
  const bindings = Array.isArray(subflowTask?.subflowBindings) ? subflowTask.subflowBindings : [];
  for (const b of bindings) {
    const iface = String(b?.interfaceParameterId || '').trim();
    if (iface) out.add(iface);
  }
  return out;
}

/** Parent variable GUID for a child output (S2 `subflowBindings`). */
function findParentVariableIdForChildOutput(subflowTask: any, childVarId: string): string | null {
  const bindings = Array.isArray(subflowTask?.subflowBindings) ? subflowTask.subflowBindings : [];
  const b = bindings.find((x: any) => String(x?.interfaceParameterId || '').trim() === childVarId);
  const parentId = b ? String(b?.parentVariableId || '').trim() : '';
  return parentId || null;
}

/** Stable id for a MappingEntry row when `variableRefId` is missing. */
function stableInterfaceEntryKey(entry: MappingEntry): string {
  const id = String(entry?.id || '').trim();
  if (id) return id;
  const path = String(entry?.wireKey || '').trim();
  if (path) return path;
  return 'unknown';
}

/** Label for the picker: {@link resolveVariableDisplayName} `menuVariables` on merged flow/project maps. */
function resolveInterfaceOutputEntryLabel(
  entry: MappingEntry,
  variableRefId: string | undefined,
  translationsByGuid?: Record<string, string> | null
): string {
  const vid = variableRefId?.trim();
  const tr = translationsByGuid ?? getActiveFlowMetaTranslationsFlattened();
  if (vid) {
    return menuResolvedLabel(vid, tr);
  }
  return String(entry?.wireKey || '').trim();
}

/** Synthetic varId for menu/maps when the interface row has no `variableRefId` yet. */
function syntheticInterfaceVarId(entryKey: string): string {
  return `iface:${String(entryKey || '').trim()}`;
}

function isExposedInFlow(
  flow: any,
  varId: string,
  projectId?: string,
  workspaceFlows?: WorkspaceState['flows'] | null
): boolean {
  const vid = String(varId || '').trim();
  if (!vid) return false;
  const ifaceIn = Array.isArray(flow?.meta?.flowInterface?.input) ? flow.meta.flowInterface.input : [];
  const ifaceOut = Array.isArray(flow?.meta?.flowInterface?.output) ? flow.meta.flowInterface.output : [];
  if ([...ifaceIn, ...ifaceOut].some((e: any) => String(e?.variableRefId || '').trim() === vid)) return true;
  const pid = String(projectId || '').trim();
  const fid = flow?.id != null ? String(flow.id).trim() : '';
  if (pid && fid && workspaceFlows) {
    const all = variableCreationService.getAllVariables(pid) ?? [];
    const vis = all.filter((v) => isVariableVisibleInFlow(v, fid, workspaceFlows));
    if (vis.some((v) => String(v.id).trim() === vid)) return true;
  }
  return false;
}

export type SubflowInterfaceAppendStats = {
  subflowItemsAdded: number;
  dbgSubflowSkipBound: number;
  dbgSubflowSkipNoVarLabel: number;
  dbgSubflowInterfaceWithoutRefAdded: number;
  dbgSubflowBoundResolvedItems: number;
};

/**
 * Appends Subflow interface rows: child outputs without a binding row, or parent-side variables when S2 bindings exist.
 */
function appendSubflowInterfaceOutputItems(
  projectId: string,
  flows: WorkspaceState['flows'],
  activeFlowId: string,
  activeFlowForExpose: any,
  output: MappingEntry[],
  subflowTask: any,
  inst: SubflowInstanceInfo,
  childFlowId: string,
  ownerTitle: string,
  items: VariableMenuItem[],
  seen: Set<string>,
  stats: SubflowInterfaceAppendStats,
  translationsByGuid?: Record<string, string> | null
): void {
  const bound = getBoundChildOutputVariableIds(subflowTask);
  const cleanSourceLabel = variableCreationService.normalizeTaskLabel(inst.rowLabel);
  const trMap = translationsByGuid ?? getActiveFlowMetaTranslationsFlattened();

  for (const entry of output) {
    const refId = String(entry?.variableRefId || '').trim();
    const entryKey = stableInterfaceEntryKey(entry);
    const missingRef = !refId;

    if (refId && bound.has(refId)) {
      const toId = findParentVariableIdForChildOutput(subflowTask, refId);
      if (!toId) {
        stats.dbgSubflowSkipBound += 1;
        continue;
      }
      const dedupeKey = `${inst.subflowTaskId}::bound::${refId}`;
      if (seen.has(dedupeKey)) {
        continue;
      }
      seen.add(dedupeKey);
      const parentName = menuResolvedLabel(toId, trMap);
      if (!parentName) {
        stats.dbgSubflowSkipNoVarLabel += 1;
        continue;
      }
      stats.subflowItemsAdded += 1;
      stats.dbgSubflowBoundResolvedItems += 1;
      const mergeIdx = items.findIndex(
        (it) =>
          it.id === toId &&
          it.isFromActiveFlow === true &&
          !it.subflowTaskId &&
          !it.resolvedFromSubflowOutputBinding
      );
      if (mergeIdx >= 0) {
        const cur = items[mergeIdx]!;
        items[mergeIdx] = {
          ...cur,
          sourceTaskRowLabel: cleanSourceLabel,
          subflowTaskId: inst.subflowTaskId,
          resolvedFromSubflowOutputBinding: true,
        };
        continue;
      }
      items.push({
        id: toId,
        varLabel: parentName,
        tokenLabel: parentName,
        ownerFlowId: activeFlowId,
        ownerFlowTitle: String(activeFlowForExpose?.title || activeFlowId).trim() || activeFlowId,
        isExposed: isExposedInFlow(activeFlowForExpose, toId, projectId, flows),
        isFromActiveFlow: true,
        sourceTaskRowLabel: cleanSourceLabel,
        subflowTaskId: inst.subflowTaskId,
        resolvedFromSubflowOutputBinding: true,
      });
      continue;
    }

    const dedupeKey = `${inst.subflowTaskId}::${refId || syntheticInterfaceVarId(entryKey)}`;
    if (seen.has(dedupeKey)) continue;
    seen.add(dedupeKey);

    const varLabel = resolveInterfaceOutputEntryLabel(entry, refId || undefined, translationsByGuid);
    if (!varLabel) {
      stats.dbgSubflowSkipNoVarLabel += 1;
      continue;
    }

    const varId = missingRef ? syntheticInterfaceVarId(entryKey) : refId;

    stats.subflowItemsAdded += 1;
    if (missingRef) stats.dbgSubflowInterfaceWithoutRefAdded += 1;
    items.push({
      id: varId,
      varLabel,
      tokenLabel: `${cleanSourceLabel}.${varLabel}`,
      ownerFlowId: childFlowId,
      ownerFlowTitle: ownerTitle,
      isExposed: true,
      isFromActiveFlow: false,
      sourceTaskRowLabel: cleanSourceLabel,
      subflowTaskId: inst.subflowTaskId,
      ...(missingRef ? { missingChildVariableRef: true } : {}),
    });
  }
}

function pushInterfaceItemsForInstance(
  projectId: string,
  activeFlowId: string,
  activeFlowForExpose: any,
  flows: WorkspaceState['flows'],
  relevantFlowIds: Set<string>,
  inst: SubflowInstanceInfo,
  items: VariableMenuItem[],
  seen: Set<string>,
  stats: SubflowInterfaceAppendStats,
  translationsByGuid?: Record<string, string> | null
): void {
  if (!relevantFlowIds.has(inst.flowId)) return;
  const childFlow = flows[inst.flowId];
  if (!childFlow) return;

  const subflowTask = taskRepository.getTask(inst.subflowTaskId);
  if (!subflowTask) return;

  const tr = translationsByGuid ?? getActiveFlowMetaTranslationsFlattened();
  const childMeta = childFlow.meta;
  const flowLocalTr = childMeta && typeof childMeta === 'object' && 'translations' in childMeta
    ? (childMeta as { translations?: Record<string, string> }).translations
    : undefined;
  const mergedTr = { ...tr, ...(flowLocalTr || {}) };
  const output: MappingEntry[] = (childFlow.meta?.flowInterface?.output ?? []) as MappingEntry[];

  const ownerTitle = String(childFlow.title || inst.flowId).trim() || inst.flowId;
  appendSubflowInterfaceOutputItems(
    projectId,
    flows,
    activeFlowId,
    activeFlowForExpose,
    output,
    subflowTask,
    inst,
    inst.flowId,
    ownerTitle,
    items,
    seen,
    stats,
    mergedTr
  );
}

export function buildVariableMenuItems(
  projectId: string,
  activeFlowId: string,
  flows: WorkspaceState['flows'],
  options?: BuildVariableMenuItemsOptions
): VariableMenuItem[] {
  const utteranceGuidSet = collectUtteranceNodeGuidSetForFlow(activeFlowId, flows);
  const relevantFlowIds = collectLevelOneFlowIds(activeFlowId, flows);
  const instances = collectLevelOneSubflowInstances(activeFlowId, flows);
  const allVars = variableCreationService.getAllVariables(projectId) || [];

  const items: VariableMenuItem[] = [];
  const seen = new Set<string>();
  const activeFlowForExpose = flows[activeFlowId];
  const localVars = filterLocalVariablesForActiveFlow(allVars, activeFlowId, flows, utteranceGuidSet);
  if (isVariableMenuDebugEnabled() || (import.meta.env.DEV && utteranceGuidSet.size > 0)) {
    logUtteranceFilterStep(projectId, activeFlowId, allVars, utteranceGuidSet, localVars);
  }

  const tblMenu = { ...getActiveFlowMetaTranslationsFlattened(), ...(options?.translationsByGuid || {}) };
  for (const v of localVars) {
    const varId = String((v as VariableInstance).id || '').trim();
    const varLabel = menuResolvedLabel(varId, tblMenu) || varId;
    if (!varId) continue;
    const key = `${activeFlowId}::${varId}`;
    if (seen.has(key)) continue;
    seen.add(key);
    items.push({
      id: varId,
      varLabel,
      tokenLabel: varLabel,
      ownerFlowId: activeFlowId,
      ownerFlowTitle: String(activeFlowForExpose?.title || activeFlowId).trim() || activeFlowId,
      isExposed: isExposedInFlow(activeFlowForExpose, varId, projectId, flows),
      isFromActiveFlow: true,
      sourceTaskRowLabel: undefined,
    });
  }

  const subflowStats: SubflowInterfaceAppendStats = {
    subflowItemsAdded: 0,
    dbgSubflowSkipBound: 0,
    dbgSubflowSkipNoVarLabel: 0,
    dbgSubflowInterfaceWithoutRefAdded: 0,
    dbgSubflowBoundResolvedItems: 0,
  };
  for (const inst of instances) {
    pushInterfaceItemsForInstance(
      projectId,
      activeFlowId,
      activeFlowForExpose,
      flows,
      relevantFlowIds,
      inst,
      items,
      seen,
      subflowStats,
      options?.translationsByGuid
    );
  }

  return items.sort((a, b) => {
    const ta = String(a.tokenLabel || a.varLabel);
    const tb = String(b.tokenLabel || b.varLabel);
    return ta.localeCompare(tb);
  });
}

/**
 * When `loadFlow` filled nodes but in-memory `flows[activeFlowId]` was empty, visibility must use
 * the same graph as `activeNodes` or task-bound variables are incorrectly filtered out.
 */
function mergeActiveFlowIntoFlowsForMenuScope(
  flows: WorkspaceState['flows'],
  activeFlowId: string,
  loadedFromApi: boolean,
  nodes: any[],
  edges: any[],
  loadedTitle: string,
  loadedMeta: unknown
): WorkspaceState['flows'] {
  if (!loadedFromApi || !Array.isArray(nodes) || nodes.length === 0) {
    return flows;
  }
  const prev = flows[activeFlowId] as any;
  const title =
    String(loadedTitle || '').trim() ||
    String(prev?.title || activeFlowId).trim() ||
    activeFlowId;
  return {
    ...flows,
    [activeFlowId]: {
      ...(prev || { id: activeFlowId, nodes: [], edges: [] }),
      id: activeFlowId,
      title,
      nodes,
      edges: Array.isArray(edges) ? edges : prev?.edges ?? [],
      ...(loadedMeta != null && typeof loadedMeta === 'object'
        ? { meta: stripLegacyVariablesFromFlowMeta(loadedMeta) as object }
        : {}),
    } as any,
  };
}

/**
 * Async variant that also resolves child flow interface outputs
 * even when the child flow is not currently loaded in workspace snapshot.
 */
export async function buildVariableMenuItemsAsync(
  projectId: string,
  activeFlowId: string,
  flows: WorkspaceState['flows'],
  options?: BuildVariableMenuItemsOptions
): Promise<VariableMenuItem[]> {
  let activeFlow = flows[activeFlowId] as any;
  let loadedActiveMeta: any = null;
  let loadedActiveTitle = '';
  let activeNodes = Array.isArray(activeFlow?.nodes) ? activeFlow.nodes : [];
  let activeEdges = Array.isArray(activeFlow?.edges) ? activeFlow.edges : [];
  let loadedActiveFlowFromApi = false;
  if (activeNodes.length === 0 && projectId) {
    try {
      const loadedActive = await loadFlow(projectId, activeFlowId);
      activeNodes = Array.isArray(loadedActive?.nodes) ? loadedActive.nodes : [];
      activeEdges = Array.isArray(loadedActive?.edges) ? loadedActive.edges : activeEdges;
      loadedActiveMeta = loadedActive?.meta || null;
      loadedActiveTitle = String((loadedActive as any)?.title || '').trim();
      loadedActiveFlowFromApi = true;
    } catch {
      // Ignore: caller gets best-effort menu with available in-memory data.
    }
  }

  const flowsForScope = mergeActiveFlowIntoFlowsForMenuScope(
    flows,
    activeFlowId,
    loadedActiveFlowFromApi,
    activeNodes,
    activeEdges,
    loadedActiveTitle,
    loadedActiveMeta
  );

  const utteranceGuidSet = collectUtteranceNodeGuidSetForFlow(activeFlowId, flowsForScope);

  const allVars = variableCreationService.getAllVariables(projectId) || [];

  const instances = activeNodes.length > 0
    ? collectLevelOneSubflowInstancesFromNodes(activeNodes)
    : collectLevelOneSubflowInstances(activeFlowId, flows);
  const relevantFlowIds = new Set<string>([activeFlowId, ...instances.map((i) => i.flowId)]);
  const activeFlowForExpose = activeFlow || { meta: loadedActiveMeta, title: loadedActiveTitle };

  const items: VariableMenuItem[] = [];
  type SubflowBuildDiag = {
    childFlowId: string;
    outputSource: 'scope' | 'empty';
    outputEntryCount: number;
    taskOk: boolean;
  };
  const subflowBuildDiag: SubflowBuildDiag[] = [];
  const seen = new Set<string>();
  const localVars = filterLocalVariablesForActiveFlow(
    allVars,
    activeFlowId,
    flowsForScope,
    utteranceGuidSet
  );
  if (isVariableMenuDebugEnabled() || (import.meta.env.DEV && utteranceGuidSet.size > 0)) {
    logUtteranceFilterStep(projectId, activeFlowId, allVars, utteranceGuidSet, localVars);
  }

  const scopeRowIdsMerged = new Set<string>([
    ...getTaskInstanceIdsOnFlowCanvasFromFlows(activeFlowId, flowsForScope),
    ...getTaskInstanceIdsOnFlowCanvas(activeFlowId),
  ]);

  const tblMenuAsync = { ...getActiveFlowMetaTranslationsFlattened(), ...(options?.translationsByGuid || {}) };
  for (const v of localVars) {
    const varId = String((v as VariableInstance).id || '').trim();
    const varLabel = menuResolvedLabel(varId, tblMenuAsync) || varId;
    if (!varId) continue;
    const key = `${activeFlowId}::${varId}`;
    if (seen.has(key)) continue;
    seen.add(key);
    items.push({
      id: varId,
      varLabel,
      tokenLabel: varLabel,
      ownerFlowId: activeFlowId,
      ownerFlowTitle: String(activeFlowForExpose?.title || activeFlowId).trim() || activeFlowId,
      isExposed: isExposedInFlow(activeFlowForExpose, varId, projectId, flows),
      isFromActiveFlow: true,
      sourceTaskRowLabel: undefined,
    });
  }

  let dbgSubflowSkipNoTask = 0;
  const subflowAppendStats: SubflowInterfaceAppendStats = {
    subflowItemsAdded: 0,
    dbgSubflowSkipBound: 0,
    dbgSubflowSkipNoVarLabel: 0,
    dbgSubflowInterfaceWithoutRefAdded: 0,
    dbgSubflowBoundResolvedItems: 0,
  };

  for (const inst of instances) {
    if (!relevantFlowIds.has(inst.flowId)) continue;
    const childFlowId = String(inst.flowId || '').trim();
    if (!childFlowId) continue;

    let output: MappingEntry[] = [];
    let outputSource: 'scope' | 'empty' = 'empty';
    let resolvedChildTitle = '';
    try {
      const resolved = await fetchChildFlowInterfaceOutputs(projectId, childFlowId, flows);
      output = resolved.outputs;
      resolvedChildTitle = resolved.title;
      outputSource = resolved.outputs.length === 0 ? 'empty' : resolved.source;
    } catch {
      output = [];
      outputSource = 'empty';
    }

    const subflowTask = taskRepository.getTask(inst.subflowTaskId);
    if (!subflowTask) {
      dbgSubflowSkipNoTask += 1;
      subflowBuildDiag.push({
        childFlowId: String(childFlowId).slice(0, 24),
        outputSource,
        outputEntryCount: output.length,
        taskOk: false,
      });
      continue;
    }
    subflowBuildDiag.push({
      childFlowId: String(childFlowId).slice(0, 24),
      outputSource,
      outputEntryCount: output.length,
      taskOk: true,
    });
    const slice = flows[childFlowId] as { title?: string } | undefined;
    const ownerTitle =
      String(resolvedChildTitle || slice?.title || childFlowId).trim() || childFlowId;

    const childSlice = flows[childFlowId];
    const flowLocalTr = childSlice?.meta?.translations;
    const mergedTr = {
      ...(options?.translationsByGuid ?? getActiveFlowMetaTranslationsFlattened()),
      ...(flowLocalTr || {}),
    };
    appendSubflowInterfaceOutputItems(
      projectId,
      flows,
      activeFlowId,
      activeFlowForExpose,
      output,
      subflowTask,
      inst,
      childFlowId,
      ownerTitle,
      items,
      seen,
      subflowAppendStats,
      mergedTr
    );
  }

  const localItemsCount = items.length - subflowAppendStats.subflowItemsAdded;
  logVariableMenuDebug('variableMenu:build', {
    projectId,
    menuFlowId: activeFlowId,
    utteranceGuidSetSize: utteranceGuidSet.size,
    storeVarCount: allVars.length,
    visibilityPassCount: localVars.length,
    mergedTaskRowIdsCount: scopeRowIdsMerged.size,
    sampleTaskRowIds: [...scopeRowIdsMerged].slice(0, 16),
    sampleVarTaskInstanceIds: allVars
      .map((v) => String((v as VariableInstance).taskInstanceId || '').trim())
      .filter(Boolean)
      .slice(0, 12),
    activeNodes: activeNodes.length,
    loadedMenuFlowFromApi: loadedActiveFlowFromApi,
    mergedScopeFromApi: loadedActiveFlowFromApi && activeNodes.length > 0,
    instancesCount: instances.length,
    instances: instances.slice(0, 12).map((i) => ({
      rowLabel: i.rowLabel,
      childFlowId: String(i.flowId || '').slice(0, 20),
    })),
    subflows: subflowBuildDiag,
    localScopeItems: localItemsCount,
    subflowItemsAdded: subflowAppendStats.subflowItemsAdded,
    boundResolvedItems: subflowAppendStats.dbgSubflowBoundResolvedItems,
    interfaceOutputsWithoutVariableRef: subflowAppendStats.dbgSubflowInterfaceWithoutRefAdded,
    totalItems: items.length,
    skips: {
      noSubflowTask: dbgSubflowSkipNoTask,
      boundOrphanOrMissingParentName: subflowAppendStats.dbgSubflowSkipBound,
      noVarLabel: subflowAppendStats.dbgSubflowSkipNoVarLabel,
    },
  });

  return items.sort((a, b) => {
    const ta = String(a.tokenLabel || a.varLabel);
    const tb = String(b.tokenLabel || b.varLabel);
    return ta.localeCompare(tb);
  });
}

/**
 * Subflow interface outputs use a deterministic UUID (subflowTaskId + child var id) as map key.
 * Expose the set so encode can prefer that key when the same label maps to multiple keys.
 */
export function buildSubflowCompositeKeySet(items: VariableMenuItem[]): Set<string> {
  const s = new Set<string>();
  for (const item of items) {
    if (item.isFromActiveFlow === false && item.subflowTaskId) {
      const id = String(item.id || '').trim();
      if (!id) continue;
      s.add(subflowInterfaceOutputMappingKey(item.subflowTaskId, id));
    }
  }
  return s;
}

/**
 * Map variable id (or deterministic Subflow interface key) to token label for DSL conversion.
 * Subflow rows are registered first so reverse lookup prefers composite keys; child var ids are
 * also registered when unambiguous so [childVarId] decodes to the same dotted label as the menu.
 */
export function buildVariableMappingsFromMenu(items: VariableMenuItem[]): Map<string, string> {
  const out = new Map<string, string>();
  const rank = (item: VariableMenuItem): number =>
    item.isFromActiveFlow === false && item.subflowTaskId ? 0 : 1;

  const sorted = [...items].sort((a, b) => {
    const d = rank(a) - rank(b);
    if (d !== 0) return d;
    return String(a.tokenLabel || a.varLabel).localeCompare(String(b.tokenLabel || b.varLabel));
  });

  for (const item of sorted) {
    const id = String(item.id || '').trim();
    const label = String(item.tokenLabel || '').trim();
    if (!id || !label) continue;

    const isSubflow = item.isFromActiveFlow === false && item.subflowTaskId;

    if (isSubflow) {
      const composite = subflowInterfaceOutputMappingKey(item.subflowTaskId!, id);
      out.set(composite, label);
      const existing = out.get(id);
      if (existing === undefined || existing === label) {
        out.set(id, label);
      }
    } else {
      out.set(id, label);
    }
  }
  return out;
}

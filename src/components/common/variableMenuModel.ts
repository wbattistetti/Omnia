/**
 * Builds variable picker items for the active flow: local scope variables and Subflow
 * interface outputs (unbound child outputs + parent variables when outputBindings exist).
 *
 * Child flow authoring: task-bound rows use local names; parent canvas shows flow-scoped
 * proxy vars (FQ) when a subflow output is bound (`resolvedFromSubflowOutputBinding`).
 */
import { TaskType } from '../../types/taskTypes';
import { taskRepository } from '../../services/TaskRepository';
import { variableCreationService } from '../../services/VariableCreationService';
import type { WorkspaceState } from '../../flows/FlowTypes';
import type { VariableInstance } from '../../types/variableTypes';
import type { MappingEntry } from '../FlowMappingPanel/mappingTypes';
import { loadFlow } from '../../flows/FlowPersistence';
import {
  fetchChildFlowInterfaceOutputs,
  invalidateChildFlowInterfaceCache,
} from '../../services/childFlowInterfaceService';
import { logVariableMenuDebug } from '../../utils/variableMenuDebug';
import { subflowInterfaceOutputMappingKey } from './subflowVariableMappingKey';

export type VariableMenuItem = {
  varId: string;
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
  /** True when this row is an interface output not yet in outputBindings for this instance. */
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

function collectTaskIdsFromNodes(nodes: any[]): Set<string> {
  const out = new Set<string>();
  for (const node of nodes || []) {
    for (const row of extractRows(node)) {
      const taskId = String(row?.id || '').trim();
      if (taskId) out.add(taskId);
    }
  }
  return out;
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
  const bindings = Array.isArray(subflowTask?.outputBindings) ? subflowTask.outputBindings : [];
  for (const b of bindings) {
    const from = String(b?.fromVariable || '').trim();
    if (from) out.add(from);
  }
  return out;
}

/** Parent variable GUID for a child output when `outputBindings` maps `fromVariable` → `toVariable`. */
function findParentVariableIdForChildOutput(subflowTask: any, childVarId: string): string | null {
  const bindings = Array.isArray(subflowTask?.outputBindings) ? subflowTask.outputBindings : [];
  const b = bindings.find((x: any) => String(x?.fromVariable || '').trim() === childVarId);
  const to = b ? String(b?.toVariable || '').trim() : '';
  return to || null;
}

/** Stable id for a MappingEntry row when `variableRefId` is missing. */
function stableInterfaceEntryKey(entry: MappingEntry): string {
  const id = String(entry?.id || '').trim();
  if (id) return id;
  const path = String(entry?.internalPath || '').trim();
  if (path) return path;
  return 'unknown';
}

/** Label for the picker: child var name when wired, else interface fields. */
function resolveInterfaceOutputEntryLabel(
  entry: MappingEntry,
  varsById: Map<string, VariableInstance>,
  variableRefId: string | undefined
): string {
  const vid = variableRefId?.trim();
  if (vid) {
    const varInst = varsById.get(vid);
    const name = String(varInst?.varName || '').trim();
    if (name) return name;
  }
  return (
    String(entry?.externalName || '').trim() ||
    String(entry?.internalPath || '').trim() ||
    String(entry?.linkedVariable || '').trim() ||
    ''
  );
}

/** Synthetic varId for menu/maps when the interface row has no `variableRefId` yet. */
function syntheticInterfaceVarId(entryKey: string): string {
  return `iface:${String(entryKey || '').trim()}`;
}

function isExposedInFlow(flow: any, varId: string): boolean {
  const vars = Array.isArray(flow?.meta?.variables) ? flow.meta.variables : [];
  const v = vars.find((x: any) => String(x?.id || '').trim() === varId);
  if (v && String(v?.visibility || 'internal') !== 'internal') return true;
  const ifaceIn = Array.isArray(flow?.meta?.flowInterface?.input) ? flow.meta.flowInterface.input : [];
  const ifaceOut = Array.isArray(flow?.meta?.flowInterface?.output) ? flow.meta.flowInterface.output : [];
  return [...ifaceIn, ...ifaceOut].some((e: any) => String(e?.variableRefId || '').trim() === varId);
}

export type SubflowInterfaceAppendStats = {
  subflowItemsAdded: number;
  dbgSubflowSkipBound: number;
  dbgSubflowSkipNoVarLabel: number;
  dbgSubflowInterfaceWithoutRefAdded: number;
  dbgSubflowBoundResolvedItems: number;
};

/**
 * Appends Subflow interface rows: unbound child outputs, or parent variables when bindings exist.
 */
function appendSubflowInterfaceOutputItems(
  projectId: string,
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
  varsById: Map<string, VariableInstance>
): void {
  const bound = getBoundChildOutputVariableIds(subflowTask);
  const cleanSourceLabel = variableCreationService.normalizeTaskLabel(inst.rowLabel);

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
      const parentName =
        variableCreationService.getVarNameByVarId(projectId, toId)?.trim() ||
        String(varsById.get(toId)?.varName || '').trim() ||
        '';
      if (!parentName) {
        stats.dbgSubflowSkipNoVarLabel += 1;
        continue;
      }
      stats.subflowItemsAdded += 1;
      stats.dbgSubflowBoundResolvedItems += 1;
      const mergeIdx = items.findIndex(
        (it) =>
          it.varId === toId &&
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
        varId: toId,
        varLabel: parentName,
        tokenLabel: parentName,
        ownerFlowId: activeFlowId,
        ownerFlowTitle: String(activeFlowForExpose?.title || activeFlowId).trim() || activeFlowId,
        isExposed: isExposedInFlow(activeFlowForExpose, toId),
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

    const varLabel = resolveInterfaceOutputEntryLabel(entry, varsById, refId || undefined);
    if (!varLabel) {
      stats.dbgSubflowSkipNoVarLabel += 1;
      continue;
    }

    const varId = missingRef ? syntheticInterfaceVarId(entryKey) : refId;

    stats.subflowItemsAdded += 1;
    if (missingRef) stats.dbgSubflowInterfaceWithoutRefAdded += 1;
    items.push({
      varId,
      varLabel,
      tokenLabel: `${cleanSourceLabel}.${varLabel}`,
      ownerFlowId: childFlowId,
      ownerFlowTitle: ownerTitle,
      isExposed: true,
      isFromActiveFlow: false,
      sourceTaskRowLabel: cleanSourceLabel,
      subflowTaskId: inst.subflowTaskId,
      isInterfaceUnbound: true,
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
  varsById: Map<string, VariableInstance>
): void {
  if (!relevantFlowIds.has(inst.flowId)) return;
  const childFlow = flows[inst.flowId];
  if (!childFlow) return;

  const subflowTask = taskRepository.getTask(inst.subflowTaskId);
  if (!subflowTask) return;

  const output: MappingEntry[] = Array.isArray(childFlow.meta?.flowInterface?.output)
    ? childFlow.meta?.flowInterface?.output || []
    : [];

  const ownerTitle = String(childFlow.title || inst.flowId).trim() || inst.flowId;
  appendSubflowInterfaceOutputItems(
    projectId,
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
    varsById
  );
}

export function buildVariableMenuItems(
  projectId: string,
  activeFlowId: string,
  flows: WorkspaceState['flows']
): VariableMenuItem[] {
  const relevantFlowIds = collectLevelOneFlowIds(activeFlowId, flows);
  const instances = collectLevelOneSubflowInstances(activeFlowId, flows);
  const allVars = variableCreationService.getAllVariables(projectId) || [];
  const activeTaskIds = collectTaskIdsForFlow(activeFlowId, flows);
  const varsById = new Map<string, VariableInstance>();
  allVars.forEach((v) => {
    const id = String((v as VariableInstance)?.varId || '').trim();
    if (!id) return;
    varsById.set(id, v as VariableInstance);
  });

  const items: VariableMenuItem[] = [];
  const seen = new Set<string>();
  const localVars = allVars.filter((v) => {
    const taskId = String((v as VariableInstance).taskInstanceId || '').trim();
    if (taskId) {
      return activeTaskIds.has(taskId);
    }
    const scope = (v as VariableInstance).scope === 'flow' ? 'flow' : 'project';
    if (scope === 'flow') {
      return String((v as VariableInstance).scopeFlowId || '').trim() === String(activeFlowId).trim();
    }
    return true;
  });

  for (const v of localVars) {
    const varId = String((v as VariableInstance).varId || '').trim();
    const varLabel = String((v as VariableInstance).varName || '').trim();
    if (!varId || !varLabel) continue;
    const key = `${activeFlowId}::${varId}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const activeFlow = flows[activeFlowId];
    items.push({
      varId,
      varLabel,
      tokenLabel: varLabel,
      ownerFlowId: activeFlowId,
      ownerFlowTitle: String(activeFlow?.title || activeFlowId).trim() || activeFlowId,
      isExposed: isExposedInFlow(activeFlow, varId),
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
      activeFlow,
      flows,
      relevantFlowIds,
      inst,
      items,
      seen,
      subflowStats
    );
  }

  return items.sort((a, b) => {
    const ta = String(a.tokenLabel || a.varLabel);
    const tb = String(b.tokenLabel || b.varLabel);
    return ta.localeCompare(tb);
  });
}

/**
 * Async variant that also resolves child flow interface outputs
 * even when the child flow is not currently loaded in workspace snapshot.
 */
export async function buildVariableMenuItemsAsync(
  projectId: string,
  activeFlowId: string,
  flows: WorkspaceState['flows']
): Promise<VariableMenuItem[]> {
  const allVars = variableCreationService.getAllVariables(projectId) || [];
  const varsById = new Map<string, VariableInstance>();
  allVars.forEach((v) => {
    const id = String((v as VariableInstance)?.varId || '').trim();
    if (!id) return;
    varsById.set(id, v as VariableInstance);
  });

  let activeFlow = flows[activeFlowId] as any;
  let loadedActiveMeta: any = null;
  let loadedActiveTitle = '';
  let activeNodes = Array.isArray(activeFlow?.nodes) ? activeFlow.nodes : [];
  let loadedActiveFlowFromApi = false;
  if (activeNodes.length === 0 && projectId) {
    try {
      const loadedActive = await loadFlow(projectId, activeFlowId);
      activeNodes = Array.isArray(loadedActive?.nodes) ? loadedActive.nodes : [];
      loadedActiveMeta = loadedActive?.meta || null;
      loadedActiveTitle = String((loadedActive as any)?.title || '').trim();
      loadedActiveFlowFromApi = true;
    } catch {
      // Ignore: caller gets best-effort menu with available in-memory data.
    }
  }

  const activeTaskIds = activeNodes.length > 0
    ? collectTaskIdsFromNodes(activeNodes)
    : collectTaskIdsForFlow(activeFlowId, flows);

  const instances = activeNodes.length > 0
    ? collectLevelOneSubflowInstancesFromNodes(activeNodes)
    : collectLevelOneSubflowInstances(activeFlowId, flows);
  const relevantFlowIds = new Set<string>([activeFlowId, ...instances.map((i) => i.flowId)]);
  const activeFlowForExpose = activeFlow || { meta: loadedActiveMeta, title: loadedActiveTitle };

  const items: VariableMenuItem[] = [];
  type SubflowBuildDiag = {
    childFlowId: string;
    outputSource: 'store' | 'cache' | 'loadFlow' | 'empty';
    outputEntryCount: number;
    taskOk: boolean;
  };
  const subflowBuildDiag: SubflowBuildDiag[] = [];
  const seen = new Set<string>();
  const localVars = allVars.filter((v) => {
    const taskId = String((v as VariableInstance).taskInstanceId || '').trim();
    if (taskId) {
      return activeTaskIds.has(taskId);
    }
    const scope = (v as VariableInstance).scope === 'flow' ? 'flow' : 'project';
    if (scope === 'flow') {
      return String((v as VariableInstance).scopeFlowId || '').trim() === String(activeFlowId).trim();
    }
    return true;
  });

  for (const v of localVars) {
    const varId = String((v as VariableInstance).varId || '').trim();
    const varLabel = String((v as VariableInstance).varName || '').trim();
    if (!varId || !varLabel) continue;
    const key = `${activeFlowId}::${varId}`;
    if (seen.has(key)) continue;
    seen.add(key);
    items.push({
      varId,
      varLabel,
      tokenLabel: varLabel,
      ownerFlowId: activeFlowId,
      ownerFlowTitle: String(activeFlowForExpose?.title || activeFlowId).trim() || activeFlowId,
      isExposed: isExposedInFlow(activeFlowForExpose, varId),
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
    let outputSource: 'store' | 'cache' | 'api' | 'empty' = 'empty';
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

    appendSubflowInterfaceOutputItems(
      projectId,
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
      varsById
    );
  }

  const localItemsCount = items.length - subflowAppendStats.subflowItemsAdded;
  logVariableMenuDebug('variableMenu:build', {
    menuFlowId: activeFlowId,
    activeNodes: activeNodes.length,
    loadedMenuFlowFromApi: loadedActiveFlowFromApi,
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
      const id = String(item.varId || '').trim();
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
    const id = String(item.varId || '').trim();
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

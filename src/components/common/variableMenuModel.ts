/**
 * Builds variable picker items for the active flow: local scope variables and unbound
 * Subflow interface outputs (one row per Subflow instance; bound outputs are omitted).
 */
import { TaskType } from '../../types/taskTypes';
import { taskRepository } from '../../services/TaskRepository';
import { variableCreationService } from '../../services/VariableCreationService';
import type { WorkspaceState } from '../../flows/FlowTypes';
import type { VariableInstance } from '../../types/variableTypes';
import type { MappingEntry } from '../FlowMappingPanel/mappingTypes';
import { loadFlow } from '../../flows/FlowPersistence';
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
  /** True when this row is an interface output not yet in outputBindings for this instance. */
  isInterfaceUnbound?: boolean;
};

const interfaceOutputCache = new Map<string, MappingEntry[]>();

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
      const rawRowLabel = String(row?.text || task?.name || '').trim() || 'Subflow';
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

function isExposedInFlow(flow: any, varId: string): boolean {
  const vars = Array.isArray(flow?.meta?.variables) ? flow.meta.variables : [];
  const v = vars.find((x: any) => String(x?.id || '').trim() === varId);
  if (v && String(v?.visibility || 'internal') !== 'internal') return true;
  const ifaceIn = Array.isArray(flow?.meta?.flowInterface?.input) ? flow.meta.flowInterface.input : [];
  const ifaceOut = Array.isArray(flow?.meta?.flowInterface?.output) ? flow.meta.flowInterface.output : [];
  return [...ifaceIn, ...ifaceOut].some((e: any) => String(e?.variableRefId || '').trim() === varId);
}

function pushInterfaceItemsForInstance(
  flows: WorkspaceState['flows'],
  relevantFlowIds: Set<string>,
  varsById: Map<string, VariableInstance>,
  inst: SubflowInstanceInfo,
  items: VariableMenuItem[],
  seen: Set<string>
): void {
  if (!relevantFlowIds.has(inst.flowId)) return;
  const childFlow = flows[inst.flowId];
  if (!childFlow) return;

  const subflowTask = taskRepository.getTask(inst.subflowTaskId);
  if (!subflowTask) return;
  const bound = getBoundChildOutputVariableIds(subflowTask);

  const output: MappingEntry[] = Array.isArray(childFlow.meta?.flowInterface?.output)
    ? childFlow.meta?.flowInterface?.output || []
    : [];

  const cleanSourceLabel = variableCreationService.normalizeTaskLabel(inst.rowLabel);

  for (const entry of output) {
    const varId = String(entry?.variableRefId || '').trim();
    if (!varId) continue;
    if (bound.has(varId)) continue;

    const key = `${inst.subflowTaskId}::${varId}`;
    if (seen.has(key)) continue;
    seen.add(key);

    const varInst = varsById.get(varId);
    const varLabel = String(varInst?.varName || entry?.externalName || entry?.internalPath || '').trim();
    if (!varLabel) continue;

    items.push({
      varId,
      varLabel,
      tokenLabel: `${cleanSourceLabel}.${varLabel}`,
      ownerFlowId: inst.flowId,
      ownerFlowTitle: String(childFlow.title || inst.flowId).trim() || inst.flowId,
      isExposed: true,
      isFromActiveFlow: false,
      sourceTaskRowLabel: cleanSourceLabel,
      subflowTaskId: inst.subflowTaskId,
      isInterfaceUnbound: true,
    });
  }
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

  for (const inst of instances) {
    pushInterfaceItemsForInstance(flows, relevantFlowIds, varsById, inst, items, seen);
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

  for (const inst of instances) {
    if (!relevantFlowIds.has(inst.flowId)) continue;
    const childFlowId = String(inst.flowId || '').trim();
    if (!childFlowId) continue;

    let output: MappingEntry[] = [];
    const loaded = flows[childFlowId];
    if (Array.isArray(loaded?.meta?.flowInterface?.output)) {
      output = loaded.meta.flowInterface.output || [];
    } else {
      const cacheKey = `${projectId}::${childFlowId}`;
      if (interfaceOutputCache.has(cacheKey)) {
        output = interfaceOutputCache.get(cacheKey) || [];
      } else {
        try {
          const loadedFlow = await loadFlow(projectId, childFlowId);
          output = Array.isArray((loadedFlow.meta as any)?.flowInterface?.output)
            ? (((loadedFlow.meta as any).flowInterface.output as MappingEntry[]) || [])
            : [];
          interfaceOutputCache.set(cacheKey, output);
        } catch {
          output = [];
        }
      }
    }

    const subflowTask = taskRepository.getTask(inst.subflowTaskId);
    if (!subflowTask) continue;
    const bound = getBoundChildOutputVariableIds(subflowTask);
    const cleanSourceLabel = variableCreationService.normalizeTaskLabel(inst.rowLabel);
    const ownerTitle = String(loaded?.title || childFlowId).trim() || childFlowId;

    for (const entry of output) {
      const varId = String(entry?.variableRefId || '').trim();
      if (!varId) continue;
      if (bound.has(varId)) continue;

      const key = `${inst.subflowTaskId}::${varId}`;
      if (seen.has(key)) continue;
      seen.add(key);

      const varInst = varsById.get(varId);
      const varLabel = String(varInst?.varName || entry?.externalName || entry?.internalPath || '').trim();
      if (!varLabel) continue;

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
      });
    }
  }

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

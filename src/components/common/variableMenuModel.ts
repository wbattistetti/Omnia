import { TaskType } from '../../types/taskTypes';
import { taskRepository } from '../../services/TaskRepository';
import { variableCreationService } from '../../services/VariableCreationService';
import type { WorkspaceState } from '../../flows/FlowTypes';
import type { VariableInstance } from '../../types/variableTypes';
import type { MappingEntry } from '../FlowMappingPanel/mappingTypes';

export type VariableMenuItem = {
  varId: string;
  varLabel: string;
  tokenLabel: string;
  ownerFlowId: string;
  ownerFlowTitle: string;
  isExposed: boolean;
  isFromActiveFlow: boolean;
  sourceTaskRowLabel?: string;
};

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

type ChildFlowInfo = { flowId: string; rowLabel: string };

function collectLevelOneChildFlowInfo(rootFlowId: string, flows: WorkspaceState['flows']): ChildFlowInfo[] {
  const out: ChildFlowInfo[] = [];
  const seen = new Set<string>();
  const root = flows[rootFlowId];
  if (!root) return out;
  for (const node of root.nodes || []) {
    for (const row of extractRows(node)) {
      const task = taskRepository.getTask(String(row?.id || '').trim());
      if (!task || task.type !== TaskType.Subflow) continue;
      const childFlowId = resolveSubflowId(task);
      if (!childFlowId) continue;
      const rawRowLabel = String(row?.text || task?.name || '').trim() || 'Subflow';
      const rowLabel = variableCreationService.normalizeTaskLabel(rawRowLabel);
      if (seen.has(childFlowId)) continue;
      seen.add(childFlowId);
      out.push({ flowId: childFlowId, rowLabel });
    }
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

export function buildVariableMenuItems(
  projectId: string,
  activeFlowId: string,
  flows: WorkspaceState['flows']
): VariableMenuItem[] {
  const relevantFlowIds = collectLevelOneFlowIds(activeFlowId, flows);
  const childFlowInfo = collectLevelOneChildFlowInfo(activeFlowId, flows);
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
      // Strict: task-bound locals are visible on a flow only if task row belongs to that flow.
      return activeTaskIds.has(taskId);
    }
    const scope = (v as VariableInstance).scope === 'flow' ? 'flow' : 'project';
    if (scope === 'flow') {
      return String((v as VariableInstance).scopeFlowId || '').trim() === String(activeFlowId).trim();
    }
    return true;
  });

  // 1) Active flow local scope only (no fallback ownership).
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

  // 2) Level-1 child flows: explicit interface output only.
  for (const child of childFlowInfo) {
    if (!relevantFlowIds.has(child.flowId)) continue;
    const childFlow = flows[child.flowId];
    if (!childFlow) continue;
    const output: MappingEntry[] = Array.isArray(childFlow.meta?.flowInterface?.output)
      ? childFlow.meta?.flowInterface?.output || []
      : [];
    for (const entry of output) {
      const varId = String(entry?.variableRefId || '').trim();
      if (!varId) continue;
      const varInst = varsById.get(varId);
      const varLabel = String(varInst?.varName || entry?.externalName || entry?.internalPath || '').trim();
      if (!varLabel) continue;
      const key = `${child.flowId}::${varId}`;
      if (seen.has(key)) continue;
      seen.add(key);
      const cleanSourceLabel = variableCreationService.normalizeTaskLabel(child.rowLabel);
      items.push({
        varId,
        varLabel,
        tokenLabel: `${cleanSourceLabel}.${varLabel}`,
        ownerFlowId: child.flowId,
        ownerFlowTitle: String(childFlow.title || child.flowId).trim() || child.flowId,
        isExposed: true,
        isFromActiveFlow: false,
        sourceTaskRowLabel: cleanSourceLabel,
      });
    }
  }

  return items.sort((a, b) => {
    if (a.isFromActiveFlow !== b.isFromActiveFlow) return a.isFromActiveFlow ? -1 : 1;
    if ((a.sourceTaskRowLabel || '') !== (b.sourceTaskRowLabel || '')) {
      return (a.sourceTaskRowLabel || '').localeCompare(b.sourceTaskRowLabel || '');
    }
    return a.varLabel.localeCompare(b.varLabel);
  });
}

export function buildVariableMappingsFromMenu(items: VariableMenuItem[]): Map<string, string> {
  const out = new Map<string, string>();
  items.forEach((item) => {
    const id = String(item.varId || '').trim();
    const label = String(item.tokenLabel || '').trim();
    if (!id || !label) return;
    out.set(id, label);
  });
  return out;
}

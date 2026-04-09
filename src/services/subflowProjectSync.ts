/**
 * Subflow policy S2: bindings live on the Subflow task (`subflowBindings`); no proxy variables and no sync that creates GUIDs.
 */

import { taskRepository } from './TaskRepository';
import { TaskType } from '../types/taskTypes';
import type { WorkspaceState } from '../flows/FlowTypes';
import { loadFlow } from '../flows/FlowPersistence';
import type { MappingEntry } from '../components/FlowMappingPanel/mappingTypes';
import { getVariableLabel } from '../utils/getVariableLabel';
import { getProjectTranslationsTable } from '../utils/projectTranslationsRegistry';

function resolveSubflowId(task: { flowId?: string; parameters?: Array<{ parameterId?: string; value?: string }> }): string | null {
  const direct = String(task?.flowId || '').trim();
  if (direct) return direct;
  const params = Array.isArray(task?.parameters) ? task.parameters : [];
  const fromParam = params.find((p) => String(p?.parameterId || '').trim() === 'flowId');
  return String(fromParam?.value || '').trim() || null;
}

function extractRows(node: { data?: { rows?: unknown[] } }): unknown[] {
  const rows = node?.data?.rows;
  return Array.isArray(rows) ? rows : [];
}

export function getCanvasRowTextForTask(
  parentFlowId: string,
  subflowTaskId: string,
  flows: WorkspaceState['flows']
): string {
  const flow = flows[parentFlowId];
  if (!flow) return '';
  for (const node of flow.nodes || []) {
    for (const row of extractRows(node as { data?: { rows?: unknown[] } })) {
      const r = row as { id?: string; text?: string };
      if (String(r?.id || '').trim() === String(subflowTaskId).trim()) {
        return String(r?.text || '').trim();
      }
    }
  }
  return '';
}

export function collectParentSubflowInstancesForChildFlow(
  childFlowId: string,
  flows: WorkspaceState['flows']
): Array<{ parentFlowId: string; subflowTaskId: string }> {
  const cf = String(childFlowId || '').trim();
  if (!cf) return [];
  const out: Array<{ parentFlowId: string; subflowTaskId: string }> = [];
  for (const [parentFlowId, f] of Object.entries(flows || {})) {
    for (const node of (f as { nodes?: unknown[] })?.nodes || []) {
      for (const row of extractRows(node as { data?: { rows?: unknown[] } })) {
        const r = row as { id?: string };
        const tid = String(r?.id || '').trim();
        if (!tid) continue;
        const task = taskRepository.getTask(tid);
        if (!task || task.type !== TaskType.Subflow) continue;
        const fid = resolveSubflowId(task);
        if (fid === cf) {
          out.push({ parentFlowId, subflowTaskId: tid });
        }
      }
    }
  }
  return out;
}

async function resolveChildInterfaceOutputs(
  projectId: string,
  childFlowId: string,
  flows: WorkspaceState['flows']
): Promise<MappingEntry[]> {
  const slice = flows[childFlowId] as { meta?: { flowInterface?: { output?: unknown[] } } } | undefined;
  if (Array.isArray(slice?.meta?.flowInterface?.output)) {
    return slice.meta!.flowInterface!.output as MappingEntry[];
  }
  if (!String(projectId || '').trim()) return [];
  try {
    const loaded = await loadFlow(projectId, childFlowId);
    const o = (loaded.meta as { flowInterface?: { output?: unknown[] } })?.flowInterface?.output;
    return Array.isArray(o) ? (o as MappingEntry[]) : [];
  } catch {
    return [];
  }
}

/** S2: intentional no-op; `subflowBindings` are authored on the Subflow task. */
export function syncProxyBindingsForSubflowTask(
  _projectId: string,
  _parentFlowId: string,
  _subflowTaskId: string,
  _childFlowId: string,
  _interfaceOutputs: MappingEntry[],
  _flows: WorkspaceState['flows'],
  _options?: { qualifiedSubflowTitle?: string }
): void {
  void _projectId;
  void _parentFlowId;
  void _subflowTaskId;
  void _childFlowId;
  void _interfaceOutputs;
  void _flows;
  void _options;
}

/**
 * Resolve bracket label: child interface parameter GUID → parent variable label via S2 subflowBindings.
 */
export function resolveChildOutputGuidToParentProxyLabelForFlow(
  childSlotGuid: string,
  parentFlowId: string,
  flows: WorkspaceState['flows']
): string | null {
  const g = String(childSlotGuid || '').trim();
  if (!g) return null;
  const flow = flows[parentFlowId];
  if (!flow) return null;
  for (const node of flow.nodes || []) {
    for (const row of extractRows(node as { data?: { rows?: unknown[] } })) {
      const r = row as { id?: string };
      const tid = String(r?.id || '').trim();
      if (!tid) continue;
      const task = taskRepository.getTask(tid);
      if (!task || task.type !== TaskType.Subflow) continue;
      const bindings = Array.isArray((task as { subflowBindings?: unknown }).subflowBindings)
        ? (task as { subflowBindings: Array<{ interfaceParameterId?: string; parentVariableId?: string }> })
            .subflowBindings
        : [];
      for (const b of bindings) {
        if (String(b?.interfaceParameterId || '').trim() !== g) continue;
        const parentId = String(b?.parentVariableId || '').trim();
        if (!parentId) continue;
        const lbl = getVariableLabel(parentId, getProjectTranslationsTable());
        return lbl || null;
      }
    }
  }
  return null;
}

/** S2: no-op; display labels do not use a second-pass proxy rename. */
export function ensureSubflowOutputBindingsDisplayLabels(_params: {
  parentSubflowTaskRowId: string;
  referencedChildVarIds: ReadonlySet<string> | ReadonlyArray<string>;
  qualifiedSubflowTitle: string;
  interfaceOutputs: MappingEntry[];
}): number {
  void _params;
  return 0;
}

/** No-op: bindings are authored on the Subflow task (`subflowBindings`). */
export async function syncSubflowChildInterfaceToAllParents(
  _projectId: string,
  _childFlowId: string,
  _flows: WorkspaceState['flows']
): Promise<void> {
  void _projectId;
  void _childFlowId;
  void _flows;
}

/** No-op: use `subflowBindings` on the task. */
export async function syncProxyBindingsForSingleSubflowTaskAsync(
  _projectId: string,
  _parentFlowId: string,
  _subflowTaskId: string,
  _flows: WorkspaceState['flows']
): Promise<void> {
  void _projectId;
  void _parentFlowId;
  void _subflowTaskId;
  void _flows;
}

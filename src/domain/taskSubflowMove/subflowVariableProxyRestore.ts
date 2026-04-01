/**
 * Ensures subflow child task-bound variables keep local names; parent FQ names live on
 * separate flow-scoped proxy rows (see syncProxyBindingsForSubflowTask).
 */

import { TaskType } from '@types/taskTypes';
import type { WorkspaceState } from '@flows/FlowTypes';
import { taskRepository } from '@services/TaskRepository';
import { variableCreationService } from '@services/VariableCreationService';
import { syncProxyBindingsForSubflowTask } from '@services/subflowProjectSync';
import { localLabelForSubflowTaskVariable } from '@domain/variableProxyNaming';
import type { MappingEntry } from '@components/FlowMappingPanel/mappingTypes';

function resolveSubflowFlowId(task: { flowId?: string; parameters?: unknown[] } | null): string | null {
  const direct = String(task?.flowId || '').trim();
  if (direct) return direct;
  const params = Array.isArray(task?.parameters) ? task.parameters : [];
  const fromParam = params.find((p: any) => String(p?.parameterId || '').trim() === 'flowId');
  return String(fromParam?.value || '').trim() || null;
}

/**
 * Finds which parent flow canvas contains the Subflow task row (by task instance id).
 */
export function findParentFlowIdForSubflowTaskRow(
  subflowTaskId: string,
  flows: WorkspaceState['flows']
): string | null {
  const sid = String(subflowTaskId || '').trim();
  if (!sid) return null;
  for (const [fid, f] of Object.entries(flows || {})) {
    for (const node of (f as any)?.nodes || []) {
      const rows = node?.data?.rows;
      if (!Array.isArray(rows)) continue;
      for (const row of rows) {
        if (String(row?.id || '').trim() === sid) {
          return fid;
        }
      }
    }
  }
  return null;
}

export type ChildLocalRenameRecord = { varId: string; previousName: string; nextName: string };

/**
 * Renames task-bound variable rows from legacy fully-qualified names to local labels only.
 * Never applies FQ names; only strips to {@link localLabelForSubflowTaskVariable}.
 */
export function restoreChildTaskBoundVariablesToLocalNames(
  projectId: string,
  taskInstanceId: string,
  candidateVarIds: ReadonlySet<string>
): ChildLocalRenameRecord[] {
  const pid = String(projectId || '').trim();
  const tid = String(taskInstanceId || '').trim();
  if (!pid || !tid) return [];

  const taskVars = variableCreationService.getVariablesByTaskInstanceId(pid, tid);
  const renamed: ChildLocalRenameRecord[] = [];

  for (const v of taskVars) {
    const vid = String(v.varId || '').trim();
    if (!vid || !candidateVarIds.has(vid)) continue;

    const localName = localLabelForSubflowTaskVariable(v.varName || 'value');
    if (!localName || localName === v.varName) continue;

    const ok = variableCreationService.renameVariableRowByVarId(pid, vid, localName);
    if (ok) {
      renamed.push({ varId: vid, previousName: v.varName, nextName: localName });
    }
  }

  return renamed;
}

export type MigrateSubflowVariableProxyResult = {
  childRenames: ChildLocalRenameRecord[];
  /** Number of syncProxyBindingsForSubflowTask calls executed. */
  syncCalls: number;
};

/**
 * One-shot migration for opened projects: strip FQ contamination on child slot varIds that
 * participate in Subflow outputBindings, then re-sync parent proxies and bindings.
 * Preserves varIds; only adjusts varName rows where needed.
 */
export function migrateSubflowVariableProxyModel(
  projectId: string,
  flows: WorkspaceState['flows']
): MigrateSubflowVariableProxyResult {
  const pid = String(projectId || '').trim();
  if (!pid || !flows || typeof flows !== 'object') {
    return { childRenames: [], syncCalls: 0 };
  }

  const fromIds = new Set<string>();
  for (const t of taskRepository.getAllTasks()) {
    if (t.type !== TaskType.Subflow) continue;
    const bindings = Array.isArray((t as any).outputBindings) ? (t as any).outputBindings : [];
    for (const b of bindings) {
      const f = String(b?.fromVariable || '').trim();
      if (f) fromIds.add(f);
    }
  }

  const childRenames: ChildLocalRenameRecord[] = [];
  const all = variableCreationService.getAllVariables(pid) ?? [];

  for (const vid of fromIds) {
    const v = all.find((x) => String(x.varId || '').trim() === vid);
    if (!v || !String(v.taskInstanceId || '').trim()) continue;

    const localName = localLabelForSubflowTaskVariable(v.varName || '');
    if (!localName || localName === v.varName) continue;

    const prev = v.varName;
    const ok = variableCreationService.renameVariableRowByVarId(pid, vid, localName);
    if (ok) {
      childRenames.push({ varId: vid, previousName: prev, nextName: localName });
    }
  }

  let syncCalls = 0;
  for (const t of taskRepository.getAllTasks()) {
    if (t.type !== TaskType.Subflow) continue;
    const subflowTaskId = String(t.id || '').trim();
    const childFlowId = resolveSubflowFlowId(t);
    if (!subflowTaskId || !childFlowId) continue;

    const parentFlowId = findParentFlowIdForSubflowTaskRow(subflowTaskId, flows);
    if (!parentFlowId) continue;

    const slice = flows[childFlowId] as any;
    const rawOut = slice?.meta?.flowInterface?.output;
    const outputs: MappingEntry[] = Array.isArray(rawOut) ? (rawOut as MappingEntry[]) : [];

    syncProxyBindingsForSubflowTask(pid, parentFlowId, subflowTaskId, childFlowId, outputs, flows);
    syncCalls += 1;
  }

  return { childRenames, syncCalls };
}

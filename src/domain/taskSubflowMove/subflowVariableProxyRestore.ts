/**
 * Ensures subflow child task-bound variables keep local names (S2: no proxy sync).
 */

import { TaskType } from '@types/taskTypes';
import type { WorkspaceState } from '@flows/FlowTypes';
import { taskRepository } from '@services/TaskRepository';
import { variableCreationService } from '@services/VariableCreationService';
import { localLabelForSubflowTaskVariable } from '@domain/variableProxyNaming';

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

export type ChildLocalRenameRecord = { id: string; previousName: string; nextName: string };

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
    const vid = String(v.id || '').trim();
    if (!vid || !candidateVarIds.has(vid)) continue;

    const localName = localLabelForSubflowTaskVariable(v.varName || 'value');
    if (!localName || localName === v.varName) continue;

    const ok = variableCreationService.renameVariableRowById(pid, vid, localName);
    if (ok) {
      renamed.push({ id: vid, previousName: v.varName, nextName: localName });
    }
  }

  return renamed;
}

export type MigrateSubflowVariableProxyResult = {
  childRenames: ChildLocalRenameRecord[];
  /** Reserved; proxy sync removed under S2. */
  syncCalls: number;
};

/**
 * Strip FQ contamination on child slot varIds listed in Subflow `subflowBindings` (interfaceParameterId).
 */
export function migrateSubflowVariableProxyModel(
  projectId: string,
  flows: WorkspaceState['flows']
): MigrateSubflowVariableProxyResult {
  const pid = String(projectId || '').trim();
  if (!pid || !flows || typeof flows !== 'object') {
    return { childRenames: [], syncCalls: 0 };
  }

  const ifaceIds = new Set<string>();
  for (const t of taskRepository.getAllTasks()) {
    if (t.type !== TaskType.Subflow) continue;
    const bindings = Array.isArray((t as { subflowBindings?: unknown }).subflowBindings)
      ? (t as { subflowBindings: Array<{ interfaceParameterId?: string }> }).subflowBindings
      : [];
    for (const b of bindings) {
      const id = String(b?.interfaceParameterId || '').trim();
      if (id) ifaceIds.add(id);
    }
  }

  const childRenames: ChildLocalRenameRecord[] = [];
  const all = variableCreationService.getAllVariables(pid) ?? [];

  for (const vid of ifaceIds) {
    const v = all.find((x) => String(x.id || '').trim() === vid);
    if (!v || !String(v.taskInstanceId || '').trim()) continue;

    const localName = localLabelForSubflowTaskVariable(v.varName || '');
    if (!localName || localName === v.varName) continue;

    const prev = v.varName;
    const ok = variableCreationService.renameVariableRowById(pid, vid, localName);
    if (ok) {
      childRenames.push({ id: vid, previousName: prev, nextName: localName });
    }
  }

  return { childRenames, syncCalls: 0 };
}

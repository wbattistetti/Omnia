/**
 * DEV-only consistency checks after structural pipeline steps.
 */

import { variableCreationService } from '@services/VariableCreationService';
import { taskRepository } from '@services/TaskRepository';
import { TaskType, isUtteranceInterpretationTask } from '@types/taskTypes';
import type { WorkspaceState } from '@flows/FlowTypes';

function rowPresentInFlow(flows: WorkspaceState['flows'], flowId: string, taskRowId: string): boolean {
  const flow = flows[flowId];
  if (!flow?.nodes) return false;
  const rid = String(taskRowId || '').trim();
  for (const node of flow.nodes as Array<{ data?: { rows?: unknown[] } }>) {
    const rows = Array.isArray(node?.data?.rows) ? node.data!.rows! : [];
    if (rows.some((r) => String((r as { id?: string }).id || '').trim() === rid)) return true;
  }
  return false;
}

/**
 * After reconcile + wiring, utterance-like tasks that appear on a flow slice should have variable rows in store.
 */
export function assertVariableStoreCoherent(
  projectId: string,
  taskInstanceId: string,
  flowId: string,
  flows: WorkspaceState['flows']
): void {
  if (!import.meta.env.DEV) return;
  const pid = String(projectId || '').trim();
  const tid = String(taskInstanceId || '').trim();
  const fid = String(flowId || '').trim();
  if (!pid || !tid || !fid) return;
  if (!rowPresentInFlow(flows, fid, tid)) return;
  const task = taskRepository.getTask(tid);
  if (!task) return;
  const utteranceLike =
    isUtteranceInterpretationTask(task) || task.type === TaskType.ClassifyProblem;
  if (!utteranceLike) return;
  const vars = variableCreationService.getVariablesByTaskInstanceId(pid, tid);
  if (vars.length === 0) {
    throw new Error(
      `[StructuralOrchestrator] Invariant failed: no variable rows for task ${tid} on flow ${fid} after pipeline`
    );
  }
}

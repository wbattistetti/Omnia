/**
 * When a parent Subflow task is linked to a child flow, runs the post-link hook (S2).
 * Bindings live on the Subflow task (`subflowBindings`); this hook is a no-op sync placeholder.
 */
import { taskRepository } from './TaskRepository';
import { TaskType } from '../types/taskTypes';
import { syncProxyBindingsForSingleSubflowTaskAsync } from './subflowProjectSync';

function resolveSubflowId(task: any): string | null {
  const direct = String(task?.flowId || '').trim();
  if (direct) return direct;
  const params = Array.isArray(task?.parameters) ? task.parameters : [];
  const fromParam = params.find((p: any) => String(p?.parameterId || '').trim() === 'flowId');
  const value = String(fromParam?.value || '').trim();
  return value || null;
}

/**
 * Invokes the async post-link sync for a single Subflow task (reserved; does not create variables).
 */
export async function provisionParentVariablesForSubflowTaskAsync(
  projectId: string,
  parentFlowId: string,
  subflowTaskId: string,
  flows: Record<string, unknown>
): Promise<void> {
  const pid = String(projectId || '').trim();
  if (!pid) return;

  const task = taskRepository.getTask(subflowTaskId);
  if (!task || task.type !== TaskType.Subflow) return;

  const childFlowId = resolveSubflowId(task);
  if (!childFlowId) return;

  await syncProxyBindingsForSingleSubflowTaskAsync(pid, parentFlowId, subflowTaskId, flows as any);
}

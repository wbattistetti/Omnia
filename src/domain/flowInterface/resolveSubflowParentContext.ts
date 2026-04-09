/**
 * Trova il flusso padre e il task Subflow (S2) che referenziano un dato child `flowId`.
 * Usa solo grafo workspace + TaskRepository (nessun DB flow_meta).
 */

import type { Flow } from '@flows/FlowTypes';
import type { Task } from '@types/taskTypes';
import { TaskType, normalizeLegacyTaskTypeValue } from '@types/taskTypes';

function resolveSubflowFlowId(task: Task): string {
  const direct = String(task?.flowId || '').trim();
  if (direct) return direct;
  const params = Array.isArray(task?.parameters) ? task.parameters : [];
  const fromParam = params.find((p) => String(p?.parameterId || '').trim() === 'flowId');
  return String(fromParam?.value || '').trim();
}

/**
 * @param getTask Risolve il task per `row.id` (stesso contratto di `taskRepository.getTask`).
 */
export function findSubflowParentContextForChild(
  flows: Record<string, Flow>,
  childFlowId: string,
  getTask: (taskId: string) => Task | null
): { parentFlow: Flow; subflowTask: Task } | null {
  const cid = String(childFlowId || '').trim();
  if (!cid) return null;

  const flowIds = Object.keys(flows);
  const ordered = flowIds.includes('main') ? ['main', ...flowIds.filter((id) => id !== 'main')] : flowIds;

  for (const fid of ordered) {
    const flow = flows[fid];
    if (!flow || fid === cid) continue;
    const nodes = Array.isArray(flow.nodes) ? flow.nodes : [];
    for (const node of nodes as Array<{ data?: { rows?: Array<{ id?: string }> } }>) {
      const rows = Array.isArray(node?.data?.rows) ? node.data!.rows! : [];
      for (const row of rows) {
        const taskId = String(row?.id || '').trim();
        if (!taskId) continue;
        const task = getTask(taskId);
        if (!task) continue;
        const t = normalizeLegacyTaskTypeValue(task.type as number);
        if (t !== TaskType.Subflow) continue;
        const linked = resolveSubflowFlowId(task);
        if (linked && linked === cid) {
          return { parentFlow: flow, subflowTask: task };
        }
      }
    }
  }

  return null;
}

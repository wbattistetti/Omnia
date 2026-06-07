/**
 * Individua canvas/nodo/riga di un task AI Agent nel workspace snapshot.
 */

import { TaskType } from '@types/taskTypes';
import { taskRepository } from '@services/TaskRepository';
import { FlowWorkspaceSnapshot } from '@flows/FlowWorkspaceSnapshot';

export type AiAgentFlowPlacement = {
  flowId: string;
  nodeId: string;
  rowId: string;
};

/** Scansiona tutti i flow del workspace per la riga il cui taskId coincide con l'agente. */
export function findAiAgentFlowPlacement(agentTaskId: string): AiAgentFlowPlacement | null {
  const tid = String(agentTaskId ?? '').trim();
  if (!tid) return null;
  const task = taskRepository.getTask(tid);
  if (!task || task.type !== TaskType.AIAgent) return null;

  for (const flowId of FlowWorkspaceSnapshot.getAllFlowIds()) {
    const slice = FlowWorkspaceSnapshot.getFlowById(flowId);
    const nodes = slice?.nodes ?? [];
    for (const node of nodes) {
      const rows = (node as { data?: { rows?: { id?: string; taskId?: string }[] } }).data?.rows ?? [];
      for (const row of rows) {
        const rowTaskId = String(row.id ?? row.taskId ?? '').trim();
        if (rowTaskId === tid) {
          return { flowId, nodeId: String(node.id), rowId: rowTaskId };
        }
      }
    }
  }
  return null;
}

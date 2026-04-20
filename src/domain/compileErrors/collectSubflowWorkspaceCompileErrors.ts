/**
 * Emits row-scoped compile errors when a Subflow task points to a missing or empty child canvas
 * (workspace snapshot + optional persisted flow document, same contract as compileWorkspaceOrchestratorSession).
 */

import type { Node } from 'reactflow';
import type { FlowNode } from '@components/Flowchart/types/flowTypes';
import { resolveSubflowFlowIdFromTask } from '@components/DialogueEngine/backendCompileFlowGraph';
import { FlowWorkspaceSnapshot } from '@flows/FlowWorkspaceSnapshot';
import { loadFlow } from '@flows/FlowPersistence';
import { taskRepository } from '@services/TaskRepository';
import { TaskType } from '@types/taskTypes';

function canvasHasAnyTaskRows(nodes: Node<FlowNode>[] | undefined): boolean {
  if (!nodes?.length) return false;
  return nodes.some((n) => (n.data?.rows?.length ?? 0) > 0);
}

export type SubflowWorkspaceGuardRecord = Record<string, unknown>;

/**
 * One error per Subflow row: missing child flow id, or child graph has no nodes/rows in snapshot and on disk.
 */
export async function collectSubflowWorkspaceCompileErrors(options: {
  enrichedNodes: Node<FlowNode>[];
  projectId: string;
}): Promise<SubflowWorkspaceGuardRecord[]> {
  const { enrichedNodes, projectId } = options;
  const out: SubflowWorkspaceGuardRecord[] = [];
  const seenRow = new Set<string>();

  for (const node of enrichedNodes) {
    const nodeId = String(node.id || '').trim();
    const rows = node.data?.rows ?? [];
    for (const row of rows) {
      const rowId = String(row.id || (row as { taskId?: string }).taskId || '').trim();
      if (!rowId || seenRow.has(rowId)) continue;
      const task = taskRepository.getTask(rowId);
      if (!task || task.type !== TaskType.Subflow) continue;
      seenRow.add(rowId);

      const childFid = resolveSubflowFlowIdFromTask(task as unknown as Record<string, unknown>).trim();
      if (!childFid) {
        continue;
      }

      let childNodes = FlowWorkspaceSnapshot.getFlowById(childFid)?.nodes ?? [];
      if (!canvasHasAnyTaskRows(childNodes) && projectId) {
        try {
          const loaded = await loadFlow(projectId, childFid);
          childNodes = loaded.nodes || [];
        } catch {
          childNodes = [];
        }
      }

      if (!canvasHasAnyTaskRows(childNodes)) {
        out.push({
          taskId: rowId,
          rowId: rowId,
          nodeId: nodeId || undefined,
          message: '',
          severity: 'Error',
          code: 'SubflowChildNotRunnable',
          category: 'SubflowWorkspaceGuard',
          rowLabel: String(row.text ?? '').trim() || undefined,
          taskType: TaskType.Subflow,
        });
      }
    }
  }
  return out;
}

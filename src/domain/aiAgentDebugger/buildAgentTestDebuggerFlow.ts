/**
 * Costruisce slice flow per debugger «Test agente» (nodo canvas o sintetico).
 */

import type { Task } from '@types/taskTypes';
import { taskRepository } from '@services/TaskRepository';
import { FlowWorkspaceSnapshot } from '@flows/FlowWorkspaceSnapshot';
import { createSingleNodeFlow } from '@utils/flowTestHelpers';
import { findAiAgentFlowPlacement } from './findAiAgentFlowPlacement';

export type AgentTestDebuggerFlowSlice = {
  flowId: string;
  nodes: unknown[];
  edges: unknown[];
  tasks: unknown[];
  executionFlowName: string;
  executionLaunchType: 'rowTask';
  executionLaunchLabel: string;
  reuseDeployedConvaiAgent: true;
};

function resolveTasksForSlice(preferred: readonly Task[] | undefined): Task[] {
  if (preferred?.length) return [...preferred];
  return taskRepository.getAllTasks();
}

/** Flow isolato con un solo nodo e una riga agente (fallback se non presente sul canvas). */
export function buildSyntheticSingleAgentFlow(
  agentTaskId: string,
  taskLabel: string,
  tasks?: readonly Task[]
): Pick<AgentTestDebuggerFlowSlice, 'flowId' | 'nodes' | 'edges' | 'tasks'> {
  const tid = String(agentTaskId ?? '').trim();
  const label = String(taskLabel ?? '').trim() || 'AI Agent';
  const nodeId = `agent_test_node_${tid}`;
  const flowId = `__agent_test__${tid}`;
  return {
    flowId,
    nodes: [
      {
        id: nodeId,
        type: 'customNode',
        position: { x: 0, y: 0 },
        data: {
          label,
          rows: [{ id: tid, text: label, included: true }],
        },
      },
    ],
    edges: [],
    tasks: resolveTasksForSlice(tasks),
  };
}

/** Risolve nodi/edge/task per il debugger test agente. */
export function buildAgentTestDebuggerFlow(
  agentTaskId: string,
  taskLabel: string
): AgentTestDebuggerFlowSlice {
  const tid = String(agentTaskId ?? '').trim();
  const label = String(taskLabel ?? '').trim() || 'AI Agent';
  const placement = findAiAgentFlowPlacement(tid);

  if (placement) {
    const slice = FlowWorkspaceSnapshot.getFlowById(placement.flowId);
    const allNodes = slice?.nodes ?? [];
    const allEdges = slice?.edges ?? [];
    const allTasks = resolveTasksForSlice(slice?.tasks);
    try {
      const { nodes, edges, tasks } = createSingleNodeFlow(
        placement.nodeId,
        allNodes,
        allEdges,
        allTasks
      );
      const canvasTitle =
        String(slice?.title ?? '').trim() ||
        (placement.flowId === 'main' ? 'MAIN' : placement.flowId);
      return {
        flowId: placement.flowId,
        nodes,
        edges,
        tasks,
        executionFlowName: canvasTitle,
        executionLaunchType: 'rowTask',
        executionLaunchLabel: `${canvasTitle}: ${label}`,
        reuseDeployedConvaiAgent: true,
      };
    } catch {
      /* Snapshot/nodo non allineati: fallback flow sintetico isolato. */
    }
  }

  const synthetic = buildSyntheticSingleAgentFlow(tid, label);
  return {
    ...synthetic,
    executionFlowName: 'Test agente',
    executionLaunchType: 'rowTask',
    executionLaunchLabel: label,
    reuseDeployedConvaiAgent: true,
  };
}

/**
 * Creates a flow canvas node + AI Agent task from an ElevenLabs workflow node drop.
 */

import type { Node } from 'reactflow';
import { createDefaultAIAgentTaskPayload } from '@components/TaskEditor/EditorHost/editors/aiAgentEditor/createDefaultAIAgentTaskPayload';
import { persistElevenLabsImportToTask } from './persistElevenLabsImportToTask';
import type { ElevenLabsNodeDragPayload } from './elevenLabsDragPayload';
import type { FlowNode } from '@components/Flowchart/types/flowTypes';
import { TaskType, type Task } from '@types/taskTypes';
import { taskRepository } from '@services/TaskRepository';
import { generateSafeGuid } from '@utils/idGenerator';
import type { IAAgentConfig } from 'types/iaAgentRuntimeSetup';
import { AGENT_WIZARD_FIRST_STEP_INDEX } from '@domain/aiAgentConstruction/agentConstructionPhase';

export type DropElevenLabsNodeOnFlowResult = {
  canvasNodeId: string;
  taskId: string;
  label: string;
  newNode: Node<FlowNode>;
  importSummary: {
    promptApplied: boolean;
    backendsAdded: number;
    backendsLinked: number;
  };
};

/**
 * Adds a CustomNode with one AI Agent row and imports EL node content into the new task.
 */
export function dropElevenLabsNodeOnFlow(params: {
  payload: ElevenLabsNodeDragPayload;
  position: { x: number; y: number };
  projectId: string | undefined;
  existingCanvasNodes: readonly Node<FlowNode>[];
}): DropElevenLabsNodeOnFlowResult {
  const { payload, position, projectId, existingCanvasNodes } = params;
  const label = String(payload.node.label || 'Agente AI').trim() || 'Agente AI';
  const taskId = generateSafeGuid();
  const canvasNodeId = generateSafeGuid();

  const iaOverride: IAAgentConfig & { elevenLabsWorkflowNodeId?: string } = {
    platform: 'elevenlabs',
    convaiAgentId: payload.remoteAgentId,
    elevenLabsWorkflowNodeId: payload.node.id,
    convaiBackendToolTaskIds: [],
  };

  const basePayload = createDefaultAIAgentTaskPayload() as Partial<Task>;
  taskRepository.createTask(
    TaskType.AIAgent,
    null,
    {
      ...basePayload,
      label,
      name: label,
      agentWizardTutorAcknowledged: true,
      agentWizardCurrentStep: AGENT_WIZARD_FIRST_STEP_INDEX,
      agentIaRuntimeOverrideJson: JSON.stringify(iaOverride),
    } as Partial<Task>,
    taskId,
    projectId
  );

  const importResult = persistElevenLabsImportToTask(
    taskId,
    payload.node,
    payload.remoteAgentName || payload.snapshot.ref.name || '',
    payload.snapshot.settings,
    payload.snapshot.toolInventory,
    {
      fromFlowDrop: true,
      remoteAgentId: payload.remoteAgentId,
      webhookScope: 'agent',
      descriptionImportMode: 'promptOnly',
    }
  );

  const newNode: Node<FlowNode> = {
    id: canvasNodeId,
    type: 'custom',
    position: { x: position.x, y: position.y },
    data: {
      label: '',
      rows: [
        {
          id: taskId,
          text: label,
          heuristics: { type: TaskType.AIAgent },
        },
      ],
    },
  };

  void existingCanvasNodes;

  return {
    canvasNodeId,
    taskId,
    label,
    newNode,
    importSummary: {
      promptApplied: importResult.promptApplied,
      backendsAdded: importResult.backendsAdded,
      backendsLinked: importResult.backendsLinked,
    },
  };
}

/** Returns set of canvas node ids already linked to an EL workflow node id. */
export function findCanvasNodeIdByElevenLabsNodeId(
  nodes: readonly Node<FlowNode>[],
  elevenLabsNodeId: string
): string | null {
  const elId = elevenLabsNodeId.trim();
  if (!elId) return null;
  for (const n of nodes) {
    const rows = n.data?.rows ?? [];
    for (const row of rows) {
      const task = taskRepository.getTask(row.id);
      if (!task) continue;
      try {
        const raw = String(task.agentIaRuntimeOverrideJson || '').trim();
        if (!raw) continue;
        const cfg = JSON.parse(raw) as {
          elevenLabsWorkflowNodeId?: string;
        };
        if (String(cfg.elevenLabsWorkflowNodeId || '') === elId) return n.id;
      } catch {
        /* ignore */
      }
    }
  }
  return null;
}

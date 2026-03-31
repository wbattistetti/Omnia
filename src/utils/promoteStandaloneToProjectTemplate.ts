/**
 * Promotes a standalone task row to an instance bound to project template(s).
 * Composite trees: POST leaf templates first, then root with subTasksIds (see buildTaskTreeNodes).
 */

import { DialogueTaskService } from '@services/DialogueTaskService';
import { taskRepository } from '@services/TaskRepository';
import { TaskType, TemplateSource } from '@types/taskTypes';
import type { Task, TaskTreeNode } from '@types/taskTypes';
import { inferTaskKind } from './taskKind';

const GUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function nodeKey(n: TaskTreeNode): string {
  return String(n.templateId || n.id || '').trim();
}

/** Post-order: children first, then node (so POST creates leaves before parents). */
export function collectInstanceNodesPostOrder(root: TaskTreeNode): TaskTreeNode[] {
  const out: TaskTreeNode[] = [];
  const visit = (n: TaskTreeNode) => {
    n.subNodes?.forEach(visit);
    out.push(n);
  };
  visit(root);
  return out;
}

function allNodesHaveGuid(root: TaskTreeNode): boolean {
  const stack: TaskTreeNode[] = [root];
  while (stack.length) {
    const n = stack.pop()!;
    if (!GUID_RE.test(nodeKey(n))) {
      return false;
    }
    if (n.subNodes?.length) {
      stack.push(...n.subNodes);
    }
  }
  return true;
}

/**
 * Standalone with exactly one root in subTasks; every node id must be a GUID.
 * Sub-nodes allowed (composite) when all GUIDs are valid.
 */
export function canPromoteStandaloneToProjectTemplateMvp(task: Task | null | undefined): boolean {
  if (!task) {
    return false;
  }
  if (inferTaskKind(task) !== 'embedded') {
    return false;
  }
  const nodes = task.subTasks;
  if (!Array.isArray(nodes) || nodes.length !== 1) {
    return false;
  }
  const root = nodes[0];
  return allNodesHaveGuid(root);
}

export type PromoteStandaloneResult = {
  rootTemplateId: string;
};

function stepsSliceForNode(
  fullSteps: Record<string, unknown> | undefined,
  nodeId: string
): Record<string, unknown> {
  if (!fullSteps || typeof fullSteps !== 'object' || Array.isArray(fullSteps)) {
    return {};
  }
  const slice = fullSteps[nodeId];
  if (!slice || typeof slice !== 'object') {
    return {};
  }
  return { [nodeId]: JSON.parse(JSON.stringify(slice)) };
}

/**
 * Creates project template task rows (POST in post-order), registers in DialogueTaskService,
 * then sets the instance row `templateId` to the root template id (embedded graph cleared from the row).
 */
export async function promoteStandaloneToProjectTemplate(
  taskId: string,
  projectId: string
): Promise<PromoteStandaloneResult> {
  const task = taskRepository.getTask(taskId);
  if (!task) {
    throw new Error('[promoteStandaloneToProjectTemplate] Task not found');
  }
  if (!canPromoteStandaloneToProjectTemplateMvp(task)) {
    throw new Error(
      '[promoteStandaloneToProjectTemplate] Only standalone tasks with one root tree and GUID ids on every node can be promoted.'
    );
  }

  const root = task.subTasks![0];
  const rootTemplateId = nodeKey(root);
  const fullSteps =
    task.steps && typeof task.steps === 'object' && !Array.isArray(task.steps)
      ? (task.steps as Record<string, unknown>)
      : undefined;

  const postOrder = collectInstanceNodesPostOrder(root);

  for (const node of postOrder) {
    const nodeId = nodeKey(node);
    const templatePayload: Record<string, unknown> = {
      id: nodeId,
      type: task.type ?? TaskType.UtteranceInterpretation,
      templateId: null,
      label: (node.label || task.labelKey || task.label || nodeId) as string,
      icon: node.icon || 'FileText',
      steps: stepsSliceForNode(fullSteps, nodeId),
      source: TemplateSource.Project,
      labelKey: task.labelKey,
    };

    if (node.subNodes && node.subNodes.length > 0) {
      templatePayload.subTasksIds = node.subNodes.map((s) => nodeKey(s));
    }

    if (node.dataContract) {
      templatePayload.dataContract = node.dataContract;
    }
    if (node.constraints) {
      templatePayload.constraints = node.constraints;
    }

    const response = await fetch(`/api/projects/${encodeURIComponent(projectId)}/tasks`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(templatePayload),
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(
        `[promoteStandaloneToProjectTemplate] Failed to create template ${nodeId}: ${response.status} ${text}`
      );
    }

    const saved = (await response.json()) as Record<string, unknown>;
    DialogueTaskService.registerExternalTemplates([saved as any]);
  }

  const ok = taskRepository.updateTask(
    taskId,
    {
      templateId: rootTemplateId,
      subTasks: [],
      steps: task.steps ?? {},
    },
    projectId
  );

  if (!ok) {
    throw new Error('[promoteStandaloneToProjectTemplate] Failed to update instance task');
  }

  return { rootTemplateId };
}

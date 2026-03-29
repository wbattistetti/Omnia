/**
 * After the AI wizard builds a full TaskTree, optionally rewrites the task row to
 * standalone storage (kind + instanceNodes, templateId cleared) for instance-first testing.
 */

import { taskRepository } from '@services/TaskRepository';
import { isWizardInstanceFirstEnabled } from '../../config/featureFlags';
import type { TaskTree } from '@types/taskTypes';

/**
 * When WIZARD_INSTANCE_FIRST is enabled, persists the built tree as standalone on the task row.
 * @returns true if an update was applied
 */
export async function persistWizardInstanceFirstRow(
  taskId: string,
  projectId: string,
  taskTree: TaskTree
): Promise<boolean> {
  if (!isWizardInstanceFirstEnabled()) {
    return false;
  }
  if (!taskId || !projectId || !taskTree?.nodes?.length) {
    return false;
  }

  const current = taskRepository.getTask(taskId);
  if (!current) {
    return false;
  }

  const nodes = JSON.parse(JSON.stringify(taskTree.nodes.filter(Boolean)));

  const ok = taskRepository.updateTask(
    taskId,
    {
      kind: 'standalone',
      templateId: null,
      instanceNodes: nodes,
      steps: current.steps ?? {},
      labelKey: (taskTree.labelKey || taskTree.label || current.labelKey) as string,
    },
    projectId,
    { allowClearTemplateId: true }
  );

  return ok;
}

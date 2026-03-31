/**
 * Materialize TaskTree view from a Utterance task row with persisted `subTasks` tree.
 * No DialogueTaskService / template cache required for structure.
 */

import type { Task, TaskTree, TaskTreeNode } from '@types/taskTypes';
import { inferTaskKind } from '@utils/taskKind';
import { logContractPersist, summarizeSubTasksForDebug } from '@utils/contractPersistDebug';
import { mergeInstanceNodeStepsIntoTreeSteps } from '@utils/instanceNodeStepsFlatten';

/**
 * Minimal editable TaskTree for rows with no subTasks yet (empty shell).
 */
export function buildMinimalStandaloneTaskTree(task: Task | null | undefined): TaskTree {
  const steps =
    task?.steps && typeof task.steps === 'object' && !Array.isArray(task.steps)
      ? { ...task.steps }
      : {};
  const labelText =
    typeof task?.labelKey === 'string'
      ? task.labelKey
      : typeof task?.label === 'string'
        ? task.label
        : '';

  return {
    labelKey: labelText || 'task',
    label: typeof task?.label === 'string' ? task.label : undefined,
    nodes: [],
    steps,
    constraints: undefined,
    dataContract: undefined,
    introduction: task?.introduction,
  };
}

/**
 * Build a TaskTree for editor preview from persisted `Task.subTasks`.
 * Returns null if the task has no tree to show (use buildMinimalStandaloneTaskTree for empty shells).
 */
export function buildStandaloneTaskTreeView(task: Task | null | undefined): TaskTree | null {
  if (!task) return null;
  const rawNodes = task.subTasks;
  if (!Array.isArray(rawNodes) || rawNodes.length === 0) {
    return null;
  }

  const nodes = rawNodes as TaskTreeNode[];
  const stepsBase: Record<string, unknown> =
    task.steps && typeof task.steps === 'object' && !Array.isArray(task.steps)
      ? { ...task.steps }
      : {};
  const steps = mergeInstanceNodeStepsIntoTreeSteps(nodes, stepsBase);

  const labelKey = task.labelKey ?? task.label ?? 'standalone_task';

  logContractPersist('materialize', 'buildStandaloneTaskTreeView (subTasks for editor)', {
    taskId: task.id,
    inferredKind: inferTaskKind(task),
    templateId: task.templateId ?? null,
    ...summarizeSubTasksForDebug(nodes),
  });

  return {
    labelKey: typeof labelKey === 'string' ? labelKey : 'standalone_task',
    nodes,
    steps: steps as TaskTree['steps'],
    constraints: undefined,
    dataContract: undefined,
    introduction: task.introduction,
    label: typeof task.label === 'string' ? task.label : undefined,
  };
}

// Please write clean, production-grade TypeScript code.
// Avoid non-ASCII characters, Chinese symbols, or multilingual output.

/**
 * PR3: When leaving wizard UI for manual mode, persist the current TaskTree (Zustand)
 * into the task repository — same steps / instance snapshot rules as the manual pipeline.
 */

import { taskRepository } from '@services/TaskRepository';
import { TaskType, type Task, type TaskTree, type TaskTreeNode } from '@types/taskTypes';
import { useTaskTreeStore } from '@responseEditor/core/state';
import {
  createDefaultManualStepDictionary,
  mergeTaskTreeStepsForTemplate,
} from '@responseEditor/core/taskTree/manualDefaultBehaviourSteps';
import {
  cloneMainNodesForInstancePersistence,
  shouldPersistStandaloneInstanceSnapshot,
} from '@responseEditor/core/persistence/standaloneInstanceSnapshot';

export interface FlushWizardToManualOptions {
  taskId: string;
  projectId: string | null | undefined;
  /** Row/task metadata when the repository row must be created */
  task?: Task | { id: string; type?: TaskType } | null;
  replaceSelectedTaskTree?: (taskTree: TaskTree) => void;
}

function collectNodeTemplateIds(nodes: TaskTreeNode[] | undefined): string[] {
  const out: string[] = [];
  const walk = (n: TaskTreeNode) => {
    const tid = n.templateId || n.id;
    if (tid) {
      out.push(tid);
    }
    n.subNodes?.forEach(walk);
  };
  nodes?.forEach(walk);
  return out;
}

/**
 * Ensures default behaviour step shells exist per template id, commits Zustand + dock,
 * merges task.steps in the repository (and subTasks when standalone).
 */
export async function flushWizardToManualPipeline(
  options: FlushWizardToManualOptions
): Promise<TaskTree | null> {
  const { taskId, projectId, task: taskMeta, replaceSelectedTaskTree } = options;

  if (!taskId?.trim()) {
    throw new Error('[flushWizardToManualPipeline] taskId is required');
  }

  const raw = useTaskTreeStore.getState().taskTree;
  if (!raw?.nodes?.length) {
    return null;
  }

  const stepDefaults = createDefaultManualStepDictionary();
  let next: TaskTree = raw;
  const templateIds = [...new Set(collectNodeTemplateIds(raw.nodes))];
  for (const tid of templateIds) {
    next = mergeTaskTreeStepsForTemplate(next, tid, stepDefaults);
  }

  useTaskTreeStore.getState().setTaskTree(next);
  try {
    replaceSelectedTaskTree?.(next);
  } catch {
    /* ignore dock sync errors */
  }

  let taskInstance = taskRepository.getTask(taskId);
  if (!taskInstance) {
    const type =
      taskMeta && typeof taskMeta === 'object' && 'type' in taskMeta && taskMeta.type != null
        ? (taskMeta.type as TaskType)
        : TaskType.UtteranceInterpretation;
    taskInstance = taskRepository.createTask(
      type,
      null,
      undefined,
      taskId,
      projectId || undefined
    );
  }

  const updates: Partial<Task> = {};
  if (next.steps && typeof next.steps === 'object') {
    updates.steps = next.steps;
  }
  if (next.labelKey) {
    updates.labelKey = next.labelKey;
  }

  if (shouldPersistStandaloneInstanceSnapshot(taskInstance, next)) {
    updates.kind = 'standalone';
    updates.subTasks = cloneMainNodesForInstancePersistence(next);
  }

  if (Object.keys(updates).length > 0) {
    const ok = taskRepository.updateTask(taskId, updates, projectId || undefined, { merge: true });
    if (!ok) {
      throw new Error(`[flushWizardToManualPipeline] updateTask failed for taskId=${taskId}`);
    }
  }

  return next;
}

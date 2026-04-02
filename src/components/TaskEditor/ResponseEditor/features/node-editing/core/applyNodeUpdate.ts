// Please write clean, production-grade TypeScript code.
// Avoid non-ASCII characters, Chinese symbols, or multilingual output.

import { validateTaskStructure } from '@utils/taskSemantics';
import { getTemplateId } from '@utils/taskHelpers';
import { taskRepository } from '@services/TaskRepository';
import { saveTaskToRepository } from '@responseEditor/core/persistence/ResponseEditorPersistence';
import { mapNode } from '@dock/ops';
import { validateNodeStructure } from '@responseEditor/core/domain/validators';
import { getNodeIdStrict } from '@responseEditor/core/domain/nodeStrict';
import {
  isBehaviourStepsDebug,
  logBehaviourSteps,
  summarizeStepsShape,
} from '@responseEditor/behaviour/behaviourStepsDebug';
import { replaceNodeAtPath } from '@responseEditor/core/taskTree';
import type { Task, TaskTree } from '@types/taskTypes';

export interface ApplyNodeUpdateParams {
  prevNode: any;
  updatedNode: any;
  selectedNodePath: {
    path: number[];
  } | null;
  selectedRoot: boolean;
  currentTaskTree: TaskTree | null | undefined;
  task: Task | null | undefined;
  currentProjectId: string | null;
  tabId?: string;
}

export interface ApplyNodeUpdateResult {
  updatedNode: any;
  updatedTaskTree: TaskTree;
  validationFailed: boolean;
  validationError?: string;
  shouldUpdateDockTree: boolean;
  shouldSave: boolean;
  saveKey?: string;
  taskInstance?: Task | null;
  currentTemplateId?: string | null;
}

/**
 * Pure function that applies a node update and returns the result.
 * This function does NOT mutate any refs or state - it only computes the result.
 */
export function applyNodeUpdate(params: ApplyNodeUpdateParams): ApplyNodeUpdateResult {
  // Validate updated node structure
  if (params.updatedNode) {
    try {
      validateNodeStructure(params.updatedNode, 'applyNodeUpdate');
    } catch (error) {
      return {
        updatedNode: params.updatedNode,
        updatedTaskTree: params.currentTaskTree || { nodes: [], steps: {} },
        validationFailed: true,
        validationError: error instanceof Error ? error.message : String(error),
        shouldUpdateDockTree: false,
        shouldSave: false,
      };
    }
  }

  const {
    prevNode,
    updatedNode,
    selectedNodePath,
    selectedRoot,
    currentTaskTree,
    task,
    currentProjectId,
    tabId,
  } = params;

  if (!prevNode) {
    return {
      updatedNode: prevNode,
      updatedTaskTree: currentTaskTree || { nodes: [] },
      validationFailed: false,
      shouldUpdateDockTree: false,
      shouldSave: false,
    };
  }

  const isRoot = selectedRoot || false;

  // STEP 1: Build complete updated TaskTree
  let updatedTaskTree: TaskTree = { ...(currentTaskTree || { nodes: [], steps: {} }) };

  if (isRoot) {
    // Root / introduction (aggregate)
    const newIntroStep = updatedNode?.steps?.find((s: any) => s.type === 'introduction');
    if (newIntroStep?.escalations?.some((esc: any) => esc?.tasks?.length > 0)) {
      updatedTaskTree.introduction = {
        type: 'introduction',
        escalations: newIntroStep.escalations ?? []
      };
    } else {
      delete updatedTaskTree.introduction;
    }
  } else {
    if (!selectedNodePath?.path?.length) {
      return {
        updatedNode: prevNode,
        updatedTaskTree: currentTaskTree || { nodes: [] },
        validationFailed: false,
        shouldUpdateDockTree: false,
        shouldSave: false,
      };
    }

    if (!currentTaskTree?.nodes) {
      throw new Error('[applyNodeUpdate] currentTaskTree.nodes is missing. This should have been caught by validateTaskTreeStructure.');
    }

    updatedTaskTree = replaceNodeAtPath(currentTaskTree, selectedNodePath.path, updatedNode);

    const path = selectedNodePath.path;
    const mainIndex = path[0];
    const savedNlpProfileExamples = updatedTaskTree.nodes?.[mainIndex]?.nlpProfile?.examples;
    if (savedNlpProfileExamples) {
      console.log('[EXAMPLES] UPDATE - Saved to taskTreeRef.data', {
        nodeId: updatedNode.id,
        mainIndex,
        path,
        hasNlpProfile: !!updatedTaskTree.nodes?.[mainIndex]?.nlpProfile,
        hasNlpProfileExamples: !!savedNlpProfileExamples,
        nlpProfileExamplesCount: savedNlpProfileExamples.length,
        nlpProfileExamples: savedNlpProfileExamples.slice(0, 3)
      });
    }

    const nodeTemplateId = getNodeIdStrict(updatedNode);
    if (nodeTemplateId && updatedNode.steps && task) {
      if (!task.steps || typeof task.steps !== 'object' || Array.isArray(task.steps)) {
        task.steps = {};
      }

      if (Array.isArray(updatedNode.steps)) {
        throw new Error(
          `[applyNodeUpdate] updatedNode.steps is array. Expected dictionary format. ` +
          `Node id: ${nodeTemplateId}. This should have been caught by validateNodeStructure.`
        );
      }

      task.steps[nodeTemplateId] = updatedNode.steps;

      // Persist steps on the repository task (editor may hold a spread copy; mutations must land in Map).
      const taskPersistId = task.id ?? (task as { instanceId?: string }).instanceId;
      if (taskPersistId) {
        taskRepository.updateTask(taskPersistId, { steps: task.steps }, currentProjectId ?? undefined, {
          merge: true,
        });
      }

      // Keep taskTree.steps in sync so the store update is atomic (one setTaskTree call).
      // Without this, useNodeLoading re-runs between the two queueMicrotask calls and
      // reads stale steps, leaving selectedNode.steps as {} after the first microtask.
      updatedTaskTree = {
        ...updatedTaskTree,
        steps: {
          ...(updatedTaskTree.steps ?? {}),
          [nodeTemplateId]: updatedNode.steps,
        },
      };

      logBehaviourSteps('applyNodeUpdate:syncedTaskTreeSteps', {
        nodeTemplateId,
        updatedNodeSteps: summarizeStepsShape(updatedNode.steps),
        taskTreeStepsTopKeys: Object.keys((updatedTaskTree.steps ?? {}) as Record<string, unknown>),
      });
    } else if (isBehaviourStepsDebug()) {
      const tid = updatedNode?.templateId ?? updatedNode?.id;
      logBehaviourSteps('applyNodeUpdate:skippedTaskTreeStepsSync', {
        nodeTemplateId: tid,
        hasUpdatedSteps: !!updatedNode.steps,
        hasTask: !!task,
        updatedNodeSteps: summarizeStepsShape(updatedNode.steps),
      });
    }
  }

  // STEP 2: Validate TaskTree structure
  const validation = validateTaskStructure(updatedTaskTree);
  if (!validation.valid) {
    console.error('[ResponseEditor] Invalid TaskTree structure:', validation.error);
    return {
      updatedNode: prevNode,
      updatedTaskTree: currentTaskTree || { nodes: [] },
      validationFailed: true,
      validationError: validation.error,
      shouldUpdateDockTree: false,
      shouldSave: false,
    };
  }

  // STEP 3: Determine if should update dockTree
  const shouldUpdateDockTree = !!(tabId);

  // STEP 4: Determine if should save
  const taskToSave = task;
  // ✅ NO FALLBACKS: Use instanceId as primary, id as fallback (both are valid properties)
  const shouldSave = !!(taskToSave?.id ?? (taskToSave as any)?.instanceId);
  const saveKey = shouldSave ? ((taskToSave as any)?.instanceId ?? taskToSave?.id) as string : undefined;
  const hasTaskTree = !!(
    updatedTaskTree &&
    ((updatedTaskTree.nodes && updatedTaskTree.nodes.length > 0) ||
      (updatedTaskTree.steps &&
        Array.isArray(updatedTaskTree.steps) &&
        updatedTaskTree.steps.length > 0) ||
      (updatedTaskTree.steps &&
        typeof updatedTaskTree.steps === 'object' &&
        !Array.isArray(updatedTaskTree.steps) &&
        Object.keys(updatedTaskTree.steps).length > 0))
  );

  let taskInstance: Task | null | undefined = undefined;
  let currentTemplateId: string | null | undefined = undefined;

  if (shouldSave && hasTaskTree && saveKey) {
    taskInstance = taskRepository.getTask(saveKey);
    if (!taskInstance && taskToSave) {
      const propId = taskToSave.id ?? (taskToSave as { instanceId?: string }).instanceId;
      if (propId === saveKey) {
        taskInstance = taskToSave as Task;
      }
    }
    currentTemplateId = getTemplateId(taskInstance);
  }

  return {
    updatedNode,
    updatedTaskTree,
    validationFailed: false,
    shouldUpdateDockTree,
    shouldSave: shouldSave && hasTaskTree,
    saveKey,
    taskInstance,
    currentTemplateId,
  };
}

/**
 * Updates dockTree with the new taskTree for the given tabId.
 * This is a pure function that returns the updated dockTree.
 */
export function updateDockTreeWithTaskTree(
  dockTree: any,
  tabId: string,
  updatedTaskTree: TaskTree
): any {
  return mapNode(dockTree, n => {
    if (n.kind === 'tabset') {
      const idx = n.tabs.findIndex(t => t.id === tabId);
      if (idx !== -1 && n.tabs[idx].type === 'responseEditor') {
        const updatedTab = { ...n.tabs[idx], taskTree: updatedTaskTree };
        return {
          ...n,
          tabs: [
            ...n.tabs.slice(0, idx),
            updatedTab,
            ...n.tabs.slice(idx + 1)
          ]
        };
      }
    }
    return n;
  });
}

/**
 * Saves the task asynchronously.
 * This function does NOT block the UI.
 */
export async function saveTaskAsync(
  key: string,
  updatedTaskTree: TaskTree,
  taskInstance: Task | null | undefined,
  currentProjectId: string | null,
  flowId?: string | null
): Promise<void> {
  try {
    await saveTaskToRepository(key, updatedTaskTree, taskInstance, currentProjectId, flowId);
  } catch (err) {
    console.error('[ResponseEditor] Failed to save task:', err);
  }
}

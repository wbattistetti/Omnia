// Please write clean, production-grade TypeScript code.
// Avoid non-ASCII characters, Chinese symbols, or multilingual output.

import { validateTaskStructure } from '@utils/taskSemantics';
import { getTemplateId } from '@utils/taskHelpers';
import { taskRepository } from '@services/TaskRepository';
import { saveTaskToRepository } from '@responseEditor/features/persistence/ResponseEditorPersistence';
import { mapNode } from '@dock/ops';
import { validateNodeStructure } from '@responseEditor/core/domain/validators';
import { getNodeIdStrict } from '@responseEditor/core/domain/nodeStrict';
import type { Task, TaskTree } from '@types/taskTypes';

export interface ApplyNodeUpdateParams {
  prevNode: any;
  updatedNode: any;
  selectedNodePath: {
    mainIndex: number;
    subIndex?: number;
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

  if (!prevNode || !selectedNodePath) {
    return {
      updatedNode: prevNode,
      updatedTaskTree: currentTaskTree || { nodes: [] },
      validationFailed: false,
      shouldUpdateDockTree: false,
      shouldSave: false,
    };
  }

  const { mainIndex, subIndex } = selectedNodePath;
  const isRoot = selectedRoot || false;

  // STEP 1: Build complete updated TaskTree
  const updatedTaskTree = { ...currentTaskTree };
  const mains = [...(currentTaskTree?.nodes || [])];

  if (mainIndex < mains.length) {
    const main = { ...mains[mainIndex] };

    if (isRoot) {
      // Root node (introduction)
      const newIntroStep = updatedNode?.steps?.find((s: any) => s.type === 'introduction');
      if (newIntroStep?.escalations?.some((esc: any) => esc?.tasks?.length > 0)) {
        updatedTaskTree.introduction = {
          type: 'introduction',
          escalations: newIntroStep.escalations || []
        };
      } else {
        delete updatedTaskTree.introduction;
      }
    } else if (subIndex === undefined) {
      // Main node
      mains[mainIndex] = updatedNode;
      updatedTaskTree.nodes = mains;

      // LOG: Verify nlpProfile.examples is present after update
      const savedNlpProfileExamples = mains[mainIndex]?.nlpProfile?.examples;
      if (savedNlpProfileExamples) {
        console.log('[EXAMPLES] UPDATE - Saved to taskTreeRef.data', {
          nodeId: updatedNode.id,
          mainIndex,
          hasNlpProfile: !!mains[mainIndex]?.nlpProfile,
          hasNlpProfileExamples: !!savedNlpProfileExamples,
          nlpProfileExamplesCount: savedNlpProfileExamples.length,
          nlpProfileExamples: savedNlpProfileExamples.slice(0, 3)
        });
      }

      // CRITICAL: Save updated.steps as dictionary
      // After validation strict, updatedNode.steps MUST be dictionary format
      const nodeTemplateId = getNodeIdStrict(updatedNode);
      if (nodeTemplateId && updatedNode.steps && task) {
        // Initialize task.steps as dictionary if it doesn't exist
        if (!task.steps || typeof task.steps !== 'object' || Array.isArray(task.steps)) {
          task.steps = {};
        }

        // Steps MUST be dictionary format (validated by validateNodeStructure)
        if (Array.isArray(updatedNode.steps)) {
          throw new Error(
            `[applyNodeUpdate] updatedNode.steps is array. Expected dictionary format. ` +
            `Node id: ${nodeTemplateId}. This should have been caught by validateNodeStructure.`
          );
        }

        // Save in dictionary using nodeTemplateId as key
        task.steps[nodeTemplateId] = updatedNode.steps;
      }
    } else {
      // Sub node
      // After validation strict, main.subNodes MUST exist (not subTasks)
      if (!main.subNodes || !Array.isArray(main.subNodes)) {
        throw new Error(
          `[applyNodeUpdate] Main node missing subNodes array. ` +
          `Main id: ${main.id || main.templateId}. This should have been caught by validateNodeStructure.`
        );
      }

      const subList = [...main.subNodes];
      const subIdx = subList.findIndex((s: any, idx: number) => idx === subIndex);
      if (subIdx >= 0) {
        subList[subIdx] = updatedNode;
        main.subNodes = subList;
        mains[mainIndex] = main;
        updatedTaskTree.nodes = mains;

        // CRITICAL: Save updated.steps as dictionary
        // After validation strict, updatedNode.steps MUST be dictionary format
        const nodeTemplateId = getNodeIdStrict(updatedNode);
        if (nodeTemplateId && updatedNode.steps && task) {
          // Initialize task.steps as dictionary if it doesn't exist
          if (!task.steps || typeof task.steps !== 'object' || Array.isArray(task.steps)) {
            task.steps = {};
          }

          // Steps MUST be dictionary format (validated by validateNodeStructure)
          if (Array.isArray(updatedNode.steps)) {
            throw new Error(
              `[applyNodeUpdate] updatedNode.steps is array. Expected dictionary format. ` +
              `Node id: ${nodeTemplateId}. This should have been caught by validateNodeStructure.`
            );
          }

          // Save in dictionary using nodeTemplateId as key
          task.steps[nodeTemplateId] = updatedNode.steps;
        }
      }
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
  const shouldSave = !!(taskToSave?.id || (taskToSave as any)?.instanceId);
  const saveKey = shouldSave ? ((taskToSave as any)?.instanceId || taskToSave?.id) as string : undefined;
  const hasTaskTree = updatedTaskTree && (
    (updatedTaskTree.nodes && updatedTaskTree.nodes.length > 0) ||
    (updatedTaskTree.steps && Array.isArray(updatedTaskTree.steps) && updatedTaskTree.steps.length > 0)
  );

  let taskInstance: Task | null | undefined = undefined;
  let currentTemplateId: string | null | undefined = undefined;

  if (shouldSave && hasTaskTree && saveKey) {
    taskInstance = taskRepository.getTask(saveKey);
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
  currentProjectId: string | null
): Promise<void> {
  try {
    await saveTaskToRepository(key, updatedTaskTree, taskInstance, currentProjectId);
  } catch (err) {
    console.error('[ResponseEditor] Failed to save task:', err);
  }
}

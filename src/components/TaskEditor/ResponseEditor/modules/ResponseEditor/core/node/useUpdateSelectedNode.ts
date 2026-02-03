// Please write clean, production-grade TypeScript code.
// Avoid non-ASCII characters, Chinese symbols, or multilingual output.

import { useCallback } from 'react';
import { getIsTesting } from '../../../../testingState';
import { applyNodeUpdate, updateDockTreeWithTaskTree, saveTaskAsync } from './applyNodeUpdate';
import type { Task, TaskTree } from '../../../../../../../types/taskTypes';

export interface UseUpdateSelectedNodeParams {
  selectedNodePath: {
    mainIndex: number;
    subIndex?: number;
  } | null;
  selectedRoot: boolean;
  taskTreeRef: React.MutableRefObject<TaskTree | null | undefined>;
  taskTree: TaskTree | null | undefined;
  task: Task | null | undefined;
  currentProjectId: string | null;
  tabId?: string;
  setDockTree?: (updater: (prev: any) => any) => void;
  setSelectedNode: React.Dispatch<React.SetStateAction<any>>;
  setTaskTreeVersion: React.Dispatch<React.SetStateAction<number>>;
}

/**
 * Hook that provides the updateSelectedNode callback.
 * This hook encapsulates all the logic for updating a selected node in the ResponseEditor.
 */
export function useUpdateSelectedNode(params: UseUpdateSelectedNodeParams) {
  const {
    selectedNodePath,
    selectedRoot,
    taskTreeRef,
    taskTree,
    task,
    currentProjectId,
    tabId,
    setDockTree,
    setSelectedNode,
    setTaskTreeVersion,
  } = params;

  const updateSelectedNode = useCallback((updater: (node: any) => any, notifyProvider: boolean = true) => {
    // CRITICAL: Block structural mutations during batch testing
    if (getIsTesting()) {
      console.log('[updateSelectedNode] Blocked: batch testing active');
      return;
    }

    setSelectedNode((prev: any) => {
      if (!prev || !selectedNodePath) {
        return prev;
      }

      const updated = updater(prev) || prev;

      // LOG: Always log dataContract comparison (even if unchanged)
      const dataContractChanged = updated.dataContract !== prev.dataContract;
      const updatedRegex = updated.dataContract?.contracts?.find((c: any) => c.type === 'regex')?.patterns?.[0];
      if (dataContractChanged && updatedRegex) {
        console.log('[REGEX] UPDATE - updateSelectedNode', {
          nodeId: updated.id,
          regexPattern: updatedRegex
        });
      }

      // Apply node update using pure function
      const result = applyNodeUpdate({
        prevNode: prev,
        updatedNode: updated,
        selectedNodePath,
        selectedRoot,
        currentTaskTree: taskTreeRef.current || taskTree,
        task,
        currentProjectId,
        tabId,
      });

      // If validation failed, return previous node
      if (result.validationFailed) {
        alert(`Invalid structure: ${result.validationError}`);
        return prev;
      }

      // STEP 3: Update taskTreeRef.current (local buffer)
      taskTreeRef.current = result.updatedTaskTree;

      // LOG: Verify nlpProfile.examples is present in taskTreeRef.current after update
      const { mainIndex } = selectedNodePath;
      const taskTreeRefNlpProfileExamples = taskTreeRef.current?.nodes?.[mainIndex]?.nlpProfile?.examples;
      if (taskTreeRefNlpProfileExamples) {
        console.log('[EXAMPLES] UPDATE - Verified in taskTreeRef.current', {
          nodeId: updated.id,
          mainIndex,
          hasNlpProfile: !!taskTreeRef.current?.nodes?.[mainIndex]?.nlpProfile,
          hasNlpProfileExamples: !!taskTreeRefNlpProfileExamples,
          nlpProfileExamplesCount: taskTreeRefNlpProfileExamples.length,
          nlpProfileExamples: taskTreeRefNlpProfileExamples.slice(0, 3)
        });
      }

      // STEP 4: Update dockTree immediately (SOURCE OF TRUTH) - only if available
      if (result.shouldUpdateDockTree && tabId && setDockTree) {
        setDockTree(prev => updateDockTreeWithTaskTree(prev, tabId, result.updatedTaskTree));
      }

      // STEP 5: Implicit and immediate save (ALWAYS, even without tabId/setDockTree)
      // Every modification is saved immediately in taskRepository to ensure persistence
      if (result.shouldSave && result.saveKey && result.taskInstance !== undefined) {
        // Save asynchronously (don't block UI)
        void saveTaskAsync(
          result.saveKey,
          result.updatedTaskTree,
          result.taskInstance,
          currentProjectId
        );
      }

      // CRITICAL: Update taskTreeRef.current.steps for synchronization
      // This is needed because applyNodeUpdate mutates task.steps but not taskTreeRef.current.steps
      if (task && result.updatedTaskTree) {
        const nodeTemplateId = updated.templateId || updated.id;
        if (nodeTemplateId && updated.steps) {
          if (taskTreeRef.current) {
            if (!taskTreeRef.current.steps || typeof taskTreeRef.current.steps !== 'object' || Array.isArray(taskTreeRef.current.steps)) {
              taskTreeRef.current.steps = {};
            }
            // Get the steps dict from task.steps (already updated by applyNodeUpdate)
            const nodeStepsDict = task.steps?.[nodeTemplateId];
            if (nodeStepsDict) {
              taskTreeRef.current.steps[nodeTemplateId] = nodeStepsDict;
            }
          }
        }
      }

      // Only internal invalidator (don't notify provider to avoid re-mount)
      setTaskTreeVersion(v => v + 1);

      try {
        if (localStorage.getItem('debug.nodeSync') === '1') {
          const steps = updated?.steps || [];
          const escalationsCount = steps.reduce((acc: number, step: any) =>
            acc + (step?.escalations?.length || 0), 0);
          const tasksCount = steps.reduce((acc: number, step: any) =>
            acc + (step?.escalations?.reduce((a: number, esc: any) =>
              a + (esc?.tasks?.length || 0), 0) || 0), 0);
          console.log('[NODE_SYNC][UPDATE] ✅ selectedNode updated + dockTree updated', {
            stepsCount: steps.length,
            escalationsCount,
            tasksCount
          });
        }
      } catch { }

      return result.updatedNode;
    });
  }, [selectedNodePath, selectedRoot, tabId, setDockTree, taskTree?.label, taskTree?.nodes?.length ?? 0, task, currentProjectId, taskTreeRef, setSelectedNode, setTaskTreeVersion]);

  return updateSelectedNode;
}

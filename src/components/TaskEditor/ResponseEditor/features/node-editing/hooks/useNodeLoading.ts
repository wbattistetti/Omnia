// Please write clean, production-grade TypeScript code.
// Avoid non-ASCII characters, Chinese symbols, or multilingual output.

import { useEffect } from 'react';
import { getMainNodes, getSubNodes } from '@responseEditor/core/domain';
import { getNodeByPath } from '@responseEditor/core/taskTree';
import { useTaskTreeFromStore, useTaskTreeVersion } from '@responseEditor/core/state';
import type { Task, TaskTree } from '@types/taskTypes';
import { logBehaviourSteps, summarizeStepsShape } from '@responseEditor/behaviour/behaviourStepsDebug';

export interface UseNodeLoadingParams {
  selectedPath: number[];
  selectedRoot: boolean;
  introduction: any;

  task?: Task | null | undefined;

  setSelectedNode: React.Dispatch<React.SetStateAction<any>>;
  setSelectedNodePath: React.Dispatch<React.SetStateAction<{ path: number[] } | null>>;

  getStepsForNode: (steps: any, nodeTemplateId: string) => Record<string, any>;
  getStepsAsArray: (steps: any) => any[];
}

/**
 * Hook that loads the selected node into editor state when selection or TaskTree changes.
 */
export function useNodeLoading(params: UseNodeLoadingParams) {
  const {
    selectedPath,
    selectedRoot,
    introduction,
    task,
    setSelectedNode,
    setSelectedNodePath,
    getStepsForNode,
    getStepsAsArray,
  } = params;

  const taskTreeFromStore = useTaskTreeFromStore();
  const taskTreeVersion = useTaskTreeVersion();

  const pathKey = selectedPath.join(',');

  useEffect(() => {
    const currentTaskTree = taskTreeFromStore;
    const currentMainList = getMainNodes(currentTaskTree);

    if (currentMainList.length === 0) {
      return;
    }

    if (selectedRoot) {
      const introStep = currentTaskTree?.introduction
        ? { type: 'introduction', escalations: currentTaskTree.introduction.escalations }
        : { type: 'introduction', escalations: [] };
      const newNode = { ...currentTaskTree, steps: [introStep] };

      setSelectedNode(newNode);
      setSelectedNodePath(null);
    } else {
      const node = getNodeByPath(currentMainList, selectedPath);
      if (node) {
        const nodeTemplateId = node.templateId ?? node.id;

        if (!currentTaskTree?.steps) {
          throw new Error(`[useNodeLoading] TaskTree.steps is missing. Node templateId: ${nodeTemplateId}`);
        }
        const stepsSource = currentTaskTree.steps;
        const nodeStepsDict = getStepsForNode(stepsSource, nodeTemplateId);
        // Always replace node.steps with the task-tree dictionary so Behaviour never sees
        // a stale MaterializedStep[] left on the tree node reference (would break getNodeStepKeys).
        node.steps = nodeStepsDict;

        logBehaviourSteps('useNodeLoading', {
          pathKey,
          taskTreeVersion,
          nodeId: node.id,
          nodeTemplateId,
          stepsSourceTopKeys:
            stepsSource && typeof stepsSource === 'object' && !Array.isArray(stepsSource)
              ? Object.keys(stepsSource as Record<string, unknown>)
              : ['(not a dict)'],
          attachedNodeSteps: summarizeStepsShape(nodeStepsDict),
        });

        const steps = getStepsAsArray(node?.steps);
        const startStepTasksCount = steps.find((s: any) => s?.type === 'start')?.escalations?.reduce((acc: number, esc: any) => acc + (esc?.tasks?.length || 0), 0) || 0;

        try {
          if (localStorage.getItem('debug.nodeSync') === '1') {
            const stepsArr = getStepsAsArray(node?.steps);
            stepsArr.reduce((acc: number, step: any) =>
              acc + (step?.escalations?.length || 0), 0);
          }
        } catch { }

        void startStepTasksCount;

        setSelectedNode(node);
        setSelectedNodePath({ path: [...selectedPath] });
      }
    }

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathKey, selectedRoot, introduction, taskTreeVersion, setSelectedNode, setSelectedNodePath, getStepsForNode, getStepsAsArray]);
}

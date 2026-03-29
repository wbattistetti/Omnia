// Please write clean, production-grade TypeScript code.
// Avoid non-ASCII characters, Chinese symbols, or multilingual output.

import { useEffect, useRef } from 'react';
import { getMainNodes } from '@responseEditor/core/domain';
import { getNodeByPath } from '@responseEditor/core/taskTree';
import { useTaskTreeFromStore, useTaskTreeVersion } from '@responseEditor/core/state';
import type { Task, TaskTree } from '@types/taskTypes';
import { logBehaviourSteps, summarizeStepsShape } from '@responseEditor/behaviour/behaviourStepsDebug';
import { logStepsStrip } from '@responseEditor/behaviour/stepsStripDebug';

export interface UseNodeLoadingParams {
  selectedPath: number[];
  selectedRoot: boolean;
  introduction: any;

  task?: Task | null | undefined;

  setSelectedNode: React.Dispatch<React.SetStateAction<any>>;
  setSelectedNodePath: React.Dispatch<React.SetStateAction<{ path: number[] } | null>>;
  /** Clears root selection when the tree has no main nodes (manual empty / reset). */
  setSelectedRoot?: (value: boolean) => void;

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
    setSelectedRoot,
    getStepsForNode,
    getStepsAsArray,
  } = params;

  const taskTreeFromStore = useTaskTreeFromStore();
  const taskTreeVersion = useTaskTreeVersion();

  const pathKey = selectedPath.join(',');
  /** Detects setSelectedNode(node) with same reference after mutating node.steps (React may skip update). */
  const lastPushedNodeRef = useRef<unknown>(null);

  useEffect(() => {
    const currentTaskTree = taskTreeFromStore;
    const currentMainList = getMainNodes(currentTaskTree);

    if (currentMainList.length === 0) {
      setSelectedNode(null);
      setSelectedNodePath(null);
      setSelectedRoot?.(false);
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

        // Shallow copy so setSelectedNode receives a new reference: React skips re-renders when
        // the same object is passed after in-place mutation, which hid StepsStrip until another
        // update (e.g. escalation) forced a render.
        const nodeForEditor = { ...node, steps: nodeStepsDict };

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

        const sliceKeys = Object.keys(nodeStepsDict || {});
        const topKeys =
          stepsSource && typeof stepsSource === 'object' && !Array.isArray(stepsSource)
            ? Object.keys(stepsSource as Record<string, unknown>)
            : [];
        const sameRefAsPreviousSetSelected = lastPushedNodeRef.current === nodeForEditor;
        logStepsStrip('useNodeLoading:attachSteps', {
          pathKey,
          taskTreeVersion,
          nodeId: node.id,
          templateId: node.templateId,
          lookupKey: nodeTemplateId,
          sliceKeys,
          taskTreeStepsTopKeys: topKeys,
          hasSliceUnderLookupKey: topKeys.includes(String(nodeTemplateId)),
          sameRefAsPreviousSetSelected,
          /** If true, React may not re-render Behaviour after steps attach — strip stays empty. */
          riskStaleUiFromSameReference: sameRefAsPreviousSetSelected,
        });

        const steps = getStepsAsArray(nodeForEditor.steps);
        const startStepTasksCount = steps.find((s: any) => s?.type === 'start')?.escalations?.reduce((acc: number, esc: any) => acc + (esc?.tasks?.length || 0), 0) || 0;

        try {
          if (localStorage.getItem('debug.nodeSync') === '1') {
            const stepsArr = getStepsAsArray(nodeForEditor.steps);
            stepsArr.reduce((acc: number, step: any) =>
              acc + (step?.escalations?.length || 0), 0);
          }
        } catch { }

        void startStepTasksCount;

        lastPushedNodeRef.current = nodeForEditor;
        setSelectedNode(nodeForEditor);
        setSelectedNodePath({ path: [...selectedPath] });
      }
    }

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathKey, selectedRoot, introduction, taskTreeVersion, setSelectedNode, setSelectedNodePath, getStepsForNode, getStepsAsArray]);
}

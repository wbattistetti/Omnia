/**
 * useTaskTreeWizardModal
 *
 * Hook for managing external TaskTree wizard modal state.
 * This hook provides a centralized way to open/close the wizard
 * and handle completion.
 */

import { useState, useCallback } from 'react';
import type { TaskTree } from '../../../types/taskTypes';
import { TaskType } from '../../../types/taskTypes';

export interface TaskTreeWizardModalState {
  isOpen: boolean;
  taskLabel?: string;
  taskType?: TaskType | string;
  initialTaskTree?: TaskTree;
  startOnStructure?: boolean;
  onCompleteCallback?: (taskTree: TaskTree, messages?: any) => Promise<void>;
}

export function useTaskTreeWizardModal() {
  const [modalState, setModalState] = useState<TaskTreeWizardModalState>({
    isOpen: false,
  });

  const openWizard = useCallback(
    (params: {
      taskLabel?: string;
      taskType?: TaskType | string;
      initialTaskTree?: TaskTree;
      startOnStructure?: boolean;
      onComplete?: (taskTree: TaskTree, messages?: any) => Promise<void>;
    }) => {
      setModalState({
        isOpen: true,
        taskLabel: params.taskLabel,
        taskType: params.taskType,
        initialTaskTree: params.initialTaskTree,
        startOnStructure: params.startOnStructure ?? false,
        onCompleteCallback: params.onComplete,
      });
    },
    []
  );

  const closeWizard = useCallback(() => {
    setModalState({
      isOpen: false,
    });
  }, []);

  const handleWizardComplete = useCallback(
    async (taskTree: TaskTree, messages?: any) => {
      if (modalState.onCompleteCallback) {
        await modalState.onCompleteCallback(taskTree, messages);
      }
      closeWizard();
    },
    [modalState.onCompleteCallback, closeWizard]
  );

  return {
    modalState,
    openWizard,
    closeWizard,
    handleWizardComplete,
  };
}

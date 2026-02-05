// Please write clean, production-grade TypeScript code.
// Avoid non-ASCII characters, Chinese symbols, or multilingual output.

import { useCallback } from 'react';
import { useTaskTreeManager } from '../../../../context/DDTManagerContext';
import { useResponseEditorWizard } from './useResponseEditorWizard';
import { useResponseEditorToolbar } from '../ResponseEditorToolbar';
import { usePanelModes } from './usePanelModes';
import type { Task, TaskTree } from '../../../../types/taskTypes';
import type { RightPanelMode } from '../RightPanel';

export interface UseResponseEditorInitializationParams {
  task: Task | null | undefined;
  taskTree: TaskTree | null | undefined;
  taskTreeRef: React.MutableRefObject<TaskTree | null | undefined>;
  showContractWizard: boolean;
  setShowContractWizard: React.Dispatch<React.SetStateAction<boolean>>;
  setTaskTreeVersion: React.Dispatch<React.SetStateAction<number>>;
  setLeftPanelMode: React.Dispatch<React.SetStateAction<RightPanelMode>>;
  replaceSelectedTaskTree: (taskTree: TaskTree) => void;
  leftPanelMode: RightPanelMode;
  testPanelMode: RightPanelMode;
  tasksPanelMode: RightPanelMode;
  showSynonyms: boolean;
  setShowSynonyms: React.Dispatch<React.SetStateAction<boolean>>;
  showMessageReview: boolean;
  setShowMessageReview: React.Dispatch<React.SetStateAction<boolean>>;
  rightMode: RightPanelMode;
  rightWidth: number;
  setRightWidth: (width: number) => void;
  testPanelWidth: number;
  setTestPanelWidth: (width: number) => void;
  tasksPanelWidth: number;
  setTasksPanelWidth: (width: number) => void;
}

export interface UseResponseEditorInitializationResult {
  replaceSelectedTaskTree: (taskTree: TaskTree) => void;
  handleGenerateAll: () => void;
  handleContractWizardClose: () => void;
  handleContractWizardNodeUpdate: (nodeId: string) => void;
  handleContractWizardComplete: (results: any) => void;
  saveLeftPanelMode: (m: RightPanelMode) => void;
  saveTestPanelMode: (m: RightPanelMode) => void;
  saveTasksPanelMode: (m: RightPanelMode) => void;
  saveRightMode: (m: RightPanelMode) => void;
  toolbarButtons: any[];
}

/**
 * Hook that provides all initialization logic for ResponseEditor (toolbar, panel modes, ContractWizard).
 *
 * NOTE: TaskWizard is now external (TaskTreeWizardModal) and no longer managed here.
 */
export function useResponseEditorInitialization(params: UseResponseEditorInitializationParams): UseResponseEditorInitializationResult {
  const {
    showContractWizard,
    setShowContractWizard,
    setTaskTreeVersion,
    leftPanelMode,
    testPanelMode,
    tasksPanelMode,
    showSynonyms,
    setShowSynonyms,
    showMessageReview,
    setShowMessageReview,
    rightMode,
    rightWidth,
    setRightWidth,
    testPanelWidth,
    setTestPanelWidth,
    tasksPanelWidth,
    setTasksPanelWidth,
  } = params;

  const { replaceSelectedTaskTree: replaceSelectedTaskTreeFromContext } = useTaskTreeManager();

  const replaceSelectedTaskTree = useCallback((taskTree: TaskTree) => {
    replaceSelectedTaskTreeFromContext(taskTree);
  }, [replaceSelectedTaskTreeFromContext]);

  const {
    handleGenerateAll,
    handleContractWizardClose,
    handleContractWizardNodeUpdate,
    handleContractWizardComplete,
  } = useResponseEditorWizard({
    showContractWizard,
    setShowContractWizard,
    setTaskTreeVersion,
  });

  const {
    saveLeftPanelMode,
    saveTestPanelMode,
    saveTasksPanelMode,
    saveRightMode,
  } = usePanelModes({
    setLeftPanelMode,
    setTestPanelMode: params.setTestPanelMode || (() => {}),
    setTasksPanelMode: params.setTasksPanelMode || (() => {}),
  });

  const toolbarButtons = useResponseEditorToolbar({
    rightMode,
    leftPanelMode,
    testPanelMode,
    tasksPanelMode,
    showSynonyms,
    showMessageReview,
    onRightModeChange: saveRightMode,
    onLeftPanelModeChange: saveLeftPanelMode,
    onTestPanelModeChange: saveTestPanelMode,
    onTasksPanelModeChange: saveTasksPanelMode,
    onToggleSynonyms: () => setShowSynonyms(v => !v),
    onToggleMessageReview: () => setShowMessageReview(v => !v),
    onOpenContractWizard: handleGenerateAll,
    rightWidth,
    onRightWidthChange: setRightWidth,
    testPanelWidth,
    onTestPanelWidthChange: setTestPanelWidth,
    tasksPanelWidth,
    onTasksPanelWidthChange: setTasksPanelWidth,
  });

  return {
    replaceSelectedTaskTree,
    handleGenerateAll,
    handleContractWizardClose,
    handleContractWizardNodeUpdate,
    handleContractWizardComplete,
    saveLeftPanelMode,
    saveTestPanelMode,
    saveTasksPanelMode,
    saveRightMode,
    toolbarButtons,
  };
}

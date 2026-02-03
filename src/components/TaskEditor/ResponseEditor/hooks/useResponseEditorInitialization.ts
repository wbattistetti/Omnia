// Please write clean, production-grade TypeScript code.
// Avoid non-ASCII characters, Chinese symbols, or multilingual output.

import { useCallback } from 'react';
import { useDDTManager } from '../../../../context/DDTManagerContext';
import { useWizardInference } from './useWizardInference';
import { useResponseEditorWizard } from './useResponseEditorWizard';
import { useResponseEditorToolbar } from '../ResponseEditorToolbar';
import { usePanelModes } from './usePanelModes';
import type { Task, TaskTree } from '../../../../types/taskTypes';
import type { RightPanelMode } from '../RightPanel';

export interface UseResponseEditorInitializationParams {
  task: Task | null | undefined;
  taskTree: TaskTree | null | undefined;
  taskTreeRef: React.MutableRefObject<TaskTree | null | undefined>;
  isTaskTreeLoading?: boolean;
  currentProjectId: string | null;
  selectedProvider: string;
  selectedModel: string;
  preAssembledTaskTreeCache: React.MutableRefObject<Map<string, { taskTree: any; _templateTranslations: Record<string, { en: string; it: string; pt: string }> }>>;
  wizardOwnsDataRef: React.MutableRefObject<boolean>;
  showContractWizard: boolean;
  setShowContractWizard: React.Dispatch<React.SetStateAction<boolean>>;
  setTaskTreeVersion: React.Dispatch<React.SetStateAction<number>>;
  setLeftPanelMode: React.Dispatch<React.SetStateAction<RightPanelMode>>;
  replaceSelectedTaskTree: (taskTree: TaskTree) => void;
  onClose?: () => void;
  onWizardComplete?: (finalTaskTree: TaskTree) => void;
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
  showWizard: boolean;
}

export interface UseResponseEditorInitializationResult {
  replaceSelectedTaskTree: (taskTree: TaskTree) => void;
  showWizard: boolean;
  setShowWizard: React.Dispatch<React.SetStateAction<boolean>>;
  isInferring: boolean;
  setIsInferring: React.Dispatch<React.SetStateAction<boolean>>;
  inferenceResult: any;
  setInferenceResult: React.Dispatch<React.SetStateAction<any>>;
  handleGenerateAll: () => void;
  handleContractWizardClose: () => void;
  handleContractWizardNodeUpdate: (nodeId: string) => void;
  handleContractWizardComplete: (results: any) => void;
  handleDDTWizardCancel: () => void;
  handleDDTWizardComplete: (finalDDT: TaskTree, messages?: any) => Promise<void>;
  getInitialDDT: () => TaskTree | undefined;
  shouldShowInferenceLoading: boolean;
  saveLeftPanelMode: (m: RightPanelMode) => void;
  saveTestPanelMode: (m: RightPanelMode) => void;
  saveTasksPanelMode: (m: RightPanelMode) => void;
  saveRightMode: (m: RightPanelMode) => void;
  toolbarButtons: any[];
}

/**
 * Hook that provides all initialization logic for ResponseEditor (wizard, toolbar, panel modes).
 */
export function useResponseEditorInitialization(params: UseResponseEditorInitializationParams): UseResponseEditorInitializationResult {
  const {
    task,
    taskTree,
    taskTreeRef,
    isTaskTreeLoading,
    currentProjectId,
    selectedProvider,
    selectedModel,
    preAssembledTaskTreeCache,
    wizardOwnsDataRef,
    showContractWizard,
    setShowContractWizard,
    setTaskTreeVersion,
    setLeftPanelMode,
    replaceSelectedTaskTree: replaceSelectedTaskTreeParam,
    onClose,
    onWizardComplete,
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
    showWizard: showWizardParam,
  } = params;

  const { replaceSelectedDDT } = useDDTManager();

  const replaceSelectedTaskTree = useCallback((taskTree: TaskTree) => {
    replaceSelectedDDT(taskTree);
  }, [replaceSelectedDDT]);

  const {
    showWizard,
    setShowWizard,
    isInferring,
    setIsInferring,
    inferenceResult,
    setInferenceResult,
  } = useWizardInference({
    taskTree,
    taskTreeRef,
    task: task && 'templateId' in task ? task : null,
    isTaskTreeLoading: isTaskTreeLoading ?? false,
    currentProjectId,
    selectedProvider,
    selectedModel,
    preAssembledTaskTreeCache,
    wizardOwnsDataRef,
  });

  const {
    handleGenerateAll,
    handleContractWizardClose,
    handleContractWizardNodeUpdate,
    handleContractWizardComplete,
    handleDDTWizardCancel,
    handleDDTWizardComplete,
    getInitialDDT,
    shouldShowInferenceLoading,
  } = useResponseEditorWizard({
    task: task && 'templateId' in task ? task : null,
    taskTree,
    taskTreeRef,
    currentProjectId,
    showWizard: showWizardParam || showWizard,
    showContractWizard,
    isInferring,
    inferenceResult,
    setShowWizard,
    setShowContractWizard,
    setTaskTreeVersion,
    setLeftPanelMode,
    replaceSelectedDDT: replaceSelectedTaskTree,
    wizardOwnsDataRef,
    onClose,
    onWizardComplete,
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
    showWizard: showWizardParam || showWizard,
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
    showWizard: showWizardParam || showWizard,
    setShowWizard,
    isInferring,
    setIsInferring,
    inferenceResult,
    setInferenceResult,
    handleGenerateAll,
    handleContractWizardClose,
    handleContractWizardNodeUpdate,
    handleContractWizardComplete,
    handleDDTWizardCancel,
    handleDDTWizardComplete,
    getInitialDDT,
    shouldShowInferenceLoading,
    saveLeftPanelMode,
    saveTestPanelMode,
    saveTasksPanelMode,
    saveRightMode,
    toolbarButtons,
  };
}

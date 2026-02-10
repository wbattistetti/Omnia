// Please write clean, production-grade TypeScript code.
// Avoid non-ASCII characters, Chinese symbols, or multilingual output.

import { useCallback } from 'react';
import { useTaskTreeManager } from '@context/DDTManagerContext';
import { useResponseEditorWizard } from '@responseEditor/hooks/useResponseEditorWizard';
import { useResponseEditorToolbar } from '@responseEditor/ResponseEditorToolbar';
import { usePanelModes } from '@responseEditor/hooks/usePanelModes';
import { taskRepository } from '@services/TaskRepository';
import type { Task, TaskTree, TaskMeta } from '@types/taskTypes';
import type { RightPanelMode } from '@responseEditor/RightPanel';

export interface UseResponseEditorInitializationParams {
  task: Task | null | undefined;
  taskTree: TaskTree | null | undefined;
  // ✅ FASE 3: taskTreeRef rimosso - store è single source of truth
  showContractWizard: boolean;
  setShowContractWizard: React.Dispatch<React.SetStateAction<boolean>>;
  setTaskTreeVersion: React.Dispatch<React.SetStateAction<number>>;
  setLeftPanelMode: React.Dispatch<React.SetStateAction<RightPanelMode>>;
  setTestPanelMode: React.Dispatch<React.SetStateAction<RightPanelMode>>;
  setTasksPanelMode: React.Dispatch<React.SetStateAction<RightPanelMode>>;
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
  // ✅ NEW: Wizard states
  taskMeta?: TaskMeta | null;
  contextualizationAbortController: AbortController | null;
  setContextualizationAbortController: React.Dispatch<React.SetStateAction<AbortController | null>>;
  setNeedsTaskContextualization: React.Dispatch<React.SetStateAction<boolean>>;
  setNeedsTaskBuilder: React.Dispatch<React.SetStateAction<boolean>>;
  setWizardMode: React.Dispatch<React.SetStateAction<'library' | 'ai' | null>>;
  // ✅ NEW: Generalization params
  shouldBeGeneral?: boolean;
  saveDecisionMade?: boolean;
  onOpenSaveDialog?: () => void;
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
    setLeftPanelMode,
    setTestPanelMode,
    setTasksPanelMode,
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
    // ✅ NEW: Wizard states
    taskMeta,
    contextualizationAbortController,
    setContextualizationAbortController,
    setNeedsTaskContextualization,
    setNeedsTaskBuilder,
    setWizardMode,
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
    setTestPanelMode,
    setTasksPanelMode,
  });

  // ✅ NEW: Wizard handlers
  const handleChooseFromLibrary = useCallback(() => {
    // Interrupt contextualization if in progress
    if (contextualizationAbortController) {
      contextualizationAbortController.abort();
      setContextualizationAbortController(null);
    }

    // Check if instance exists
    const instanceId = taskMeta?.instanceId || taskMeta?.id;
    const existingTask = instanceId ? taskRepository.getTask(instanceId) : null;

    if (existingTask) {
      // Ask for confirmation
      const confirmed = window.confirm(
        'Un\'istanza del task esiste già. Vuoi sovrascriverla con un template dalla libreria?'
      );
      if (!confirmed) {
        return;
      }
    }

    // Switch to library mode
    setNeedsTaskContextualization(false);
    setNeedsTaskBuilder(true);
    setWizardMode('library');
  }, [taskMeta, contextualizationAbortController, setContextualizationAbortController, setNeedsTaskContextualization, setNeedsTaskBuilder, setWizardMode]);

  const handleGenerateNewTask = useCallback(() => {
    // Interrupt contextualization if in progress
    if (contextualizationAbortController) {
      contextualizationAbortController.abort();
      setContextualizationAbortController(null);
    }

    // Check if instance exists
    const instanceId = taskMeta?.instanceId || taskMeta?.id;
    const existingTask = instanceId ? taskRepository.getTask(instanceId) : null;

    if (existingTask) {
      // Ask for confirmation
      const confirmed = window.confirm(
        'Un\'istanza del task esiste già. Vuoi sovrascriverla con un nuovo task generato da AI?'
      );
      if (!confirmed) {
        return;
      }
    }

    // Switch to AI generation mode
    setNeedsTaskContextualization(false);
    setNeedsTaskBuilder(true);
    setWizardMode('ai');
  }, [taskMeta, contextualizationAbortController, setContextualizationAbortController, setNeedsTaskContextualization, setNeedsTaskBuilder, setWizardMode]);

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
    rightWidth,
    onRightWidthChange: setRightWidth,
    testPanelWidth,
    onTestPanelWidthChange: setTestPanelWidth,
    tasksPanelWidth,
    onTasksPanelWidthChange: setTasksPanelWidth,
    // ✅ NEW: Wizard handlers
    onChooseFromLibrary: handleChooseFromLibrary,
    onGenerateNewTask: handleGenerateNewTask,
    // ✅ NEW: Generalization handlers
    shouldBeGeneral: params.shouldBeGeneral,
    saveDecisionMade: params.saveDecisionMade,
    onOpenSaveDialog: params.onOpenSaveDialog,
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

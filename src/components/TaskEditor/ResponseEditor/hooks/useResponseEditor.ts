// Please write clean, production-grade TypeScript code.
// Avoid non-ASCII characters, Chinese symbols, or multilingual output.

/**
 * useResponseEditor
 *
 * Main composite hook that combines all logic for ResponseEditor.
 * This hook orchestrates core logic, handlers, and returns everything needed for rendering.
 *
 * ✅ FASE 3.1: Extracted from index.tsx to reduce complexity
 */

import React from 'react';
import { useResponseEditorCore } from '@responseEditor/hooks/useResponseEditorCore';
import { useResponseEditorHandlers } from '@responseEditor/hooks/useResponseEditorHandlers';
import type { TaskMeta, Task } from '@types/taskTypes';
import type { TaskTree } from '@types/taskTypes';
import type { TaskWizardMode } from '@taskEditor/EditorHost/types';

export interface UseResponseEditorParams {
  taskTree?: TaskTree | null;
  task?: TaskMeta | Task;
  isTaskTreeLoading?: boolean;
  onWizardComplete?: (finalTaskTree: TaskTree) => void;
  currentProjectId: string | null;
  tabId?: string;
  setDockTree?: (updater: (prev: any) => any) => void;
  onClose?: () => void;
  hideHeader?: boolean;
  onToolbarUpdate?: (toolbar: any[], color: string) => void;
  registerOnClose?: (fn: () => Promise<boolean>) => void;
  // ✅ NEW: Generalization params
  shouldBeGeneral?: boolean;
  saveDecisionMade?: boolean;
  onOpenSaveDialog?: () => void;
}

export interface UseResponseEditorResult {
  // Core data
  core: ReturnType<typeof useResponseEditorCore>;

  // Handlers
  handlers: ReturnType<typeof useResponseEditorHandlers>;

  // Convenience accessors
  state: ReturnType<typeof useResponseEditorCore>['state'];
  refs: ReturnType<typeof useResponseEditorCore>['refs'];
  nodeSelection: ReturnType<typeof useResponseEditorCore>['nodeSelection'];
  initialization: ReturnType<typeof useResponseEditorCore>['initialization'];
  panelWidths: ReturnType<typeof useResponseEditorCore>['panelWidths'];

  // Derived values
  taskMeta: ReturnType<typeof useResponseEditorCore>['taskMeta'];
  localTranslations: ReturnType<typeof useResponseEditorCore>['localTranslations'];
  mainList: ReturnType<typeof useResponseEditorCore>['mainList'];
  isAggregatedAtomic: ReturnType<typeof useResponseEditorCore>['isAggregatedAtomic'];
  needsIntentMessages: ReturnType<typeof useResponseEditorCore>['needsIntentMessages'];
  taskType: ReturnType<typeof useResponseEditorCore>['taskType'];
  headerTitle: ReturnType<typeof useResponseEditorCore>['headerTitle'];
  icon: ReturnType<typeof useResponseEditorCore>['icon'];
  iconColor: ReturnType<typeof useResponseEditorCore>['iconColor'];
  isGeneralizable: ReturnType<typeof useResponseEditorCore>['isGeneralizable'];
  generalizationReason: ReturnType<typeof useResponseEditorCore>['generalizationReason'];

  // Handlers
  sidebar: ReturnType<typeof useResponseEditorHandlers>['sidebar']; // ✅ FASE 2.1: Consolidated sidebar hook
  handleEditorClose: ReturnType<typeof useResponseEditorHandlers>['handleEditorClose'];
  contractDialogHandlers: ReturnType<typeof useResponseEditorHandlers>['contractDialogHandlers'];
  handleParserCreate: ReturnType<typeof useResponseEditorCore>['handleParserCreate'];
  handleParserModify: ReturnType<typeof useResponseEditorCore>['handleParserModify'];
  handleEngineChipClick: ReturnType<typeof useResponseEditorCore>['handleEngineChipClick'];
  handleProfileUpdate: ReturnType<typeof useResponseEditorCore>['handleProfileUpdate'];
  handleIntentMessagesComplete: ReturnType<typeof useResponseEditorCore>['handleIntentMessagesComplete'];
  handleGenerateAll: ReturnType<typeof useResponseEditorCore>['initialization']['handleGenerateAll'];
  handleContractWizardClose: ReturnType<typeof useResponseEditorCore>['initialization']['handleContractWizardClose'];
  handleContractWizardNodeUpdate: ReturnType<typeof useResponseEditorCore>['initialization']['handleContractWizardNodeUpdate'];
  handleContractWizardComplete: ReturnType<typeof useResponseEditorCore>['initialization']['handleContractWizardComplete'];

  // State values
  selectedMainIndex: number;
  selectedSubIndex: number | null | undefined;
  selectedRoot: boolean;
  sidebarRef: React.RefObject<HTMLDivElement>;
  handleSelectMain: (idx: number) => void;
  handleSelectSub: (idx: number | undefined, mainIdx?: number) => void;
  handleSelectAggregator: () => void;
  selectedNode: any;
  selectedNodePath: { mainIndex: number; subIndex?: number } | null;
  showContractWizard: boolean;
  toolbarButtons: any[];
  rightWidth: number;
  testPanelWidth: number;
  tasksPanelWidth: number;
  draggingPanel: any;
  setDraggingPanel: (panel: any) => void;
  setRightWidth: (width: number) => void;
  setTestPanelWidth: (width: number) => void;
  setTasksPanelWidth: (width: number) => void;
  leftPanelMode: any;
  testPanelMode: any;
  tasksPanelMode: any;
  sidebarManualWidth: number;
  isDraggingSidebar: boolean;
  showMessageReview: boolean;
  showSynonyms: boolean;
  selectedIntentIdForTraining: string | null;
  setSelectedIntentIdForTraining: (id: string | null) => void;
  pendingEditorOpen: boolean;
  serviceUnavailable: { service: string; message: string; endpoint?: string; onRetry?: () => void } | null;
  setServiceUnavailable: (value: any) => void;
  showContractDialog: boolean;
  pendingContractChange: { templateId: string; templateLabel: string; modifiedContract: any } | null;
  updateSelectedNode: ReturnType<typeof useResponseEditorCore>['updateSelectedNode'];

  // Refs
  rootRef: React.RefObject<HTMLDivElement>;
  contractChangeRef: React.MutableRefObject<any>;
  tasksStartWidthRef: React.MutableRefObject<number>;
  tasksStartXRef: React.MutableRefObject<number>;
  replaceSelectedTaskTree: (taskTree: TaskTree) => void;
  escalationTasks: any[];

  // ✅ NEW: Wizard mode state (primary)
  taskWizardMode: TaskWizardMode;
  setTaskWizardMode: React.Dispatch<React.SetStateAction<TaskWizardMode>>;
  // ✅ DEPRECATED: Backward compatibility wizard states
  needsTaskContextualization: boolean;
  needsTaskBuilder: boolean;
  isContextualizing: boolean;
  contextualizationTemplateId: string | null;
  taskLabel: string;
  wizardMode: 'library' | 'ai' | null;

  // ✅ NEW: Wizard complete handler
  onWizardComplete?: (finalTaskTree: TaskTree) => void;
  setNeedsTaskBuilder: React.Dispatch<React.SetStateAction<boolean>>;

  // ✅ NEW: Wizard callbacks (stable references)
  onTaskContextualizationComplete?: (taskTree: TaskTree) => void;
  onTaskBuilderComplete?: (taskTree: TaskTree, messages?: any) => void;
  onTaskBuilderCancel?: () => void;
}

/**
 * Main composite hook for ResponseEditor.
 */
export function useResponseEditor(params: UseResponseEditorParams): UseResponseEditorResult {
  const {
    taskTree,
    task,
    isTaskTreeLoading,
    onWizardComplete,
    currentProjectId,
    tabId,
    setDockTree,
    onClose,
    hideHeader,
    onToolbarUpdate,
    registerOnClose,
  } = params;

  // Core logic
  const core = useResponseEditorCore({
    taskTree,
    task,
    isTaskTreeLoading,
    onWizardComplete,
    currentProjectId,
    tabId,
    setDockTree,
    // ✅ NEW: Pass generalization params to core
    shouldBeGeneral: params.shouldBeGeneral,
    saveDecisionMade: params.saveDecisionMade,
    onOpenSaveDialog: params.onOpenSaveDialog,
  });

  // Handlers
  const handlers = useResponseEditorHandlers({
    taskTree,
    task,
    currentProjectId,
    state: core.state,
    refs: core.refs,
    nodeSelection: core.nodeSelection,
    panelWidths: core.panelWidths,
    initialization: core.initialization,
    updateSelectedNode: core.updateSelectedNode,
    handleProfileUpdate: core.handleProfileUpdate,
    tabId,
    setDockTree,
    onClose,
    hideHeader,
    onToolbarUpdate,
    registerOnClose,
    // ✅ NEW: Generalization params (will be passed from ResponseEditorLayout)
    shouldBeGeneral: params.shouldBeGeneral,
    saveDecisionMade: params.saveDecisionMade,
    onOpenSaveDialog: params.onOpenSaveDialog,
  });

  // Extract convenience values
  const {
    state,
    refs,
    nodeSelection,
    initialization,
    panelWidths,
    taskMeta,
    localTranslations,
    mainList,
    isAggregatedAtomic,
    needsIntentMessages,
    taskType,
    headerTitle,
    icon,
    iconColor,
    isGeneralizable,
    generalizationReason,
    handleParserCreate,
    handleParserModify,
    handleEngineChipClick,
    handleProfileUpdate,
    handleIntentMessagesComplete,
    updateSelectedNode,
  } = core;

  const {
    sidebar,
    handleEditorClose,
    contractDialogHandlers,
  } = handlers;

  const {
    selectedMainIndex,
    selectedSubIndex,
    selectedRoot,
    sidebarRef,
    handleSelectMain,
    handleSelectSub,
    handleSelectAggregator,
  } = nodeSelection;

  const {
    handleGenerateAll,
    handleContractWizardClose,
    handleContractWizardNodeUpdate,
    handleContractWizardComplete,
    toolbarButtons,
    replaceSelectedTaskTree: replaceSelectedTaskTreeFromInit,
  } = initialization;

  // Safety check: ensure replaceSelectedTaskTreeFromInit is defined
  if (!replaceSelectedTaskTreeFromInit) {
    console.error('[useResponseEditor] replaceSelectedTaskTree is undefined from initialization', { initialization });
  }

  const {
    rightWidth,
    setRightWidth,
    testPanelWidth,
    setTestPanelWidth,
    tasksPanelWidth,
    setTasksPanelWidth,
  } = panelWidths;

  const {
    rootRef,
    contractChangeRef,
    tasksStartWidthRef,
    tasksStartXRef,
  } = refs;

  const {
    selectedNode,
    selectedNodePath,
    showContractWizard,
    leftPanelMode,
    testPanelMode,
    tasksPanelMode,
    sidebarManualWidth,
    isDraggingSidebar,
    showMessageReview,
    showSynonyms,
    selectedIntentIdForTraining,
    setSelectedIntentIdForTraining,
    pendingEditorOpen,
    serviceUnavailable,
    setServiceUnavailable,
    showContractDialog,
    pendingContractChange,
    draggingPanel,
    setDraggingPanel,
    escalationTasks,
    // ✅ NEW: Wizard mode state (primary)
    taskWizardMode,
    setTaskWizardMode,
    // ✅ DEPRECATED: Backward compatibility wizard states
    needsTaskContextualization,
    needsTaskBuilder,
    isContextualizing,
    contextualizationTemplateId,
    taskLabel,
    wizardMode,
    setNeedsTaskBuilder,
  } = state;

  // ✅ ARCHITECTURE: Stable wizard callbacks wrapped in useCallback
  const handleTaskContextualizationComplete = React.useCallback((contextualizedTaskTree: TaskTree) => {
    // TODO: Implement in Phase 13 - save contextualized task tree
    console.log('[useResponseEditor] Task contextualization complete', contextualizedTaskTree);
    // Future: Save contextualized task tree to store/repository
  }, []);

  const handleTaskBuilderComplete = React.useCallback(async (taskTree: TaskTree, messages?: any) => {
    // ✅ Create task when wizard completes (Scenario 2B)
    // Pass to onWizardComplete which will be handled by DDTHostAdapter's handleComplete
    // The handleComplete will create the task if it doesn't exist yet
    if (onWizardComplete) {
      await onWizardComplete(taskTree);
      // Switch from wizard mode to normal editing mode
      setNeedsTaskBuilder(false);
    } else {
      console.error('[useResponseEditor] onWizardComplete not available');
    }
  }, [onWizardComplete, setNeedsTaskBuilder]);

  const handleTaskBuilderCancel = React.useCallback(() => {
    // TODO: Implement in Phase 10 - cancel wizard
    console.log('[useResponseEditor] Task builder cancelled');
  }, []);

  // ✅ ARCHITECTURE: Return object directly (NO memoization)
  // ✅ Callbacks are already stable from useCallback
  // ✅ Components should receive only the props they need, not the entire object
  return {
    core,
    handlers,
    state,
    refs,
    nodeSelection,
    initialization,
    panelWidths,
    taskMeta,
    localTranslations,
    mainList,
    isAggregatedAtomic,
    needsIntentMessages,
    taskType,
    headerTitle,
    icon,
    iconColor,
    isGeneralizable,
    generalizationReason,
    sidebar, // ✅ FASE 2.1: Consolidated sidebar hook (replaces sidebarHandlers + handleSidebarResizeStart)
    handleEditorClose,
    contractDialogHandlers,
    handleParserCreate,
    handleParserModify,
    handleEngineChipClick,
    handleProfileUpdate,
    handleIntentMessagesComplete,
    handleGenerateAll,
    handleContractWizardClose,
    handleContractWizardNodeUpdate,
    handleContractWizardComplete,
    selectedMainIndex,
    selectedSubIndex,
    selectedRoot,
    sidebarRef,
    handleSelectMain,
    handleSelectSub,
    handleSelectAggregator,
    selectedNode,
    selectedNodePath,
    showContractWizard,
    toolbarButtons,
    rightWidth,
    testPanelWidth,
    tasksPanelWidth,
    draggingPanel,
    setDraggingPanel,
    setRightWidth,
    setTestPanelWidth,
    setTasksPanelWidth,
    leftPanelMode,
    testPanelMode,
    tasksPanelMode,
    sidebarManualWidth,
    isDraggingSidebar,
    showMessageReview,
    showSynonyms,
    selectedIntentIdForTraining,
    setSelectedIntentIdForTraining,
    pendingEditorOpen,
    serviceUnavailable,
    setServiceUnavailable,
    showContractDialog,
    pendingContractChange,
    updateSelectedNode,
    rootRef,
    contractChangeRef,
    tasksStartWidthRef,
    tasksStartXRef,
    replaceSelectedTaskTree: replaceSelectedTaskTreeFromInit,
    escalationTasks,
    // ✅ NEW: Wizard mode state (primary)
    taskWizardMode,
    setTaskWizardMode,
    // ✅ DEPRECATED: Backward compatibility wizard states
    needsTaskContextualization,
    needsTaskBuilder,
    isContextualizing,
    contextualizationTemplateId,
    taskLabel,
    wizardMode,
    // ✅ NEW: Expose onWizardComplete and setNeedsTaskBuilder
    onWizardComplete,
    setNeedsTaskBuilder,
    // ✅ NEW: Stable wizard callbacks
    onTaskContextualizationComplete: handleTaskContextualizationComplete,
    onTaskBuilderComplete: handleTaskBuilderComplete,
    onTaskBuilderCancel: handleTaskBuilderCancel,
  };
}

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

import { useResponseEditorCore } from './useResponseEditorCore';
import { useResponseEditorHandlers } from './useResponseEditorHandlers';
import type { TaskMeta, Task } from '../../../../types/taskTypes';
import type { TaskTree } from '../../../../types/taskTypes';

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
  sidebarHandlers: ReturnType<typeof useResponseEditorHandlers>['sidebarHandlers'];
  handleSidebarResizeStart: ReturnType<typeof useResponseEditorHandlers>['handleSidebarResizeStart'];
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
    sidebarHandlers,
    handleSidebarResizeStart,
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
  } = state;

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
    sidebarHandlers,
    handleSidebarResizeStart,
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
  };
}

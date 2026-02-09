// Please write clean, production-grade TypeScript code.
// Avoid non-ASCII characters, Chinese symbols, or multilingual output.

/**
 * useResponseEditorHandlers
 *
 * Composite hook that combines all handlers for ResponseEditor.
 * This hook orchestrates all user interactions and side effects.
 *
 * ✅ FASE 3.1: Extracted from index.tsx to reduce complexity
 */

import React from 'react';
// ✅ FASE 2.1: Sidebar hooks consolidated into useSidebar composito
import { useSidebar } from '@responseEditor/hooks/useSidebar';
import { useResponseEditorClose } from '@responseEditor/hooks/useResponseEditorClose';
import { useContractUpdateDialog } from '@responseEditor/hooks/useContractUpdateDialog';
import { useResponseEditorSideEffects } from '@responseEditor/hooks/useResponseEditorSideEffects';
import type { TaskMeta, Task } from '@types/taskTypes';
import type { TaskTree } from '@types/taskTypes';

export interface UseResponseEditorHandlersParams {
  // Core data
  taskTree?: TaskTree | null;
  task?: TaskMeta | Task;
  currentProjectId: string | null;

  // State
  state: any;
  refs: any;
  nodeSelection: any;
  panelWidths: any;
  initialization: any;

  // Handlers
  updateSelectedNode: any;
  handleProfileUpdate: any;

  // Props
  tabId?: string;
  setDockTree?: (updater: (prev: any) => any) => void;
  onClose?: () => void;
  hideHeader?: boolean;
  onToolbarUpdate?: (toolbar: any[], color: string) => void;
  registerOnClose?: (fn: () => Promise<boolean>) => void;
}

export interface UseResponseEditorHandlersResult {
  // Sidebar (consolidated from useSidebarHandlers + useSidebarResize)
  sidebar: ReturnType<typeof useSidebar>;

  // Editor close
  handleEditorClose: ReturnType<typeof useResponseEditorClose>;

  // Contract dialog
  contractDialogHandlers: ReturnType<typeof useContractUpdateDialog>;
}

/**
 * Composite hook that combines all handlers for ResponseEditor.
 */
export function useResponseEditorHandlers(params: UseResponseEditorHandlersParams): UseResponseEditorHandlersResult {
  const {
    taskTree,
    task,
    currentProjectId,
    state,
    refs,
    nodeSelection,
    panelWidths,
    initialization,
    updateSelectedNode,
    handleProfileUpdate,
    tabId,
    setDockTree,
    onClose,
    hideHeader,
    onToolbarUpdate,
    registerOnClose,
  } = params;

  const {
    contractChangeRef,
    sidebarRef,
    sidebarStartWidthRef,
    sidebarStartXRef,
    prevInstanceRef,
  } = refs;

  const {
    selectedNode,
    selectedNodePath,
    selectedRoot,
    setSelectedNode,
    setSelectedNodePath,
    isDraggingSidebar,
    setIsDraggingSidebar,
    draggingPanel,
    setDraggingPanel,
    rightWidth,
    setRightWidth,
    testPanelWidth,
    setTestPanelWidth,
    tasksPanelWidth,
    setTasksPanelWidth,
    tasksPanelMode,
    testPanelMode,
    tasksStartWidthRef,
    tasksStartXRef,
    showContractDialog,
    setShowContractDialog,
    pendingContractChange,
    setPendingContractChange,
    serviceUnavailable,
    setServiceUnavailable,
    escalationTasks,
    setEscalationTasks,
    pendingEditorOpen,
    showSynonyms,
    selectedNode: selectedNodeFromState,
    setPendingEditorOpen,
    sidebarManualWidth,
    setSidebarManualWidth,
    taskTreeVersion,
    setTaskTreeVersion,
  } = state;

  const {
    selectedRoot: selectedRootFromSelection,
    sidebarRef: sidebarRefFromSelection,
  } = nodeSelection;

  const {
    replaceSelectedTaskTree: replaceSelectedTaskTreeFromInit,
    toolbarButtons,
  } = initialization;

  // ✅ FASE 2.1: Sidebar consolidated into single composito hook
  const sidebar = useSidebar({
    isDraggingSidebar,
    setIsDraggingSidebar,
    sidebarStartWidthRef,
    sidebarStartXRef,
    setSidebarManualWidth,
    sidebarRef: sidebarRefFromSelection,
    taskTree,
    replaceSelectedTaskTree: replaceSelectedTaskTreeFromInit,
  });

  // Editor close
  const handleEditorClose = useResponseEditorClose({
    contractChangeRef,
    setPendingContractChange,
    setShowContractDialog,
    selectedNode,
    selectedNodePath,
    selectedRoot,
    task,
    currentProjectId,
    tabId,
    setDockTree,
    onClose,
    replaceSelectedTaskTree: replaceSelectedTaskTreeFromInit,
    // ✅ NEW: Pass taskWizardMode per permettere chiusura in modalità wizard
    taskWizardMode: state.taskWizardMode,
    // ✅ NEW: Pass generalization params for tutor on close
    shouldBeGeneral: params.shouldBeGeneral,
    saveDecisionMade: params.saveDecisionMade,
    onOpenSaveDialog: params.onOpenSaveDialog,
  });

  // Contract dialog handlers
  const contractDialogHandlers = useContractUpdateDialog({
    showContractDialog,
    setShowContractDialog,
    pendingContractChange,
    setPendingContractChange,
    contractChangeRef,
    tabId,
    setDockTree,
    onClose,
  });

  // Side effects
  useResponseEditorSideEffects({
    task,
    taskTree,
    currentProjectId,
    setTaskTreeVersion,
    prevInstanceRef,
    setServiceUnavailable,
    setEscalationTasks,
    pendingEditorOpen,
    showSynonyms,
    selectedNode,
    setPendingEditorOpen,
    replaceSelectedTaskTree: replaceSelectedTaskTreeFromInit,
    sidebarRef: sidebarRefFromSelection,
    isDraggingSidebar,
    setIsDraggingSidebar,
    sidebarStartWidthRef,
    sidebarStartXRef,
    setSidebarManualWidth,
    handleEditorClose,
    registerOnClose,
    draggingPanel,
    setDraggingPanel,
    rightWidth,
    setRightWidth,
    testPanelWidth,
    setTestPanelWidth,
    tasksPanelWidth,
    setTasksPanelWidth,
    tasksPanelMode,
    testPanelMode,
    tasksStartWidthRef,
    tasksStartXRef,
    hideHeader,
    onToolbarUpdate,
    toolbarButtons,
    taskWizardMode: state.taskWizardMode,
  });

  return {
    sidebar,
    handleEditorClose,
    contractDialogHandlers,
  };
}

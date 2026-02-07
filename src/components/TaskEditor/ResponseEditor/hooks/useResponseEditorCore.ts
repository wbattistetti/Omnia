// Please write clean, production-grade TypeScript code.
// Avoid non-ASCII characters, Chinese symbols, or multilingual output.

/**
 * useResponseEditorCore
 *
 * Composite hook that combines all core logic for ResponseEditor.
 * This hook orchestrates state, derived values, and core handlers.
 *
 * ✅ FASE 3.1: Extracted from index.tsx to reduce complexity
 */

import React from 'react';
import { useTaskTreeManager } from '@context/DDTManagerContext';
import { useProjectDataUpdate } from '@context/ProjectDataContext';
import { useFontContext } from '@context/FontContext';
import { useAIProvider } from '@context/AIProviderContext';
import { useDDTTranslations } from '@hooks/useDDTTranslations';
import { useTaskTreeVersion, useTaskTreeFromStore } from '@responseEditor/core/state';
import { useResponseEditorState } from '@responseEditor/hooks/useResponseEditorState';
import { useResponseEditorRefs } from '@responseEditor/hooks/useResponseEditorRefs';
import { useNodeSelection, useNodeFinder, useNodeLoading } from '@responseEditor/features/node-editing/hooks';
import { useTaskTreeDerived } from '@responseEditor/hooks/useTaskTreeDerived';
import { useResponseEditorDerived } from '@responseEditor/hooks/useResponseEditorDerived';
import { useResponseEditorInitialization } from '@responseEditor/hooks/useResponseEditorInitialization';
import { usePanelModes } from '@responseEditor/hooks/usePanelModes';
import { usePanelWidths } from '@responseEditor/hooks/usePanelWidths';
import { useParserHandlers, useProfileUpdate } from '@responseEditor/features/step-management/hooks';
import { useUpdateSelectedNode } from '@responseEditor/features/node-editing/hooks/useUpdateSelectedNode';
import { useIntentMessagesHandler } from '@responseEditor/hooks/useIntentMessagesHandler';
import { useGeneralizabilityCheck } from '@responseEditor/hooks/useGeneralizabilityCheck';
import { getTaskMeta } from '@responseEditor/utils/responseEditorUtils';
import { getStepsForNode, getStepsAsArray } from '@responseEditor/core/domain';
import type { TaskMeta, Task } from '@types/taskTypes';
import type { TaskTree } from '@types/taskTypes';

export interface UseResponseEditorCoreParams {
  taskTree?: TaskTree | null;
  task?: TaskMeta | Task;
  isTaskTreeLoading?: boolean;
  onWizardComplete?: (finalTaskTree: TaskTree) => void;
  currentProjectId: string | null;
  tabId?: string;
  setDockTree?: (updater: (prev: any) => any) => void;
}

export interface UseResponseEditorCoreResult {
  // State
  state: ReturnType<typeof useResponseEditorState>;

  // Refs
  refs: ReturnType<typeof useResponseEditorRefs>;

  // Derived values
  taskMeta: TaskMeta;
  taskTreeFromStore: TaskTree | null;
  taskTreeVersion: number;
  localTranslations: Record<string, string>;
  mainList: any[];
  isAggregatedAtomic: boolean;
  introduction: any;
  needsIntentMessages: boolean;
  taskType: string;
  headerTitle: string;
  icon: React.ComponentType<any>;
  iconColor: string;
  rightMode: any;
  isGeneralizable: boolean;
  generalizationReason: string | null;
  isCheckingGeneralizability: boolean;

  // Node selection
  nodeSelection: ReturnType<typeof useNodeSelection>;

  // Handlers
  findAndSelectNodeById: ReturnType<typeof useNodeFinder>;
  handleParserCreate: (nodeId: string, node: any) => void;
  handleParserModify: (nodeId: string, node: any) => void;
  handleEngineChipClick: (nodeId: string, node: any, editorType: 'regex' | 'extractor' | 'ner' | 'llm' | 'embeddings') => void;
  updateSelectedNode: ReturnType<typeof useUpdateSelectedNode>;
  handleProfileUpdate: ReturnType<typeof useProfileUpdate>;
  handleIntentMessagesComplete: ReturnType<typeof useIntentMessagesHandler>;

  // Initialization
  initialization: ReturnType<typeof useResponseEditorInitialization>;

  // Panel state
  panelModes: ReturnType<typeof usePanelModes>;
  panelWidths: ReturnType<typeof usePanelWidths>;
}

/**
 * Composite hook that combines all core logic for ResponseEditor.
 */
export function useResponseEditorCore(params: UseResponseEditorCoreParams): UseResponseEditorCoreResult {
  const {
    taskTree,
    task,
    isTaskTreeLoading,
    onWizardComplete,
    currentProjectId,
    tabId,
    setDockTree,
  } = params;

  // Context hooks
  const pdUpdate = useProjectDataUpdate();
  const { combinedClass } = useFontContext();
  const { provider: selectedProvider, model: selectedModel } = useAIProvider();

  // State
  const state = useResponseEditorState();
  const {
    serviceUnavailable,
    setServiceUnavailable,
    showContractDialog,
    setShowContractDialog,
    pendingContractChange,
    setPendingContractChange,
    escalationTasks,
    setEscalationTasks,
    pendingEditorOpen,
    setPendingEditorOpen,
    showSynonyms,
    setShowSynonyms,
    showMessageReview,
    setShowMessageReview,
    selectedIntentIdForTraining,
    setSelectedIntentIdForTraining,
    showContractWizard,
    setShowContractWizard,
    selectedNode,
    setSelectedNode,
    selectedNodePath,
    setSelectedNodePath,
    taskTreeVersion: taskTreeVersionFromState,
    setTaskTreeVersion,
    leftPanelMode,
    setLeftPanelMode,
    testPanelMode,
    setTestPanelMode,
    tasksPanelMode,
    setTasksPanelMode,
    sidebarManualWidth,
    // ✅ NEW: Wizard states
    needsTaskContextualization,
    setNeedsTaskContextualization,
    needsTaskBuilder,
    setNeedsTaskBuilder,
    isContextualizing,
    setIsContextualizing,
    contextualizationTemplateId,
    setContextualizationTemplateId,
    taskLabel,
    setTaskLabel,
    wizardMode,
    setWizardMode,
    contextualizationAbortController,
    setContextualizationAbortController,
    setSidebarManualWidth,
    isDraggingSidebar,
    setIsDraggingSidebar,
    draggingPanel,
    setDraggingPanel,
  } = state;

  // Refs
  const refs = useResponseEditorRefs({ taskTree, task });
  const {
    prevInstanceRef,
    contractChangeRef,
    rootRef,
    preAssembledTaskTreeCache,
    wizardOwnsDataRef,
    sidebarStartWidthRef,
    sidebarStartXRef,
    tasksStartWidthRef,
    tasksStartXRef,
  } = refs;

  // Store
  const taskTreeVersionFromStore = useTaskTreeVersion();
  const taskTreeVersion = taskTreeVersionFromStore || taskTreeVersionFromState;
  const taskTreeFromStore = useTaskTreeFromStore();

  // Task meta
  const taskMeta = getTaskMeta(task);

  // ✅ NEW: Read wizard flags from taskMeta (if present)
  // These flags are set when opening ResponseEditor from NodeRow
  React.useEffect(() => {
    if (taskMeta) {
      // Read flags from taskMeta (set by NodeRow when opening ResponseEditor)
      const needsContextualization = (taskMeta as any).needsTaskContextualization === true;
      const needsBuilder = (taskMeta as any).needsTaskBuilder === true;
      const contextualizationTemplateId = (taskMeta as any).contextualizationTemplateId || null;
      const taskLabelFromMeta = (taskMeta as any).taskLabel || taskMeta.label || '';

      if (needsContextualization || needsBuilder) {
        setNeedsTaskContextualization(needsContextualization);
        setNeedsTaskBuilder(needsBuilder);
        setContextualizationTemplateId(contextualizationTemplateId);
        setTaskLabel(taskLabelFromMeta);
      }
    }
  }, [taskMeta, setNeedsTaskContextualization, setNeedsTaskBuilder, setContextualizationTemplateId, setTaskLabel]);

  // Replace selected task tree
  const { replaceSelectedTaskTree: replaceSelectedTaskTreeFromContext } = useTaskTreeManager();
  const replaceSelectedTaskTree = React.useCallback((taskTree: any) => {
    replaceSelectedTaskTreeFromContext(taskTree);
  }, [replaceSelectedTaskTreeFromContext]);

  // Translations
  const taskTreeForTranslations = taskTreeFromStore || taskTree;
  const localTranslations = useDDTTranslations(taskTreeForTranslations, task, taskTreeVersionFromStore);

  // Derived values
  const {
    mainList,
    isAggregatedAtomic,
    introduction,
  } = useTaskTreeDerived({
    isTaskTreeLoading,
  });

  // Generalizability check
  const {
    isGeneralizable,
    generalizationReason,
    isLoading: isCheckingGeneralizability,
  } = useGeneralizabilityCheck(
    taskTree,
    task?.label,
    currentProjectId
  );

  // Panel widths
  const panelWidths = usePanelWidths();
  const {
    rightWidth,
    setRightWidth,
    testPanelWidth,
    setTestPanelWidth,
    tasksPanelWidth,
    setTasksPanelWidth,
  } = panelWidths;

  // Node selection
  const nodeSelection = useNodeSelection(0);
  const {
    selectedMainIndex,
    selectedSubIndex,
    selectedRoot,
    sidebarRef,
    setSelectedMainIndex,
    setSelectedSubIndex,
    setSelectedRoot,
    handleSelectMain,
    handleSelectSub,
    handleSelectAggregator,
  } = nodeSelection;

  // Node finder
  const findAndSelectNodeById = useNodeFinder({
    handleSelectMain,
    handleSelectSub,
  });

  // Parser handlers
  const parserHandlers = useParserHandlers({
    findAndSelectNodeById,
    setShowSynonyms,
    setPendingEditorOpen,
  });
  const {
    handleParserCreate,
    handleParserModify,
    handleEngineChipClick,
  } = parserHandlers;

  // Response editor derived
  const {
    needsIntentMessages,
    taskType,
    headerTitle,
    icon: Icon,
    iconColor,
    rightMode,
  } = useResponseEditorDerived({
    task: taskMeta,
    taskTree,
    mainList,
    leftPanelMode,
    testPanelMode,
  });

  // Initialization
  const initialization = useResponseEditorInitialization({
    task: taskMeta,
    taskTree,
    showContractWizard,
    setShowContractWizard,
    setTaskTreeVersion,
    setLeftPanelMode,
    setTestPanelMode,
    setTasksPanelMode,
    replaceSelectedTaskTree: replaceSelectedTaskTree,
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
  });
  const {
    replaceSelectedTaskTree: replaceSelectedTaskTreeFromInit,
    handleGenerateAll,
    handleContractWizardClose,
    handleContractWizardNodeUpdate,
    handleContractWizardComplete,
    saveLeftPanelMode,
    saveTestPanelMode,
    saveTasksPanelMode,
    saveRightMode,
    toolbarButtons,
  } = initialization;

  // Panel modes
  const panelModes = usePanelModes({
    leftPanelMode,
    setLeftPanelMode,
    testPanelMode,
    setTestPanelMode,
    tasksPanelMode,
    setTasksPanelMode,
    saveLeftPanelMode,
    saveTestPanelMode,
    saveTasksPanelMode,
  });

  // Node loading
  useNodeLoading({
    selectedMainIndex,
    selectedSubIndex,
    selectedRoot,
    introduction,
    task,
    setSelectedNode,
    setSelectedNodePath,
    getStepsForNode,
    getStepsAsArray,
  });

  // Update selected node
  const updateSelectedNode = useUpdateSelectedNode({
    selectedNodePath,
    selectedRoot,
    task,
    currentProjectId,
    tabId,
    setDockTree,
    setSelectedNode,
    setTaskTreeVersion,
  });

  // Profile update
  const handleProfileUpdate = useProfileUpdate({ updateSelectedNode });

  // Intent messages handler
  const handleIntentMessagesComplete = useIntentMessagesHandler({
    task: taskMeta,
    taskTree,
    currentProjectId,
    onWizardComplete,
    replaceSelectedTaskTree,
  });

  return {
    state,
    refs,
    taskMeta,
    taskTreeFromStore,
    taskTreeVersion,
    localTranslations,
    mainList,
    isAggregatedAtomic,
    introduction,
    needsIntentMessages,
    taskType,
    headerTitle,
    icon: Icon,
    iconColor,
    rightMode,
    isGeneralizable,
    generalizationReason,
    isCheckingGeneralizability,
    nodeSelection,
    findAndSelectNodeById,
    handleParserCreate,
    handleParserModify,
    handleEngineChipClick,
    updateSelectedNode,
    handleProfileUpdate,
    handleIntentMessagesComplete,
    initialization,
    panelModes,
    panelWidths,
    // ✅ NEW: Wizard states
    needsTaskContextualization,
    needsTaskBuilder,
    isContextualizing,
    contextualizationTemplateId,
    taskLabel,
    wizardMode,
  };
}

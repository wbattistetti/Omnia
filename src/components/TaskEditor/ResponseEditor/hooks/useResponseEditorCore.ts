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
import { getTaskMeta, isTaskMeta } from '@responseEditor/utils/responseEditorUtils';
import { getStepsForNode, getStepsAsArray } from '@responseEditor/core/domain';
import type { TaskMeta, Task } from '@types/taskTypes';
import type { TaskTree } from '@types/taskTypes';
import type { TaskWizardMode } from '@taskEditor/EditorHost/types';

export interface UseResponseEditorCoreParams {
  taskTree?: TaskTree | null;
  task?: TaskMeta | Task;
  isTaskTreeLoading?: boolean;
  onWizardComplete?: (finalTaskTree: TaskTree) => void;
  currentProjectId: string | null;
  tabId?: string;
  setDockTree?: (updater: (prev: any) => any) => void;
  // ✅ REMOVED: shouldBeGeneral - now from WizardContext
  saveDecisionMade?: boolean;
  onOpenSaveDialog?: () => void;
  // ✅ NEW: Ref per il pulsante save-to-library
  saveToLibraryButtonRef?: React.RefObject<HTMLButtonElement>;
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
    // ✅ NEW: Generalization params
    shouldBeGeneral,
    saveDecisionMade,
    onOpenSaveDialog,
    saveToLibraryButtonRef,
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
    // ✅ NEW: Wizard mode state (primary)
    taskWizardMode,
    setTaskWizardMode,
    // ✅ DEPRECATED: Backward compatibility wizard states
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
  // ✅ Se task è già un TaskMeta valido (ha type), lo uso direttamente
  // Altrimenti, provo a estrarlo da Task usando getTaskMeta
  // ✅ FIX: Memoize taskMeta to prevent reference changes on every render
  const taskMeta = React.useMemo(() => {
    return isTaskMeta(task) ? task : getTaskMeta(task);
  }, [
    task?.id,
    task?.type,
    (task as any)?.taskWizardMode,
    (task as any)?.contextualizationTemplateId,
    (task as any)?.needsTaskContextualization,
    (task as any)?.needsTaskBuilder,
    (task as any)?.taskLabel,
    task?.label,
    task?.instanceId
  ]);

  // ✅ MODIFICA MINIMA: Inizializza wizardMode UNA SOLA VOLTA quando task.id cambia
  // NON quando taskMeta cambia riferimento - questo risolve il rendering continuo
  const previousTaskIdRef = React.useRef<string | undefined>(undefined);

  // ✅ SINGLE SOURCE OF TRUTH: Read taskWizardMode and taskLabel from taskMeta
  // These flags are set when opening ResponseEditor from NodeRow
  // taskLabel is ALWAYS set here - if taskMeta is not available, use empty string temporarily
  React.useEffect(() => {
    // ✅ SOLO se task.id è cambiato (nuovo task), inizializza
    // Se task.id è lo stesso, NON fare nulla (anche se taskMeta cambia riferimento)
    const currentTaskId = task?.id;

    // ✅ Se task.id non è cambiato, NON fare nulla
    if (currentTaskId === previousTaskIdRef.current) {
      return;
    }

    // ✅ Se non c'è task, resetta
    if (!currentTaskId) {
      if (previousTaskIdRef.current !== undefined) {
        setTaskWizardMode('none');
        setContextualizationTemplateId(null);
        setTaskLabel('');
        previousTaskIdRef.current = undefined;
      }
      return;
    }

    // ✅ Inizializza SOLO per nuovo task.id
    const taskMeta = isTaskMeta(task) ? task : getTaskMeta(task);

      // ✅ Priority: explicit taskWizardMode > backward compatibility with booleans
      let wizardMode: TaskWizardMode = 'none';
      if (taskMeta.taskWizardMode && (taskMeta.taskWizardMode === 'none' || taskMeta.taskWizardMode === 'adaptation' || taskMeta.taskWizardMode === 'full')) {
        wizardMode = taskMeta.taskWizardMode;
      } else {
        // ✅ Backward compatibility: derive from boolean flags
        const needsContextualization = (taskMeta as any).needsTaskContextualization === true;
        const needsBuilder = (taskMeta as any).needsTaskBuilder === true;
        if (needsBuilder) {
          wizardMode = 'full';
        } else if (needsContextualization) {
          wizardMode = 'adaptation';
        } else {
          wizardMode = 'none';
        }
      }

      const contextualizationTemplateId = (taskMeta as any).contextualizationTemplateId || null;
      // ✅ SINGLE SOURCE OF TRUTH: Read taskLabel from taskMeta
      // Priority: taskMeta.taskLabel > taskMeta.label > empty string (temporary)
      const taskLabelFromMeta = (taskMeta as any).taskLabel || taskMeta.label || '';

      // ✅ Set primary state
      setTaskWizardMode(wizardMode);
      setContextualizationTemplateId(contextualizationTemplateId);
      setTaskLabel(taskLabelFromMeta); // ✅ ALWAYS set - empty string if not available yet

      // ✅ DEPRECATED: Backward compatibility - sync boolean flags
      if (wizardMode === 'adaptation') {
        setNeedsTaskContextualization(true);
        setNeedsTaskBuilder(false);
      } else if (wizardMode === 'full') {
        setNeedsTaskContextualization(false);
        setNeedsTaskBuilder(true);
      } else {
        setNeedsTaskContextualization(false);
        setNeedsTaskBuilder(false);
      }

    // ✅ Marca task.id come processato
    previousTaskIdRef.current = currentTaskId;
  }, [task?.id]); // ✅ SOLO task.id come dipendenza - NON taskMeta o altri campi

  // Replace selected task tree
  const { replaceSelectedTaskTree: replaceSelectedTaskTreeFromContext } = useTaskTreeManager();
  const replaceSelectedTaskTree = React.useCallback((taskTree: any) => {
    replaceSelectedTaskTreeFromContext(taskTree);
  }, [replaceSelectedTaskTreeFromContext]);

  // Translations
  const taskTreeForTranslations = taskTreeFromStore || taskTree;
  // ✅ CRITICAL FIX: Pass selectedNodeId to force recalculation when node selection changes
  // When you change node, the context changes, so translations must be recalculated
  const selectedNodeId = selectedNode?.id || selectedNode?._id || null;
  const localTranslations = useDDTTranslations(
    taskTreeForTranslations,
    task,
    taskTreeVersionFromStore,
    selectedNodeId
  );

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
    task: taskMeta, // ✅ taskMeta (TaskMeta | null) - null quando task non è un TaskMeta valido
    taskTree,
    mainList,
    leftPanelMode,
    taskMeta: task, // ✅ Pass original task (TaskMeta | Task) per wizard mode quando taskMeta è null
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
    currentProjectId, // ✅ NEW: Pass currentProjectId for test panel
    contextualizationAbortController,
    setContextualizationAbortController,
    setNeedsTaskContextualization,
    setNeedsTaskBuilder,
    // ✅ NEW: Pass setDockTree for dockable chat panel
    setDockTree,
    setWizardMode,
    // ✅ NEW: Generalization params (passed from useResponseEditor)
    shouldBeGeneral: shouldBeGeneral,
    saveDecisionMade: saveDecisionMade,
    onOpenSaveDialog: onOpenSaveDialog,
    // ✅ NEW: Ref per il pulsante save-to-library
    saveToLibraryButtonRef: saveToLibraryButtonRef,
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
  };
}

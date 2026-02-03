import React, { useMemo, useRef, useCallback, useEffect } from 'react';
import { info } from '../../../utils/logger';
import { useDDTManager } from '../../../context/DDTManagerContext';
import { taskRepository } from '../../../services/TaskRepository';
import { useProjectDataUpdate } from '../../../context/ProjectDataContext';
import { getTemplateId } from '../../../utils/taskHelpers';
import { TaskType, isUtteranceInterpretationTemplateId } from '../../../types/taskTypes';
import { useRightPanelWidth, RightPanelMode } from './RightPanel';
import { ContractUpdateDialog } from './ContractUpdateDialog';
import EditorHeader from '../../common/EditorHeader';
import { getTaskVisualsByType } from '../../Flowchart/utils/taskVisuals';
import TaskDragLayer from './TaskDragLayer';
import { getdataList, getSubDataList } from './ddtSelectors';
import { hasIntentMessages } from './utils/hasMessages';
import { saveIntentMessagesToTaskTree } from './utils/saveIntentMessages';
import { useNodeSelection } from './hooks/useNodeSelection';
import { useNodeUpdate } from './hooks/useNodeUpdate';
import { useNodePersistence } from './hooks/useNodePersistence';
import { useResponseEditorToolbar } from './ResponseEditorToolbar';
import IntentListEditorWrapper from './components/IntentListEditorWrapper';
import { FontProvider, useFontContext } from '../../../context/FontContext';
import { useAIProvider } from '../../../context/AIProviderContext';
import { TemplateTranslationsService } from '../../../services/TemplateTranslationsService';
import { useProjectTranslations } from '../../../context/ProjectTranslationsContext';
import { useDDTTranslations } from '../../../hooks/useDDTTranslations';
import { ToolbarButton } from '../../../dock/types';
import { taskTemplateService } from '../../../services/TaskTemplateService';
import { mapNode, closeTab } from '../../../dock/ops';
import { buildTaskTree } from '../../../utils/taskUtils';
import { saveTaskOnProjectSave, saveTaskOnEditorClose, checkAndApplyTemplateSync, saveTaskToRepository } from './modules/ResponseEditor/persistence/ResponseEditorPersistence';
import { useWizardInference } from './hooks/useWizardInference';
import { useResponseEditorSideEffects } from './hooks/useResponseEditorSideEffects';
import { useResponseEditorState } from './hooks/useResponseEditorState';
import { useResponseEditorWizard } from './hooks/useResponseEditorWizard';
import { ResponseEditorContent } from './components/ResponseEditorContent';
import { ResponseEditorNormalLayout } from './components/ResponseEditorNormalLayout';
import { useSidebarHandlers } from './hooks/useSidebarHandlers';
import { validateTaskStructure, getTaskSemantics } from '../../../utils/taskSemantics';
import { getIsTesting } from './testingState';

import type { TaskMeta } from '../EditorHost/types';
import type { Task } from '../../../types/taskTypes';

// Helper: safe deep clone that handles circular references
function safeDeepClone<T>(obj: T): T {
  if (!obj) return obj;
  try {
    // Use structuredClone if available (handles circular refs)
    if (typeof structuredClone !== 'undefined') {
      return structuredClone(obj);
    }
    // Fallback to JSON (may fail on circular refs)
    return JSON.parse(JSON.stringify(obj));
  } catch (err) {
    console.warn('[safeDeepClone] Failed to clone, returning original:', err);
    return obj;
  }
}

// ❌ RIMOSSO: coercePhoneKind - non serve più backward compatibility con vecchio modello DDT (.data[])

function ResponseEditorInner({ taskTree, onClose, onWizardComplete, task, isTaskTreeLoading, hideHeader, onToolbarUpdate, tabId, setDockTree, registerOnClose }: { taskTree?: TaskTree | null, onClose?: () => void, onWizardComplete?: (finalTaskTree: TaskTree) => void, task?: TaskMeta | Task, isTaskTreeLoading?: boolean, hideHeader?: boolean, onToolbarUpdate?: (toolbar: ToolbarButton[], color: string) => void, tabId?: string, setDockTree?: (updater: (prev: any) => any) => void, registerOnClose?: (fn: () => Promise<boolean>) => void }) { // ✅ ARCHITETTURA ESPERTO: task può essere TaskMeta o Task completo


  // Ottieni projectId corrente per salvare le istanze nel progetto corretto
  const pdUpdate = useProjectDataUpdate();
  const currentProjectId = pdUpdate?.getCurrentProjectId() || null;

  // ✅ Get translations from global table (filtered by project locale)
  const { translations: globalTranslations } = useProjectTranslations();
  // Font centralizzato dal Context
  const { combinedClass } = useFontContext();
  // ✅ AI Provider per inferenza pre-wizard
  const { provider: selectedProvider, model: selectedModel } = useAIProvider();

  // ✅ All state managed by useResponseEditorState hook
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
    taskTreeVersion,
    setTaskTreeVersion,
    leftPanelMode,
    setLeftPanelMode,
    testPanelMode,
    setTestPanelMode,
    tasksPanelMode,
    setTasksPanelMode,
    sidebarManualWidth,
    setSidebarManualWidth,
    isDraggingSidebar,
    setIsDraggingSidebar,
    draggingPanel,
    setDraggingPanel,
  } = state;

  // ✅ Ref per accedere allo stato delle modifiche da RecognitionEditor
  const contractChangeRef = React.useRef<{
    hasUnsavedChanges: boolean;
    modifiedContract: any;
    originalContract: any; // ✅ Contract originale (dal DB) per poterlo ripristinare
    nodeTemplateId: string | undefined;
    nodeLabel: string | undefined;
  }>({
    hasUnsavedChanges: false,
    modifiedContract: null,
    originalContract: null,
    nodeTemplateId: undefined,
    nodeLabel: undefined
  });

  const rootRef = useRef<HTMLDivElement>(null);

  // ✅ Cache globale per TaskTree pre-assemblati (per templateId)
  // Key: templateId (es. "723a1aa9-a904-4b55-82f3-a501dfbe0351")
  // Value: { taskTree, _templateTranslations }
  const preAssembledTaskTreeCache = React.useRef<Map<string, { taskTree: any; _templateTranslations: Record<string, { en: string; it: string; pt: string }> }>>(new Map());

  const { ideTranslations, replaceSelectedDDT } = useDDTManager(); // ✅ replaceSelectedDDT sarà aggiornato in futuro
  const mergedBase = useMemo(() => (ideTranslations || {}), [ideTranslations]);

  // ✅ Alias per compatibilità: replaceSelectedTaskTree usa replaceSelectedDDT internamente
  const replaceSelectedTaskTree = React.useCallback((taskTree: any) => {
    replaceSelectedDDT(taskTree);
  }, [replaceSelectedDDT]);

  // Node selection management (must be before useDDTInitialization for callback)
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
  } = useNodeSelection(0); // Initial main index

  // ✅ selectedNode è uno stato separato (fonte di verità durante l'editing)
  // NON è una derivazione da localTaskTree - questo elimina race conditions e dipendenze circolari
  // (selectedNode e selectedNodePath sono già estratti in useResponseEditorState)

  // ✅ Helper to find and select node by ID
  const findAndSelectNodeById = useCallback((nodeId: string) => {
    const mains = getdataList(taskTreeRef.current || taskTree);
    for (let mIdx = 0; mIdx < mains.length; mIdx++) {
      const main = mains[mIdx];
      const mainNodeId = main.id || main.templateId || main._id;
      if (mainNodeId === nodeId) {
        handleSelectMain(mIdx);
        handleSelectSub(undefined);
        return;
      }
      const subs = getSubDataList(main) || [];
      for (let sIdx = 0; sIdx < subs.length; sIdx++) {
        const sub = subs[sIdx];
        const subNodeId = sub.id || sub.templateId || sub._id;
        if (subNodeId === nodeId) {
          handleSelectMain(mIdx);
          handleSelectSub(sIdx, mIdx);
          return;
        }
      }
    }
  }, [taskTree, handleSelectMain, handleSelectSub]);

  // ✅ Handler for parser create/modify
  const handleParserCreate = useCallback((nodeId: string, node: any) => {
    findAndSelectNodeById(nodeId);
    setShowSynonyms(true);
    // TODO: Open parser creation dialog or wizard
  }, [findAndSelectNodeById]);

  const handleParserModify = useCallback((nodeId: string, node: any) => {
    findAndSelectNodeById(nodeId);
    setShowSynonyms(true);
    // Editor will open automatically when Recognition panel opens
  }, [findAndSelectNodeById]);

  // ✅ Handler for engine chip click
  const handleEngineChipClick = useCallback((
    nodeId: string,
    node: any,
    editorType: 'regex' | 'extractor' | 'ner' | 'llm' | 'embeddings'
  ) => {
    findAndSelectNodeById(nodeId);
    setShowSynonyms(true);
    // Set pending editor to open after Recognition panel is ready
    setPendingEditorOpen({ editorType, nodeId });
  }, [findAndSelectNodeById]);

  // ✅ Handler for Intent Messages Complete
  const handleIntentMessagesComplete = useCallback((messages: any) => {
    const updatedTaskTree = saveIntentMessagesToTaskTree(taskTree, messages);

    // ✅ CRITICO: Salva il DDT nell'istanza IMMEDIATAMENTE quando si completano i messaggi
    // Questo assicura che quando si fa "Save" globale, l'istanza abbia il DDT aggiornato
    if (task?.id || (task as any)?.instanceId) {
      const key = ((task as any)?.instanceId || task?.id) as string;
      // ✅ MIGRATION: Use getTemplateId() helper
      // ✅ FIX: Se c'è un DDT, assicurati che il templateId sia 'UtteranceInterpretation'
      const taskInstance = taskRepository.getTask(key);
      const hasTaskTree = updatedTaskTree && Object.keys(updatedTaskTree).length > 0 && updatedTaskTree.nodes && updatedTaskTree.nodes.length > 0;
      if (hasTaskTree && taskInstance) {
        const currentTemplateId = getTemplateId(taskInstance);
        // ✅ Usa helper function invece di stringa hardcoded
        // ✅ Update task con campi TaskTree direttamente (niente wrapper value)
        if (!isUtteranceInterpretationTemplateId(currentTemplateId)) {
          taskRepository.updateTask(key, {
            type: TaskType.UtteranceInterpretation,  // ✅ type: enum numerico
            templateId: null,            // ✅ templateId: null (standalone)
            ...updatedTaskTree  // ✅ Spread: label, nodes, steps, ecc.
          }, currentProjectId || undefined);
        } else {
          taskRepository.updateTask(key, {
            ...updatedTaskTree  // ✅ Spread: label, nodes, steps, ecc.
          }, currentProjectId || undefined);
        }
      } else if (hasTaskTree) {
        // Task doesn't exist, create it with UtteranceInterpretation type
        taskRepository.createTask(TaskType.UtteranceInterpretation, null, updatedTaskTree, key, currentProjectId || undefined);
      } else {
        // FIX: Salva con projectId per garantire persistenza nel database
        taskRepository.updateTask(key, {
          ...updatedTaskTree  // ✅ Spread: label, nodes, steps, ecc.
        }, currentProjectId || undefined);
      }

      // ✅ FIX: Notifica il parent (DDTHostAdapter) che il TaskTree è stato aggiornato
      onWizardComplete?.(updatedTaskTree);
    }

    try {
      replaceSelectedTaskTree(updatedTaskTree);
    } catch (err) {
      console.error('[ResponseEditor][replaceSelectedDDT] FAILED', err);
    }

    // After saving, show normal editor (needsIntentMessages will become false)
  }, [task, taskTree, currentProjectId, onWizardComplete, replaceSelectedTaskTree]);

  // ✅ Wizard logic managed by useResponseEditorWizard hook

  // ✅ TaskTree come ref mutabile (simula VB.NET: modifica diretta sulla struttura in memoria)
  const taskTreeRef = useRef(taskTree);

  // ✅ Inizializza taskTreeRef.current solo su cambio istanza (non ad ogni re-render)
  const prevInstanceRef = useRef<string | undefined>(undefined);

  // Debug logger gated by localStorage flag: set localStorage.setItem('debug.responseEditor','1') to enable
  const log = (...args: any[]) => {
    try { if (localStorage.getItem('debug.responseEditor') === '1') console.log(...args); } catch { }
  };
  // Get project language from localStorage (set when project is created/loaded)
  const projectLocale = useMemo<'en' | 'it' | 'pt'>(() => {
    try {
      const saved = localStorage.getItem('project.lang');
      if (saved === 'en' || saved === 'it' || saved === 'pt') {
        return saved;
      }
    } catch (err) {
      // Silent fail
    }
    return 'it'; // Default to Italian
  }, []);

  // Get translations for project locale
  const getTranslationsForLocale = (locale: 'en' | 'it' | 'pt', ddtTranslations: any) => {
    if (!ddtTranslations) {
      return mergedBase;
    }

    // Structure: taskTree.translations = { en: {...}, it: {...}, pt: {...} }
    const localeTranslations = ddtTranslations[locale] || ddtTranslations.en || ddtTranslations;
    const result = { ...mergedBase, ...localeTranslations };
    return result;
  };

  // ✅ Load translations from global table using shared hook
      // ✅ Pass task to extract GUIDs from task.steps (array MaterializedStep[])
  const localTranslations = useDDTTranslations(taskTree, task); // ✅ useDDTTranslations sarà aggiornato in futuro

  // 🔍 DEBUG: Log translations loading (rimosso - troppo verboso)
  // React.useEffect(() => {
  //   if (localStorage.getItem('debug.responseEditor') === '1') {
  //     console.log('[ResponseEditor] 📚 Translations loaded', {
  //       translationsCount: Object.keys(localTranslations).length,
  //       sampleTranslations: Object.keys(localTranslations).slice(0, 10),
  //       hasTask: !!task,
  //       taskId: task?.id,
      //       taskStepsCount: Array.isArray(task?.steps) ? task.steps.length : 0,
  //       ddtId: ddt?.id || ddt?._id,
  //       ddtLabel: ddt?.label
  //     });
  //   }
  // }, [localTranslations, task?.id, task?.steps, ddt?.id]);

  // ❌ REMOVED: Sync from ddt.translations - translations are now in global table only
  // Translations are updated via the effect above that watches globalTranslations

  // ✅ Quando chiudi, usa direttamente taskTreeRef.current (già contiene tutte le modifiche)
  // Non serve più buildTaskTree perché le modifiche sono già nel ref

  // ✅ Salva modifiche quando si clicca "Salva" nel progetto (senza chiudere l'editor)
  // Usa taskTreeRef.current che è sempre sincronizzato con dockTree (fonte di verità)
  //
  // LOGICA CONCETTUALE DEL SALVATAGGIO:
  // - Template: contiene struttura condivisa (constraints, examples, nlpContract)
  // - Istanza: contiene SOLO override (modifiche rispetto al template)
  // - extractTaskOverrides confronta istanza con template e salva solo differenze
  // - A runtime: se mancante nell'istanza → risoluzione lazy dal template (backend VB.NET)


  // ✅ Usa taskTreeRef.current per mainList (contiene già le modifiche)
  // Forza re-render quando taskTreeRef cambia usando uno stato trigger
  // (taskTreeVersion è già estratto in useResponseEditorState)
  // ✅ ARCHITETTURA ESPERTO: Stabilizza isTaskTreeLoading per evitare problemi con dipendenze undefined
  const stableIsTaskTreeLoading = isTaskTreeLoading ?? false;
  const mainList = useMemo(() => {
    // ✅ ARCHITETTURA ESPERTO: Usa taskTree prop se disponibile, altrimenti taskTreeRef.current
    // Questo garantisce che mainList sia aggiornato quando DDTHostAdapter carica il TaskTree
    const currentTaskTree = taskTree ?? taskTreeRef.current;
    const list = getdataList(currentTaskTree);
    return list;
  }, [taskTree?.label ?? '', taskTree?.nodes?.length ?? 0, taskTreeVersion ?? 0, stableIsTaskTreeLoading]); // ✅ Usa valori primitivi sempre definiti
  // Aggregated view: show a group header when there are multiple mains
  const isAggregatedAtomic = useMemo(() => (
    Array.isArray(mainList) && mainList.length > 1
  ), [mainList]);
  // ✅ Panel modes (già estratti in useResponseEditorState)

  const { width: rightWidth, setWidth: setRightWidth } = useRightPanelWidth(360);

  // ✅ Larghezza separata per il pannello Test (indipendente)
  const { width: testPanelWidth, setWidth: setTestPanelWidth } = useRightPanelWidth(360, 'responseEditor.testPanelWidth');
  // ✅ Larghezza separata per il pannello Tasks (indipendente)
  const { width: tasksPanelWidth, setWidth: setTasksPanelWidth } = useRightPanelWidth(360, 'responseEditor.tasksPanelWidth');

  // ✅ Sidebar drag state (già estratto in useResponseEditorState)
  const sidebarStartWidthRef = React.useRef<number>(0);
  const sidebarStartXRef = React.useRef<number>(0);
  const tasksStartWidthRef = React.useRef<number>(0);
  const tasksStartXRef = React.useRef<number>(0);

  // ✅ Sidebar handlers managed by useSidebarHandlers hook
  const sidebarHandlers = useSidebarHandlers({
    taskTree,
    replaceSelectedTaskTree,
  });

  const handleSidebarResizeStart = React.useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation(); // ✅ CRITICO: previeni che altri handler interferiscano

    const sidebarEl = sidebarRef?.current;
    if (!sidebarEl) {
      return;
    }

    const rect = sidebarEl.getBoundingClientRect();
    sidebarStartWidthRef.current = rect.width;
    sidebarStartXRef.current = e.clientX;

    setIsDraggingSidebar(true);
  }, [sidebarRef]);

  // ✅ Mantieni rightMode per compatibilità (combinazione di leftPanelMode e testPanelMode)
  const rightMode: RightPanelMode = testPanelMode === 'chat' ? 'chat' : leftPanelMode;
  // ✅ Splitter drag state (già estratto in useResponseEditorState)

  // Header: icon, title, and toolbar
  // ✅ CRITICAL: NO FALLBACK - type MUST be present
  if (!task?.type) {
    throw new Error(`[ResponseEditor] Task is missing required field 'type'. Task: ${JSON.stringify(task, null, 2)}`);
  }
  const taskType = task.type; // ✅ NO FALLBACK - must be present

  // ✅ Verifica se kind === "intent" e non ha messaggi (mostra IntentMessagesBuilder se non ci sono)
  const needsIntentMessages = useMemo(() => {
    const firstMain = mainList[0];
    const hasMessages = hasIntentMessages(taskTree, task);
    return firstMain?.kind === 'intent' && !hasMessages;
  }, [mainList, taskTree, task]); // ✅ CORRETTO: Passa task a hasIntentMessages

  // ✅ Ref per controllare ownership del wizard sui dati (creato prima per essere passato a entrambi gli hook)
  const wizardOwnsDataRef = useRef(false);

  // ✅ Usa hook custom per gestire wizard e inferenza (estratto per migliorare manutenibilità)
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
    task: task && 'templateId' in task ? task : null, // ✅ ARCHITETTURA ESPERTO: Cast a Task completo (se ha templateId) o null
    isTaskTreeLoading: isTaskTreeLoading ?? false, // ✅ ARCHITETTURA ESPERTO: Passa stato di loading
    currentProjectId,
    selectedProvider,
    selectedModel,
    preAssembledTaskTreeCache,
    wizardOwnsDataRef,
  });

  // ✅ Wizard handlers and logic managed by useResponseEditorWizard hook
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
    showWizard,
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
  // ✅ TODO FUTURO: Category System (vedi documentation/TODO_NUOVO.md)
  // Aggiornare per usare getTaskVisuals(taskType, task?.category, task?.categoryCustom, !!taskTree)
  const { Icon, color: iconColor } = getTaskVisualsByType(taskType, !!taskTree); // ✅ RINOMINATO: actType → taskType
  // Priority: _sourceTask.label (preserved task info) > task.label (direct prop) > localTaskTree._userLabel (legacy) > generic fallback
  // NOTE: Do NOT use localTaskTree.label here - that's the TaskTree root label (e.g. "Age") which belongs in the TreeView, not the header
  const sourceTask = (taskTree as any)?._sourceTask || (taskTree as any)?._sourceAct; // ✅ RINOMINATO: sourceAct → sourceTask (backward compatibility con _sourceAct)
  const headerTitle = sourceTask?.label || task?.label || (taskTree as any)?._userLabel || 'Response Editor'; // ✅ RINOMINATO: act → task

  // ✅ Handler per il pannello sinistro (Behaviour/Personality/Recognition)
  const saveLeftPanelMode = (m: RightPanelMode) => {
    setLeftPanelMode(m);
    try { localStorage.setItem('responseEditor.leftPanelMode', m); } catch { }
  };

  // ✅ Handler per il pannello Test (indipendente)
  const saveTestPanelMode = (m: RightPanelMode) => {
    setTestPanelMode(m);
    try { localStorage.setItem('responseEditor.testPanelMode', m); } catch { }
  };

  // ✅ Handler per il pannello Tasks (indipendente)
  const saveTasksPanelMode = (m: RightPanelMode) => {
    setTasksPanelMode(m);
    try { localStorage.setItem('responseEditor.tasksPanelMode', m); } catch { }
  };

  // ✅ Mantieni saveRightMode per compatibilità (gestisce entrambi i pannelli)
  const saveRightMode = (m: RightPanelMode) => {
    if (m === 'chat') {
      // Se è 'chat', gestisci solo Test
      saveTestPanelMode(m);
    } else if (m === 'none') {
      // Se è 'none', chiudi solo il pannello sinistro (non Test)
      saveLeftPanelMode(m);
    } else {
      // Altrimenti, gestisci solo il pannello sinistro
      saveLeftPanelMode(m);
    }
  };

  // Toolbar buttons (extracted to hook)
  const toolbarButtons = useResponseEditorToolbar({
    showWizard,
    rightMode, // Per compatibilità (combinazione di leftPanelMode e testPanelMode)
    leftPanelMode, // Nuovo stato separato
    testPanelMode, // Nuovo stato separato
    tasksPanelMode, // Nuovo stato separato
    showSynonyms,
    showMessageReview,
    onRightModeChange: saveRightMode,
    onLeftPanelModeChange: saveLeftPanelMode, // Nuovo handler
    onTestPanelModeChange: saveTestPanelMode, // Nuovo handler
    onTasksPanelModeChange: saveTasksPanelMode, // Nuovo handler
    onToggleSynonyms: () => setShowSynonyms(v => !v),
    onToggleMessageReview: () => setShowMessageReview(v => !v),
    onOpenContractWizard: handleGenerateAll, // Nuovo: apri wizard contract
    rightWidth,
    onRightWidthChange: setRightWidth,
    testPanelWidth,
    onTestPanelWidthChange: setTestPanelWidth,
    tasksPanelWidth,
    onTasksPanelWidthChange: setTasksPanelWidth,
  });

  // Track introduction separately - usa taskTreeRef.current con dipendenze stabilizzate
  // Stabilizza i valori primitivi per evitare problemi con array di dipendenze
  const stableTaskTreeVersion = taskTreeVersion ?? 0;
  // ✅ Serializza introduction per confronto stabile (evita problemi con oggetti)
  // Usa sempre stringa (non null) per evitare problemi con React
  const stableIntroductionKey = taskTree?.introduction ? JSON.stringify(taskTree.introduction) : '';

  const introduction = useMemo(() => {
    return taskTreeRef.current?.introduction ?? null;
  }, [stableTaskTreeVersion, stableIntroductionKey]); // ✅ Usa chiave serializzata sempre stringa

  // Persist explicitly on close only (avoid side-effects/flicker on unmount)
  const handleEditorClose = React.useCallback(async (): Promise<boolean> => {
    console.log('[ResponseEditor][CLOSE] 🚪 Editor close initiated', {
      taskId: task?.id || task?.instanceId,
      hasTask: !!task,
      hasSelectedNode: !!selectedNode,
      hasSelectedNodePath: !!selectedNodePath,
      taskStepsCount: task?.steps ? Object.keys(task.steps).length : 0,
      contractChangeRefType: typeof contractChangeRef.current,
      contractChangeRefExists: !!contractChangeRef.current
    });

    // ✅ Verifica se ci sono modifiche ai contracts non salvate
    const contractChange = contractChangeRef.current;
    console.log('[ResponseEditor][CLOSE] 🔍 Checking contract changes', {
      hasUnsavedChanges: contractChange?.hasUnsavedChanges,
      hasModifiedContract: !!contractChange?.modifiedContract,
      hasOriginalContract: !!contractChange?.originalContract,
      nodeTemplateId: contractChange?.nodeTemplateId,
      nodeLabel: contractChange?.nodeLabel,
      refKeys: contractChange ? Object.keys(contractChange) : [],
      contractChangeRefExists: !!contractChangeRef.current,
      contractChangeType: typeof contractChange
    });

    // ✅ CRITICAL: Controlla anche se contractChangeRef.current è stato aggiornato via useImperativeHandle
    // Se contractChange è null/undefined, prova a leggere direttamente dal RecognitionEditor ref
    if (!contractChange) {
      console.log('[ResponseEditor][CLOSE] ⚠️ contractChangeRef.current is null/undefined');
    } else if (!contractChange.hasUnsavedChanges) {
      console.log('[ResponseEditor][CLOSE] ⚠️ No unsaved changes', {
        hasUnsavedChanges: contractChange.hasUnsavedChanges,
        hasModifiedContract: !!contractChange.modifiedContract,
        hasNodeTemplateId: !!contractChange.nodeTemplateId
      });
    } else if (!contractChange.modifiedContract) {
      console.log('[ResponseEditor][CLOSE] ⚠️ hasUnsavedChanges is true but modifiedContract is null', {
        hasUnsavedChanges: contractChange.hasUnsavedChanges,
        modifiedContract: contractChange.modifiedContract,
        nodeTemplateId: contractChange.nodeTemplateId
      });
    } else if (!contractChange.nodeTemplateId) {
      console.log('[ResponseEditor][CLOSE] ⚠️ hasUnsavedChanges and modifiedContract are set but nodeTemplateId is missing', {
        hasUnsavedChanges: contractChange.hasUnsavedChanges,
        hasModifiedContract: !!contractChange.modifiedContract,
        nodeTemplateId: contractChange.nodeTemplateId
      });
    } else if (contractChange.hasUnsavedChanges && contractChange.modifiedContract && contractChange.nodeTemplateId) {
      console.log('[ResponseEditor][CLOSE] ⚠️ Unsaved contract changes detected', {
        nodeTemplateId: contractChange.nodeTemplateId,
        nodeLabel: contractChange.nodeLabel,
        hasModifiedContract: !!contractChange.modifiedContract,
        hasOriginalContract: !!contractChange.originalContract
      });

      // ✅ Mostra dialog e blocca chiusura
      const template = DialogueTaskService.getTemplate(contractChange.nodeTemplateId);
      console.log('[ResponseEditor][CLOSE] 🟡 Showing dialog...', {
        templateId: contractChange.nodeTemplateId,
        templateLabel: template?.label || contractChange.nodeLabel || 'Template',
        hasModifiedContract: !!contractChange.modifiedContract
      });

      setPendingContractChange({
        templateId: contractChange.nodeTemplateId,
        templateLabel: template?.label || contractChange.nodeLabel || 'Template',
        modifiedContract: contractChange.modifiedContract
      });
      setShowContractDialog(true);
      console.log('[ResponseEditor][CLOSE] ✅ Dialog state set to true, blocking close');
      // ✅ Ritorna false per bloccare la chiusura del tab
      return false;
    }

    // ✅ Salva selectedNode corrente nel ref prima di chiudere (se non già salvato)
    if (selectedNode && selectedNodePath) {
      const mains = getdataList(taskTreeRef.current);
      const { mainIndex, subIndex } = selectedNodePath;
      const isRoot = selectedRoot || false;

      if (mainIndex < mains.length) {
        const main = mains[mainIndex];

        if (isRoot) {
          const newIntroStep = selectedNode?.steps?.find((s: any) => s.type === 'introduction');
          const hasTasks = newIntroStep?.escalations?.some((esc: any) =>
            esc?.tasks && Array.isArray(esc.tasks) && esc.tasks.length > 0
          );
          if (hasTasks) {
            if (!taskTreeRef.current) taskTreeRef.current = { label: '', nodes: [], steps: {} };
            taskTreeRef.current.introduction = {
              type: 'introduction',
              escalations: newIntroStep.escalations || []
            };
          } else {
            if (taskTreeRef.current) delete taskTreeRef.current.introduction;
          }
        } else if (subIndex === undefined) {
          const regexPattern = selectedNode?.dataContract?.contracts?.find((c: any) => c.type === 'regex')?.patterns?.[0];
          const nlpProfileExamples = selectedNode?.nlpProfile?.examples;
          console.log('[REGEX] CLOSE - Saving to taskTreeRef', {
            nodeId: selectedNode?.id,
            regexPattern: regexPattern || '(none)',
            hasNlpProfile: !!selectedNode?.nlpProfile,
            hasNlpProfileExamples: !!nlpProfileExamples,
            nlpProfileExamplesCount: Array.isArray(nlpProfileExamples) ? nlpProfileExamples.length : 0,
            nlpProfileExamples: nlpProfileExamples?.slice(0, 3)
          });
          mains[mainIndex] = selectedNode;
          taskTreeRef.current.nodes = mains;

          // ✅ VERIFICA: Controlla se nlpProfile.examples è presente dopo il salvataggio
          const savedNode = taskTreeRef.current.nodes[mainIndex];
          console.log('[EXAMPLES] CLOSE - Verifying saved node', {
            nodeId: savedNode?.id,
            hasNlpProfile: !!savedNode?.nlpProfile,
            hasNlpProfileExamples: !!savedNode?.nlpProfile?.examples,
            nlpProfileExamplesCount: Array.isArray(savedNode?.nlpProfile?.examples) ? savedNode.nlpProfile.examples.length : 0
          });
        } else {
          const subList = main.subTasks || [];
          const subIdx = subList.findIndex((s: any, idx: number) => idx === subIndex);
          if (subIdx >= 0) {
            subList[subIdx] = selectedNode;
            main.subTasks = subList;
            mains[mainIndex] = main;
            if (!taskTreeRef.current) taskTreeRef.current = { label: '', nodes: [], steps: {} };
            taskTreeRef.current.nodes = mains;
          }
        }
      }
    }

    // ✅ Usa direttamente taskTreeRef.current (già contiene tutte le modifiche)
    const finalTaskTree = { ...taskTreeRef.current };
    const finalMainList = getdataList(finalTaskTree);
    const firstNode = finalMainList?.[0];
    const firstNodeRegex = firstNode?.dataContract?.contracts?.find((c: any) => c.type === 'regex')?.patterns?.[0];
    const firstNodeNlpProfileExamples = firstNode?.nlpProfile?.examples;
    console.log('[REGEX] CLOSE - Final TaskTree before save', {
      hasData: !!finalMainList && finalMainList.length > 0,
      firstNodeRegex: firstNodeRegex || '(none)',
      firstNodeId: firstNode?.id,
      hasFirstNodeNlpProfile: !!firstNode?.nlpProfile,
      hasFirstNodeNlpProfileExamples: !!firstNodeNlpProfileExamples,
      firstNodeNlpProfileExamplesCount: Array.isArray(firstNodeNlpProfileExamples) ? firstNodeNlpProfileExamples.length : 0,
      firstNodeNlpProfileExamples: firstNodeNlpProfileExamples?.slice(0, 3)
    });

    try {
      // Se abbiamo un instanceId o task.id (caso DDTHostAdapter), salva nell'istanza // ✅ RINOMINATO: act → task
      if (task?.id || task?.instanceId) { // ✅ RINOMINATO: act → task
        const key = (task?.instanceId || task?.id) as string; // ✅ RINOMINATO: act → task
        const hasTaskTree = finalTaskTree && Object.keys(finalTaskTree).length > 0 && finalTaskTree.nodes && finalTaskTree.nodes.length > 0;

        // ✅ NUOVO MODELLO: Aggiorna solo la cache in memoria (NON salvataggio DB)
        // Il salvataggio nel DB avviene solo su comando esplicito ("Salva progetto")
        if (hasTaskTree) {
          // ✅ Usa funzione di persistenza per salvare
          await saveTaskToRepository(key, finalTaskTree, task, currentProjectId);

          const firstNodeTestNotes = firstNode?.testNotes;
          console.log('[EXAMPLES] CLOSE - Updated TaskRepository cache with final TaskTree', {
            taskId: key,
            dataLength: finalMainList?.length || 0,
            firstNodeId: firstNode?.id,
            hasFirstNodeNlpProfile: !!firstNode?.nlpProfile,
            hasFirstNodeNlpProfileExamples: !!firstNodeNlpProfileExamples,
            firstNodeNlpProfileExamplesCount: Array.isArray(firstNodeNlpProfileExamples) ? firstNodeNlpProfileExamples.length : 0,
            firstNodeNlpProfileExamples: firstNodeNlpProfileExamples?.slice(0, 3),
            hasFirstNodeTestNotes: !!firstNodeTestNotes,
            firstNodeTestNotesCount: firstNodeTestNotes ? Object.keys(firstNodeTestNotes).length : 0,
            firstNodeTestNotesKeys: firstNodeTestNotes ? Object.keys(firstNodeTestNotes).slice(0, 3) : []
          });
        }

        console.log('[ResponseEditor][CLOSE] 🔍 Pre-save check', {
          taskId: task?.id || task?.instanceId,
          key,
          hasTaskTree,
          finalTaskTreeKeys: finalTaskTree ? Object.keys(finalTaskTree) : [],
            hasNodes: !!finalMainList && finalMainList.length > 0,
            nodesLength: finalMainList?.length || 0
        });

        console.log('[ResponseEditor][CLOSE] 💾 Starting save process', {
          taskId: task?.id || task?.instanceId,
          key,
          hasTask: !!task,
          taskStepsCount: Array.isArray(task?.steps) ? task.steps.length : 0,
          taskStepsIsArray: Array.isArray(task?.steps),
          taskStepsDetails: Array.isArray(task?.steps) ? task.steps.map((step: MaterializedStep) => {
            const nodeSteps = [step]; // ✅ Ogni step è un MaterializedStep
            const isArray = true; // ✅ Sempre array nel nuovo modello
            const isObject = false;
            let escalationsCount = 0;
            let tasksCount = 0;

            escalationsCount = step.escalations?.length || 0;
            tasksCount = step.escalations?.reduce((a: number, esc: any) => a + (esc?.tasks?.length || 0), 0) || 0;
            return {
              stepId: step.id,
              templateStepId: step.templateStepId,
              stepsType: 'array',
              isArray: true,
              isObject: false,
              escalationsCount,
              tasksCount
            };
          }) : []
        });

        // ✅ NUOVO MODELLO: Alla chiusura NON si salva automaticamente nel DB
        // Il salvataggio avviene solo su comando esplicito ("Salva progetto")
        // Qui aggiorniamo solo la cache in memoria per mantenere la working copy aggiornata
        if (hasTaskTree) {
          const finaldata = firstNode;
          const finalSubData = finaldata?.subTasks?.[0];
          const finalStartTasks = finalSubData?.steps?.start?.escalations?.reduce((acc: number, esc: any) => acc + (esc?.tasks?.length || 0), 0) || 0;

          console.log('[handleEditorClose] 🔄 Aggiornando cache in memoria (NON salvataggio DB)', {
            key,
            finalStartTasks,
            hasNodes: !!finalMainList,
            nodesLength: finalMainList?.length || 0
          });

          // ✅ CRITICAL: Aggiungi task.steps a finalTaskTree (unica fonte di verità per gli steps)
          // Gli steps vengono salvati in task.steps[nodeTemplateId] quando si modifica un nodo
          // ✅ finalTaskTreeWithSteps è la WORKING COPY (modificata dall'utente)
          // ✅ Usa task.steps come fonte di verità (contiene tutti gli steps aggiornati dai nodi)
          const finalTaskTreeWithSteps: TaskTree = {
            ...finalTaskTree,
            steps: task?.steps || taskTreeRef.current?.steps || finalTaskTree.steps || {}
          };

          console.log('[ResponseEditor][CLOSE] 📦 Final TaskTree with steps prepared', {
            taskId: task?.id || task?.instanceId,
            key,
            finalStepsKeys: finalTaskTreeWithSteps.steps ? Object.keys(finalTaskTreeWithSteps.steps) : [],
            finalStepsCount: finalTaskTreeWithSteps.steps ? Object.keys(finalTaskTreeWithSteps.steps).length : 0,
            taskStepsKeys: task?.steps ? Object.keys(task.steps) : [],
            taskStepsCount: task?.steps ? Object.keys(task.steps).length : 0,
            stepsMatch: JSON.stringify(finalTaskTreeWithSteps.steps) === JSON.stringify(task?.steps || {})
          });

          // ✅ AWAIT OBBLIGATORIO: non chiudere finché non è salvato
          await saveTaskOnEditorClose(key, finalTaskTreeWithSteps, task, currentProjectId);

          console.log('[ResponseEditor][CLOSE] ✅ Save completed successfully', {
            taskId: task?.id || task?.instanceId,
            key,
            nodesLength: finalDDT.nodes?.length || 0,
            finalStartTasks
          });
        } else if (finalDDT) {
          // ✅ No TaskTree structure, but save other fields (e.g., Message text)
          await saveTaskToRepository(key, finalDDT, task, currentProjectId);
          console.log('[handleEditorClose] ✅ Save completed (no data)', { key });
        }

      }

      // NON chiamare replaceSelectedDDT se abbiamo task prop (siamo in TaskEditorOverlay)
      // Questo previene l'apertura di ResizableResponseEditor in AppContent mentre si chiude TaskEditorOverlay
      if (!task) {
        // Modalità diretta (senza task): aggiorna selectedDDT per compatibilità legacy
        replaceSelectedDDT(finalDDT);
      }
    } catch (e) {
      console.error('[ResponseEditor][CLOSE] ❌ Persist error', {
        taskId: task?.id || task?.instanceId,
        error: e,
        errorMessage: e instanceof Error ? e.message : String(e),
        errorStack: e instanceof Error ? e.stack : undefined
      });
    }

    // ✅ NON chiamare onClose() qui - la chiusura del tab è gestita da tab.onClose nel DockManager
    // tab.onClose chiamerà closeTab solo se questo handleEditorClose ritorna true
    // onClose() è solo per compatibilità legacy e non deve chiudere il tab
    console.log('[ResponseEditor][CLOSE] ✅ Close process completed, returning true to allow tab closure', {
      taskId: task?.id || task?.instanceId
    });

    // ✅ Ritorna true per indicare che la chiusura può procedere
    // DockManager chiuderà il tab solo se tab.onClose ritorna true
    return true;
  }, [replaceSelectedDDT, onClose, task?.id, (task as any)?.instanceId, currentProjectId]);

  // ✅ NON serve più tracciare sincronizzazioni - selectedNode è l'unica fonte di verità
  // Helper per convertire steps (oggetto o array) in array
  const getStepsAsArray = useCallback((steps: any): any[] => {
    if (!steps) return [];
    if (Array.isArray(steps)) return steps;
    // Se è un oggetto, convertilo in array
    return Object.entries(steps).map(([key, value]: [string, any]) => ({
      type: key,
      ...value
    }));
  }, []);

  // ✅ NON serve più salvare prima di cambiare nodo
  // dockTree è la fonte di verità - le modifiche sono già salvate immediatamente in updateSelectedNode

  // ✅ Caricamento: legge da taskTreeRef.current (che contiene già le modifiche, come VB.NET)
  // ✅ Helper function per ottenere steps per un nodo (dictionary lookup diretto)
  const getStepsForNode = React.useCallback((steps: any, nodeTemplateId: string): Record<string, any> => {
    if (!steps || typeof steps !== 'object' || Array.isArray(steps)) {
      return {}; // ✅ Ritorna dictionary vuoto se non valido
    }
    // ✅ Lookup diretto: O(1) invece di O(n) filter
    return steps[nodeTemplateId] || {};
  }, []);

  useEffect(() => {
    // 🔴 LOG CHIRURGICO 3: Caricamento nodo
    const currentMainList = getdataList(taskTreeRef.current); // ✅ Leggi dal ref, non dal prop

    if (currentMainList.length === 0) {
      return;
    }

    try {
      if (localStorage.getItem('debug.nodeSync') === '1') {
        console.log('[NODE_SYNC][LOAD] 🔄 Loading node from taskTree', {
          selectedMainIndex,
          selectedSubIndex,
          selectedRoot,
          mainListLength: currentMainList.length
        });
      }
    } catch { }

    if (selectedRoot) {
      const introStep = taskTreeRef.current?.introduction
        ? { type: 'introduction', escalations: taskTreeRef.current.introduction.escalations }
        : { type: 'introduction', escalations: [] };
      const newNode = { ...taskTreeRef.current, steps: [introStep] };

      try {
        if (localStorage.getItem('debug.nodeSync') === '1') {
          const tasksCount = introStep.escalations?.reduce((acc: number, esc: any) =>
            acc + (esc?.tasks?.length || 0), 0) || 0;
          console.log('[NODE_SYNC][LOAD] ✅ Root node loaded', {
            escalationsCount: introStep.escalations?.length || 0,
            tasksCount
          });
        }
      } catch { }

      setSelectedNode(newNode);
      setSelectedNodePath(null);
    } else {
      // Usa currentMainList invece di mainList per leggere sempre l'ultima versione
      const node = selectedSubIndex == null
        ? currentMainList[selectedMainIndex]
        : getSubDataList(currentMainList[selectedMainIndex])?.[selectedSubIndex];

      if (node) {
        // ✅ CRITICAL: Usa node.templateId come chiave (non node.id)
        // task.steps[node.templateId] = steps clonati
        // node.id potrebbe essere diverso (nel caso di template aggregato)
        const nodeTemplateId = node.templateId || node.id; // ✅ Fallback a node.id se templateId non presente

        // ✅ DEBUG: Log node.nlpProfile.examples quando viene caricato
        const nodeNlpProfileExamples = (node as any)?.nlpProfile?.examples;
        if (nodeNlpProfileExamples || (node as any)?.nlpProfile) {
          console.log('[NODE_SELECT] Node loaded with nlpProfile', {
            nodeId: node.id,
            nodeTemplateId,
            hasNlpProfile: !!(node as any)?.nlpProfile,
            nlpProfileKeys: (node as any)?.nlpProfile ? Object.keys((node as any).nlpProfile) : [],
            hasNlpProfileExamples: !!nodeNlpProfileExamples,
            nlpProfileExamplesCount: Array.isArray(nodeNlpProfileExamples) ? nodeNlpProfileExamples.length : 0,
            nlpProfileExamples: nodeNlpProfileExamples?.slice(0, 3),
            hasTestNotes: !!(node as any)?.testNotes,
            testNotesCount: (node as any)?.testNotes ? Object.keys((node as any).testNotes).length : 0
          });
        }

        // ✅ NUOVO: Usa lookup diretto per ottenere steps per questo nodo (dictionary)
        // ✅ CRITICAL: Usa taskTree.steps come fonte primaria (più affidabile, costruito da buildTaskTree)
        // Fallback a task.steps solo se taskTree.steps non è disponibile
        const stepsSource = taskTreeRef.current?.steps || task?.steps;
        const nodeStepsDict = getStepsForNode(stepsSource, nodeTemplateId);
        const taskTemplateIdsCount = stepsSource && typeof stepsSource === 'object' && !Array.isArray(stepsSource)
          ? Object.keys(stepsSource).length
          : 0;
        const nodeStepTypes = Object.keys(nodeStepsDict);

        console.log('[🔍 ResponseEditor][NODE_SELECT] 🔍 Loading steps for node', {
          nodeId: node.id,
          nodeTemplateId,
          nodeLabel: node?.label,
          hasTaskSteps: nodeStepTypes.length > 0,
          taskTemplateIdsCount,
          nodeStepTypes,
          nodeStepsCount: nodeStepTypes.length,
          stepsSource: taskTreeRef.current?.steps ? 'taskTree.steps' : 'task.steps',
          stepsIsDictionary: stepsSource && typeof stepsSource === 'object' && !Array.isArray(stepsSource)
        });
        const nodeStepsDetails = nodeStepTypes.length > 0 ? (() => {
          let escalationsCount = 0;
          let tasksCount = 0;

          for (const stepType in nodeStepsDict) {
            const step = nodeStepsDict[stepType];
            if (step?.escalations && Array.isArray(step.escalations)) {
              escalationsCount += step.escalations.length;
              tasksCount += step.escalations.reduce((acc: number, esc: any) =>
                acc + (esc?.tasks?.length || 0), 0);
            }
          }

          return {
            stepsType: 'dictionary',
            isArray: false,
            isObject: true,
            stepTypes: nodeStepTypes,
            stepTypesCount: nodeStepTypes.length,
            escalationsCount,
            tasksCount,
            nodeHasStepsBefore: !!node.steps,
            nodeStepsType: typeof node.steps
          };
        })() : null;

        // ✅ Usa nodeStepsDict già dichiarato sopra
        if (nodeStepTypes.length > 0) {
          node.steps = nodeStepsDict;

          let totalEscalations = 0;
          let totalTasks = 0;
          for (const stepType in nodeStepsDict) {
            const step = nodeStepsDict[stepType];
            if (step?.escalations && Array.isArray(step.escalations)) {
              totalEscalations += step.escalations.length;
              totalTasks += step.escalations.reduce((acc: number, esc: any) =>
                acc + (esc?.tasks?.length || 0), 0);
            }
          }

          console.log('[ResponseEditor][NODE_SELECT] ✅ Steps copied to node', {
            nodeId: node.id,
            nodeTemplateId,
            nodeLabel: node?.label,
            stepsCopied: true,
            nodeStepsType: typeof node.steps,
            nodeStepsIsDictionary: node.steps && typeof node.steps === 'object' && !Array.isArray(node.steps),
            nodeStepTypes,
            stepTypesCount: nodeStepTypes.length,
            escalationsCount: totalEscalations,
            tasksCount: totalTasks
          });
        } else {
          console.log('[🔍 ResponseEditor][NODE_SELECT] ❌ CRITICAL - No steps found for node', {
            nodeId: node.id,
            nodeTemplateId,
            nodeLabel: node?.label,
            stepsSource: taskTreeRef.current?.steps ? 'taskTree.steps' : 'task.steps',
            hasTaskSteps: !!(nodeTemplateId && stepsSource?.[nodeTemplateId]),
            taskStepsKeys: stepsSource && typeof stepsSource === 'object' && !Array.isArray(stepsSource)
              ? Object.keys(stepsSource)
              : [],
            taskTemplateIdsCount: stepsSource && typeof stepsSource === 'object' && !Array.isArray(stepsSource)
              ? Object.keys(stepsSource).length
              : 0,
            nodeHasTemplateId: !!node.templateId,
            nodeTemplateIdMatches: node.templateId ? stepsSource?.[node.templateId] : false,
            keyMatchAnalysis: nodeTemplateId && stepsSource && typeof stepsSource === 'object' && !Array.isArray(stepsSource) ? {
              lookingFor: nodeTemplateId,
              availableKeys: Object.keys(stepsSource),
              keyComparison: Object.keys(stepsSource).map(k => ({
                key: k,
                matches: k === nodeTemplateId,
                keyPreview: k.substring(0, 40),
                templateIdPreview: nodeTemplateId.substring(0, 40)
              }))
            } : null
          });
        }

        // 🔴 LOG CHIRURGICO 3 (continuazione): Dettagli del nodo caricato
        const steps = getStepsAsArray(node?.steps);
        const startStepTasksCount = steps.find((s: any) => s?.type === 'start')?.escalations?.reduce((acc: number, esc: any) => acc + (esc?.tasks?.length || 0), 0) || 0;


        try {
          if (localStorage.getItem('debug.nodeSync') === '1') {
            const steps = getStepsAsArray(node?.steps);
            const escalationsCount = steps.reduce((acc: number, step: any) =>
              acc + (step?.escalations?.length || 0), 0);
            const tasksCount = steps.reduce((acc: number, step: any) =>
              acc + (step?.escalations?.reduce((a: number, esc: any) =>
                a + (esc?.tasks?.length || 0), 0) || 0), 0);

            // Log dettagliato per ogni step
            const stepDetails = steps.map((step: any, idx: number) => {
              const stepKey = step?.type || `step-${idx}`;
              const escs = step?.escalations || [];
              const stepTasksCount = escs.reduce((acc: number, esc: any) =>
                acc + (esc?.tasks?.length || 0), 0);
              return {
                stepKey,
                escalationsCount: escs.length,
                tasksCount: stepTasksCount,
                tasks: escs.flatMap((esc: any) => esc?.tasks || []).map((t: any) => ({
                  id: t?.id,
                  label: t?.label
                }))
              };
            });

            console.log('[NODE_SYNC][LOAD] ✅ Node loaded from taskTree', {
              mainIndex: selectedMainIndex,
              subIndex: selectedSubIndex,
              nodeLabel: node?.label,
              stepsCount: steps.length,
              escalationsCount,
              tasksCount,
              stepDetails
            });
          }
        } catch (e) {
          // Error logging details (gated by debug flag)
        }


        setSelectedNode(node);
        const newPath = {
          mainIndex: selectedMainIndex,
          subIndex: selectedSubIndex
        };
        setSelectedNodePath(newPath);
      }
    }


    // ✅ Carica il nodo quando cambiano gli indici O quando taskTree prop cambia (dal dockTree)
    // taskTreeRef.current è già sincronizzato con taskTree prop dal useEffect precedente
  }, [selectedMainIndex, selectedSubIndex, selectedRoot, introduction, taskTree?.label, taskTree?.nodes?.length, task?.steps]);

  // ✅ NON serve più sincronizzare selectedNode con localDDT
  // selectedNode è l'unica fonte di verità durante l'editing
  // Quando chiudi l'editor, costruisci il TaskTree da selectedNode e salva


  // ✅ Step keys e selectedStepKey sono ora gestiti internamente da BehaviourEditor

  // ✅ updateSelectedNode: SINGOLA FONTE DI VERITÀ = dockTree
    // 1. Modifica taskTreeRef.current (buffer locale per editing)
  // 2. Aggiorna IMMEDIATAMENTE tab.taskTree nel dockTree (fonte di verità)
  // 3. React re-renderizza con tab.taskTree aggiornato
  //
  // ✅ BATCH TESTING: During batch testing, node structure is IMMUTABLE
  // This prevents feedback loops: updateSelectedNode → re-render → onChange → handleProfileUpdate → ...
  const updateSelectedNode = useCallback((updater: (node: any) => any, notifyProvider: boolean = true) => {
    // ✅ CRITICAL: Block structural mutations during batch testing
    if (getIsTesting()) {
      console.log('[updateSelectedNode] Blocked: batch testing active');
      return;
    }

    try {
    } catch { }

    setSelectedNode((prev: any) => {
      if (!prev || !selectedNodePath) {
        return prev;
      }

      const updated = updater(prev) || prev;

      // ✅ LOG: Always log dataContract comparison (even if unchanged)
      const dataContractChanged = updated.dataContract !== prev.dataContract;
      const dataContractDeepChanged = JSON.stringify(updated.dataContract) !== JSON.stringify(prev.dataContract);

      const updatedRegex = updated.dataContract?.contracts?.find((c: any) => c.type === 'regex')?.patterns?.[0];
      if (dataContractChanged && updatedRegex) {
        console.log('[REGEX] UPDATE - updateSelectedNode', {
          nodeId: updated.id,
          regexPattern: updatedRegex
        });
      }

      const { mainIndex, subIndex } = selectedNodePath;
      const isRoot = selectedRoot || false;

      // ✅ STEP 1: Costruisci il TaskTree completo aggiornato
      const currentTaskTree = taskTreeRef.current || taskTree;
      const updatedTaskTree = { ...currentTaskTree };
      const mains = [...(currentTaskTree.nodes || [])];

      if (mainIndex < mains.length) {
        const main = { ...mains[mainIndex] };

        if (isRoot) {
          // Root node (introduction)
          const newIntroStep = updated?.steps?.find((s: any) => s.type === 'introduction');
          if (newIntroStep?.escalations?.some((esc: any) => esc?.tasks?.length > 0)) {
            updatedTaskTree.introduction = {
              type: 'introduction',
              escalations: newIntroStep.escalations || []
            };
          } else {
            delete updatedTaskTree.introduction;
          }
        } else if (subIndex === undefined) {
          // Main node
          mains[mainIndex] = updated;
          updatedTaskTree.nodes = mains;

          // ✅ LOG: Verifica che nlpProfile.examples sia presente dopo l'aggiornamento
          const savedNlpProfileExamples = mains[mainIndex]?.nlpProfile?.examples;
          if (savedNlpProfileExamples) {
            console.log('[EXAMPLES] UPDATE - Saved to taskTreeRef.data', {
              nodeId: updated.id,
              mainIndex,
              hasNlpProfile: !!mains[mainIndex]?.nlpProfile,
              hasNlpProfileExamples: !!savedNlpProfileExamples,
              nlpProfileExamplesCount: savedNlpProfileExamples.length,
              nlpProfileExamples: savedNlpProfileExamples.slice(0, 3)
            });
          }

          // ✅ CRITICAL: Salva updated.steps come dictionary
          // ✅ NUOVO: steps è un dictionary: { "templateId": { "start": {...}, "noMatch": {...}, ... } }
          const nodeTemplateId = updated.templateId || updated.id; // ✅ Fallback a id se templateId non presente
          if (nodeTemplateId && updated.steps && task) {
            // ✅ Inizializza task.steps come dictionary se non esiste
            if (!task.steps || typeof task.steps !== 'object' || Array.isArray(task.steps)) {
              task.steps = {};
            }

            // ✅ updated.steps può essere dictionary o array (legacy)
            let nodeStepsDict: Record<string, any> = {};
            if (updated.steps && typeof updated.steps === 'object' && !Array.isArray(updated.steps)) {
              // ✅ Già dictionary: usa direttamente
              nodeStepsDict = updated.steps;
            } else if (Array.isArray(updated.steps)) {
              // ✅ Legacy array: converti in dictionary
              console.warn('[updateSelectedNode] Converting legacy array to dictionary', { nodeTemplateId });
              for (const step of updated.steps) {
                if (step?.type) {
                  nodeStepsDict[step.type] = {
                    type: step.type,
                    escalations: step.escalations || [],
                    id: step.id
                  };
                }
              }
            }

            // ✅ Salva nel dictionary usando nodeTemplateId come chiave
            task.steps[nodeTemplateId] = nodeStepsDict;

            // ✅ CRITICAL: Aggiorna anche taskTreeRef.current.steps per mantenere sincronizzazione
            if (taskTreeRef.current) {
              if (!taskTreeRef.current.steps || typeof taskTreeRef.current.steps !== 'object' || Array.isArray(taskTreeRef.current.steps)) {
                taskTreeRef.current.steps = {};
              }
              taskTreeRef.current.steps[nodeTemplateId] = nodeStepsDict;
            }
          }
        } else {
          // Sub node
          const subList = [...(main.subTasks || [])];
          const subIdx = subList.findIndex((s: any, idx: number) => idx === subIndex);
          if (subIdx >= 0) {
            subList[subIdx] = updated;
            main.subTasks = subList;
            mains[mainIndex] = main;
            updatedTaskTree.nodes = mains;

            // ✅ CRITICAL: Salva updated.steps come dictionary
            // ✅ NUOVO: steps è un dictionary: { "templateId": { "start": {...}, "noMatch": {...}, ... } }
            const nodeTemplateId = updated.templateId || updated.id; // ✅ Fallback a id se templateId non presente
            if (nodeTemplateId && updated.steps && task) {
              // ✅ Inizializza task.steps come dictionary se non esiste
              if (!task.steps || typeof task.steps !== 'object' || Array.isArray(task.steps)) {
                task.steps = {};
              }

              // ✅ updated.steps può essere dictionary o array (legacy)
              let nodeStepsDict: Record<string, any> = {};
              if (updated.steps && typeof updated.steps === 'object' && !Array.isArray(updated.steps)) {
                // ✅ Già dictionary: usa direttamente
                nodeStepsDict = updated.steps;
              } else if (Array.isArray(updated.steps)) {
                // ✅ Legacy array: converti in dictionary
                console.warn('[updateSelectedNode] Converting legacy array to dictionary (sub)', { nodeTemplateId });
                for (const step of updated.steps) {
                  if (step?.type) {
                    nodeStepsDict[step.type] = {
                      type: step.type,
                      escalations: step.escalations || [],
                      id: step.id
                    };
                  }
                }
              }

              // ✅ Salva nel dictionary usando nodeTemplateId come chiave
              task.steps[nodeTemplateId] = nodeStepsDict;

              // ✅ CRITICAL: Aggiorna anche taskTreeRef.current.steps per mantenere sincronizzazione
              if (taskTreeRef.current) {
                if (!taskTreeRef.current.steps || typeof taskTreeRef.current.steps !== 'object' || Array.isArray(taskTreeRef.current.steps)) {
                  taskTreeRef.current.steps = {};
                }
                taskTreeRef.current.steps[nodeTemplateId] = nodeStepsDict;
              }
            }
          }
        }

        // ✅ STEP 2: Valida struttura TaskTree
        const validation = validateTaskStructure(updatedTaskTree);
        if (!validation.valid) {
          console.error('[ResponseEditor] Invalid TaskTree structure:', validation.error);
          // Mostra errore all'utente (puoi aggiungere un toast/alert qui)
          alert(`Invalid structure: ${validation.error}`);
          return prev; // Non aggiornare se struttura invalida
        }

        // ✅ STEP 3: Aggiorna taskTreeRef.current (buffer locale)
        taskTreeRef.current = updatedTaskTree;

        // ✅ LOG: Verifica che nlpProfile.examples sia presente in taskTreeRef.current dopo l'aggiornamento
        const taskTreeRefNlpProfileExamples = taskTreeRef.current?.nodes?.[mainIndex]?.nlpProfile?.examples;
        if (taskTreeRefNlpProfileExamples) {
          console.log('[EXAMPLES] UPDATE - Verified in taskTreeRef.current', {
            nodeId: updated.id,
            mainIndex,
            hasNlpProfile: !!taskTreeRef.current?.nodes?.[mainIndex]?.nlpProfile,
            hasNlpProfileExamples: !!taskTreeRefNlpProfileExamples,
            nlpProfileExamplesCount: taskTreeRefNlpProfileExamples.length,
            nlpProfileExamples: taskTreeRefNlpProfileExamples.slice(0, 3)
          });
        }

        // ✅ STEP 4: Aggiorna IMMEDIATAMENTE tab.taskTree nel dockTree (FONTE DI VERITÀ) - solo se disponibili
        if (tabId && setDockTree) {
          setDockTree(prev =>
            mapNode(prev, n => {
              if (n.kind === 'tabset') {
                const idx = n.tabs.findIndex(t => t.id === tabId);
                if (idx !== -1 && n.tabs[idx].type === 'responseEditor') {
                  const updatedTab = { ...n.tabs[idx], taskTree: updatedTaskTree };
                  return {
                    ...n,
                    tabs: [
                      ...n.tabs.slice(0, idx),
                      updatedTab,
                      ...n.tabs.slice(idx + 1)
                    ]
                  };
                }
              }
              return n;
            })
          );
        }

        // ✅ STEP 5: Salvataggio implicito e immediato (SEMPRE, anche senza tabId/setDockTree)
        // Ogni modifica viene salvata immediatamente nel taskRepository per garantire persistenza
        // NOTA: task viene letto dal closure del useCallback, quindi è disponibile
        const taskToSave = task; // Cattura task dal closure
        const projectIdToSave = currentProjectId; // Cattura currentProjectId dal closure

        if (taskToSave?.id || (taskToSave as any)?.instanceId) {
          const key = ((taskToSave as any)?.instanceId || taskToSave?.id) as string;
          // ✅ Verifica che updatedTaskTree sia valido (ha nodes o steps)
          const hasTaskTree = updatedTaskTree && (
            (updatedTaskTree.nodes && updatedTaskTree.nodes.length > 0) ||
            (updatedTaskTree.steps && Array.isArray(updatedTaskTree.steps) && updatedTaskTree.steps.length > 0)
          );

          if (hasTaskTree) {
            // Salva in modo asincrono (non bloccare l'UI)
            void (async () => {
              try {
                const taskInstance = taskRepository.getTask(key);
                const currentTemplateId = getTemplateId(taskInstance);

                // ✅ Usa funzione di persistenza per salvare
                await saveTaskToRepository(key, updatedTaskTree, taskInstance, projectIdToSave);
              } catch (err) {
                console.error('[ResponseEditor] Failed to save task:', err);
              }
            })();
          }
        }
      }

      // ✅ Solo invalidatore interno (non notificare provider per evitare re-mount)
      setTaskTreeVersion(v => v + 1);

      try {
        if (localStorage.getItem('debug.nodeSync') === '1') {
          const steps = updated?.steps || [];
          const escalationsCount = steps.reduce((acc: number, step: any) =>
            acc + (step?.escalations?.length || 0), 0);
          const tasksCount = steps.reduce((acc: number, step: any) =>
            acc + (step?.escalations?.reduce((a: number, esc: any) =>
              a + (esc?.tasks?.length || 0), 0) || 0), 0);
          console.log('[NODE_SYNC][UPDATE] ✅ selectedNode updated + dockTree updated', {
            stepsCount: steps.length,
            escalationsCount,
            tasksCount
          });
        }
      } catch { }

      return updated;
    });
  }, [selectedNodePath, selectedRoot, tabId, setDockTree, taskTree?.label, taskTree?.nodes?.length ?? 0, task, currentProjectId]);

  // ✅ NON serve più persistenza asincrona
  // Quando chiudi l'editor, costruisci il TaskTree da selectedNode e salva

  // ✅ normalizeAndPersistModel è ora gestito internamente da BehaviourEditor

  // kept for future translation edits in StepEditor


  // ✅ handleProfileUpdate: aggiorna selectedNode (UI immediata) e salva override
  const handleProfileUpdate = useCallback((partialProfile: any) => {
    // ✅ CRITICAL: Blocca aggiornamenti durante batch testing per prevenire re-render infiniti
    if (getIsTesting()) {
      console.log('[handleProfileUpdate] Blocked: batch testing active');
      return;
    }

    // ✅ Usa updateSelectedNode per aggiornare il node e salvare l'override
    updateSelectedNode((prev: any) => {
      if (!prev) {
        return prev;
      }

      const updated = {
        ...prev,
        nlpProfile: {
          ...(prev.nlpProfile || {}),
          ...partialProfile
        }
      };

      // ✅ Aggiorna anche nlpContract per salvare l'override
      if (!updated.nlpContract) {
        updated.nlpContract = {};
      }

      // ✅ Salva tutte le proprietà del profile nel nlpContract come override
      updated.nlpContract = {
        ...updated.nlpContract,
        ...partialProfile,
        // ✅ Assicura che regex, synonyms, ecc. siano salvati
        regex: partialProfile.regex !== undefined ? partialProfile.regex : updated.nlpContract.regex,
        synonyms: partialProfile.synonyms !== undefined ? partialProfile.synonyms : updated.nlpContract.synonyms,
        kind: partialProfile.kind !== undefined ? partialProfile.kind : updated.nlpContract.kind,
        examples: partialProfile.examples !== undefined ? partialProfile.examples : updated.nlpContract.examples,
        testCases: partialProfile.testCases !== undefined ? partialProfile.testCases : updated.nlpContract.testCases,
        formatHints: partialProfile.formatHints !== undefined ? partialProfile.formatHints : updated.nlpContract.formatHints,
        minConfidence: partialProfile.minConfidence !== undefined ? partialProfile.minConfidence : updated.nlpContract.minConfidence,
        postProcess: partialProfile.postProcess !== undefined ? partialProfile.postProcess : updated.nlpContract.postProcess,
        waitingEsc1: partialProfile.waitingEsc1 !== undefined ? partialProfile.waitingEsc1 : updated.nlpContract.waitingEsc1,
        waitingEsc2: partialProfile.waitingEsc2 !== undefined ? partialProfile.waitingEsc2 : updated.nlpContract.waitingEsc2,
      };

      return updated;
    }, true);
  }, [selectedNode, selectedNodePath, updateSelectedNode]);

  // Funzione per capire se c'├¿ editing attivo (input, textarea, select)
  function isEditingActive() {
    const el = document.activeElement;
    if (!el) return false;
    const tag = (el as HTMLElement).tagName.toLowerCase();
    return tag === 'input' || tag === 'textarea' || tag === 'select' || (el as HTMLElement).isContentEditable;
  }

  // ✅ Keyboard shortcuts per step navigation sono ora gestiti internamente da BehaviourEditor


  // Esponi toolbar tramite callback quando in docking mode
  const headerColor = '#9a4f00'; // Orange color from EditorHeader theme

  // ✅ Use side-effects hook to manage all side-effects
  useResponseEditorSideEffects({
    task,
    taskTree,
    taskTreeRef,
    currentProjectId,
    setTaskTreeVersion,
    prevInstanceRef,
    setServiceUnavailable,
    setEscalationTasks,
    pendingEditorOpen,
    showSynonyms,
    selectedNode,
    setPendingEditorOpen,
    replaceSelectedTaskTree,
    sidebarRef,
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
  });

  // Layout
  return (
    <div ref={rootRef} className={combinedClass} style={{ background: '#0b0f17', display: 'flex', flexDirection: 'column', overflow: 'hidden', flex: 1, minHeight: 0, height: '100%' }}>

      {/* Header sempre visibile (minimale durante wizard, completo dopo) - nascosto quando in docking mode */}
      {!hideHeader && (
        <EditorHeader
          icon={<Icon size={18} style={{ color: iconColor }} />}
          title={headerTitle}
          toolbarButtons={toolbarButtons}
          onClose={handleEditorClose}
          color="orange"
        />
      )}

      {/* Contenuto */}
      <div style={{ display: 'flex', flex: 1, minHeight: 0, height: '100%', overflow: 'hidden' }}>
        <ResponseEditorContent
          isInferring={isInferring}
          showContractWizard={showContractWizard}
          showWizard={showWizard}
          shouldShowInferenceLoading={shouldShowInferenceLoading}
          needsIntentMessages={needsIntentMessages}
          task={task && 'templateId' in task ? task : null}
          taskTree={taskTree}
          taskTreeRef={taskTreeRef}
          handleContractWizardClose={handleContractWizardClose}
          handleContractWizardNodeUpdate={handleContractWizardNodeUpdate}
          handleContractWizardComplete={handleContractWizardComplete}
          handleDDTWizardCancel={handleDDTWizardCancel}
          handleDDTWizardComplete={handleDDTWizardComplete}
          getInitialDDT={getInitialDDT}
          onIntentMessagesComplete={handleIntentMessagesComplete}
          normalEditorLayout={
            <ResponseEditorNormalLayout
              mainList={mainList}
              taskTree={taskTree}
              task={task && 'templateId' in task ? task : null}
              currentProjectId={currentProjectId}
              localTranslations={localTranslations}
              escalationTasks={escalationTasks}
              selectedMainIndex={selectedMainIndex}
              selectedSubIndex={selectedSubIndex}
              selectedRoot={selectedRoot}
              selectedNode={selectedNode}
              selectedNodePath={selectedNodePath}
              handleSelectMain={handleSelectMain}
              handleSelectSub={handleSelectSub}
              handleSelectAggregator={handleSelectAggregator}
              sidebarRef={sidebarRef}
              onChangeSubRequired={sidebarHandlers.onChangeSubRequired}
              onReorderSub={sidebarHandlers.onReorderSub}
              onAddMain={sidebarHandlers.onAddMain}
              onRenameMain={sidebarHandlers.onRenameMain}
              onDeleteMain={sidebarHandlers.onDeleteMain}
              onAddSub={sidebarHandlers.onAddSub}
              onRenameSub={sidebarHandlers.onRenameSub}
              onDeleteSub={sidebarHandlers.onDeleteSub}
              handleParserCreate={handleParserCreate}
              handleParserModify={handleParserModify}
              handleEngineChipClick={handleEngineChipClick}
              handleGenerateAll={handleGenerateAll}
              isAggregatedAtomic={isAggregatedAtomic}
              sidebarManualWidth={sidebarManualWidth}
              isDraggingSidebar={isDraggingSidebar}
              handleSidebarResizeStart={handleSidebarResizeStart}
              showMessageReview={showMessageReview}
              showSynonyms={showSynonyms}
              selectedIntentIdForTraining={selectedIntentIdForTraining}
              setSelectedIntentIdForTraining={setSelectedIntentIdForTraining}
              pendingEditorOpen={pendingEditorOpen}
              contractChangeRef={contractChangeRef}
              taskType={taskType}
              handleProfileUpdate={handleProfileUpdate}
              updateSelectedNode={updateSelectedNode}
              leftPanelMode={leftPanelMode}
              testPanelMode={testPanelMode}
              tasksPanelMode={tasksPanelMode}
              rightWidth={rightWidth}
              testPanelWidth={testPanelWidth}
              tasksPanelWidth={tasksPanelWidth}
              draggingPanel={draggingPanel}
              setDraggingPanel={setDraggingPanel}
              setRightWidth={setRightWidth}
              setTestPanelWidth={setTestPanelWidth}
              setTasksPanelWidth={setTasksPanelWidth}
              tasksStartWidthRef={tasksStartWidthRef}
              tasksStartXRef={tasksStartXRef}
              replaceSelectedTaskTree={replaceSelectedTaskTree}
              replaceSelectedDDT={replaceSelectedDDT}
            />
          }
        />
      </div>

      {/* Drag layer for visual feedback when dragging tasks */}
      <TaskDragLayer />

      {/* ✅ Service Unavailable Modal - Centered in ResponseEditor */}
      {serviceUnavailable && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0, 0, 0, 0.7)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 10000,
            pointerEvents: 'auto' // ✅ Modal: blocca interazione con il resto
          }}
          onClick={(e) => {
            // Chiudi cliccando sullo sfondo (opzionale, ma meglio solo con OK)
            // e.stopPropagation();
          }}
        >
          <div
            style={{
              background: '#2d2d2d',
              borderRadius: 12,
              boxShadow: '0 4px 24px rgba(0,0,0,0.4)',
              padding: 24,
              maxWidth: 500,
              width: '90%',
              display: 'flex',
              flexDirection: 'column',
              gap: 16,
              pointerEvents: 'auto'
            }}
            onClick={(e) => e.stopPropagation()} // Previeni chiusura cliccando sul contenuto
          >
            {/* Header con icona e titolo */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: 12
            }}>
              <div style={{
                color: '#fbbf24',
                fontSize: 32,
                flexShrink: 0
              }}>
                ⚠️
              </div>
              <h3 style={{
                fontSize: 20,
                fontWeight: 700,
                margin: 0,
                color: '#e2e8f0'
              }}>
                {serviceUnavailable.service || 'Servizio'} non disponibile
              </h3>
            </div>

            {/* Messaggio */}
            <p style={{
              fontSize: 16,
              lineHeight: 1.5,
              margin: 0,
              color: '#e2e8f0'
            }}>
              {serviceUnavailable.message}
            </p>

            {/* Endpoint info (se presente) */}
            {serviceUnavailable.endpoint && (
              <p style={{
                fontSize: 12,
                color: '#94a3b8',
                margin: 0
              }}>
                Endpoint: {serviceUnavailable.endpoint}
              </p>
            )}

            {/* Azioni */}
            <div style={{
              display: 'flex',
              justifyContent: 'flex-end',
              gap: 8,
              marginTop: 8
            }}>
              {serviceUnavailable.onRetry && (
                <button
                  onClick={() => {
                    const retry = serviceUnavailable.onRetry;
                    setServiceUnavailable(null);
                    try { retry(); } catch { }
                  }}
                  style={{
                    background: '#0ea5e9',
                    color: '#0b1220',
                    border: 'none',
                    borderRadius: 8,
                    padding: '10px 24px',
                    fontWeight: 700,
                    cursor: 'pointer',
                    fontSize: 14,
                    transition: 'background 0.2s'
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.background = '#0284c7'}
                  onMouseLeave={(e) => e.currentTarget.style.background = '#0ea5e9'}
                >
                  Retry
                </button>
              )}
              <button
                onClick={() => setServiceUnavailable(null)}
                style={{
                  background: '#22c55e',
                  color: '#0b1220',
                  border: 'none',
                  borderRadius: 8,
                  padding: '10px 24px',
                  fontWeight: 700,
                  cursor: 'pointer',
                  fontSize: 14,
                  transition: 'background 0.2s'
                }}
                onMouseEnter={(e) => e.currentTarget.style.background = '#16a34a'}
                onMouseLeave={(e) => e.currentTarget.style.background = '#22c55e'}
              >
                OK
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Contract Update Dialog - dentro ResponseEditor */}
      {showContractDialog && pendingContractChange && (
        <ContractUpdateDialog
          open={showContractDialog}
          templateLabel={pendingContractChange.templateLabel}
          onKeep={() => {
            // ✅ Mantieni: chiudi editor, modifiche già in memoria (NON salvare nel DB)
            console.log('[ResponseEditor][DIALOG] ✅ Mantieni modifiche - chiudendo editor');
            setShowContractDialog(false);
            setPendingContractChange(null);
            contractChangeRef.current = {
              hasUnsavedChanges: false,
              modifiedContract: null,
              originalContract: null,
              nodeTemplateId: undefined,
              nodeLabel: undefined
            };
            // ✅ Chiudi tab tramite setDockTree (se disponibile)
            if (tabId && setDockTree) {
              console.log('[ResponseEditor][DIALOG] Closing tab via setDockTree', { tabId });
              setDockTree(prev => closeTab(prev, tabId));
            } else if (onClose) {
              // ✅ Fallback per compatibilità legacy
              console.log('[ResponseEditor][DIALOG] Closing via onClose (legacy)');
              onClose();
            }
          }}
          onDiscard={() => {
            // ✅ Scarta: ripristina originale in memoria, poi chiudi
            console.log('[ResponseEditor][DIALOG] ❌ Scarta modifiche - ripristinando originale');
            const template = DialogueTaskService.getTemplate(pendingContractChange.templateId);
            if (template && contractChangeRef.current.originalContract !== undefined) {
              // ✅ Ripristina contract originale in memoria
              template.dataContract = contractChangeRef.current.originalContract
                ? JSON.parse(JSON.stringify(contractChangeRef.current.originalContract))
                : null;
              // ✅ Rimuovi template dalla lista dei modificati (è tornato allo stato originale)
              DialogueTaskService.clearModifiedTemplate(pendingContractChange.templateId);
              console.log('[ResponseEditor][DIALOG] ✅ Template ripristinato in memoria', {
                templateId: pendingContractChange.templateId,
                hasOriginalContract: !!contractChangeRef.current.originalContract
              });
            }

            setShowContractDialog(false);
            setPendingContractChange(null);
            contractChangeRef.current = {
              hasUnsavedChanges: false,
              modifiedContract: null,
              originalContract: null,
              nodeTemplateId: undefined,
              nodeLabel: undefined
            };
            // ✅ Chiudi tab tramite setDockTree (se disponibile)
            if (tabId && setDockTree) {
              console.log('[ResponseEditor][DIALOG] Closing tab via setDockTree', { tabId });
              setDockTree(prev => closeTab(prev, tabId));
            } else if (onClose) {
              // ✅ Fallback per compatibilità legacy
              console.log('[ResponseEditor][DIALOG] Closing via onClose (legacy)');
              onClose();
            }
          }}
          onCancel={() => {
            // ✅ Annulla: non chiudere editor
            console.log('[ResponseEditor][DIALOG] ⏸️ Annulla - non chiudere editor');
            setShowContractDialog(false);
            setPendingContractChange(null);
            // ✅ NON resettare contractChangeRef, così se riprova a chiudere ricompare il dialog
          }}
        />
      )}
    </div>
  );
}

export default function ResponseEditor({ taskTree, onClose, onWizardComplete, task, isTaskTreeLoading, hideHeader, onToolbarUpdate, tabId, setDockTree, registerOnClose }: { taskTree?: TaskTree | null, onClose?: () => void, onWizardComplete?: (finalTaskTree: TaskTree) => void, task?: TaskMeta | Task, isTaskTreeLoading?: boolean, hideHeader?: boolean, onToolbarUpdate?: (toolbar: ToolbarButton[], color: string) => void, tabId?: string, setDockTree?: (updater: (prev: any) => any) => void, registerOnClose?: (fn: () => Promise<boolean>) => void }) {
  return (
    <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <FontProvider>
        <ResponseEditorInner taskTree={taskTree} onClose={onClose} onWizardComplete={onWizardComplete} task={task} isTaskTreeLoading={isTaskTreeLoading} hideHeader={hideHeader} onToolbarUpdate={onToolbarUpdate} tabId={tabId} setDockTree={setDockTree} registerOnClose={registerOnClose} /> {/* ✅ ARCHITETTURA ESPERTO: Passa isTaskTreeLoading */}
      </FontProvider>
    </div>
  );
}
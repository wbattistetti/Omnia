import React, { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import { info } from '../../../utils/logger';
import DDTWizard from '../../DialogueDataTemplateBuilder/DDTWizard/DDTWizard';
import { isTaskTreeEmpty } from '../../../utils/ddt';
import { useDDTManager } from '../../../context/DDTManagerContext';
import { taskRepository } from '../../../services/TaskRepository';
import { useProjectDataUpdate } from '../../../context/ProjectDataContext';
import { getTemplateId } from '../../../utils/taskHelpers';
import { TaskType, isUtteranceInterpretationTemplateId, isUtteranceInterpretationTask } from '../../../types/taskTypes'; // ✅ Helper functions per evitare stringhe hardcoded
import Sidebar from './Sidebar';
import BehaviourEditor from './BehaviourEditor';
import RightPanel, { useRightPanelWidth, RightPanelMode } from './RightPanel';
import MessageReviewView from './MessageReview/MessageReviewView';
// import SynonymsEditor from './SynonymsEditor';
import DataExtractionEditor from './DataExtractionEditor';
import { ContractUpdateDialog } from './ContractUpdateDialog';
import { updateTemplateContract, createNewTemplateFrom } from '../../../services/TemplateUpdateService';
import DialogueTaskService from '../../../services/DialogueTaskService';
import EditorHeader from '../../common/EditorHeader';
import { getTaskVisualsByType } from '../../Flowchart/utils/taskVisuals';
import TaskDragLayer from './TaskDragLayer';
import {
  getdataList,
  getSubDataList
} from './ddtSelectors';
import { hasIntentMessages } from './utils/hasMessages';
import IntentMessagesBuilder from './components/IntentMessagesBuilder';
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
import { extractTaskOverrides, buildTaskTree, syncTasksWithTemplate, markTaskAsEdited } from '../../../utils/taskUtils';
import { useWizardInference } from './hooks/useWizardInference';
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

  // ✅ Service unavailable warning state (centered overlay in ResponseEditor)
  const [serviceUnavailable, setServiceUnavailable] = React.useState<{
    service: string;
    message: string;
    endpoint?: string;
    onRetry?: () => void;
  } | null>(null);

  // ✅ Contract change dialog state
  const [showContractDialog, setShowContractDialog] = React.useState(false);
  const [pendingContractChange, setPendingContractChange] = React.useState<{
    templateId: string;
    templateLabel: string;
    modifiedContract: any;
  } | null>(null);

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

  // ✅ Listen for service unavailable events
  React.useEffect(() => {
    const handleServiceUnavailable = (event: CustomEvent) => {
      const { service, message, endpoint, onRetry } = event.detail || {};
      setServiceUnavailable({ service, message, endpoint, onRetry });
      // ✅ Modal: NO auto-hide, l'utente deve chiudere manualmente con OK
    };

    window.addEventListener('service:unavailable' as any, handleServiceUnavailable);
    return () => {
      window.removeEventListener('service:unavailable' as any, handleServiceUnavailable);
    };
  }, []);

  // ✅ Load tasks for escalation palette
  const [escalationTasks, setEscalationTasks] = React.useState<any[]>([]);
  React.useEffect(() => {
    fetch('/api/factory/tasks?taskType=Action')
      .then(res => {
        if (!res.ok) {
          console.warn('[ResponseEditor] Failed to load escalation tasks: HTTP', res.status);
          return [];
        }
        return res.json();
      })
      .then(templates => {
        // ✅ CRITICAL: Verifica che templates sia un array
        if (!Array.isArray(templates)) {
          console.warn('[ResponseEditor] Invalid response format, expected array, got:', typeof templates, templates);
          setEscalationTasks([]);
          return;
        }

        const tasks = templates.map((template: any) => ({
          id: template.id || template._id,
          label: template.label || '',
          description: template.description || '',
          icon: template.icon || 'Circle',
          color: template.color || 'text-gray-500',
          params: template.structure || template.params || {},
          type: template.type,
          allowedContexts: template.allowedContexts || []
        }));

        setEscalationTasks(tasks);
      })
      .catch(err => {
        console.error('[ResponseEditor] Failed to load escalation tasks', err);
        setEscalationTasks([]);
      });
  }, []);
  const rootRef = useRef<HTMLDivElement>(null);
  const wizardOwnsDataRef = useRef(false); // Flag: wizard has control over data lifecycle

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

  // ✅ TaskTree come ref mutabile (simula VB.NET: modifica diretta sulla struttura in memoria)
  const taskTreeRef = useRef(taskTree);

  // ✅ Inizializza taskTreeRef.current solo su cambio istanza (non ad ogni re-render)
  const prevInstanceRef = useRef<string | undefined>(undefined);

  // ✅ Sincronizza taskTreeRef.current con taskTree prop (fonte di verità dal dockTree)
  // Quando taskTree prop cambia (dal dockTree), aggiorna il buffer locale
  useEffect(() => {
    const instance = task?.instanceId || task?.id;
    const isNewInstance = prevInstanceRef.current !== instance;

    if (isNewInstance) {
      // Nuova istanza → inizializza dal prop taskTree (fonte di verità)
      taskTreeRef.current = taskTree;
      prevInstanceRef.current = instance;
      // ✅ ARCHITETTURA ESPERTO: Forza aggiornamento mainList quando TaskTree viene caricato
      const currentList = getdataList(taskTree);
      if (currentList && currentList.length > 0) {
        setTaskTreeVersion(v => v + 1);
      }
    } else if (taskTree && taskTree !== taskTreeRef.current) {
      // ✅ Safe comparison: check reference and nodes length instead of JSON.stringify
      // (JSON.stringify can fail on circular references)
      const currentList = getdataList(taskTree);
      const prevList = getdataList(taskTreeRef.current);
      const taskTreeChanged = taskTree !== taskTreeRef.current ||
        (currentList?.length !== prevList?.length);
      if (taskTreeChanged) {
        // Stessa istanza ma taskTree prop è cambiato → sincronizza (dockTree è stato aggiornato esternamente)
        taskTreeRef.current = taskTree;
        // ✅ ARCHITETTURA ESPERTO: Forza aggiornamento mainList quando TaskTree viene caricato
        if (currentList && currentList.length > 0) {
          setTaskTreeVersion(v => v + 1);
        }
      }
    }
  }, [taskTree, (task as any)?.instanceId, task?.id]);

  // ✅ Check for template sync when task is opened
  React.useEffect(() => {
    const checkTemplateSync = async () => {
      if (!taskTree || !task?.templateId) return;

      const template = DialogueTaskService.getTemplate(task.templateId);
      if (!template) return;

      try {
        const syncNeeded = await syncTasksWithTemplate(
          taskTree.steps,
          template,
          task.templateId
        );

        if (syncNeeded.length > 0) {
          const shouldSync = window.confirm(
            `Il template è stato aggiornato. Vuoi ereditare i nuovi valori per ${syncNeeded.length} task?`
          );

          if (shouldSync) {
            // Apply template updates
            syncNeeded.forEach(({ templateId, stepType, escalationIndex, taskIndex, templateTask }) => {
              const nodeSteps = taskTree.steps[templateId];
              if (!nodeSteps) return;

              // Case A: steps as object
              if (!Array.isArray(nodeSteps) && nodeSteps[stepType]) {
                const step = nodeSteps[stepType];
                if (step?.escalations?.[escalationIndex]?.tasks?.[taskIndex]) {
                  const task = step.escalations[escalationIndex].tasks[taskIndex];
                  task.text = templateTask.text;
                  task.parameters = templateTask.parameters;
                  task.edited = false;  // Keep as inherited
                }
              }

              // Case B: steps as array
              if (Array.isArray(nodeSteps)) {
                const group = nodeSteps.find((g: any) => g?.type === stepType);
                if (group?.escalations?.[escalationIndex]?.tasks?.[taskIndex]) {
                  const task = group.escalations[escalationIndex].tasks[taskIndex];
                  task.text = templateTask.text;
                  task.parameters = templateTask.parameters;
                  task.edited = false;  // Keep as inherited
                }
              }
            });

            // Update taskTreeRef and trigger re-render
            taskTreeRef.current = { ...taskTree };
            replaceSelectedTaskTree(taskTreeRef.current);
          } else {
            // Mark all as edited
            syncNeeded.forEach(({ templateId, stepType, escalationIndex, taskIndex }) => {
              markTaskAsEdited(taskTree.steps, templateId, stepType, escalationIndex, taskIndex);
            });
            taskTreeRef.current = { ...taskTree };
            replaceSelectedTaskTree(taskTreeRef.current);
          }
        }
      } catch (error) {
        console.error('[ResponseEditor] Error checking template sync', error);
      }
    };

    // Only check on initial load (when taskTree is first set)
    if (taskTree && task?.templateId && prevInstanceRef.current === (task?.instanceId || task?.id)) {
      checkTemplateSync();
    }
  }, [taskTree, task?.templateId, task?.instanceId, task?.id, replaceSelectedTaskTree]);

  // Debug logger gated by localStorage flag: set localStorage.setItem('debug.responseEditor','1') to enable
  const log = (...args: any[]) => {
    try { if (localStorage.getItem('debug.responseEditor') === '1') console.log(...args); } catch { }
  };
  // Removed verbose translation sources log
  // Ensure debug flag is set once to avoid asking again
  useEffect(() => {
    try { localStorage.setItem('debug.responseEditor', '1'); } catch { }
    try { localStorage.setItem('debug.reopen', '1'); } catch { }
    try { localStorage.setItem('debug.nodeSelection', '1'); } catch { }
    try { localStorage.setItem('debug.nodeSync', '1'); } catch { }
    try { localStorage.setItem('debug.useDDTTranslations', '1'); } catch { }
    try { localStorage.setItem('debug.getTaskText', '1'); } catch { }
  }, []);
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
  // ✅ Pass task to extract GUIDs from task.steps[nodeId] (unified model)
  const localTranslations = useDDTTranslations(taskTree, task); // ✅ useDDTTranslations sarà aggiornato in futuro

  // 🔍 DEBUG: Log translations loading (rimosso - troppo verboso)
  // React.useEffect(() => {
  //   if (localStorage.getItem('debug.responseEditor') === '1') {
  //     console.log('[ResponseEditor] 📚 Translations loaded', {
  //       translationsCount: Object.keys(localTranslations).length,
  //       sampleTranslations: Object.keys(localTranslations).slice(0, 10),
  //       hasTask: !!task,
  //       taskId: task?.id,
  //       taskStepsCount: task?.steps ? Object.keys(task.steps).length : 0,
  //       ddtId: ddt?.id || ddt?._id,
  //       ddtLabel: ddt?.label
  //     });
  //   }
  // }, [localTranslations, task?.id, task?.steps, ddt?.id]);

  // ❌ REMOVED: Sync from ddt.translations - translations are now in global table only
  // Translations are updated via the effect above that watches globalTranslations

  // ✅ selectedNode è uno stato separato (fonte di verità durante l'editing)
  // NON è una derivazione da localTaskTree - questo elimina race conditions e dipendenze circolari
  const [selectedNode, setSelectedNode] = useState<any>(null);
  const [selectedNodePath, setSelectedNodePath] = useState<{
    mainIndex: number;
    subIndex?: number;
  } | null>(null);

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
  React.useEffect(() => {
    const handleProjectSave = async () => {
      if (task?.id || task?.instanceId) { // ✅ RINOMINATO: act → task
        const key = (task?.instanceId || task?.id) as string; // ✅ RINOMINATO: act → task
        const taskInstance = taskRepository.getTask(key);
        const currentTaskTree = taskTreeRef.current;
        const currentMainList = getdataList(currentTaskTree);
        const hasTaskTree = currentTaskTree && Object.keys(currentTaskTree).length > 0 && currentMainList && currentMainList.length > 0;

        if (hasTaskTree && taskInstance) {
          // ✅ NUOVO MODELLO: Salva TUTTA la working copy, non solo override
          const { extractTaskOverrides, buildTemplateExpanded } = await import('../../../utils/taskUtils');
          const currentTemplateId = getTemplateId(taskInstance);

          // ✅ Crea templateExpanded (baseline dal template attuale)
          const templateExpanded = currentTemplateId
            ? await buildTemplateExpanded(currentTemplateId, currentProjectId || undefined)
            : null;

          // ✅ Salva TUTTA la working copy (con flag edited aggiornate)
          const modifiedFields = await extractTaskOverrides(
            taskInstance,
            currentTaskTree,
            currentProjectId || undefined,
            templateExpanded || undefined
          );

          // ✅ Usa helper function invece di stringa hardcoded
          if (!isUtteranceInterpretationTemplateId(currentTemplateId)) {
            await taskRepository.updateTask(key, {
              type: TaskType.UtteranceInterpretation,  // ✅ type: enum numerico
              templateId: null,            // ✅ templateId: null (standalone)
              ...modifiedFields  // ✅ Salva TUTTA la working copy
            }, currentProjectId || undefined);
          } else {
            await taskRepository.updateTask(key, modifiedFields, currentProjectId || undefined);
          }
        } else if (currentTaskTree) {
          // ✅ NUOVO MODELLO: Salva TUTTA la working copy, non solo override
          const { extractTaskOverrides, buildTemplateExpanded } = await import('../../../utils/taskUtils');
          const currentTemplateId = currentTask.templateId || null;

          // ✅ Crea templateExpanded (baseline dal template attuale)
          const templateExpanded = currentTemplateId
            ? await buildTemplateExpanded(currentTemplateId, currentProjectId || undefined)
            : null;

          const tempTask: Task = {
            id: key,
            type: currentTask.type || TaskType.UtteranceInterpretation,
            templateId: currentTemplateId,
            label: currentTaskTree.label,
            steps: currentTaskTree.steps
          };

          // ✅ Salva TUTTA la working copy (con flag edited aggiornate)
          const overrides = await extractTaskOverrides(
            tempTask,
            currentTaskTree,
            currentProjectId || undefined,
            templateExpanded || undefined
          );
          await taskRepository.updateTask(key, overrides, currentProjectId || undefined);
        }
      }
    };

    window.addEventListener('project:save', handleProjectSave);
    return () => {
      window.removeEventListener('project:save', handleProjectSave);
    };
  }, [task?.id, (task as any)?.instanceId, currentProjectId]);


  // ✅ Usa taskTreeRef.current per mainList (contiene già le modifiche)
  // Forza re-render quando taskTreeRef cambia usando uno stato trigger
  const [taskTreeVersion, setTaskTreeVersion] = useState(0);
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
  // ✅ Stato separato per Behaviour/Personality/Recognition (mutualmente esclusivi)
  const [leftPanelMode, setLeftPanelMode] = useState<RightPanelMode>('actions'); // Always start with tasks panel visible
  // ✅ Stato separato per Test (indipendente)
  const [testPanelMode, setTestPanelMode] = useState<RightPanelMode>('none'); // Test inizia chiuso
  // ✅ Stato separato per Tasks (indipendente)
  const [tasksPanelMode, setTasksPanelMode] = useState<RightPanelMode>('none'); // Tasks inizia chiuso

  const { width: rightWidth, setWidth: setRightWidth } = useRightPanelWidth(360);

  // ✅ Larghezza separata per il pannello Test (indipendente)
  const { width: testPanelWidth, setWidth: setTestPanelWidth } = useRightPanelWidth(360, 'responseEditor.testPanelWidth');
  // ✅ Larghezza separata per il pannello Tasks (indipendente)
  const { width: tasksPanelWidth, setWidth: setTasksPanelWidth } = useRightPanelWidth(360, 'responseEditor.tasksPanelWidth');

  // ✅ REFACTOR: Sidebar resize manuale solo durante la sessione (senza persistenza)
  // L'autosize prevale sempre all'apertura
  const [sidebarManualWidth, setSidebarManualWidth] = React.useState<number | null>(null);
  const [isDraggingSidebar, setIsDraggingSidebar] = React.useState(false);
  const sidebarStartWidthRef = React.useRef<number>(0);
  const sidebarStartXRef = React.useRef<number>(0);

  // ✅ Ref per il resize del pannello Tasks
  const tasksStartWidthRef = React.useRef<number>(0);
  const tasksStartXRef = React.useRef<number>(0);

  // ✅ Pulisci localStorage all'avvio per garantire che autosize prevalga
  React.useEffect(() => {
    try {
      localStorage.removeItem('responseEditor.sidebarWidth');
    } catch { }
  }, []);

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

  React.useEffect(() => {
    if (!isDraggingSidebar) {
      return;
    }

    const handleMove = (e: MouseEvent) => {
      const deltaX = e.clientX - sidebarStartXRef.current;
      // ✅ FIX: Aumenta maxWidth a 1000px per permettere sidebar più larghe
      // Il minWidth rimane 160px, ma il maxWidth deve essere sufficientemente alto
      const MIN_WIDTH = 160;
      const MAX_WIDTH = 1000;
      const calculatedWidth = sidebarStartWidthRef.current + deltaX;
      const newWidth = Math.max(MIN_WIDTH, Math.min(MAX_WIDTH, calculatedWidth));

      setSidebarManualWidth(newWidth);
      // ✅ NON salvare in localStorage - solo durante la sessione
    };

    const handleUp = () => {
      setIsDraggingSidebar(false);
    };

    window.addEventListener('mousemove', handleMove);
    window.addEventListener('mouseup', handleUp);

    return () => {
      window.removeEventListener('mousemove', handleMove);
      window.removeEventListener('mouseup', handleUp);
    };
  }, [isDraggingSidebar]);

  // ✅ Mantieni rightMode per compatibilità (combinazione di leftPanelMode e testPanelMode)
  const rightMode: RightPanelMode = testPanelMode === 'chat' ? 'chat' : leftPanelMode;
  // ✅ Stati di dragging separati per ogni pannello
  const [draggingPanel, setDraggingPanel] = useState<'left' | 'test' | 'tasks' | 'shared' | null>(null);
  const [showSynonyms, setShowSynonyms] = useState(false);
  const [showMessageReview, setShowMessageReview] = useState(false);
  const [selectedIntentIdForTraining, setSelectedIntentIdForTraining] = useState<string | null>(null);

  // Header: icon, title, and toolbar
  const taskType = task?.type ?? TaskType.UtteranceInterpretation; // ✅ RINOMINATO: actType → taskType, usa TaskType enum

  // ✅ Verifica se kind === "intent" e non ha messaggi (mostra IntentMessagesBuilder se non ci sono)
  const needsIntentMessages = useMemo(() => {
    const firstMain = mainList[0];
    const hasMessages = hasIntentMessages(taskTree, task);
    return firstMain?.kind === 'intent' && !hasMessages;
  }, [mainList, taskTree, task]); // ✅ CORRETTO: Passa task a hasIntentMessages

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

        // ✅ CRITICAL: Aggiorna la cache del TaskRepository con il TaskTree finale
        // Questo è ESSENZIALE per garantire che quando riapri l'editor,
        // taskRepository.getTask() restituisca il task aggiornato con examplesList
        const currentTask = taskRepository.getTask(key);
        if (currentTask && hasTaskTree) {
          // ✅ Usa extractTaskOverrides per salvare solo override
          const { extractTaskOverrides } = await import('../../../utils/taskUtils');
          const overrides = await extractTaskOverrides(currentTask, finalTaskTree, currentProjectId || undefined);
          taskRepository.updateTask(key, overrides, currentProjectId || undefined);

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
          taskStepsKeys: task?.steps ? Object.keys(task.steps) : [],
          taskStepsCount: task?.steps ? Object.keys(task.steps).length : 0,
          taskStepsDetails: task?.steps ? Object.keys(task.steps).map(nodeId => {
            const nodeSteps = task.steps[nodeId];
            const isArray = Array.isArray(nodeSteps);
            const isObject = typeof nodeSteps === 'object' && !Array.isArray(nodeSteps);
            let escalationsCount = 0;
            let tasksCount = 0;

            if (isArray) {
              escalationsCount = nodeSteps.length;
              tasksCount = nodeSteps.reduce((acc: number, step: any) =>
                acc + (step?.escalations?.reduce((a: number, esc: any) => a + (esc?.tasks?.length || 0), 0) || 0), 0);
            } else if (isObject) {
              escalationsCount = nodeSteps?.start?.escalations?.length || nodeSteps?.introduction?.escalations?.length || 0;
              const startEscs = nodeSteps?.start?.escalations || [];
              const introEscs = nodeSteps?.introduction?.escalations || [];
              tasksCount = [...startEscs, ...introEscs].reduce((acc: number, esc: any) => acc + (esc?.tasks?.length || 0), 0);
            }

            return {
              nodeId,
              stepsType: typeof nodeSteps,
              isArray,
              isObject,
              stepsKeys: isObject ? Object.keys(nodeSteps || {}) : [],
              escalationsCount,
              tasksCount
            };
          }) : []
        });

        if (hasTaskTree) {
          const finaldata = firstNode;
          const finalSubData = finaldata?.subTasks?.[0];
          const finalStartTasks = finalSubData?.steps?.start?.escalations?.reduce((acc: number, esc: any) => acc + (esc?.tasks?.length || 0), 0) || 0;

          console.log('[handleEditorClose] 💾 Saving complete TaskTree (SYNC - blocking close until saved)', {
            key,
            finalStartTasks,
            hasNodes: !!finalMainList,
            nodesLength: finalMainList?.length || 0
          });

          // ✅ Get or create task
          // ✅ LOGICA: Il task viene creato solo quando si apre ResponseEditor, dopo aver determinato il tipo
          let taskInstance = taskRepository.getTask(key);
          if (!taskInstance) {
            // ✅ Usa direttamente task.type (TaskType enum) invece di convertire da stringa
            const taskType = task?.type ?? TaskType.UtteranceInterpretation; // ✅ Usa direttamente task.type (TaskType enum)
            taskInstance = taskRepository.createTask(taskType, null, undefined, key, currentProjectId || undefined);
          }

          const currentTemplateId = getTemplateId(taskInstance);

          // ✅ CRITICAL: Aggiungi task.steps a finalTaskTree (unica fonte di verità per gli steps)
          // Gli steps vengono salvati in task.steps[nodeTemplateId] quando si modifica un nodo (righe 1489-1492, 1506-1510)
          // ✅ finalTaskTreeWithSteps è la WORKING COPY (modificata dall'utente)
          // ✅ Usa task.steps come fonte di verità (contiene tutti gli steps aggiornati dai nodi)
          const finalTaskTreeWithSteps: TaskTree = {
            ...finalTaskTree,
            steps: task?.steps || taskTreeRef.current?.steps || finalTaskTree.steps || {} // ✅ task.steps è la working copy aggiornata
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

          // ✅ Usa helper function invece di stringa hardcoded - AWAIT OBBLIGATORIO: non chiudere finché non è salvato
          if (!isUtteranceInterpretationTemplateId(currentTemplateId)) {
            // ❌ DEPRECATED: Non salvare più data nell'istanza (viene dal template)
            // ✅ NUOVO MODELLO: Salva TUTTA la working copy, non solo override
            // ✅ Crea templateExpanded (baseline) per confronto
            const { extractTaskOverrides, buildTemplateExpanded } = await import('../../../utils/taskUtils');

            // ✅ Crea templateExpanded (baseline dal template attuale)
            const templateExpanded = currentTemplateId
              ? await buildTemplateExpanded(currentTemplateId, currentProjectId || undefined)
              : null;

            // ✅ Crea task temporaneo per extractTaskOverrides
            const tempTask: Task = {
              id: key,
              type: TaskType.UtteranceInterpretation,
              templateId: currentTemplateId || null,
              label: finalTaskTreeWithSteps.label,
              steps: finalTaskTreeWithSteps.steps
            };

            // ✅ Salva TUTTA la working copy (con flag edited aggiornate)
            const dataToSave = await extractTaskOverrides(
              tempTask,
              finalTaskTreeWithSteps,
              currentProjectId || undefined,
              templateExpanded || undefined
            );

            const dataToSaveMainList = getdataList(finalTaskTreeWithSteps);
            const dataToSaveFirstNode = dataToSaveMainList?.[0];
            const regexPattern = dataToSaveFirstNode?.dataContract?.contracts?.find((c: any) => c.type === 'regex')?.patterns?.[0];
            const savedNlpProfileExamples = dataToSaveFirstNode?.nlpProfile?.examples;
            console.log('[REGEX] CLOSE - Saving to DB (standalone)', {
              taskId: key,
              regexPattern: regexPattern || '(none)',
              firstNodeId: dataToSaveFirstNode?.id,
              hasFirstNodeNlpProfile: !!dataToSaveFirstNode?.nlpProfile,
              hasFirstNodeNlpProfileExamples: !!savedNlpProfileExamples,
              firstNodeNlpProfileExamplesCount: Array.isArray(savedNlpProfileExamples) ? savedNlpProfileExamples.length : 0,
              firstNodeNlpProfileExamples: savedNlpProfileExamples?.slice(0, 3)
            });
            // ✅ STEP 1: Salva in memoria
            taskRepository.updateTask(key, dataToSave, currentProjectId || undefined);

            // ✅ STEP 2: Salva IMMEDIATAMENTE nel database per preservare nlpProfile.examples
            const finalProjectId = currentProjectId || undefined;
            if (finalProjectId) {
              const taskToSave = taskRepository.getTask(key);
              if (taskToSave) {
                try {
                  const { id, _id, templateId, createdAt, updatedAt, ...fields } = taskToSave;
                  const payload = {
                    id: taskToSave.id,
                    type: taskToSave.type,
                    templateId: taskToSave.templateId ?? null,
                    ...fields
                  };

                  const payloadString = JSON.stringify(payload);
                  const response = await fetch(`/api/projects/${finalProjectId}/tasks`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: payloadString
                  });

                  if (!response.ok) {
                    console.error('[EXAMPLES] CLOSE - Failed to save task to database', {
                      taskId: key,
                      status: response.status
                    });
                  } else {
                    console.log('[EXAMPLES] CLOSE - Task saved to database', {
                      taskId: key,
                      hasFirstNodeNlpProfile: !!taskToSave.data?.[0]?.nlpProfile,
                      hasFirstNodeNlpProfileExamples: !!taskToSave.data?.[0]?.nlpProfile?.examples,
                      firstNodeNlpProfileExamplesCount: taskToSave.data?.[0]?.nlpProfile?.examples?.length || 0
                    });
                  }
                } catch (error) {
                  console.error('[EXAMPLES] CLOSE - Error saving task to database', {
                    taskId: key,
                    error
                  });
                }
              }
            }

            // ✅ VERIFICA: Controlla se è stato salvato correttamente
            const savedTask = taskRepository.getTask(key);
            const savedTaskNlpProfileExamples = savedTask?.data?.[0]?.nlpProfile?.examples;
            console.log('[EXAMPLES] CLOSE - Verifying saved task', {
              taskId: key,
              hasSavedTask: !!savedTask,
              hasSavedTaskData: !!savedTask?.data,
              savedTaskDataLength: savedTask?.data?.length || 0,
              hasFirstNodeNlpProfile: !!savedTask?.data?.[0]?.nlpProfile,
              hasFirstNodeNlpProfileExamples: !!savedTaskNlpProfileExamples,
              savedFirstNodeNlpProfileExamplesCount: Array.isArray(savedTaskNlpProfileExamples) ? savedTaskNlpProfileExamples.length : 0,
              savedFirstNodeNlpProfileExamples: savedTaskNlpProfileExamples?.slice(0, 3)
            });
          } else {
            // ✅ NUOVO MODELLO: Salva TUTTA la working copy anche per task con templateId
            const { extractTaskOverrides, buildTemplateExpanded } = await import('../../../utils/taskUtils');

            // ✅ Crea templateExpanded (baseline dal template attuale)
            const templateExpanded = currentTemplateId
              ? await buildTemplateExpanded(currentTemplateId, currentProjectId || undefined)
              : null;

            // ✅ Crea task temporaneo per extractTaskOverrides
            const tempTask: Task = {
              id: key,
              type: TaskType.UtteranceInterpretation,
              templateId: currentTemplateId || null,
              label: finalTaskTreeWithSteps.label,
              steps: finalTaskTreeWithSteps.steps
            };

            // ✅ Salva TUTTA la working copy (con flag edited aggiornate)
            const dataToSave = await extractTaskOverrides(
              tempTask,
              finalTaskTreeWithSteps,
              currentProjectId || undefined,
              templateExpanded || undefined
            );

            const regexPattern = dataToSave.data?.[0]?.dataContract?.contracts?.find((c: any) => c.type === 'regex')?.patterns?.[0];
            console.log('[REGEX] CLOSE - Saving to DB (with templateId)', {
              taskId: key,
              templateId: currentTemplateId,
              regexPattern: regexPattern || '(none)'
            });
            // ✅ STEP 1: Salva in memoria
            taskRepository.updateTask(key, dataToSave, currentProjectId || undefined);
          }

          // ✅ Verify steps were saved by reading back from repository
          const savedTask = taskRepository.getTask(key);
          const savedStepsKeys = savedTask?.steps ? Object.keys(savedTask.steps) : [];
          const savedStepsCount = savedStepsKeys.length;

          console.log('[ResponseEditor][CLOSE] ✅ Save completed successfully', {
            taskId: task?.id || task?.instanceId,
            key,
            nodesLength: finalDDT.nodes?.length || 0,
            finalStartTasks,
            savedStepsKeys: finalTaskTreeWithSteps.steps ? Object.keys(finalTaskTreeWithSteps.steps) : [],
            savedStepsCount: finalTaskTreeWithSteps.steps ? Object.keys(finalTaskTreeWithSteps.steps).length : 0,
            repositoryTask: {
              hasSteps: !!savedTask?.steps,
              stepsKeys: savedStepsKeys,
              stepsCount: savedStepsCount,
              stepsMatch: JSON.stringify(savedTask?.steps || {}) === JSON.stringify(finalTaskTreeWithSteps.steps || {})
            },
            verification: {
              stepsWereSaved: savedStepsCount > 0,
              stepsMatchExpected: savedStepsCount === (finalTaskTreeWithSteps.steps ? Object.keys(finalTaskTreeWithSteps.steps).length : 0),
              allStepsPresent: savedStepsKeys.every(nodeId => finalTaskTreeWithSteps.steps?.[nodeId] !== undefined)
            }
          });
        } else if (finalDDT) {
          // ✅ No TaskTree structure, but save other fields (e.g., Message text)
          // ✅ Get or create task
          let taskInstance = taskRepository.getTask(key);
          if (!taskInstance) {
            // ✅ Usa direttamente task.type (TaskType enum) invece di convertire da stringa
            const taskType = task?.type ?? TaskType.SayMessage; // ✅ Usa direttamente task.type (TaskType enum)
            taskInstance = taskRepository.createTask(taskType, null, undefined, key, currentProjectId || undefined);
          }
          // ✅ AWAIT per garantire completamento
          await taskRepository.updateTask(key, finalDDT, currentProjectId || undefined);
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

  // ✅ Ref per evitare re-registrazioni quando handleEditorClose cambia
  const handleEditorCloseRef = React.useRef(handleEditorClose);
  React.useEffect(() => {
    handleEditorCloseRef.current = handleEditorClose;
  }, [handleEditorClose]);

  // ✅ Registra handleEditorClose nel ref per permettere a tab.onClose di chiamarlo
  React.useEffect(() => {
    if (registerOnClose) {
      // ✅ Usa ref per evitare dipendenza da handleEditorClose (evita re-registrazioni)
      registerOnClose(() => handleEditorCloseRef.current());
      console.log('[ResponseEditor] ✅ Registered handleEditorClose');
    } else {
      console.warn('[ResponseEditor] ⚠️ registerOnClose not provided');
    }
  }, [registerOnClose]); // ✅ Solo registerOnClose nelle dipendenze

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

        const allTaskStepsKeys = task?.steps ? Object.keys(task.steps) : [];
        // ✅ CRITICAL: Stampa chiavi come stringhe per debug
        console.log('[🔍 ResponseEditor][NODE_SELECT] 🔑 CHIAVI IN task.steps:', allTaskStepsKeys);
        console.log('[🔍 ResponseEditor][NODE_SELECT] 🔍 CERCHIAMO CHIAVE:', nodeTemplateId);

        console.log('[🔍 ResponseEditor][NODE_SELECT] CRITICAL - Loading steps for node', {
          nodeId: node.id,
          nodeTemplateId,
          nodeLabel: node?.label,
          hasTaskSteps: !!(nodeTemplateId && task?.steps?.[nodeTemplateId]),
          taskStepsKeys: allTaskStepsKeys,
          taskStepsKeysAsStrings: allTaskStepsKeys.join(', '), // ✅ Stringa per vedere tutte le chiavi
          taskStepsCount: allTaskStepsKeys.length,
          lookingForKey: nodeTemplateId,
          keyExists: nodeTemplateId ? !!(task?.steps?.[nodeTemplateId]) : false,
          keyMatchDetails: nodeTemplateId && task?.steps ? {
            exactMatch: task.steps[nodeTemplateId] ? '✅ MATCH' : '❌ NO MATCH',
            allKeys: allTaskStepsKeys,
            keyComparison: allTaskStepsKeys.map(k => ({
              key: k,
              keyFull: k, // ✅ Mostra chiave completa
              matches: k === nodeTemplateId,
              keyLength: k.length,
              templateIdLength: nodeTemplateId.length,
              keyPreview: k.substring(0, 30) + '...',
              templateIdPreview: nodeTemplateId.substring(0, 30) + '...',
              // ✅ Confronto carattere per carattere
              charByChar: k.length === nodeTemplateId.length ? Array.from(k).map((char, idx) => ({
                pos: idx,
                keyChar: char,
                templateChar: nodeTemplateId[idx],
                matches: char === nodeTemplateId[idx],
                keyCode: char.charCodeAt(0),
                templateCode: nodeTemplateId[idx]?.charCodeAt(0)
              })).filter(c => !c.matches).slice(0, 5) : 'LENGTH_MISMATCH'
            }))
          } : null,
          taskStepsForNode: nodeTemplateId && task?.steps?.[nodeTemplateId] ? (() => {
            const nodeSteps = task.steps[nodeTemplateId];
            const isArray = Array.isArray(nodeSteps);
            const isObject = typeof nodeSteps === 'object' && !Array.isArray(nodeSteps);
            let escalationsCount = 0;
            let tasksCount = 0;

            if (isArray) {
              escalationsCount = nodeSteps.length;
              tasksCount = nodeSteps.reduce((acc: number, step: any) =>
                acc + (step?.escalations?.reduce((a: number, esc: any) => a + (esc?.tasks?.length || 0), 0) || 0), 0);
            } else if (isObject) {
              escalationsCount = nodeSteps?.start?.escalations?.length || nodeSteps?.introduction?.escalations?.length || 0;
              const startEscs = nodeSteps?.start?.escalations || [];
              const introEscs = nodeSteps?.introduction?.escalations || [];
              tasksCount = [...startEscs, ...introEscs].reduce((acc: number, esc: any) => acc + (esc?.tasks?.length || 0), 0);
            }

            return {
              stepsType: typeof nodeSteps,
              isArray,
              isObject,
              stepsKeys: isObject ? Object.keys(nodeSteps || {}) : [],
              escalationsCount,
              tasksCount
            };
          })() : null,
          nodeHasStepsBefore: !!node.steps,
          nodeStepsType: typeof node.steps
        });

        if (nodeTemplateId && task?.steps?.[nodeTemplateId]) {
          node.steps = task.steps[nodeTemplateId];

          console.log('[ResponseEditor][NODE_SELECT] ✅ Steps copied to node', {
            nodeId: node.id,
            nodeTemplateId,
            nodeLabel: node?.label,
            stepsCopied: true,
            nodeStepsType: typeof node.steps,
            nodeStepsKeys: typeof node.steps === 'object' && !Array.isArray(node.steps) ? Object.keys(node.steps || {}) : [],
            escalationsCount: Array.isArray(node.steps)
              ? node.steps.length
              : (node.steps?.start?.escalations?.length || node.steps?.introduction?.escalations?.length || 0),
            tasksCount: Array.isArray(node.steps)
              ? node.steps.reduce((acc: number, step: any) =>
                  acc + (step?.escalations?.reduce((a: number, esc: any) => a + (esc?.tasks?.length || 0), 0) || 0), 0)
              : 0
          });
        } else {
          console.log('[🔍 ResponseEditor][NODE_SELECT] ❌ CRITICAL - No steps found for node', {
            nodeId: node.id,
            nodeTemplateId,
            nodeLabel: node?.label,
            hasTaskSteps: !!(nodeTemplateId && task?.steps?.[nodeTemplateId]),
            taskStepsKeys: task?.steps ? Object.keys(task.steps) : [],
            taskStepsCount: task?.steps ? Object.keys(task.steps).length : 0,
            nodeHasTemplateId: !!node.templateId,
            nodeTemplateIdMatches: node.templateId ? task?.steps?.[node.templateId] : false,
            keyMatchAnalysis: nodeTemplateId && task?.steps ? {
              lookingFor: nodeTemplateId,
              availableKeys: Object.keys(task.steps),
              keyComparison: Object.keys(task.steps).map(k => ({
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

          // ✅ CRITICAL: Salva updated.steps usando templateId come chiave (non id)
          // task.steps[node.templateId] = steps clonati
          const nodeTemplateId = updated.templateId || updated.id; // ✅ Fallback a id se templateId non presente
          if (nodeTemplateId && updated.steps && task) {
            // Aggiorna task.steps immediatamente (unica fonte di verità)
            if (!task.steps) task.steps = {};
            task.steps[nodeTemplateId] = updated.steps;
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

            // ✅ CRITICAL: Salva updated.steps usando templateId come chiave (non id)
            // task.steps[node.templateId] = steps clonati
            const nodeTemplateId = updated.templateId || updated.id; // ✅ Fallback a id se templateId non presente
            if (nodeTemplateId && updated.steps && task) {
              // Aggiorna task.steps immediatamente (unica fonte di verità)
              if (!task.steps) task.steps = {};
              task.steps[nodeTemplateId] = updated.steps;
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
          const hasDDT = updatedDDT && Object.keys(updatedDDT).length > 0 && updatedDDT.data && updatedDDT.data.length > 0;

          if (hasDDT) {
            // Salva in modo asincrono (non bloccare l'UI)
            void (async () => {
              try {
                const taskInstance = taskRepository.getTask(key);
                const currentTemplateId = getTemplateId(taskInstance);

                // ✅ NUOVO: Usa extractTaskOverrides (sempre, anche se templateId è null)
                // Se templateId è null, viene creato automaticamente un template
                // ✅ updatedTaskTree è già un TaskTree

                // ✅ SEMPRE estrai solo override (non struttura)
                const fieldsToSave = await extractTaskOverrides(taskInstance, updatedTaskTree, projectIdToSave || undefined);

                // ✅ Aggiorna task con override (sempre, anche se templateId era null)
                // Se templateId era null, extractTaskOverrides ha già creato il template
                await taskRepository.updateTask(key, fieldsToSave, projectIdToSave || undefined);
              } catch (err) {
                console.error('[ResponseEditor] Failed to save task:', err);
              }
            })();
          }
        }
      }

      // ✅ Solo invalidatore interno (non notificare provider per evitare re-mount)
      setDDTVersion(v => v + 1);

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

  // ✅ Splitter drag handlers - gestisce tutti i pannelli in base a draggingPanel
  useEffect(() => {
    if (!draggingPanel) return;

    const onMove = (e: MouseEvent) => {
      const total = window.innerWidth;
      const minWidth = 160;
      const leftMin = 320;

      if (draggingPanel === 'left') {
        // Pannello sinistro: calcola dalla posizione del mouse (da sinistra)
        const maxRight = Math.max(minWidth, total - leftMin);
        const newWidth = Math.max(minWidth, Math.min(maxRight, total - e.clientX));
        setRightWidth(newWidth);
      } else if (draggingPanel === 'test') {
        // Pannello Test: calcola dalla posizione del mouse
        // Quando ridimensiono Test, Tasks viene spinto a destra (flexbox gestisce automaticamente)
        const contentLeft = total - (rightWidth || 360);
        if (tasksPanelMode === 'actions' && tasksPanelWidth > 1) {
          // Test finisce dove inizia Tasks
          // La larghezza di Test = posizione mouse - inizio contenuto
          // Ma devo rispettare la larghezza minima di Tasks
          const maxTestWidth = total - contentLeft - tasksPanelWidth; // Massima larghezza Test (rispetta Tasks)
          const newTestWidth = Math.max(minWidth, Math.min(maxTestWidth, e.clientX - contentLeft));
          setTestPanelWidth(newTestWidth);
          // Tasks mantiene la sua larghezza, si sposta solo a destra (gestito da flexbox)
        } else {
          // Test è l'unico pannello a destra
          const maxRight = Math.max(minWidth, total - leftMin);
          const newWidth = Math.max(minWidth, Math.min(maxRight, total - e.clientX));
          setTestPanelWidth(newWidth);
        }
      } else if (draggingPanel === 'tasks') {
        // Pannello Tasks: calcola dal delta del mouse rispetto alla posizione iniziale
        const deltaX = tasksStartXRef.current - e.clientX; // Negativo quando si trascina a destra (allarga)
        const newWidth = tasksStartWidthRef.current + deltaX;

        if (testPanelMode === 'chat' && testPanelWidth > 1) {
          // Tasks inizia dove finisce Test
          // Devo rispettare la larghezza minima di Test
          const contentLeft = total - (rightWidth || 360);
          const maxTasksWidth = total - contentLeft - testPanelWidth; // Massima larghezza Tasks (rispetta Test)
          const clampedWidth = Math.max(minWidth, Math.min(maxTasksWidth, newWidth));
          setTasksPanelWidth(clampedWidth);
          // Test mantiene la sua larghezza, si sposta solo a sinistra (gestito da flexbox)
        } else {
          // Tasks è l'unico pannello a destra
          const maxTasksWidth = total - (rightWidth || 360) - 320; // Lascia spazio minimo per il contenuto principale
          const clampedWidth = Math.max(minWidth, Math.min(maxTasksWidth, newWidth));
          setTasksPanelWidth(clampedWidth);
        }
      }
    };

    const onUp = () => setDraggingPanel(null);

    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);

    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
  }, [draggingPanel, setRightWidth, setTestPanelWidth, setTasksPanelWidth, rightWidth, tasksPanelWidth, tasksPanelMode, testPanelMode, testPanelWidth]);

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
  React.useEffect(() => {
    if (hideHeader && onToolbarUpdate) {
      // Always call onToolbarUpdate when toolbarButtons changes, even if empty
      // This ensures the tab header is updated with the latest toolbar state
      onToolbarUpdate(toolbarButtons, headerColor);
    }
  }, [hideHeader, toolbarButtons, onToolbarUpdate, headerColor]);

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
      {(() => {
        return null;
      })()}
      <div style={{ display: 'flex', flex: 1, minHeight: 0, height: '100%', overflow: 'hidden' }}>
        {false && isTaskTreeEmpty(taskTree) ? ( // Summarizer not yet implemented
          /* Placeholder for Summarizer when TaskTree is empty */
          <div className={combinedClass} style={{ flex: 1, minHeight: 0, overflow: 'auto', padding: '24px', color: '#e2e8f0', lineHeight: 1.6 }}>
            <div style={{ maxWidth: '800px', margin: '0 auto' }}>
              <h2 className={combinedClass} style={{ fontWeight: 700, marginBottom: '16px', color: '#fb923c', display: 'flex', alignItems: 'center', gap: '8px' }}>
                🧠 Summarizing (in arrivo)
              </h2>
              <p className={combinedClass} style={{ marginBottom: '16px' }}>
                Questo modulo (generale) riepiloga dati raccolti e chiede conferma (opzionale) con gestione delle correzioni.
              </p>
              <p className={combinedClass} style={{ marginBottom: '16px' }}>
                Il designer deve solo specificare quali dati vanno riepilogati.
              </p>
              <p className={combinedClass} style={{ marginBottom: '16px', fontWeight: 600 }}>📌 Esempio:</p>
              <div className={combinedClass} style={{ marginBottom: '16px', padding: '16px', background: '#1e293b', borderRadius: '8px', lineHeight: 1.8 }}>
                <div style={{ marginBottom: '8px' }}><strong>👤 Utente:</strong> Salve, buongiorno.</div>
                <div style={{ marginBottom: '8px' }}><strong>🤖 Agente:</strong> Buongiorno! Riepilogo i dati: Mario Rossi, nato a Milano il 17 maggio 1980, residente in via Ripamonti numero 13. Giusto?</div>
                <div style={{ marginBottom: '8px' }}><strong>👤 Utente:</strong> No, l'indirizzo esatto è via RI-GA-MON-TI non Ripamonti e sono nato il 18 maggio non il 17</div>
                <div style={{ marginBottom: '8px' }}><strong>🤖 Agente:</strong> Certo. Mario Rossi, nato a Milano il 18 maggio 1980, residente in via Rigamonti al numero 17. Giusto?</div>
                <div style={{ marginBottom: '8px' }}><strong>👤 Utente:</strong> Giusto!</div>
                <div><strong>🤖 Agente:</strong> Perfetto.</div>
              </div>
            </div>
          </div>
        ) : false && isTaskTreeEmpty(taskTree) ? ( // Negotiation not yet implemented
          /* Placeholder for Negotiation when TaskTree is empty */
          <div className={combinedClass} style={{ flex: 1, minHeight: 0, overflow: 'auto', padding: '24px', color: '#e2e8f0', lineHeight: 1.6 }}>
            <div style={{ maxWidth: '800px', margin: '0 auto' }}>
              <h2 className={combinedClass} style={{ fontWeight: 700, marginBottom: '16px', color: '#fb923c', display: 'flex', alignItems: 'center', gap: '8px' }}>
                Negotiation (in arrivo)
              </h2>
              <p className={combinedClass} style={{ marginBottom: '16px' }}>
                Questo modulo gestisce la negoziazione di una serie di "estrazioni con vincoli" da una insieme di opzioni. Vale per date, orari, o in generale insieme di opzioni.
              </p>
              <p className={combinedClass} style={{ marginBottom: '16px', fontWeight: 600 }}>Il modulo supporta:</p>
              <ul className={combinedClass} style={{ marginBottom: '16px', paddingLeft: '24px' }}>
                <li>Proposte e controproposte</li>
                <li>Riformulazioni e chiarimenti</li>
                <li>Ripetizione delle opzioni</li>
                <li>Navigazione avanti e indietro tra le alternative</li>
                <li>Impostazione di vincoli o preferenze (es. "solo dopo le 17", "non il lunedì")</li>
              </ul>
              <p className={combinedClass} style={{ marginBottom: '16px', fontWeight: 600 }}>📌 Esempio di dialogo di negoziazione (data appuntamento):</p>
              <div className={combinedClass} style={{ marginBottom: '16px', padding: '16px', background: '#1e293b', borderRadius: '8px', lineHeight: 1.8 }}>
                <div style={{ marginBottom: '8px' }}><strong>👤 Utente:</strong> Salve, buongiorno.</div>
                <div style={{ marginBottom: '8px' }}><strong>🤖 Agente:</strong> Buongiorno! Abbiamo disponibilità per dopodomani alle 12, le andrebbe bene?</div>
                <div style={{ marginBottom: '8px' }}><strong>👤 Utente:</strong> No, guardi, dopodomani non va bene. La settimana prossima? Ci sono date? Io potrei da giovedì.</div>
                <div style={{ marginBottom: '8px' }}><strong>🤖 Agente:</strong> Certo! Giovedì abbiamo alle 17:45, poi venerdì alle 12. Altrimenti possiamo andare a lunedì successivo alle 14:00.</div>
                <div style={{ marginBottom: '8px' }}><strong>👤 Utente:</strong> Mi scusi, mi può ripetere gli orari di giovedì?</div>
                <div style={{ marginBottom: '8px' }}><strong>🤖 Agente:</strong> Certamente. Giovedì alle 17:45.</div>
                <div style={{ marginBottom: '8px' }}><strong>👤 Utente:</strong> Mmm, è troppo tardi. Invece lunedi?</div>
                <div style={{ marginBottom: '8px' }}><strong>🤖 Agente:</strong> Martedi 23?</div>
                <div style={{ marginBottom: '8px' }}><strong>🤖 Agente:</strong> Martedi 23 abbiamo disponibilita alle 19.</div>
                <div style={{ marginBottom: '8px' }}><strong>👤 Utente:</strong> Ancora peggio. Allora facciamo gioved' alle 17:45.</div>
                <div style={{ marginBottom: '8px' }}><strong>🤖 Agente:</strong> Ok Va bene per giovedi alle 17:45 allora?</div>
                <div><strong>👤 Utente:</strong> Si va bene.</div>
              </div>
            </div>
          </div>
        ) : isInferring ? (
          /* Mostra loading durante ricerca modello */
          <div style={{ flex: 1, minHeight: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#e2e8f0' }}>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '18px', marginBottom: '16px' }}>🔍 Sto cercando se ho già un modello per il tipo di dato che ti serve.</div>
              <div style={{ fontSize: '14px', color: '#94a3b8' }}>Un attimo solo...</div>
            </div>
          </div>
        ) : showWizard ? (
          /* Full-screen wizard without RightPanel */
          /* ✅ FIX: Non montare wizard se dovrebbe avere inferenceResult ma non ce l'ha ancora */
          (() => {
            // Se abbiamo task.label e dovremmo aver fatto inferenza, aspetta inferenceResult // ✅ RINOMINATO: act → task
            // ✅ MA solo se l'inferenza è ancora in corso (isInferring === true)
            // ✅ Se l'inferenza è finita ma non c'è risultato, apri comunque il wizard
            const taskLabel = task?.label?.trim(); // ✅ RINOMINATO: actLabel → taskLabel, act → task
            const shouldHaveInference = taskLabel && taskLabel.length >= 3;

            // ✅ Mostra loading solo se l'inferenza è ancora in corso
            if (shouldHaveInference && !inferenceResult && isInferring) {
              return (
                <div style={{ flex: 1, minHeight: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#e2e8f0' }}>
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: '18px', marginBottom: '16px' }}>🔍 Sto cercando se ho già un modello per il tipo di dato che ti serve.</div>
                    <div style={{ fontSize: '14px', color: '#94a3b8' }}>Un attimo solo...</div>
                  </div>
                </div>
              );
            }

            // ✅ Se l'inferenza è finita ma non c'è risultato, apri comunque il wizard
            // (l'inferenza potrebbe essere fallita o non necessaria)

            return (
              <div style={{ flex: 1, minHeight: 0, overflow: 'auto' }}>
                <DDTWizard
                  taskType={task?.type ? String(task.type) : undefined} // ✅ Convert TaskType enum to string
                  taskLabel={task?.label || ''} // ✅ Passa il label del task (testo della riga di nodo) come fallback
                  initialDDT={inferenceResult?.ai?.schema ? {
                    // ✅ Pre-compila con il risultato dell'inferenza
                    id: taskTree?.id || `temp_taskTree_${task?.id}`,
                    label: inferenceResult.ai.schema.label || task?.label || 'Data',
                    nodes: inferenceResult.ai.schema.nodes || [],
                    _inferenceResult: inferenceResult // Passa anche il risultato completo per riferimento (con traduzioni se disponibili)
                  } : (taskTree && taskTree.nodes && taskTree.nodes.length > 0 ? {
                    // ✅ Se taskTree ha nodes (creato da categoria), passalo come initialDDT
                    // Il wizard andrà direttamente a 'structure' e mostrerà "Build Messages"
                    id: taskTree?.id || `temp_taskTree_${task?.id}`,
                    label: taskTree?.label || task?.label || 'Data',
                    nodes: taskTree.nodes,
                    steps: taskTree.steps,  // ✅ Steps a root level
                    constraints: taskTree.constraints,
                    dataContract: taskTree.dataContract
                  } : taskTree)}
                  onCancel={onClose || (() => { })}
                  onComplete={(finalDDT, messages) => {
                    if (!finalDDT) {
                      console.error('[ResponseEditor] onComplete called with null/undefined finalDDT');
                      return;
                    }

                    // ✅ DEBUG: Verifica cosa contiene finalDDT dal wizard
                    console.log('[ResponseEditor][onComplete] 🔍 finalDDT from wizard', {
                      hasFinalDDT: !!finalDDT,
                      finalDDTKeys: Object.keys(finalDDT || {}),
                      hasSteps: !!finalDDT.steps,
                      stepsType: typeof finalDDT.steps,
                      stepsKeys: finalDDT.steps ? Object.keys(finalDDT.steps) : [],
                      stepsCount: finalDDT.steps ? Object.keys(finalDDT.steps).length : 0,
                      stepsDetails: finalDDT.steps ? Object.keys(finalDDT.steps).map(nodeId => {
                        const nodeSteps = finalDDT.steps[nodeId];
                        const isArray = Array.isArray(nodeSteps);
                        const isObject = typeof nodeSteps === 'object' && !Array.isArray(nodeSteps);
                        let stepKeys: string[] = [];
                        if (isArray) {
                          stepKeys = nodeSteps.map((s: any) => s?.type || 'unknown');
                        } else if (isObject) {
                          stepKeys = Object.keys(nodeSteps || {});
                        }
                        return {
                          nodeId: nodeId.substring(0, 20) + '...',
                          stepsType: typeof nodeSteps,
                          isArray,
                          isObject,
                          stepKeys,
                          stepCount: stepKeys.length
                        };
                      }) : [],
                      hasNodes: !!finalDDT.nodes,
                      nodesLength: finalDDT.nodes?.length || 0,
                      firstNodeId: finalDDT.nodes?.[0]?.id
                    });

                    // ✅ NUOVO MODELLO: Usa direttamente finalDDT (TaskTree con nodes[])
                    const coerced = finalDDT;

                    // Set flag to prevent auto-reopen IMMEDIATELY (before any state updates)
                    wizardOwnsDataRef.current = true;

                    // ✅ CRITICAL: Salva immediatamente il task con steps per evitare perdita dati
                    // Questo assicura che quando si riapre l'editor, i steps siano già salvati
                    if (task?.id || task?.instanceId) {
                      const key = (task?.instanceId || task?.id) as string;
                      const hasDDT = coerced && Object.keys(coerced).length > 0 && coerced.nodes && coerced.nodes.length > 0;

                      if (hasDDT) {
                        let taskInstance = taskRepository.getTask(key);
                        if (!taskInstance) {
                          const taskType = task?.type ?? TaskType.UtteranceInterpretation;
                          taskInstance = taskRepository.createTask(taskType, null, undefined, key, currentProjectId || undefined);
                        }

                        // ✅ DEBUG: Verifica taskInstance prima del salvataggio
                        console.log('[ResponseEditor][onComplete] 🔍 taskInstance before save', {
                          key,
                          hasTaskInstance: !!taskInstance,
                          taskInstanceHasSteps: !!taskInstance.steps,
                          taskInstanceStepsKeys: taskInstance.steps ? Object.keys(taskInstance.steps) : [],
                          taskInstanceStepsCount: taskInstance.steps ? Object.keys(taskInstance.steps).length : 0
                        });

                        const currentTemplateId = getTemplateId(taskInstance);
                        const updateData: Partial<Task> = {
                          label: coerced.label,
                          // ❌ RIMOSSO: data: coerced.data,  // NON salvare data! (si ricostruisce runtime)
                          steps: coerced.steps, // ✅ Salva steps a root level immediatamente
                          constraints: coerced.constraints, // ✅ Override opzionali (solo se modificati)
                          examples: coerced.examples, // ✅ Override opzionali (solo se modificati)
                          dataContract: coerced.dataContract, // ✅ Override opzionali (solo se modificati)
                          introduction: coerced.introduction
                        };

                        // ✅ CRITICAL: Preserva templateId
                        if (currentTemplateId && currentTemplateId !== 'UNDEFINED') {
                          updateData.templateId = currentTemplateId; // ✅ Preserva templateId esistente
                        } else if (coerced.templateId) {
                          updateData.templateId = coerced.templateId; // ✅ Usa templateId dal wizard
                        }
                        // ❌ RIMOSSO: Non sovrascrivere templateId con null!

                        // ✅ DEBUG: Verifica updateData prima del salvataggio
                        console.log('[ResponseEditor][onComplete] 🔍 updateData before save', {
                          key,
                          updateDataKeys: Object.keys(updateData),
                          hasSteps: !!updateData.steps,
                          stepsType: typeof updateData.steps,
                          stepsKeys: updateData.steps ? Object.keys(updateData.steps) : [],
                          stepsCount: updateData.steps ? Object.keys(updateData.steps).length : 0,
                          templateId: updateData.templateId, // ✅ Verifica templateId preservato
                          stepsDetails: updateData.steps ? Object.keys(updateData.steps).map(nodeId => {
                            const nodeSteps = updateData.steps[nodeId];
                            const isArray = Array.isArray(nodeSteps);
                            const isObject = typeof nodeSteps === 'object' && !Array.isArray(nodeSteps);
                            let stepKeys: string[] = [];
                            if (isArray) {
                              stepKeys = nodeSteps.map((s: any) => s?.type || 'unknown');
                            } else if (isObject) {
                              stepKeys = Object.keys(nodeSteps || {});
                            }
                            return {
                              nodeId: nodeId.substring(0, 20) + '...',
                              stepKeys,
                              stepCount: stepKeys.length
                            };
                          }) : []
                        });

                        taskRepository.updateTask(key, updateData, currentProjectId || undefined);

                        // ✅ DEBUG: Verifica task salvato dopo il salvataggio
                        const savedTask = taskRepository.getTask(key);
                        console.log('[ResponseEditor][onComplete] ✅ Task saved with steps', {
                          key,
                          hasSteps: !!coerced.steps,
                          stepsCount: coerced.steps ? Object.keys(coerced.steps).length : 0,
                          nodesLength: coerced.nodes?.length || 0,
                          savedTaskHasSteps: !!savedTask?.steps,
                          savedTaskStepsKeys: savedTask?.steps ? Object.keys(savedTask.steps) : [],
                          savedTaskStepsCount: savedTask?.steps ? Object.keys(savedTask.steps).length : 0,
                          stepsWereSaved: savedTask?.steps && Object.keys(savedTask.steps).length > 0,
                          stepsMatch: JSON.stringify(savedTask?.steps || {}) === JSON.stringify(coerced.steps || {})
                        });
                      }
                    }

                    // Update DDT state
                    try {
                      replaceSelectedDDT(coerced);
                    } catch (err) {
                      console.error('[ResponseEditor] replaceSelectedDDT FAILED', err);
                    }

                    // ✅ IMPORTANTE: Chiudi SEMPRE il wizard quando onComplete viene chiamato
                    // Il wizard ha già assemblato il DDT, quindi non deve riaprirsi
                    // Non controllare isEmpty qui perché potrebbe causare race conditions
                    setShowWizard(false);
                    // ✅ NOTE: inferenceStartedRef è gestito internamente da useWizardInference

                    setLeftPanelMode('actions'); // Force show TaskList (now in Tasks panel)
                    // ✅ selectedStepKey è ora gestito internamente da BehaviourEditor

                    // If parent provided onWizardComplete, notify it after updating UI
                    // (but don't close the overlay - let user see the editor)
                    if (onWizardComplete) {
                      onWizardComplete(coerced);
                    }
                  }}
                  startOnStructure={false}
                />
              </div>
            );
          })()
        ) : needsIntentMessages ? (
          /* Build Messages UI for ProblemClassification without messages */
          <div style={{ flex: 1, display: 'flex', alignItems: 'flex-start', justifyContent: 'flex-start', padding: '16px 20px' }}>
            <IntentMessagesBuilder
              intentLabel={task?.label || taskTree?.label || 'chiedi il problema'}
              onComplete={(messages) => {
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
              }}
            />
          </div>
        ) : (
          /* Normal editor layout with 3 panels (no header, already shown above) */
          <>
            {/* ✅ Left navigation - IntentListEditor quando kind === "intent", Sidebar altrimenti */}
            {/* ✅ ARCHITETTURA ESPERTO: Mostra Sidebar anche se mainList è vuoto inizialmente (DDT in loading) */}
            {mainList[0]?.kind === 'intent' && task && (
              <IntentListEditorWrapper
                act={task as any}
                onIntentSelect={(intentId) => {
                  // Store selected intent ID in state to pass to EmbeddingEditor
                  setSelectedIntentIdForTraining(intentId);
                }}
              />
            )}
            {/* ✅ ARCHITETTURA ESPERTO: Mostra Sidebar anche durante loading (mostrerà placeholder se mainList vuoto) */}
            {mainList[0]?.kind !== 'intent' && (
              <>
                <Sidebar
                  ref={sidebarRef}
                  mainList={mainList} // ✅ mainList viene calcolato da ddt prop quando disponibile
                  selectedMainIndex={selectedMainIndex}
                  onSelectMain={handleSelectMain}
                  selectedSubIndex={selectedSubIndex}
                  onSelectSub={handleSelectSub}
                  aggregated={isAggregatedAtomic}
                  rootLabel={taskTree?.label || 'Data'}
                  style={sidebarManualWidth ? { width: sidebarManualWidth, flexShrink: 0 } : { flexShrink: 0 }} // ✅ FIX: passa sempre style, ma width solo se c'è manualWidth
                  onChangeSubRequired={(mIdx: number, sIdx: number, required: boolean) => {
                    // Persist required flag on the exact sub (by indices), independent of current selection
                    const next = JSON.parse(JSON.stringify(taskTree));
                    const mains = getdataList(next);
                    const main = mains[mIdx];
                    if (!main) return;
                    const subList = Array.isArray(main.subTasks) ? main.subTasks : [];
                    if (sIdx < 0 || sIdx >= subList.length) return;
                    subList[sIdx] = { ...subList[sIdx], required };
                    main.subTasks = subList;
                    mains[mIdx] = main;
                    next.nodes = mains;
                    try {
                      const subs = getSubDataList(main) || [];
                      const target = subs[sIdx];
                      if (localStorage.getItem('debug.responseEditor') === '1') console.log('[DDT][subRequiredToggle][persist]', { main: main?.label, label: target?.label, required });
                    } catch { }
                    try { replaceSelectedTaskTree(next); } catch { }
                  }}
                  onReorderSub={(mIdx: number, fromIdx: number, toIdx: number) => {
                    const next = JSON.parse(JSON.stringify(taskTree));
                    const mains = getdataList(next);
                    const main = mains[mIdx];
                    if (!main) return;
                    const subList = Array.isArray(main.subTasks) ? main.subTasks : [];
                    if (fromIdx < 0 || fromIdx >= subList.length || toIdx < 0 || toIdx >= subList.length) return;
                    const [moved] = subList.splice(fromIdx, 1);
                    subList.splice(toIdx, 0, moved);
                    main.subTasks = subList;
                    mains[mIdx] = main;
                    next.nodes = mains;
                    try { if (localStorage.getItem('debug.responseEditor') === '1') console.log('[DDT][subReorder][persist]', { main: main?.label, fromIdx, toIdx }); } catch { }
                    try { replaceSelectedTaskTree(next); } catch { }
                  }}
                  onAddMain={(label: string) => {
                    const next = JSON.parse(JSON.stringify(taskTree));
                    const mains = getdataList(next);
                    mains.push({ label, subTasks: [] });
                    next.nodes = mains;
                    try { replaceSelectedTaskTree(next); } catch { }
                  }}
                  onRenameMain={(mIdx: number, label: string) => {
                    const next = JSON.parse(JSON.stringify(taskTree));
                    const mains = getdataList(next);
                    if (!mains[mIdx]) return;
                    mains[mIdx].label = label;
                    next.nodes = mains;
                    try { replaceSelectedTaskTree(next); } catch { }
                  }}
                  onDeleteMain={(mIdx: number) => {
                    const next = JSON.parse(JSON.stringify(taskTree));
                    const mains = getdataList(next);
                    if (mIdx < 0 || mIdx >= mains.length) return;
                    mains.splice(mIdx, 1);
                    next.nodes = mains;
                    try { replaceSelectedTaskTree(next); } catch { }
                  }}
                  onAddSub={(mIdx: number, label: string) => {
                    const next = JSON.parse(JSON.stringify(taskTree));
                    const mains = getdataList(next);
                    const main = mains[mIdx];
                    if (!main) return;
                    const list = Array.isArray(main.subTasks) ? main.subTasks : [];
                    list.push({ label, required: true });
                    main.subTasks = list;
                    mains[mIdx] = main;
                    next.nodes = mains;
                    try { replaceSelectedTaskTree(next); } catch { }
                  }}
                  onRenameSub={(mIdx: number, sIdx: number, label: string) => {
                    const next = JSON.parse(JSON.stringify(taskTree));
                    const mains = getdataList(next);
                    const main = mains[mIdx];
                    if (!main) return;
                    const list = Array.isArray(main.subTasks) ? main.subTasks : [];
                    if (sIdx < 0 || sIdx >= list.length) return;
                    list[sIdx] = { ...(list[sIdx] || {}), label };
                    main.subTasks = list;
                    mains[mIdx] = main;
                    next.nodes = mains;
                    try { replaceSelectedTaskTree(next); } catch { }
                  }}
                  onDeleteSub={(mIdx: number, sIdx: number) => {
                    const next = JSON.parse(JSON.stringify(taskTree));
                    const mains = getdataList(next);
                    const main = mains[mIdx];
                    if (!main) return;
                    const list = Array.isArray(main.subTasks) ? main.subTasks : [];
                    if (sIdx < 0 || sIdx >= list.length) return;
                    list.splice(sIdx, 1);
                    main.subTasks = list;
                    mains[mIdx] = main;
                    next.nodes = mains;
                    try { replaceSelectedTaskTree(next); } catch { }
                  }}
                  onSelectAggregator={handleSelectAggregator}
                />
                {/* ✅ REFACTOR: Resizer verticale tra Sidebar e contenuto principale - sempre visibile */}
                <div
                  onMouseDown={(e) => {
                    handleSidebarResizeStart(e);
                  }}
                  style={{
                    width: 8,
                    cursor: 'col-resize',
                    background: isDraggingSidebar ? '#fb923c' : '#fb923c22',
                    transition: 'background 0.15s ease',
                    flexShrink: 0,
                    position: 'relative',
                    zIndex: isDraggingSidebar ? 100 : 10, // ✅ z-index più alto
                    userSelect: 'none',
                    WebkitUserSelect: 'none',
                    touchAction: 'none',
                  }}
                  aria-label="Resize sidebar"
                  role="separator"
                />
              </>
            )}
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0, height: '100%', overflow: 'hidden' }}>
              {/* Content */}
              <div style={{ display: 'flex', minHeight: 0, flex: 1, height: '100%', overflow: 'hidden' }}>
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0, padding: showMessageReview ? '8px' : '8px 8px 0 8px', height: '100%', overflow: 'hidden' }}>
                  {showMessageReview ? (
                    <div style={{ flex: 1, minHeight: 0, background: '#fff', borderRadius: 16, boxShadow: '0 2px 8px #e0d7f7', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                      <div style={{ flex: 1, minHeight: 0, overflow: 'auto' }}>
                        <MessageReviewView node={selectedNode} translations={localTranslations} updateSelectedNode={updateSelectedNode} />
                      </div>
                    </div>
                  ) : (
                    <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', height: '100%' }}>
                      {showSynonyms ? (
                        <div style={{ padding: 6, flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
                          {/* ✅ TesterGrid deve rimanere visibile durante batch per mostrare risultati e permettere input */}
                          <DataExtractionEditor
                            node={selectedNode}
                            taskType={taskType}
                            locale={'it-IT'}
                            intentSelected={mainList[0]?.kind === 'intent' ? selectedIntentIdForTraining || undefined : undefined}
                            task={task}
                            updateSelectedNode={updateSelectedNode}
                            contractChangeRef={contractChangeRef}
                            onChange={(profile) => {
                              // ✅ CRITICAL: Block onChange during batch testing per prevenire feedback loop
                              if (getIsTesting()) {
                                return;
                              }
                              // ✅ Usa handleProfileUpdate invece di updateSelectedNode
                              handleProfileUpdate({
                                ...profile,
                                // Assicura che kind e synonyms siano aggiornati anche in node root
                                ...(profile.kind && profile.kind !== 'auto' ? { _kindManual: profile.kind } : {}),
                              });
                            }}
                          />
                        </div>
                      ) : (
                        // ✅ Nuovo componente BehaviourEditor che contiene StepsStrip + StepEditor
                        <BehaviourEditor
                          node={selectedNode}
                          translations={localTranslations}
                          updateSelectedNode={updateSelectedNode}
                          selectedRoot={selectedRoot}
                          selectedSubIndex={selectedSubIndex}
                        />
                      )}
                    </div>
                  )}
                </div>
                {/* ✅ Pannello sinistro: Behaviour/Personality/Recognition (mutualmente esclusivi) */}
                {/* ✅ NON mostrare il pannello quando Behaviour è attivo (leftPanelMode === 'actions')
                    perché TaskList è ora nel pannello Tasks separato */}
                {!showSynonyms && !showMessageReview && leftPanelMode !== 'none' && leftPanelMode !== 'chat' && leftPanelMode !== 'actions' && rightWidth > 1 && (
                  <RightPanel
                    mode={leftPanelMode}
                    width={rightWidth}
                    onWidthChange={setRightWidth}
                    onStartResize={() => setDraggingPanel('left')}
                    dragging={draggingPanel === 'left'}
                    taskTree={taskTree}
                    task={task && 'templateId' in task ? task : null}
                    projectId={currentProjectId}
                    translations={localTranslations}
                    selectedNode={selectedNode}
                    onUpdateDDT={(updater) => {
                      const updated = updater(taskTree);
                      try { replaceSelectedTaskTree(updated); } catch { }
                    }}
                    tasks={escalationTasks}
                  />
                )}

                {/* ✅ Pannello destro: Test (indipendente, può essere mostrato insieme agli altri) */}
                {testPanelMode === 'chat' && testPanelWidth > 1 && (
                  <>
                    <RightPanel
                      mode="chat"
                      width={testPanelWidth}
                      onWidthChange={setTestPanelWidth}
                      onStartResize={() => setDraggingPanel('test')}
                      dragging={draggingPanel === 'test'}
                      hideSplitter={tasksPanelMode === 'actions' && tasksPanelWidth > 1} // ✅ Nascondi splitter se Tasks è visibile (usiamo quello condiviso)
                      taskTree={taskTree}
                      task={task && 'templateId' in task ? task : null}
                      projectId={currentProjectId}
                      translations={localTranslations}
                      selectedNode={selectedNode}
                      onUpdateDDT={(updater) => {
                        const updated = updater(taskTree);
                        try { replaceSelectedTaskTree(updated); } catch { }
                      }}
                      tasks={escalationTasks}
                    />
                    {/* ✅ Splitter condiviso tra Test e Tasks - ridimensiona entrambi i pannelli */}
                    {tasksPanelMode === 'actions' && tasksPanelWidth > 1 && (
                      <div
                        onMouseDown={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          setDraggingPanel('shared'); // ✅ Usa 'shared' per indicare che stiamo ridimensionando entrambi
                        }}
                        onMouseEnter={(e) => {
                          (e.currentTarget as HTMLElement).style.background = '#fb923c55';
                        }}
                        onMouseLeave={(e) => {
                          if (draggingPanel !== 'shared') {
                            (e.currentTarget as HTMLElement).style.background = 'transparent';
                          }
                        }}
                        style={{
                          width: 6,
                          cursor: 'col-resize',
                          background: draggingPanel === 'shared' ? '#fb923c55' : 'transparent',
                          transition: 'background 0.1s ease',
                          flexShrink: 0,
                          zIndex: draggingPanel === 'shared' ? 10 : 1,
                        }}
                        aria-label="Resize test and tasks panels"
                        role="separator"
                      />
                    )}
                  </>
                )}

                {/* ✅ Splitter esterno tra contenuto principale e pannello Tasks - sempre visibile quando Tasks è attivo */}
                {tasksPanelMode === 'actions' && tasksPanelWidth > 1 && (
                  <>
                    <div
                      onMouseDown={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        tasksStartWidthRef.current = tasksPanelWidth;
                        tasksStartXRef.current = e.clientX;
                        setDraggingPanel('tasks');
                      }}
                      style={{
                        width: 8,
                        cursor: 'col-resize',
                        background: draggingPanel === 'tasks' ? '#fb923c' : '#fb923c22',
                        transition: 'background 0.15s ease',
                        flexShrink: 0,
                        position: 'relative',
                        zIndex: draggingPanel === 'tasks' ? 100 : 10,
                        userSelect: 'none',
                        WebkitUserSelect: 'none',
                        touchAction: 'none',
                      }}
                      aria-label="Resize tasks panel"
                      role="separator"
                    />
                    <RightPanel
                      mode="actions"
                      width={tasksPanelWidth}
                      onWidthChange={setTasksPanelWidth}
                      onStartResize={() => setDraggingPanel('tasks')}
                      dragging={draggingPanel === 'tasks'}
                      hideSplitter={true} // ✅ Nascondi splitter interno, usiamo quello esterno
                      taskTree={taskTree}
                      tasks={escalationTasks}
                      translations={localTranslations}
                      selectedNode={selectedNode}
                      onUpdateDDT={(updater) => {
                        const updated = updater(ddt);
                        try { replaceSelectedDDT(updated); } catch { }
                      }}
                    />
                  </>
                )}
              </div>
            </div>
          </>
        )}
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
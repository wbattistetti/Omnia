import React, { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import { info } from '../../../utils/logger';
import DDTWizard from '../../DialogueDataTemplateBuilder/DDTWizard/DDTWizard';
import { isDDTEmpty } from '../../../utils/ddt';
import { useDDTManager } from '../../../context/DDTManagerContext';
import { taskRepository } from '../../../services/TaskRepository';
import { useProjectDataUpdate } from '../../../context/ProjectDataContext';
import { getTemplateId } from '../../../utils/taskHelpers';
import { TaskType } from '../../../types/taskTypes'; // ✅ RIMOSSO: taskIdToTaskType - non più necessario, task.type è già TaskType enum
import Sidebar from './Sidebar';
import BehaviourEditor from './BehaviourEditor';
import RightPanel, { useRightPanelWidth, RightPanelMode } from './RightPanel';
import MessageReviewView from './MessageReview/MessageReviewView';
// import SynonymsEditor from './SynonymsEditor';
import NLPExtractorProfileEditor from './NLPExtractorProfileEditor';
import EditorHeader from '../../common/EditorHeader';
import { getTaskVisualsByType } from '../../Flowchart/utils/taskVisuals';
import TaskDragLayer from './TaskDragLayer';
import {
  getdataList,
  getSubDataList
} from './ddtSelectors';
import { hasIntentMessages } from './utils/hasMessages';
import IntentMessagesBuilder from './components/IntentMessagesBuilder';
import { saveIntentMessagesToDDT } from './utils/saveIntentMessages';
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
import { mapNode } from '../../../dock/ops';
import { extractModifiedDDTFields } from '../../../utils/taskUtils';
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

// Helper: enforce phone kind by label when missing/mis-set
function coercePhoneKind(src: any) {
  if (!src) return src;
  try {
    const clone = safeDeepClone(src);
    const mains = Array.isArray(clone?.data) ? clone.data : [];
    for (const m of mains) {
      const label = String(m?.label || '').toLowerCase();
      if (/phone|telephone|tel|cellulare|mobile/.test(label)) {
        if ((m?.kind || '').toLowerCase() !== 'phone') {
          m.kind = 'phone';
          (m as any)._kindManual = 'phone';
        }
      }
    }
    return clone;
  } catch (err) {
    console.warn('[coercePhoneKind] Failed to clone, returning original:', err);
    return src;
  }
}

function ResponseEditorInner({ ddt, onClose, onWizardComplete, task, isDdtLoading, hideHeader, onToolbarUpdate, tabId, setDockTree }: { ddt: any, onClose?: () => void, onWizardComplete?: (finalDDT: any) => void, task?: TaskMeta | Task, isDdtLoading?: boolean, hideHeader?: boolean, onToolbarUpdate?: (toolbar: ToolbarButton[], color: string) => void, tabId?: string, setDockTree?: (updater: (prev: any) => any) => void }) { // ✅ ARCHITETTURA ESPERTO: task può essere TaskMeta o Task completo


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
  const [serviceUnavailable, setServiceUnavailable] = React.useState<{ service: string; message: string } | null>(null);

  // ✅ Listen for service unavailable events
  React.useEffect(() => {
    const handleServiceUnavailable = (event: CustomEvent) => {
      const { service, message } = event.detail;
      setServiceUnavailable({ service, message });
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
    fetch('/api/factory/task-templates?taskType=Action')
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

  // ✅ Cache globale per DDT pre-assemblati (per templateId)
  // Key: templateId (es. "723a1aa9-a904-4b55-82f3-a501dfbe0351")
  // Value: { ddt, _templateTranslations }
  const preAssembledDDTCache = React.useRef<Map<string, { ddt: any; _templateTranslations: Record<string, { en: string; it: string; pt: string }> }>>(new Map());

  const { ideTranslations, replaceSelectedDDT } = useDDTManager();
  const mergedBase = useMemo(() => (ideTranslations || {}), [ideTranslations]);

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

  // ✅ DDT come ref mutabile (simula VB.NET: modifica diretta sulla struttura in memoria)
  const ddtRef = useRef(ddt);

  // ✅ Inizializza ddtRef.current solo su cambio istanza (non ad ogni re-render)
  const prevInstanceRef = useRef<string | undefined>(undefined);

  // ✅ Sincronizza ddtRef.current con ddt prop (fonte di verità dal dockTree)
  // Quando ddt prop cambia (dal dockTree), aggiorna il buffer locale
  useEffect(() => {
    const instance = task?.instanceId || task?.id; // ✅ RINOMINATO: act → task
    const isNewInstance = prevInstanceRef.current !== instance;

    if (isNewInstance) {
      // Nuova istanza → inizializza dal prop ddt (fonte di verità)
      ddtRef.current = ddt;
      prevInstanceRef.current = instance;
      // ✅ ARCHITETTURA ESPERTO: Forza aggiornamento mainList quando DDT viene caricato
      if (ddt?.data && ddt.data.length > 0) {
        setDDTVersion(v => v + 1);
      }
    } else if (ddt && ddt !== ddtRef.current) {
      // ✅ Safe comparison: check reference and data length instead of JSON.stringify
      // (JSON.stringify can fail on circular references)
      const ddtChanged = ddt !== ddtRef.current ||
        (ddt?.data?.length !== ddtRef.current?.data?.length);
      if (ddtChanged) {
        // Stessa istanza ma ddt prop è cambiato → sincronizza (dockTree è stato aggiornato esternamente)
        ddtRef.current = ddt;
        // ✅ ARCHITETTURA ESPERTO: Forza aggiornamento mainList quando DDT viene caricato
        if (ddt?.data && ddt.data.length > 0) {
          setDDTVersion(v => v + 1);
        }
      }
    }
  }, [ddt, (task as any)?.instanceId, task?.id]);

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

    // Structure: ddt.translations = { en: {...}, it: {...}, pt: {...} }
    const localeTranslations = ddtTranslations[locale] || ddtTranslations.en || ddtTranslations;
    const result = { ...mergedBase, ...localeTranslations };
    return result;
  };

  // ✅ Load translations from global table using shared hook
  // ✅ Pass task to extract GUIDs from task.steps[nodeId] (unified model)
  const localTranslations = useDDTTranslations(ddt, task);

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
  // NON è una derivazione da localDDT - questo elimina race conditions e dipendenze circolari
  const [selectedNode, setSelectedNode] = useState<any>(null);
  const [selectedNodePath, setSelectedNodePath] = useState<{
    mainIndex: number;
    subIndex?: number;
  } | null>(null);

  // ✅ Quando chiudi, usa direttamente ddtRef.current (già contiene tutte le modifiche)
  // Non serve più buildDDTFromSelectedNode perché le modifiche sono già nel ref

  // ✅ Salva modifiche quando si clicca "Salva" nel progetto (senza chiudere l'editor)
  // Usa ddtRef.current che è sempre sincronizzato con dockTree (fonte di verità)
  //
  // LOGICA CONCETTUALE DEL SALVATAGGIO:
  // - Template: contiene struttura condivisa (constraints, examples, nlpContract)
  // - Istanza: contiene SOLO override (modifiche rispetto al template)
  // - extractModifiedDDTFields confronta istanza con template e salva solo differenze
  // - A runtime: se mancante nell'istanza → risoluzione lazy dal template (backend VB.NET)
  React.useEffect(() => {
    const handleProjectSave = async () => {
      if (task?.id || task?.instanceId) { // ✅ RINOMINATO: act → task
        const key = (task?.instanceId || task?.id) as string; // ✅ RINOMINATO: act → task
        const taskInstance = taskRepository.getTask(key);
        const currentDDT = { ...ddtRef.current };
        const hasDDT = currentDDT && Object.keys(currentDDT).length > 0 && currentDDT.data && currentDDT.data.length > 0;

        if (hasDDT && taskInstance) {
          // ✅ Estrai solo campi modificati rispetto al template (override)
          // Questo evita duplicazione: constraints/examples/nlpContract vengono salvati
          // solo se sono stati modificati rispetto al template
          const modifiedFields = await extractModifiedDDTFields(taskInstance, currentDDT);

          const currentTemplateId = getTemplateId(taskInstance);

          // ✅ CASE-INSENSITIVE
          if (!currentTemplateId || currentTemplateId.toLowerCase() !== 'datarequest') {
            await taskRepository.updateTask(key, {
              type: TaskType.DataRequest,  // ✅ type: enum numerico
              templateId: null,            // ✅ templateId: null (standalone)
              ...modifiedFields  // ✅ Salva solo override, non tutto
            }, currentProjectId || undefined);
          } else {
            await taskRepository.updateTask(key, modifiedFields, currentProjectId || undefined);
          }
        } else if (currentDDT) {
          await taskRepository.updateTask(key, currentDDT, currentProjectId || undefined);
        }
      }
    };

    window.addEventListener('project:save', handleProjectSave);
    return () => {
      window.removeEventListener('project:save', handleProjectSave);
    };
  }, [task?.id, (task as any)?.instanceId, currentProjectId]);


  // ✅ Usa ddtRef.current per mainList (contiene già le modifiche)
  // Forza re-render quando ddtRef cambia usando uno stato trigger
  const [ddtVersion, setDDTVersion] = useState(0);
  // ✅ ARCHITETTURA ESPERTO: Stabilizza isDdtLoading per evitare problemi con dipendenze undefined
  const stableIsDdtLoading = isDdtLoading ?? false;
  const mainList = useMemo(() => {
    // ✅ ARCHITETTURA ESPERTO: Usa ddt prop se disponibile, altrimenti ddtRef.current
    // Questo garantisce che mainList sia aggiornato quando DDTHostAdapter carica il DDT
    const currentDDT = ddt ?? ddtRef.current;
    const list = getdataList(currentDDT);
    return list;
  }, [ddt?.label ?? '', ddt?.data?.length ?? 0, ddtVersion ?? 0, stableIsDdtLoading]); // ✅ Usa valori primitivi sempre definiti
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

  // ✅ DEBUG: Abilita log con localStorage.setItem('debug.sidebarResize', '1')
  const DEBUG_RESIZE = typeof localStorage !== 'undefined' && localStorage.getItem('debug.sidebarResize') === '1';

  // ✅ Pulisci localStorage all'avvio per garantire che autosize prevalga
  React.useEffect(() => {
    try {
      localStorage.removeItem('responseEditor.sidebarWidth');
    } catch { }
  }, []);

  const handleSidebarResizeStart = React.useCallback((e: React.MouseEvent) => {
    if (DEBUG_RESIZE) console.log('🔵 [SIDEBAR_RESIZE] handleSidebarResizeStart chiamato', {
      clientX: e.clientX,
      button: e.button,
      buttons: e.buttons,
      target: e.target,
      currentTarget: e.currentTarget,
      sidebarRefExists: !!sidebarRef,
      sidebarRefCurrent: !!sidebarRef?.current,
    });

    e.preventDefault();
    e.stopPropagation(); // ✅ CRITICO: previeni che altri handler interferiscano

    const sidebarEl = sidebarRef?.current;
    if (!sidebarEl) {
      if (DEBUG_RESIZE) console.error('❌ [SIDEBAR_RESIZE] sidebarRef.current è null!');
      return;
    }

    const rect = sidebarEl.getBoundingClientRect();
    sidebarStartWidthRef.current = rect.width;
    sidebarStartXRef.current = e.clientX;

    if (DEBUG_RESIZE) console.log('✅ [SIDEBAR_RESIZE] Impostando isDraggingSidebar = true', {
      startWidth: sidebarStartWidthRef.current,
      startX: sidebarStartXRef.current,
      sidebarRect: { width: rect.width, left: rect.left, right: rect.right },
    });

    setIsDraggingSidebar(true);
  }, [sidebarRef, DEBUG_RESIZE]);

  React.useEffect(() => {
    if (DEBUG_RESIZE) console.log('🟡 [SIDEBAR_RESIZE] useEffect isDraggingSidebar cambiato', {
      isDraggingSidebar,
      sidebarManualWidth,
    });

    if (!isDraggingSidebar) {
      if (DEBUG_RESIZE) console.log('⏸️ [SIDEBAR_RESIZE] isDraggingSidebar è false, esco');
      return;
    }

    if (DEBUG_RESIZE) console.log('▶️ [SIDEBAR_RESIZE] Aggiungendo listener mousemove/mouseup');

    const handleMove = (e: MouseEvent) => {
      const deltaX = e.clientX - sidebarStartXRef.current;
      // ✅ FIX: Aumenta maxWidth a 1000px per permettere sidebar più larghe
      // Il minWidth rimane 160px, ma il maxWidth deve essere sufficientemente alto
      const MIN_WIDTH = 160;
      const MAX_WIDTH = 1000;
      const calculatedWidth = sidebarStartWidthRef.current + deltaX;
      const newWidth = Math.max(MIN_WIDTH, Math.min(MAX_WIDTH, calculatedWidth));

      if (DEBUG_RESIZE) console.log('🔄 [SIDEBAR_RESIZE] handleMove', {
        clientX: e.clientX,
        startX: sidebarStartXRef.current,
        deltaX,
        startWidth: sidebarStartWidthRef.current,
        calculatedWidth,
        newWidth,
        clamped: newWidth !== calculatedWidth,
        clampedMin: newWidth === MIN_WIDTH,
        clampedMax: newWidth === MAX_WIDTH,
      });

      setSidebarManualWidth(newWidth);
      // ✅ NON salvare in localStorage - solo durante la sessione
    };

    const handleUp = () => {
      if (DEBUG_RESIZE) console.log('🛑 [SIDEBAR_RESIZE] handleUp - fine drag');
      setIsDraggingSidebar(false);
    };

    window.addEventListener('mousemove', handleMove);
    window.addEventListener('mouseup', handleUp);

    if (DEBUG_RESIZE) console.log('✅ [SIDEBAR_RESIZE] Listener aggiunti');

    return () => {
      if (DEBUG_RESIZE) console.log('🧹 [SIDEBAR_RESIZE] Cleanup - rimuovendo listener');
      window.removeEventListener('mousemove', handleMove);
      window.removeEventListener('mouseup', handleUp);
    };
  }, [isDraggingSidebar, DEBUG_RESIZE]);

  // ✅ DEBUG: Log quando sidebarManualWidth cambia
  React.useEffect(() => {
    if (DEBUG_RESIZE) console.log('📏 [SIDEBAR_RESIZE] sidebarManualWidth cambiato', {
      sidebarManualWidth,
      isDraggingSidebar,
    });
  }, [sidebarManualWidth, isDraggingSidebar, DEBUG_RESIZE]);

  // ✅ Mantieni rightMode per compatibilità (combinazione di leftPanelMode e testPanelMode)
  const rightMode: RightPanelMode = testPanelMode === 'chat' ? 'chat' : leftPanelMode;
  // ✅ Stati di dragging separati per ogni pannello
  const [draggingPanel, setDraggingPanel] = useState<'left' | 'test' | 'tasks' | 'shared' | null>(null);
  const [showSynonyms, setShowSynonyms] = useState(false);
  const [showMessageReview, setShowMessageReview] = useState(false);
  const [selectedIntentIdForTraining, setSelectedIntentIdForTraining] = useState<string | null>(null);

  // Header: icon, title, and toolbar
  const taskType = task?.type ?? TaskType.DataRequest; // ✅ RINOMINATO: actType → taskType, usa TaskType enum

  // ✅ Verifica se kind === "intent" e non ha messaggi (mostra IntentMessagesBuilder se non ci sono)
  const needsIntentMessages = useMemo(() => {
    const firstMain = mainList[0];
    const hasMessages = hasIntentMessages(ddt, task);
    return firstMain?.kind === 'intent' && !hasMessages;
  }, [mainList, ddt, task]); // ✅ CORRETTO: Passa task a hasIntentMessages

  // ✅ Usa hook custom per gestire wizard e inferenza (estratto per migliorare manutenibilità)
  const {
    showWizard,
    setShowWizard,
    isInferring,
    setIsInferring,
    inferenceResult,
    setInferenceResult,
  } = useWizardInference({
    ddt,
    ddtRef,
    task: task && 'templateId' in task ? task : null, // ✅ ARCHITETTURA ESPERTO: Cast a Task completo (se ha templateId) o null
    isDdtLoading: isDdtLoading ?? false, // ✅ ARCHITETTURA ESPERTO: Passa stato di loading
    currentProjectId,
    selectedProvider,
    selectedModel,
    preAssembledDDTCache,
    wizardOwnsDataRef,
  });
  // ✅ TODO FUTURO: Category System (vedi documentation/TODO_NUOVO.md)
  // Aggiornare per usare getTaskVisuals(taskType, task?.category, task?.categoryCustom, !!ddt)
  const { Icon, color: iconColor } = getTaskVisualsByType(taskType, !!ddt); // ✅ RINOMINATO: actType → taskType
  // Priority: _sourceTask.label (preserved task info) > task.label (direct prop) > localDDT._userLabel (legacy) > generic fallback
  // NOTE: Do NOT use localDDT.label here - that's the DDT root label (e.g. "Age") which belongs in the TreeView, not the header
  const sourceTask = (ddt as any)?._sourceTask || (ddt as any)?._sourceAct; // ✅ RINOMINATO: sourceAct → sourceTask (backward compatibility con _sourceAct)
  const headerTitle = sourceTask?.label || task?.label || (ddt as any)?._userLabel || 'Response Editor'; // ✅ RINOMINATO: act → task

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

  // Track introduction separately - usa ddtRef.current con dipendenze stabilizzate
  // Stabilizza i valori primitivi per evitare problemi con array di dipendenze
  const stableDdtVersion = ddtVersion ?? 0;
  // ✅ Serializza introduction per confronto stabile (evita problemi con oggetti)
  // Usa sempre stringa (non null) per evitare problemi con React
  const stableIntroductionKey = ddt?.introduction ? JSON.stringify(ddt.introduction) : '';

  const introduction = useMemo(() => {
    return ddtRef.current?.introduction ?? null;
  }, [stableDdtVersion, stableIntroductionKey]); // ✅ Usa chiave serializzata sempre stringa

  // Persist explicitly on close only (avoid side-effects/flicker on unmount)
  const handleEditorClose = React.useCallback(async () => {
    console.log('[ResponseEditor][CLOSE] 🚪 Editor close initiated', {
      taskId: task?.id || task?.instanceId,
      hasTask: !!task,
      hasSelectedNode: !!selectedNode,
      hasSelectedNodePath: !!selectedNodePath,
      taskStepsCount: task?.steps ? Object.keys(task.steps).length : 0
    });

    // ✅ Salva selectedNode corrente nel ref prima di chiudere (se non già salvato)
    if (selectedNode && selectedNodePath) {
      const mains = getdataList(ddtRef.current);
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
            ddtRef.current.introduction = {
              type: 'introduction',
              escalations: newIntroStep.escalations || []
            };
          } else {
            delete ddtRef.current.introduction;
          }
        } else if (subIndex === undefined) {
          mains[mainIndex] = selectedNode;
          ddtRef.current.data = mains;
        } else {
          const subList = main.subData || [];
          const subIdx = subList.findIndex((s: any, idx: number) => idx === subIndex);
          if (subIdx >= 0) {
            subList[subIdx] = selectedNode;
            main.subData = subList;
            mains[mainIndex] = main;
            ddtRef.current.data = mains;
          }
        }
      }
    }

    // ✅ Usa direttamente ddtRef.current (già contiene tutte le modifiche)
    const finalDDT = { ...ddtRef.current };

    try {
      // Se abbiamo un instanceId o task.id (caso DDTHostAdapter), salva nell'istanza // ✅ RINOMINATO: act → task
      if (task?.id || task?.instanceId) { // ✅ RINOMINATO: act → task
        const key = (task?.instanceId || task?.id) as string; // ✅ RINOMINATO: act → task
        const hasDDT = finalDDT && Object.keys(finalDDT).length > 0 && finalDDT.data && finalDDT.data.length > 0;

        console.log('[ResponseEditor][CLOSE] 🔍 Pre-save check', {
          taskId: task?.id || task?.instanceId,
          key,
          hasDDT,
          finalDDTKeys: finalDDT ? Object.keys(finalDDT) : [],
          hasdata: !!finalDDT?.data,
          dataLength: finalDDT?.data?.length || 0
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

        if (hasDDT) {
          const finaldata = finalDDT?.data?.[0];
          const finalSubData = finaldata?.subData?.[0];
          const finalStartTasks = finalSubData?.steps?.start?.escalations?.reduce((acc: number, esc: any) => acc + (esc?.tasks?.length || 0), 0) || 0;

          console.log('[handleEditorClose] 💾 Saving complete DDT (SYNC - blocking close until saved)', {
            key,
            finalStartTasks,
            hasdata: !!finaldata,
            dataLength: finalDDT?.data?.length || 0
          });

          // ✅ Get or create task
          // ✅ LOGICA: Il task viene creato solo quando si apre ResponseEditor, dopo aver determinato il tipo
          let taskInstance = taskRepository.getTask(key);
          if (!taskInstance) {
            // ✅ Usa direttamente task.type (TaskType enum) invece di convertire da stringa
            const taskType = task?.type ?? TaskType.DataRequest; // ✅ Usa direttamente task.type (TaskType enum)
            taskInstance = taskRepository.createTask(taskType, null, undefined, key, currentProjectId || undefined);
          }

          const currentTemplateId = getTemplateId(taskInstance);

          // ✅ CRITICAL: Aggiungi task.steps a finalDDT (unica fonte di verità per gli steps)
          // Gli steps non sono in ddtRef.current perché vivono solo in task.steps[nodeId]
          const finalDDTWithSteps = {
            ...finalDDT,
            steps: task?.steps || finalDDT.steps || {} // ✅ Preferisci task.steps (unica fonte di verità)
          };

          console.log('[ResponseEditor][CLOSE] 📦 Final DDT with steps prepared', {
            taskId: task?.id || task?.instanceId,
            key,
            finalStepsKeys: finalDDTWithSteps.steps ? Object.keys(finalDDTWithSteps.steps) : [],
            finalStepsCount: finalDDTWithSteps.steps ? Object.keys(finalDDTWithSteps.steps).length : 0,
            taskStepsKeys: task?.steps ? Object.keys(task.steps) : [],
            taskStepsCount: task?.steps ? Object.keys(task.steps).length : 0,
            stepsMatch: JSON.stringify(finalDDTWithSteps.steps) === JSON.stringify(task?.steps || {})
          });

          // ✅ CASE-INSENSITIVE - AWAIT OBBLIGATORIO: non chiudere finché non è salvato
          if (!currentTemplateId || currentTemplateId.toLowerCase() !== 'datarequest') {
            await taskRepository.updateTask(key, {
              type: TaskType.DataRequest,  // ✅ type: enum numerico
              templateId: null,            // ✅ templateId: null (standalone)
              label: finalDDTWithSteps.label,
              data: finalDDTWithSteps.data,
              steps: finalDDTWithSteps.steps, // ✅ CRITICAL: Salva steps da task.steps (unica fonte di verità)
              constraints: finalDDTWithSteps.constraints,
              examples: finalDDTWithSteps.examples,
              nlpContract: finalDDTWithSteps.nlpContract,
              introduction: finalDDTWithSteps.introduction
            }, currentProjectId || undefined);
          } else {
            await taskRepository.updateTask(key, {
              label: finalDDTWithSteps.label,
              data: finalDDTWithSteps.data,
              steps: finalDDTWithSteps.steps, // ✅ CRITICAL: Salva steps da task.steps (unica fonte di verità)
              constraints: finalDDTWithSteps.constraints,
              examples: finalDDTWithSteps.examples,
              nlpContract: finalDDTWithSteps.nlpContract,
              introduction: finalDDTWithSteps.introduction
            }, currentProjectId || undefined);
          }

          // ✅ Verify steps were saved by reading back from repository
          const savedTask = taskRepository.getTask(key);
          const savedStepsKeys = savedTask?.steps ? Object.keys(savedTask.steps) : [];
          const savedStepsCount = savedStepsKeys.length;

          console.log('[ResponseEditor][CLOSE] ✅ Save completed successfully', {
            taskId: task?.id || task?.instanceId,
            key,
            dataLength: finalDDT.data?.length || 0,
            finalStartTasks,
            savedStepsKeys: finalDDTWithSteps.steps ? Object.keys(finalDDTWithSteps.steps) : [],
            savedStepsCount: finalDDTWithSteps.steps ? Object.keys(finalDDTWithSteps.steps).length : 0,
            repositoryTask: {
              hasSteps: !!savedTask?.steps,
              stepsKeys: savedStepsKeys,
              stepsCount: savedStepsCount,
              stepsMatch: JSON.stringify(savedTask?.steps || {}) === JSON.stringify(finalDDTWithSteps.steps || {})
            },
            verification: {
              stepsWereSaved: savedStepsCount > 0,
              stepsMatchExpected: savedStepsCount === (finalDDTWithSteps.steps ? Object.keys(finalDDTWithSteps.steps).length : 0),
              allStepsPresent: savedStepsKeys.every(nodeId => finalDDTWithSteps.steps?.[nodeId] !== undefined)
            }
          });
        } else if (finalDDT) {
          // ✅ No DDT structure, but save other fields (e.g., Message text)
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

    console.log('[ResponseEditor][CLOSE] 🚪 Calling onClose callback', {
      taskId: task?.id || task?.instanceId,
      hasOnClose: !!onClose
    });

    try { onClose && onClose(); } catch (e) {
      console.error('[ResponseEditor][CLOSE] ❌ Error calling onClose', {
        taskId: task?.id || task?.instanceId,
        error: e
      });
    }
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

  // ✅ Caricamento: legge da ddtRef.current (che contiene già le modifiche, come VB.NET)
  useEffect(() => {
    // 🔴 LOG CHIRURGICO 3: Caricamento nodo
    const currentMainList = getdataList(ddtRef.current); // ✅ Leggi dal ref, non dal prop

    if (currentMainList.length === 0) {
      return;
    }

    try {
      if (localStorage.getItem('debug.nodeSync') === '1') {
        console.log('[NODE_SYNC][LOAD] 🔄 Loading node from ddt', {
          selectedMainIndex,
          selectedSubIndex,
          selectedRoot,
          mainListLength: currentMainList.length
        });
      }
    } catch { }

    if (selectedRoot) {
      const introStep = ddtRef.current?.introduction
        ? { type: 'introduction', escalations: ddtRef.current.introduction.escalations }
        : { type: 'introduction', escalations: [] };
      const newNode = { ...ddtRef.current, steps: [introStep] };

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

            console.log('[NODE_SYNC][LOAD] ✅ Node loaded from ddt', {
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


    // ✅ Carica il nodo quando cambiano gli indici O quando ddt prop cambia (dal dockTree)
    // ddtRef.current è già sincronizzato con ddt prop dal useEffect precedente
  }, [selectedMainIndex, selectedSubIndex, selectedRoot, introduction, ddt?.label, ddt?.data?.length, task?.steps]);

  // ✅ NON serve più sincronizzare selectedNode con localDDT
  // selectedNode è l'unica fonte di verità durante l'editing
  // Quando chiudi l'editor, costruisci il DDT da selectedNode e salva


  // ✅ Step keys e selectedStepKey sono ora gestiti internamente da BehaviourEditor

  // ✅ updateSelectedNode: SINGOLA FONTE DI VERITÀ = dockTree
  // 1. Modifica ddtRef.current (buffer locale per editing)
  // 2. Aggiorna IMMEDIATAMENTE tab.ddt nel dockTree (fonte di verità)
  // 3. React re-renderizza con tab.ddt aggiornato
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
      if (localStorage.getItem('debug.nodeSync') === '1') {
        console.log('[NODE_SYNC][UPDATE] 🎯 updateSelectedNode called', {
          hasSelectedNode: !!selectedNode,
          selectedNodePath,
          hasTask: !!task,
          taskId: task?.id,
          instanceId: (task as any)?.instanceId,
          hasTabId: !!tabId,
          hasSetDockTree: !!setDockTree
        });
      }
    } catch { }

    setSelectedNode((prev: any) => {
      if (!prev || !selectedNodePath) {
        return prev;
      }

      const updated = updater(prev) || prev;
      const { mainIndex, subIndex } = selectedNodePath;
      const isRoot = selectedRoot || false;

      // ✅ STEP 1: Costruisci il DDT completo aggiornato
      const currentDDT = ddtRef.current || ddt;
      const updatedDDT = { ...currentDDT };
      const mains = [...(currentDDT.data || [])];

      if (mainIndex < mains.length) {
        const main = { ...mains[mainIndex] };

        if (isRoot) {
          // Root node (introduction)
          const newIntroStep = updated?.steps?.find((s: any) => s.type === 'introduction');
          if (newIntroStep?.escalations?.some((esc: any) => esc?.tasks?.length > 0)) {
            updatedDDT.introduction = {
              type: 'introduction',
              escalations: newIntroStep.escalations || []
            };
          } else {
            delete updatedDDT.introduction;
          }
        } else if (subIndex === undefined) {
          // Main node
          mains[mainIndex] = updated;
          updatedDDT.data = mains;

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
          const subList = [...(main.subData || [])];
          const subIdx = subList.findIndex((s: any, idx: number) => idx === subIndex);
          if (subIdx >= 0) {
            subList[subIdx] = updated;
            main.subData = subList;
            mains[mainIndex] = main;
            updatedDDT.data = mains;

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

        // ✅ STEP 2: Valida struttura DDT
        const validation = validateTaskStructure(updatedDDT);
        if (!validation.valid) {
          console.error('[ResponseEditor] Invalid DDT structure:', validation.error);
          // Mostra errore all'utente (puoi aggiungere un toast/alert qui)
          alert(`Invalid structure: ${validation.error}`);
          return prev; // Non aggiornare se struttura invalida
        }

        // ✅ STEP 3: Aggiorna ddtRef.current (buffer locale)
        ddtRef.current = updatedDDT;

        // ✅ STEP 4: Aggiorna IMMEDIATAMENTE tab.ddt nel dockTree (FONTE DI VERITÀ) - solo se disponibili
        if (tabId && setDockTree) {
          setDockTree(prev =>
            mapNode(prev, n => {
              if (n.kind === 'tabset') {
                const idx = n.tabs.findIndex(t => t.id === tabId);
                if (idx !== -1 && n.tabs[idx].type === 'responseEditor') {
                  const updatedTab = { ...n.tabs[idx], ddt: updatedDDT };
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

                // ✅ Se standalone (no templateId), salva tutto data completo
                // Se ha templateId, usa extractModifiedDDTFields per salvare solo override
                let fieldsToSave: any;
                if (!currentTemplateId || currentTemplateId === 'UNDEFINED') {
                  // Standalone: salva tutto data completo (include tutti i task)
                  fieldsToSave = {
                    label: updatedDDT.label,
                    data: updatedDDT.data, // ✅ Salva tutto, incluso tutti i task
                    steps: task?.steps || taskToSave?.steps || {}, // ✅ CORRETTO: Salva steps da task corrente (unica fonte di verità)
                    constraints: updatedDDT.constraints,
                    examples: updatedDDT.examples,
                    nlpContract: updatedDDT.nlpContract,
                    introduction: updatedDDT.introduction
                  };
                } else {
                  // Con templateId: salva solo override
                  fieldsToSave = await extractModifiedDDTFields(taskInstance, updatedDDT);
                  // ✅ CRITICAL: Aggiungi task.steps agli override (unica fonte di verità per gli steps)
                  if (task?.steps && Object.keys(task.steps).length > 0) {
                    fieldsToSave.steps = task.steps;
                  }
                }

                if (!currentTemplateId || currentTemplateId.toLowerCase() !== 'datarequest') {
                  await taskRepository.updateTask(key, {
                    type: TaskType.DataRequest,  // ✅ type: enum numerico
                    templateId: null,            // ✅ templateId: null (standalone)
                    ...fieldsToSave
                  }, projectIdToSave || undefined);
                } else {
                  await taskRepository.updateTask(key, fieldsToSave, projectIdToSave || undefined);
                }
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
  }, [selectedNodePath, selectedRoot, tabId, setDockTree, ddt?.label, ddt?.data?.length ?? 0, task, currentProjectId]);

  // ✅ NON serve più persistenza asincrona
  // Quando chiudi l'editor, costruisci il DDT da selectedNode e salva

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
        {false && isDDTEmpty(ddt) ? ( // Summarizer not yet implemented
          /* Placeholder for Summarizer when DDT is empty */
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
        ) : false && isDDTEmpty(ddt) ? ( // Negotiation not yet implemented
          /* Placeholder for Negotiation when DDT is empty */
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
                    id: ddt?.id || `temp_ddt_${task?.id}`,
                    label: inferenceResult.ai.schema.label || task?.label || 'Data',
                    data: inferenceResult.ai.schema.data || [],
                    _inferenceResult: inferenceResult // Passa anche il risultato completo per riferimento (con traduzioni se disponibili)
                  } : (ddt && ddt.data && ddt.data.length > 0 ? {
                    // ✅ Se ddt ha data (creato da categoria), passalo come initialDDT
                    // Il wizard andrà direttamente a 'structure' e mostrerà "Build Messages"
                    id: ddt?.id || `temp_ddt_${task?.id}`,
                    label: ddt?.label || task?.label || 'Data',
                    data: ddt.data,
                    steps: ddt.steps,  // ✅ Steps a root level
                    constraints: ddt.constraints,
                    examples: ddt.examples
                  } : ddt)}
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
                      hasdata: !!finalDDT.data,
                      dataLength: finalDDT.data?.length || 0,
                      dataFirstId: finalDDT.data?.[0]?.id
                    });

                    const coerced = coercePhoneKind(finalDDT);

                    // ✅ DEBUG: Verifica cosa contiene coerced dopo coercePhoneKind
                    console.log('[ResponseEditor][onComplete] 🔍 coerced after coercePhoneKind', {
                      hasSteps: !!coerced.steps,
                      stepsType: typeof coerced.steps,
                      stepsKeys: coerced.steps ? Object.keys(coerced.steps) : [],
                      stepsCount: coerced.steps ? Object.keys(coerced.steps).length : 0,
                      stepsDetails: coerced.steps ? Object.keys(coerced.steps).map(nodeId => {
                        const nodeSteps = coerced.steps[nodeId];
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
                      stepsPreserved: JSON.stringify(coerced.steps) === JSON.stringify(finalDDT.steps)
                    });

                    // Set flag to prevent auto-reopen IMMEDIATELY (before any state updates)
                    wizardOwnsDataRef.current = true;

                    // ✅ CRITICAL: Salva immediatamente il task con steps per evitare perdita dati
                    // Questo assicura che quando si riapre l'editor, i steps siano già salvati
                    if (task?.id || task?.instanceId) {
                      const key = (task?.instanceId || task?.id) as string;
                      const hasDDT = coerced && Object.keys(coerced).length > 0 && coerced.data && coerced.data.length > 0;

                      if (hasDDT) {
                        let taskInstance = taskRepository.getTask(key);
                        if (!taskInstance) {
                          const taskType = task?.type ?? TaskType.DataRequest;
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
                          nlpContract: coerced.nlpContract, // ✅ Override opzionali (solo se modificati)
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
                          dataLength: coerced.data?.length || 0,
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
              intentLabel={task?.label || ddt?.label || 'chiedi il problema'}
              onComplete={(messages) => {
                const updatedDDT = saveIntentMessagesToDDT(ddt, messages);

                // ✅ CRITICO: Salva il DDT nell'istanza IMMEDIATAMENTE quando si completano i messaggi
                // Questo assicura che quando si fa "Save" globale, l'istanza abbia il DDT aggiornato
                if (task?.id || (task as any)?.instanceId) {
                  const key = ((task as any)?.instanceId || task?.id) as string;
                  // ✅ MIGRATION: Use getTemplateId() helper
                  // ✅ FIX: Se c'è un DDT, assicurati che il templateId sia 'DataRequest'
                  const taskInstance = taskRepository.getTask(key);
                  const hasDDT = updatedDDT && Object.keys(updatedDDT).length > 0 && updatedDDT.data && updatedDDT.data.length > 0;
                  if (hasDDT && taskInstance) {
                    const currentTemplateId = getTemplateId(taskInstance);
                    // ✅ CASE-INSENSITIVE
                    // ✅ Update task con campi DDT direttamente (niente wrapper value)
                    if (!currentTemplateId || currentTemplateId.toLowerCase() !== 'datarequest') {
                      taskRepository.updateTask(key, {
                        type: TaskType.DataRequest,  // ✅ type: enum numerico
                        templateId: null,            // ✅ templateId: null (standalone)
                        ...updatedDDT  // ✅ Spread: label, data, steps, ecc.
                      }, currentProjectId || undefined);
                    } else {
                      taskRepository.updateTask(key, {
                        ...updatedDDT  // ✅ Spread: label, data, steps, ecc.
                      }, currentProjectId || undefined);
                    }
                  } else if (hasDDT) {
                    // Task doesn't exist, create it with DataRequest type
                    taskRepository.createTask(TaskType.DataRequest, null, updatedDDT, key, currentProjectId || undefined);
                  } else {
                    // FIX: Salva con projectId per garantire persistenza nel database
                    taskRepository.updateTask(key, {
                      ...updatedDDT  // ✅ Spread: label, data, stepPrompts, ecc.
                    }, currentProjectId || undefined);
                  }

                  // ✅ FIX: Notifica il parent (DDTHostAdapter) che il DDT è stato aggiornato
                  onWizardComplete?.(updatedDDT);
                }

                try {
                  replaceSelectedDDT(updatedDDT);
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
                  rootLabel={ddt?.label || 'Data'}
                  style={sidebarManualWidth ? { width: sidebarManualWidth, flexShrink: 0 } : { flexShrink: 0 }} // ✅ FIX: passa sempre style, ma width solo se c'è manualWidth
                  onChangeSubRequired={(mIdx: number, sIdx: number, required: boolean) => {
                    // Persist required flag on the exact sub (by indices), independent of current selection
                    const next = JSON.parse(JSON.stringify(ddt));
                    const mains = getdataList(next);
                    const main = mains[mIdx];
                    if (!main) return;
                    const subList = Array.isArray(main.subData) ? main.subData : [];
                    if (sIdx < 0 || sIdx >= subList.length) return;
                    subList[sIdx] = { ...subList[sIdx], required };
                    main.subData = subList;
                    mains[mIdx] = main;
                    next.data = mains;
                    try {
                      const subs = getSubDataList(main) || [];
                      const target = subs[sIdx];
                      if (localStorage.getItem('debug.responseEditor') === '1') console.log('[DDT][subRequiredToggle][persist]', { main: main?.label, label: target?.label, required });
                    } catch { }
                    try { replaceSelectedDDT(next); } catch { }
                  }}
                  onReorderSub={(mIdx: number, fromIdx: number, toIdx: number) => {
                    const next = JSON.parse(JSON.stringify(ddt));
                    const mains = getdataList(next);
                    const main = mains[mIdx];
                    if (!main) return;
                    const subList = Array.isArray(main.subData) ? main.subData : [];
                    if (fromIdx < 0 || fromIdx >= subList.length || toIdx < 0 || toIdx >= subList.length) return;
                    const [moved] = subList.splice(fromIdx, 1);
                    subList.splice(toIdx, 0, moved);
                    main.subData = subList;
                    mains[mIdx] = main;
                    next.data = mains;
                    try { if (localStorage.getItem('debug.responseEditor') === '1') console.log('[DDT][subReorder][persist]', { main: main?.label, fromIdx, toIdx }); } catch { }
                    try { replaceSelectedDDT(next); } catch { }
                  }}
                  onAddMain={(label: string) => {
                    const next = JSON.parse(JSON.stringify(ddt));
                    const mains = getdataList(next);
                    mains.push({ label, subData: [] });
                    next.data = mains;
                    try { replaceSelectedDDT(next); } catch { }
                  }}
                  onRenameMain={(mIdx: number, label: string) => {
                    const next = JSON.parse(JSON.stringify(ddt));
                    const mains = getdataList(next);
                    if (!mains[mIdx]) return;
                    mains[mIdx].label = label;
                    next.data = mains;
                    try { replaceSelectedDDT(next); } catch { }
                  }}
                  onDeleteMain={(mIdx: number) => {
                    const next = JSON.parse(JSON.stringify(ddt));
                    const mains = getdataList(next);
                    if (mIdx < 0 || mIdx >= mains.length) return;
                    mains.splice(mIdx, 1);
                    next.data = mains;
                    try { replaceSelectedDDT(next); } catch { }
                  }}
                  onAddSub={(mIdx: number, label: string) => {
                    const next = JSON.parse(JSON.stringify(ddt));
                    const mains = getdataList(next);
                    const main = mains[mIdx];
                    if (!main) return;
                    const list = Array.isArray(main.subData) ? main.subData : [];
                    list.push({ label, required: true });
                    main.subData = list;
                    mains[mIdx] = main;
                    next.data = mains;
                    try { replaceSelectedDDT(next); } catch { }
                  }}
                  onRenameSub={(mIdx: number, sIdx: number, label: string) => {
                    const next = JSON.parse(JSON.stringify(ddt));
                    const mains = getdataList(next);
                    const main = mains[mIdx];
                    if (!main) return;
                    const list = Array.isArray(main.subData) ? main.subData : [];
                    if (sIdx < 0 || sIdx >= list.length) return;
                    list[sIdx] = { ...(list[sIdx] || {}), label };
                    main.subData = list;
                    mains[mIdx] = main;
                    next.data = mains;
                    try { replaceSelectedDDT(next); } catch { }
                  }}
                  onDeleteSub={(mIdx: number, sIdx: number) => {
                    const next = JSON.parse(JSON.stringify(ddt));
                    const mains = getdataList(next);
                    const main = mains[mIdx];
                    if (!main) return;
                    const list = Array.isArray(main.subData) ? main.subData : [];
                    if (sIdx < 0 || sIdx >= list.length) return;
                    list.splice(sIdx, 1);
                    main.subData = list;
                    mains[mIdx] = main;
                    next.data = mains;
                    try { replaceSelectedDDT(next); } catch { }
                  }}
                  onSelectAggregator={handleSelectAggregator}
                />
                {/* ✅ REFACTOR: Resizer verticale tra Sidebar e contenuto principale - sempre visibile */}
                <div
                  onMouseDown={(e) => {
                    if (DEBUG_RESIZE) console.log('🖱️ [SIDEBAR_RESIZE] onMouseDown sul resizer', {
                      clientX: e.clientX,
                      button: e.button,
                      buttons: e.buttons,
                      target: e.target,
                      currentTarget: e.currentTarget,
                    });
                    handleSidebarResizeStart(e);
                  }}
                  onMouseEnter={() => {
                    if (DEBUG_RESIZE) console.log('👆 [SIDEBAR_RESIZE] Mouse enter resizer');
                  }}
                  onMouseLeave={() => {
                    if (DEBUG_RESIZE) console.log('👋 [SIDEBAR_RESIZE] Mouse leave resizer');
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
                          <NLPExtractorProfileEditor
                            node={selectedNode}
                            taskType={taskType}
                            locale={'it-IT'}
                            intentSelected={mainList[0]?.kind === 'intent' ? selectedIntentIdForTraining || undefined : undefined}
                            task={task}
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
                    ddt={ddt}
                    translations={localTranslations}
                    selectedNode={selectedNode}
                    onUpdateDDT={(updater) => {
                      const updated = updater(ddt);
                      try { replaceSelectedDDT(updated); } catch { }
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
                      ddt={ddt}
                      translations={localTranslations}
                      selectedNode={selectedNode}
                      onUpdateDDT={(updater) => {
                        const updated = updater(ddt);
                        try { replaceSelectedDDT(updated); } catch { }
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
                      ddt={ddt}
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

            {/* Pulsante OK */}
            <div style={{
              display: 'flex',
              justifyContent: 'flex-end',
              gap: 8,
              marginTop: 8
            }}>
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
    </div>
  );
}

export default function ResponseEditor({ ddt, onClose, onWizardComplete, task, isDdtLoading, hideHeader, onToolbarUpdate, tabId, setDockTree }: { ddt: any, onClose?: () => void, onWizardComplete?: (finalDDT: any) => void, task?: TaskMeta | Task, isDdtLoading?: boolean, hideHeader?: boolean, onToolbarUpdate?: (toolbar: ToolbarButton[], color: string) => void, tabId?: string, setDockTree?: (updater: (prev: any) => any) => void }) {
  return (
    <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <FontProvider>
        <ResponseEditorInner ddt={ddt} onClose={onClose} onWizardComplete={onWizardComplete} task={task} isDdtLoading={isDdtLoading} hideHeader={hideHeader} onToolbarUpdate={onToolbarUpdate} tabId={tabId} setDockTree={setDockTree} /> {/* ✅ ARCHITETTURA ESPERTO: Passa isDdtLoading */}
      </FontProvider>
    </div>
  );
}
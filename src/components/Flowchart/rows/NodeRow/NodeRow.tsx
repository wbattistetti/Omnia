import React, { useState, useEffect, useLayoutEffect, useRef, useCallback } from 'react';
import { useProjectData } from '../../../../context/ProjectDataContext';
import { useTaskTreeManager } from '../../../../context/DDTManagerContext';
import { useTaskTreeContext } from '../../../../context/DDTContext';
import { ProjectDataService } from '../../../../services/ProjectDataService';
import { EntityCreationService } from '../../../../services/EntityCreationService';
import { createAndAttachTask } from '../../../../services/TaskFactory';
import { useTaskEditor } from '../../../TaskEditor/EditorHost/TaskEditorContext'; // ✅ RINOMINATO: ActEditor → TaskEditor, useActEditor → useTaskEditor
import { emitSidebarRefresh } from '../../../../ui/events';
import { createPortal } from 'react-dom';
import { useReactFlow } from 'reactflow';
import { SIDEBAR_TYPE_ICONS, getSidebarIconComponent, SIDEBAR_ICON_COMPONENTS } from '../../../Sidebar/sidebarTheme';
import { HelpCircle } from 'lucide-react';
import { IntellisenseItem } from '../../../Intellisense/IntellisenseTypes';
import { getLabelColor } from '../../../../utils/labelColor';
import { NodeRowEditor } from '../../NodeRowEditor';
import { NodeRowProps } from '../../../../types/NodeRowTypes';
import { SIDEBAR_TYPE_COLORS } from '../../../Sidebar/sidebarTheme';
import { NodeRowLabel } from './NodeRowLabel';
import { NodeRowIntellisense } from './NodeRowIntellisense';
import { RowTypePickerToolbar } from './RowTypePickerToolbar';
import { FontProvider } from '../../../../context/FontContext';
import { useRowToolbar } from '../../hooks/useRowToolbar';
import { useRowState } from './hooks/useRowState';
import { useIntellisensePosition } from './hooks/useIntellisensePosition';
import { useRowRegistry } from './hooks/useRowRegistry';
import { isInsideWithPadding, getToolbarRect } from './utils/geometry';
import { getTaskVisualsByType, getTaskVisuals, resolveTaskType, hasTaskTree } from '../../utils/taskVisuals';
import { TaskType, taskTypeToTemplateId, taskTypeToHeuristicString, taskIdToTaskType } from '../../../../types/taskTypes'; // ✅ RINOMINATO: actIdToTaskType → taskIdToTaskType
import getIconComponent from '../../../TaskEditor/ResponseEditor/icons';
import { ensureHexColor } from '../../../TaskEditor/ResponseEditor/utils/color';
import { RowHeuristicsService } from '../../../../services/RowHeuristicsService'; // ✅ Service centralizzato per euristiche
// ❌ RIMOSSO: modeToType, typeToMode - usa TaskType enum direttamente
import { idMappingService } from '../../../../services/IdMappingService';
import { generateId } from '../../../../utils/idGenerator';
import { taskRepository } from '../../../../services/TaskRepository';
import { useRowExecutionHighlight } from '../../executionHighlight/useExecutionHighlight';
import { getTaskIdFromRow, updateRowTaskType, createRowWithTask, getTemplateId } from '../../../../utils/taskHelpers'; // ✅ RINOMINATO: updateRowTaskAction → updateRowTaskType

const NodeRowInner: React.ForwardRefRenderFunction<HTMLDivElement, NodeRowProps> = (
  {
    row,
    nodeTitle,
    nodeCanvasPosition,
    onUpdate,
    onUpdateWithCategory,
    onDelete,
    onKeyDown,
    onDragStart,
    onMoveRow,
    onDropRow,
    index,
    canDelete,
    totalRows,
    isHoveredTarget = false,
    isBeingDragged = false,
    isPlaceholder = false,
    style,
    forceEditing = false,
    onMouseEnter,
    onMouseLeave,
    onMouseMove,
    bgColor: propBgColor,
    textColor: propTextColor,
    onEditingEnd,
    onCreateFactoryTask, // ✅ RINOMINATO: onCreateAgentAct → onCreateFactoryTask
    onCreateBackendCall,
    onCreateTask,
    getProjectId
  }: NodeRowProps,
  ref
) => {
  const { data: projectDataCtx } = useProjectData();
  const taskTreeContext = useTaskTreeContext();
  const getTranslationsForTaskTree = taskTreeContext.getTranslationsForTaskTree;
  // Debug gate for icon/flow logs (enable with localStorage.setItem('debug.flowIcons','1'))
  const debugFlowIcons = (() => { try { return Boolean(localStorage.getItem('debug.flowIcons')); } catch { return false; } })();

  // Extract all state management to custom hook
  const rowState = useRowState({ row, forceEditing });
  const {
    isEditing, setIsEditing,
    hasEverBeenEditing, setHasEverBeenEditing,
    currentText, setCurrentText,
    included, setIncluded,
    showIntellisense, setShowIntellisense,
    intellisenseQuery, setIntellisenseQuery,
    suppressIntellisenseRef, intellisenseTimerRef,
    allowCreatePicker, setAllowCreatePicker,
    showCreatePicker, setShowCreatePicker,
    showIcons, setShowIcons,
    iconPos, setIconPos,
    typeToolbarRef, inputRef, nodeContainerRef, labelRef, overlayRef, mousePosRef, buttonCloseTimeoutRef
  } = rowState;

  // Measure label width and font styles when not editing to prevent shrinking and maintain font consistency
  const [labelWidth, setLabelWidth] = useState<number | null>(null);
  const [labelFontStyles, setLabelFontStyles] = useState<{
    fontSize: string;
    fontFamily: string;
    fontWeight: string;
    lineHeight: string;
  } | null>(null);

  // Use useLayoutEffect to measure after DOM is fully rendered
  useLayoutEffect(() => {
    if (!isEditing && labelRef.current) {
      // Wait for next frame to ensure layout is complete
      requestAnimationFrame(() => {
        if (!labelRef.current) return;

        const rect = labelRef.current.getBoundingClientRect();
        const computedStyle = window.getComputedStyle(labelRef.current);
        const width = rect.width;

        // Measure full width including parent container and node
        const parentWidth = labelRef.current.parentElement?.getBoundingClientRect().width;
        const nodeContainer = labelRef.current.closest('.react-flow__node') as HTMLElement;
        const nodeWidth = nodeContainer?.getBoundingClientRect().width;

        setLabelWidth(width);
        setLabelFontStyles({
          fontSize: computedStyle.fontSize,
          fontFamily: computedStyle.fontFamily,
          fontWeight: computedStyle.fontWeight,
          lineHeight: computedStyle.lineHeight
        });

        // Width and font styles measured (debug disabled)
      });
    }
  }, [isEditing, row.id, row.text]);

  // Visual states for drag & drop feedback
  const [visualState, setVisualState] = useState<'normal' | 'fade' | 'highlight'>('normal');

  // Type picker state (moved here to be accessible in handleKeyDownInternal)
  const [pickerCurrentType, setPickerCurrentType] = useState<TaskType | undefined>(undefined);
  const [pickerPosition, setPickerPosition] = useState<{ left: number; top: number } | null>(null);



  // Registry for external access
  const { registerRow, unregisterRow } = useRowRegistry();

  // Visual state methods
  const fade = useCallback(() => {
    setVisualState('fade');
  }, []);

  const highlight = useCallback(() => {
    setVisualState('highlight');
    // ✅ Auto-reset to normal after 1 second
    setTimeout(() => setVisualState('normal'), 1000);
  }, []);

  const normal = useCallback(() => {
    setVisualState('normal');
  }, []);


  // Register component in registry
  useEffect(() => {
    registerRow(row.id, { fade, highlight, normal });
    return () => unregisterRow(row.id);
  }, [row.id, fade, highlight, normal, registerRow, unregisterRow]);

  // Expose methods via ref for external access
  React.useImperativeHandle(ref, () => ({
    fade,
    highlight,
    normal
  }), [fade, highlight, normal]);

  // Use stable intellisense positioning hook
  const nodeOverlayPosition = useIntellisensePosition({
    isEditing,
    inputRef
  });

  const reactFlowInstance = useReactFlow();
  const getZoom = () => {
    try { return (reactFlowInstance as any)?.getViewport?.().zoom || 1; } catch { return 1; }
  };

  // State machine for toolbar/picker visibility (after refs are initialized)
  const toolbarSM = useRowToolbar({ rowRef: nodeContainerRef as any, overlayRef: overlayRef as any, pickerRef: typeToolbarRef as any });


  // ESC: when type toolbar is open, close it and refocus textbox without propagating to canvas
  useEffect(() => {
    if (!showCreatePicker) return;
    const onEsc = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      try {
        e.preventDefault();
        e.stopPropagation();
      } catch { }
      setShowCreatePicker(false);
      setAllowCreatePicker(false);
      suppressIntellisenseRef.current = true;
      // restore focus to the editor textarea
      try {
        if (inputRef.current) {
          const el = inputRef.current;
          el.focus();
          // place caret at end
          const val = el.value || '';
          el.setSelectionRange(val.length, val.length);
        }
      } catch { }
    };
    document.addEventListener('keydown', onEsc, true);
    return () => document.removeEventListener('keydown', onEsc, true);
  }, [showCreatePicker]);

  // Debug: track picker visibility/position
  useEffect(() => {
  }, [showCreatePicker, nodeOverlayPosition]);

  // reset suppression when editing ends
  useEffect(() => {
    if (!isEditing) suppressIntellisenseRef.current = false;
  }, [isEditing]);
  const { openTaskTree } = useTaskTreeManager();
  const hoverHideTimerRef = useRef<number | null>(null);

  // Calcola la posizione e dimensione della zona buffer (already computed above)

  // Helper per entrare in editing
  const enterEditing = () => {
    setIsEditing(true);
    // assicurati che la toolbar dei tipi sia sempre chiusa quando inizi a scrivere
    setShowCreatePicker(false);
    setAllowCreatePicker(false);
  };

  // Intercetta tasti globali quando la type toolbar è aperta, per evitare che raggiungano il canvas
  useEffect(() => {
    if (!showCreatePicker) return;
    const onGlobalKeyDown = (ev: KeyboardEvent) => {
      const keys = ['ArrowRight', 'ArrowLeft', 'ArrowUp', 'ArrowDown', 'Enter', 'Escape'];
      if (keys.includes(ev.key)) {
        const t = ev.target as Node | null;
        if (typeToolbarRef.current && t instanceof Node && typeToolbarRef.current.contains(t)) {
          return; // lascia passare alla toolbar
        }
        ev.preventDefault();
        ev.stopPropagation();
      }
    };
    window.addEventListener('keydown', onGlobalKeyDown, { capture: true });
    return () => window.removeEventListener('keydown', onGlobalKeyDown, { capture: true } as any);
  }, [showCreatePicker]);

  // Calcola la posizione delle icone: appena FUORI dal bordo destro del nodo, all'altezza della label
  // Con piccolo gap per evitare sovrapposizione al bordo
  useEffect(() => {
    if (showIcons && labelRef.current) {
      const labelRect = labelRef.current.getBoundingClientRect();
      const nodeEl = labelRef.current.closest('.react-flow__node') as HTMLElement | null;
      const nodeRect = nodeEl ? nodeEl.getBoundingClientRect() : labelRect;
      setIconPos({
        top: labelRect.top,
        left: nodeRect.right + 4 // Piccolo gap per evitare sovrapposizione al bordo
      });
    } else {
      setIconPos(null);
    }
  }, [showIcons]);

  // Bridge SM → local booleans used by layout effects
  useEffect(() => {
    if (toolbarSM.showIcons !== showIcons) setShowIcons(toolbarSM.showIcons);
    if (toolbarSM.showPicker !== showCreatePicker) setShowCreatePicker(toolbarSM.showPicker);
  }, [toolbarSM.showIcons, toolbarSM.showPicker]);

  useEffect(() => {
    if (forceEditing) {
      setIsEditing(true);
    } else {
      // ✅ Quando forceEditing diventa false, esci dalla modalità editing
      // Questo assicura che la riga torni a essere una label quando perde il focus
      setIsEditing(false);
    }
  }, [forceEditing]);

  // Debug disattivato di default (abilitabile via debug.flowIcons)
  useEffect(() => {
    // no-op
  }, [showIcons, row.id, iconPos, debugFlowIcons]);

  useEffect(() => {
    // Traccia se siamo mai entrati in editing
    if (isEditing) {
      setHasEverBeenEditing(true);
    }
  }, [isEditing]);

  useEffect(() => {
    // Solo chiamare onEditingEnd se stiamo uscendo dall'editing (era true, ora false)
    // E se siamo mai entrati in editing
    if (!isEditing && hasEverBeenEditing && typeof onEditingEnd === 'function') {
      onEditingEnd(row.id);
    }
  }, [isEditing, hasEverBeenEditing, row.id, onEditingEnd]);

  // Canvas click = ESC semantics: close intellisense if open, otherwise end editing without deleting
  useEffect(() => {
    const handleCanvasClick = () => {
      if (!isEditing) return;
      if (showIntellisense) {
        setShowIntellisense(false);
        setIntellisenseQuery('');
        return;
      }
      // End editing gracefully, keep the row/node even if empty
      setCurrentText(row.text);
      setIsEditing(false);
      setShowIntellisense(false);
      setIntellisenseQuery('');
      if (typeof onEditingEnd === 'function') {
        onEditingEnd(row.id);
      }
    };
    window.addEventListener('flow:canvas:click', handleCanvasClick as any, { capture: false } as any);
    return () => window.removeEventListener('flow:canvas:click', handleCanvasClick as any);
  }, [isEditing, showIntellisense, row.text, onEditingEnd]);

  const handleSave = async () => {
    const label = currentText.trim() || row.text;
    onUpdate(row, label);
    try {
      // aggiorna cache locale del testo messaggio
      if (onUpdateWithCategory) {
        (onUpdateWithCategory as any)(row, label, (row as any)?.categoryType, { message: { text: label } });
      }
    } catch { }
    setIsEditing(false);
    setShowIntellisense(false);
    setIntellisenseQuery('');
    // PUT non-bloccante: salva in background
    try {
      let pid: string | undefined = undefined;
      try { pid = ((require('../../state/runtime') as any).getCurrentProjectId?.() || undefined); } catch { }
      if (pid && ((row as any)?.mode === 'Message' || !(row as any)?.mode)) {
        // Per Message, usa row.id come instanceId (row.id è l'instanceId per le righe Message)
        const instanceId = (row as any)?.instanceId ?? row.id;

        console.log('[Message][SAVE][START]', {
          rowId: row.id,
          rowInstanceId: (row as any)?.instanceId,
          finalInstanceId: instanceId,
          label,
          labelLength: label.length,
          projectId: pid,
          rowMode: (row as any)?.mode
        });

        // FASE 4: Assicurati che il Task esista in memoria prima di salvare
        // Se non esiste, crealo (questo può succedere se la riga è stata creata senza intellisense)
        const task = taskRepository.getTask(instanceId);
        console.log('[Message][SAVE][MEMORY_CHECK]', {
          instanceId,
          taskExists: !!task,
          taskMessage: task?.value?.text || 'N/A'
        });

        if (!task) {
          // Crea l'istanza in memoria se non esiste
          console.log('[Message][SAVE][CREATE_IN_MEMORY]', { instanceId });
          const projectId = getProjectId?.() ?? undefined;

          // FASE 4: Create Task if row doesn't have taskId
          if (!row.taskId) {
            // Create Task for this row (default to Message type)
            const newTask = createRowWithTask(instanceId, TaskType.SayMessage, label, projectId); // ✅ TaskType enum invece di stringa
            // ✅ REGOLA ARCHITETTURALE: task.id = row.id (newTask.id === instanceId === row.id)
            // ✅ NON modificare row.taskId direttamente (row è una prop immutabile)
            // ✅ Il task è già stato creato con instanceId come ID, quindi newTask.id === instanceId è sempre vero
          } else {
            // Row already has Task, update it
            taskRepository.updateTask(row.taskId, { text: label }, projectId);
          }

          console.log('[Message][SAVE][CREATED_AND_UPDATED]', {
            instanceId,
            taskId: row.taskId,
            messageText: label.substring(0, 50)
          });
        } else {
          // FASE 4: Aggiorna il messaggio nel Task esistente
          console.log('[Message][SAVE][UPDATE_IN_MEMORY]', {
            instanceId,
            oldText: task.text?.substring(0, 50) || 'N/A',
            newText: label.substring(0, 50)
          });

          // FASE 4: Update Task (TaskRepository internally updates InstanceRepository)
          // ✅ Task viene creato solo quando si apre ResponseEditor, non qui
          const taskId = getTaskIdFromRow(row);
          if (taskId) {
            taskRepository.updateTask(taskId, { text: label }, getProjectId?.() ?? undefined);
          }
        }

        // FASE 4: Verifica dopo l'aggiornamento
        const taskAfter = taskRepository.getTask(instanceId);
        console.log('[Message][SAVE][MEMORY_AFTER_UPDATE]', {
          instanceId,
          taskExists: !!taskAfter,
          messageText: taskAfter?.value?.text?.substring(0, 50) || 'N/A'
        });

        // ✅ REMOVED: updateInstance (legacy act_instances) - taskRepository.updateTask already saves to database
      } else {
        console.log('[Message][SAVE][SKIPPED]', {
          hasProjectId: !!pid,
          rowMode: (row as any)?.mode,
          rowInstanceId: (row as any)?.instanceId,
          reason: !pid ? 'NO_PROJECT_ID' : 'NOT_MESSAGE_MODE'
        });
      }
    } catch (err) {
      console.error('[Message][SAVE][ERROR]', {
        error: String(err),
        rowId: row.id,
        label: label.substring(0, 50)
      });
    }
    if (typeof onEditingEnd === 'function') {
      onEditingEnd();
    }
  };

  const handleCancel = () => {
    if (currentText.trim() === '') {
      onDelete(row);
    } else {
      setCurrentText(row.text);
      setIsEditing(false);
      setShowIntellisense(false);
      setIntellisenseQuery('');
      if (typeof onEditingEnd === 'function') {
        onEditingEnd(row.id);
      }
    }
  };

  const handleKeyDownInternal = async (e: React.KeyboardEvent) => {
    const dbg = (() => { try { return Boolean(localStorage.getItem('debug.picker')); } catch { return false; } })();

    if (e.key === '/' && !showIntellisense) {
      // Activate intellisense with slash
      // Log rimosso per evitare spam
      setIntellisenseQuery('');
      setShowIntellisense(true);
      setAllowCreatePicker(false);
      e.preventDefault();
    } else if (e.key === 'Escape') {
      if (showIntellisense) {
        setShowIntellisense(false);
        setIntellisenseQuery('');
        setShowCreatePicker(false);
      } else {
        if (onKeyDown) onKeyDown(e); // Propaga ESC al parent
        handleCancel();
      }
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const q = (currentText || '').trim();
      // Quick-create Conditions: se questa riga appartiene alle conditions, crea subito senza intellisense
      if ((row as any)?.categoryType === 'conditions') {
        try {
          const created = EntityCreationService.createCondition({
            name: q,
            projectData,
            projectIndustry: (projectData as any)?.industry,
            scope: 'industry'
          });
          if (created) {
            if (onUpdateWithCategory) {
              (onUpdateWithCategory as any)(row, q, 'conditions', { conditionId: created.id });
            } else {
              onUpdate(row, q);
            }
            setIsEditing(false);
            setShowIntellisense(false);
            setIntellisenseQuery('');
            try { emitSidebarRefresh(); } catch { }
          }
        } catch (err) {
          try { console.warn('[CondFlow] quick-create failed', err); } catch { }
        }
        return;
      }

      // Alt+Enter: apri la toolbar manuale dei tipi
      if (e.altKey) {
        if (dbg) { }
        setIntellisenseQuery(q);
        setShowIntellisense(false);
        setAllowCreatePicker(true);
        setShowCreatePicker(true);
        try { inputRef.current?.blur(); } catch { }
        return;
      }
      // ✅ FLUSSO CENTRALIZZATO: Usa RowHeuristicsService per analisi euristica
      try {
        // ✅ Usa servizio centralizzato per analisi euristica
        const heuristicsResult = await RowHeuristicsService.analyzeRowLabel(q);
        const { taskType, templateId, isUndefined, inferredCategory } = heuristicsResult;

        // ✅ LAZY APPROACH: Memorizza metadati nella riga invece di creare task subito
        // ✅ Il task verrà creato solo quando si apre l'editor (lazy creation)

        // ✅ LAZY: NON creiamo/aggiorniamo il task qui - solo memorizziamo metadati nella riga
        // ✅ Il task verrà creato solo quando si apre l'editor (cliccando sul gear)

        // ✅ AGGIORNA RIGA con metadati
        // ✅ Converti TaskType enum → string per row.type (compatibilità con codice esistente)
        const rowType = taskType === TaskType.UtteranceInterpretation ? 'UtteranceInterpretation' :
          taskType === TaskType.SayMessage ? 'Message' :
            taskType === TaskType.ClassifyProblem ? 'ProblemClassification' :
              taskType === TaskType.BackendCall ? 'BackendCall' : undefined;

        // ✅ Memorizza metadati nella riga per lazy task creation
        // ✅ LAZY: NON impostiamo taskId - il task verrà creato solo quando si apre l'editor
        const updatedRow = {
          ...row,
          text: q,
          type: rowType as any,
          mode: rowType as any,
          isUndefined: isUndefined, // ✅ Usa isUndefined dal servizio
          // ✅ LAZY: Memorizza metadati per creazione task quando si apre l'editor
          meta: {
            type: taskType,  // TaskType enum
            templateId: templateId,  // GUID del template se trovato
            inferredCategory: inferredCategory || null  // ✅ Categoria semantica dedotta automaticamente
          }
        };

        onUpdate(updatedRow as any, q);
        setIsEditing(false);

        return;
      } catch (err) {
        console.error('❌ [EURISTICA] ERRORE durante creazione riga', {
          text: q,
          rowId: row.id,
          error: err,
          errorMessage: err instanceof Error ? err.message : String(err),
          stack: err instanceof Error ? err.stack : undefined,
          timestamp: new Date().toISOString()
        });
        try { console.warn('[Heuristics] failed, fallback to picker', err); } catch { }
        setIntellisenseQuery(q);
        setShowIntellisense(false);
        setAllowCreatePicker(true);
        setShowCreatePicker(true);
        try { inputRef.current?.blur(); } catch { }
        return;
      }
    }
  };

  // Handle text change and trigger intellisense
  const handleTextChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newText = e.target.value;
    setCurrentText(newText);
    // Mostra intellisense mentre scrivi; non mostrare il picker finché non premi Enter
    const q = newText.trim();
    setAllowCreatePicker(false);
    setShowCreatePicker(false);
    if (intellisenseTimerRef.current) { window.clearTimeout(intellisenseTimerRef.current); intellisenseTimerRef.current = null; }
    if (q.length >= 2) {
      setIntellisenseQuery(newText);
      intellisenseTimerRef.current = window.setTimeout(() => {
        if (!suppressIntellisenseRef.current) {
          // Log rimosso per evitare spam
          setShowIntellisense(true);
        }
      }, 100);
    } else {
      setShowIntellisense(false);
      setIntellisenseQuery('');
    }
  };

  // Common handler invoked by keyboard or mouse pick
  const handlePickType = async (selectedTaskTypeOrTask: TaskType | { task: any }) => { // ✅ Riceve TaskType enum o task object per "Other"
    // ✅ Determina se è un TaskType enum o un task object
    const isTaskObject = typeof selectedTaskTypeOrTask === 'object' && 'task' in selectedTaskTypeOrTask;
    const selectedTaskType: TaskType | null = isTaskObject ? null : (selectedTaskTypeOrTask as TaskType);
    const selectedTask = isTaskObject ? (selectedTaskTypeOrTask as { task: any }).task : null;

    console.log('🎯 [HANDLE_PICK_TYPE][START]', {
      isTaskObject,
      taskType: selectedTaskType,
      taskTypeName: selectedTaskType ? TaskType[selectedTaskType] : 'Other',
      taskId: selectedTask?.id,
      taskTemplateId: selectedTask?.templateId,
      currentText,
      rowId: row.id,
      rowText: row.text,
      isEditing,
      hasOnCreateFactoryTask: !!onCreateFactoryTask,
      timestamp: Date.now()
    });

    setShowCreatePicker(false);
    setAllowCreatePicker(false);
    setShowIntellisense(false);
    const label = (currentText || '').trim();

    console.log('🎯 [HANDLE_PICK_TYPE][LABEL]', {
      label,
      labelLength: label.length,
      currentTextBeforeTrim: currentText,
      isEmpty: !label,
      isEditing,
      timestamp: Date.now()
    });

    if (!label) {
      console.log('🎯 [HANDLE_PICK_TYPE][EMPTY_LABEL] - Exiting early');
      setIsEditing(false);
      return;
    }

    // ✅ CAMBIO TIPO: Se non siamo in editing, stiamo cambiando il tipo di una riga esistente
    // In questo caso aggiorniamo solo il tipo senza aprire il ResponseEditor (si apre solo con l'ingranaggio)
    if (!isEditing && onUpdateWithCategory) {
      const taskId = row.id;
      let finalTaskType: TaskType;
      let typeString: string;
      let templateId: string | null = null;

      if (isTaskObject && selectedTask) {
        // ✅ Task "Other": usa il templateId, icon e color del task selezionato
        templateId = selectedTask.id || selectedTask.templateId || null;
        finalTaskType = selectedTask.type !== undefined ? selectedTask.type : TaskType.UNDEFINED;
        typeString = 'Other'; // Per backward compatibility

        // ✅ Salva icon e color nel task per usarli nei visuals
        const updateDataWithVisuals: any = {
          type: finalTaskType,
          icon: selectedTask.icon || selectedTask.iconName || null,
          color: selectedTask.color || null
        };
        if (templateId) {
          updateDataWithVisuals.templateId = templateId;
        }

        const existingTask = taskRepository.getTask(taskId);
        if (existingTask) {
          taskRepository.updateTask(taskId, updateDataWithVisuals, getProjectId?.() ?? undefined);
        } else {
          taskRepository.createTask(
            finalTaskType,
            templateId,
            {
              ...(finalTaskType === TaskType.SayMessage ? { text: row.text || '' } : {}),
              icon: selectedTask.icon || selectedTask.iconName || null,
              color: selectedTask.color || null
            },
            taskId,
            getProjectId?.() ?? undefined
          );
        }
      } else if (selectedTaskType !== null) {
        // ✅ TaskType enum: usa direttamente
        finalTaskType = selectedTaskType;
        typeString = finalTaskType === TaskType.SayMessage ? 'Message' :
          finalTaskType === TaskType.UtteranceInterpretation ? 'UtteranceInterpretation' :
            finalTaskType === TaskType.BackendCall ? 'BackendCall' :
              finalTaskType === TaskType.ClassifyProblem ? 'ProblemClassification' :
                finalTaskType === TaskType.AIAgent ? 'AIAgent' :
                  finalTaskType === TaskType.Summarizer ? 'Summarizer' :
                    finalTaskType === TaskType.Negotiation ? 'Negotiation' : 'Message';
      } else {
        console.error('❌ [CHANGE_TYPE] Nessun tipo valido fornito');
        toolbarSM.picker.close();
        return;
      }

      console.log('🎯 [CHANGE_TYPE][EXISTING_ROW]', {
        rowId: row.id,
        oldType: row.categoryType,
        newType: finalTaskType,
        newTypeString: typeString,
        templateId,
        isTaskObject,
        wasUndefined: (row as any)?.isUndefined,
        timestamp: Date.now()
      });

      // ✅ Aggiorna il task nel repository PRIMA di aggiornare la riga (solo se non è già stato fatto per task "Other")
      if (!isTaskObject || !selectedTask) {
        const existingTask = taskRepository.getTask(taskId);
        if (existingTask) {
          const updateData: any = { type: finalTaskType };
          if (templateId) {
            updateData.templateId = templateId;
          }
          taskRepository.updateTask(taskId, updateData, getProjectId?.() ?? undefined);
        } else {
          // Crea il task se non esiste
          taskRepository.createTask(
            finalTaskType,
            templateId,
            finalTaskType === TaskType.SayMessage ? { text: row.text || '' } : undefined,
            taskId,
            getProjectId?.() ?? undefined
          );
        }
      }

      // ✅ mode removed - use type (TaskType enum) only
      // ✅ Aggiorna anche row.meta.type con il TaskType enum (numero) per resolveTaskType
      const updateMeta = {
        id: row.id,
        type: typeString, // ✅ Stringa per backward compatibility
        meta: {
          ...((row as any)?.meta || {}),
          type: finalTaskType // ✅ TaskType enum (numero) per resolveTaskType
        },
        factoryId: (row as any).factoryId,
        instanceId: (row as any).instanceId,
        // ✅ Rimuovi flag isUndefined quando viene selezionato un tipo
        isUndefined: false
      };

      console.log('🎯 [CHANGE_TYPE][CALLING_UPDATE]', {
        rowId: row.id,
        label: row.text,
        categoryType: 'taskTemplates',
        meta: updateMeta,
        isUndefinedRemoved: true
      });

      (onUpdateWithCategory as any)(row, row.text, 'taskTemplates', updateMeta);

      console.log('🎯 [CHANGE_TYPE][COMPLETE]', {
        rowId: row.id,
        timestamp: Date.now()
      });

      // ✅ NON aprire automaticamente il ResponseEditor - si apre solo con l'ingranaggio
      // Chiudi il picker e aggiorna lo stato del toolbar
      toolbarSM.picker.close();
      return;
    }

    // ❌ NON chiudere la riga qui: aspetta che il testo sia salvato nel callback

    // ✅ NUOVO: Crea il factory task se onCreateFactoryTask è disponibile
    // Questo permette di ritrovare la riga nell'Intellisense quando viene riutilizzata
    // NOTA: Questo branch viene usato solo quando si crea una nuova riga (isEditing = true)
    // Quando si cambia il tipo di una riga esistente (isEditing = false), usiamo il branch sopra
    if (onCreateFactoryTask && isEditing) { // ✅ RINOMINATO: onCreateAgentAct → onCreateFactoryTask
      // ✅ Se è un task "Other", non usiamo onCreateFactoryTask (non ha senso per task esistenti)
      if (isTaskObject && selectedTask) {
        console.log('🎯 [HANDLE_PICK_TYPE][OTHER_TASK_IN_EDITING]', {
          label,
          taskId: selectedTask.id,
          taskTemplateId: selectedTask.templateId,
          timestamp: Date.now()
        });
        // Per task "Other" in editing, creiamo direttamente il task con templateId
        const taskId = row.id;
        const projectId = getProjectId?.() || undefined;
        const taskType = selectedTask.type !== undefined ? selectedTask.type : TaskType.UNDEFINED;
        const templateId = selectedTask.id || selectedTask.templateId || null;

        if (!row.taskId) {
          taskRepository.createTask(
            taskType,
            templateId,
            taskType === TaskType.SayMessage ? { text: label } : undefined,
            taskId,
            projectId
          );
        } else {
          taskRepository.updateTask(taskId, { type: taskType, templateId }, projectId);
        }

        // Aggiorna la riga
        const updateMeta = {
          id: taskId,
          type: 'Other',
          meta: {
            ...((row as any)?.meta || {}),
            type: taskType
          },
          isUndefined: false
        };

        if (onUpdateWithCategory) {
          (onUpdateWithCategory as any)(row, label, 'taskTemplates', updateMeta);
        } else {
          onUpdate({ ...row, isUndefined: false } as any, label);
        }

        setIsEditing(false);
        setShowIntellisense(false);
        setIntellisenseQuery('');
        toolbarSM.picker.close();
        return;
      }

      // ✅ Per TaskType enum, usa la logica esistente con key (da Intellisense)
      // NOTA: key non è definita quando si chiama dal picker, quindi questo branch
      // viene usato solo quando si seleziona da Intellisense, non dal picker
      console.log('🎯 [HANDLE_PICK_TYPE][CALLING_CREATE_FACTORY_TASK]', {
        label,
        taskType: selectedTaskType,
        timestamp: Date.now()
      });

      try {
        // ✅ Per TaskType enum, determina la key da usare
        const key = selectedTaskType !== null ? taskTypeToTemplateId(selectedTaskType) || '' : '';

        // Crea il factory task con il nome della riga e il tipo inferito
        // Il callback onRowUpdate viene chiamato immediatamente da EntityCreationService
        onCreateFactoryTask(label, (createdItem: any) => { // ✅ RINOMINATO: onCreateAgentAct → onCreateFactoryTask
          console.log('🎯 [TEMPLATE_CREATION][CALLBACK_START]', {
            label,
            createdItem,
            hasCreatedItem: !!createdItem,
            id: createdItem?.id,
            type: createdItem?.type,
            mode: createdItem?.mode,
            timestamp: Date.now()
          });

          // Callback che riceve l'item creato
          const createdItemId = createdItem?.id;
          console.log('🎯 [TEMPLATE_CREATION] Factory task created:', { // ✅ RINOMINATO: Agent act → Factory task
            label,
            id: createdItemId,
            type: createdItem?.type,
            mode: createdItem?.mode
          });

          // Aggiorna la riga con i metadati del template creato
          const instanceId = row.id;
          const projectId = getProjectId?.() || undefined;

          // Migration: Create or update Task
          // ✅ Converti key (stringa da Intellisense) a TaskType enum
          const taskType = taskIdToTaskType(key); // ✅ RINOMINATO: actIdToTaskType → taskIdToTaskType
          if (!row.taskId) {
            // Create Task for this row
            const task = createRowWithTask(instanceId, taskType, '', projectId); // ✅ TaskType enum
            // ✅ REGOLA ARCHITETTURALE: task.id = row.id (task.id === instanceId === row.id)
            // ✅ NON modificare row.taskId direttamente (row è una prop immutabile)
            // ✅ Il task è già stato creato con instanceId come ID, quindi task.id === instanceId è sempre vero
          } else {
            // Update Task type
            updateRowTaskType(row, taskType, projectId); // ✅ RINOMINATO: updateRowTaskAction → updateRowTaskType
          }

          const finalType = createdItem?.type ?? key;
          // ✅ mode removed - use type (TaskType enum) only

          const updateMeta = {
            id: instanceId,
            type: finalType, // ✅ TaskType enum only, no mode
            factoryId: createdItem?.factoryId,
            // ✅ Rimuovi flag isUndefined quando viene selezionato un tipo
            isUndefined: false
          };

          console.log('🎯 [TEMPLATE_CREATION][BEFORE_UPDATE]', {
            rowId: row.id,
            rowTextBefore: row.text,
            label,
            updateMeta,
            hasOnUpdateWithCategory: !!onUpdateWithCategory,
            hasOnUpdate: !!onUpdate,
            timestamp: Date.now()
          });

          if (onUpdateWithCategory) {
            console.log('🎯 [TEMPLATE_CREATION][CALLING_ON_UPDATE_WITH_CATEGORY]', {
              rowId: row.id,
              label,
              categoryType: 'taskTemplates',
              meta: updateMeta
            });
            (onUpdateWithCategory as any)(row, label, 'taskTemplates', updateMeta);
            console.log('🎯 [TEMPLATE_CREATION][AFTER_ON_UPDATE_WITH_CATEGORY]', {
              rowId: row.id,
              label,
              timestamp: Date.now()
            });
          } else {
            console.log('🎯 [TEMPLATE_CREATION][CALLING_ON_UPDATE]', {
              rowId: row.id,
              label,
              wasUndefined: (row as any)?.isUndefined
            });
            // ✅ Rimuovi flag isUndefined quando viene selezionato un tipo
            onUpdate({ ...row, isUndefined: false } as any, label);
            console.log('🎯 [TEMPLATE_CREATION][AFTER_ON_UPDATE]', {
              rowId: row.id,
              label,
              timestamp: Date.now()
            });
          }

          // ✅ CHIUDI LA RIGA DOPO aver salvato il testo
          console.log('🎯 [TEMPLATE_CREATION][CLOSING_ROW]', {
            rowId: row.id,
            timestamp: Date.now()
          });
          setIsEditing(false);
          setShowIntellisense(false);
          setIntellisenseQuery('');

          // ✅ Log dello stato finale della riga dopo un breve delay
          setTimeout(() => {
            console.log('🎯 [TEMPLATE_CREATION][FINAL_STATE_CHECK]', {
              rowId: row.id,
              rowTextAfter: row.text,
              label,
              textsMatch: row.text === label,
              timestamp: Date.now()
            });
          }, 100);

          try { emitSidebarRefresh(); } catch { }
        }, 'industry', undefined, key);

        console.log('🎯 [HANDLE_PICK_TYPE][AFTER_CALLING_CREATE_AGENT_ACT]', {
          label,
          timestamp: Date.now()
        });

        // ✅ Il callback viene chiamato immediatamente, quindi non serve il fallback
        return;
      } catch (err) {
        console.warn('[Row][TemplateCreation] Failed to create agent act template:', err);
        // Fallback al comportamento originale se la creazione fallisce
        setIsEditing(false); // Chiudi la riga anche in caso di errore
      }
    }

    // ✅ Fallback: comportamento originale se onCreateFactoryTask non è disponibile
    const immediate = (patch: any) => {
      if (onUpdateWithCategory) {
        (onUpdateWithCategory as any)(row, label, 'taskTemplates', patch);
      } else {
        onUpdate(row, label);
      }
    };

    // ✅ Create instance when type is determined (Intellisense or inference)
    console.log('🎯 [INSTANCE_CREATION] Creating instance for type:', key);
    const instanceId = row.id; // ✅ Use existing row ID as instance ID
    console.log('🎯 [INSTANCE_CREATION] Instance ID:', instanceId);

    // Get projectId if available
    const projectId = getProjectId?.() || undefined;

    // Migration: Create or update Task
    // ✅ Converti key (stringa da Intellisense) a TaskType enum
    const taskType = taskIdToTaskType(key); // ✅ RINOMINATO: actIdToTaskType → taskIdToTaskType
    if (!row.taskId) {
      // Create Task for this row
      const task = createRowWithTask(instanceId, taskType, row.text || '', projectId); // ✅ TaskType enum
      // ✅ REGOLA ARCHITETTURALE: task.id = row.id (task.id === instanceId === row.id)
      // ✅ NON modificare row.taskId direttamente (row è una prop immutabile)
      // ✅ Il task è già stato creato con instanceId come ID, quindi task.id === instanceId è sempre vero
    } else {
      // Update Task type
      updateRowTaskType(row, taskType, projectId); // ✅ RINOMINATO: updateRowTaskAction → updateRowTaskType
    }
    console.log('🎯 [INSTANCE_CREATION] Instance/Task created successfully', {
      projectId: projectId || 'N/A',
      taskId: row.taskId
    });

    console.log('🎯 [INSTANCE_CREATION] Row will be updated with ID:', instanceId);

    // ✅ Simple row update without createAndAttachAct - ELIMINATED!
    // ✅ mode removed - use type (TaskType enum) only
    console.log('🎯 [DIRECT_UPDATE] Updating row directly:', {
      id: instanceId,
      type: key // ✅ TaskType enum only, no mode
    });

    immediate({
      id: instanceId,
      type: key,
      mode
    });

    try { emitSidebarRefresh(); } catch { }
  };

  const handleIntellisenseSelect = async (item: IntellisenseItem) => {
    console.log('[🔍 INTELLISENSE] handleIntellisenseSelect called', {
      itemName: item.name,
      itemCategoryType: item.categoryType,
      rowId: row.id,
      nodeCanvasPosition,
      timestamp: Date.now()
    });

    setCurrentText(item.name);
    console.log('[🔍 INTELLISENSE] Closing intellisense', {
      itemName: item.name,
      rowId: row.id,
      timestamp: Date.now()
    });
    setShowIntellisense(false);
    setIntellisenseQuery('');
    // Auto-save the selection with category type (legacy path keeps row label)
    if (onUpdateWithCategory) {
      console.log('[🔍 INTELLISENSE] Calling onUpdateWithCategory', {
        rowId: row.id,
        itemName: item.name,
        categoryType: item.categoryType
      });
      (onUpdateWithCategory as any)(row, item.name, item.categoryType, {
        factoryId: item.factoryId,
        type: (item as any)?.type,
        mode: (item as any)?.mode,
        userActs: item.userActs,
        categoryType: item.categoryType
      });
    } else {
      console.log('[🔍 INTELLISENSE] Calling onUpdate', {
        rowId: row.id,
        itemName: item.name
      });
      onUpdate(row, item.name);
    }
    // Create instance asynchronously (best-effort)
    try {
      let pid: string | undefined = undefined;
      try { pid = ((require('../../state/runtime') as any).getCurrentProjectId?.() ?? undefined); } catch { }

      console.log('[🔍 ROW_CREATION] Item details:', {
        pid,
        itemId: item.id,
        itemCategoryType: item.categoryType,
        hasCategoryType: item.categoryType === 'taskTemplates',
        willCreateInstance: pid && item.id && item.categoryType === 'taskTemplates'
      });

      let backendInstanceId: string | undefined = undefined;
      if (pid && item.id && item.categoryType === 'taskTemplates') {
        // ✅ REMOVED: createInstance (legacy act_instances) - replaced with taskRepository.createTask
        // ✅ Create task using taskRepository (unified model)
        const chosenType = (item as any)?.type ?? TaskType.UNDEFINED; // ✅ TaskType enum only, no mode

        // ✅ Use row.id as taskId (1:1 relationship)
        const taskId = row.id || generateId();

        // ✅ Create task in taskRepository (saves to tasks collection)
        const task = taskRepository.createTask(chosenType, item.id || null, undefined, taskId, pid);

        console.log('[🔍 INTELLISENSE] taskRepository.createTask result', {
          success: !!task,
          task: task,
          taskId: task?.id,
          templateId: task?.templateId,
          timestamp: Date.now()
        });

        if (task && (onUpdateWithCategory as any)) {
          backendInstanceId = task.id;

          console.log('[🔍 INTELLISENSE] Task created', {
            taskId: task.id,
            type: chosenType,
            timestamp: Date.now()
          });

          (onUpdateWithCategory as any)(row, item.name, item.categoryType, {
            instanceId: task.id,
            type: chosenType,
            mode: (item as any)?.mode ?? modeFromType
          });
        } else {
          console.log('[⚠️ INTELLISENSE] taskRepository.createTask failed or returned null', {
            pid,
            itemId: item.id,
            itemCategoryType: item.categoryType,
            timestamp: Date.now()
          });
        }
      }
    } catch (e) { try { console.warn('[Row][instance:create] failed', e); } catch { } }

    // Create instance in InstanceRepository for ProblemClassification
    try {
      const itemCategoryType = (item as any)?.categoryType;
      const itemType = (item as any)?.type;
      // ✅ MIGRATION: Use getTemplateId() helper instead of direct task.action access
      // FASE 4: Get row type from Task (since we removed it from NodeRowData)
      const rowTask = taskRepository.getTask(row.id);
      // Map templateId to task type
      const templateIdToTaskType: Record<string, string> = {
        'SayMessage': 'Message',
        'UtteranceInterpretation': 'UtteranceInterpretation',
        'ClassifyProblem': 'ProblemClassification',
        'callBackend': 'BackendCall'
      };
      const rowType = rowTask ? (templateIdToTaskType[getTemplateId(rowTask)] ?? getTemplateId(rowTask)) : undefined;

      const isProblemClassification = itemCategoryType === 'taskTemplates' &&
        (itemType === 'ProblemClassification' || rowType === 'ProblemClassification');

      console.log('[🔍 INTELLISENSE] Checking if should create instance', {
        isProblemClassification,
        itemCategoryType,
        itemType,
        rowType,
        rowInstanceId: row.id, // row.id IS the instanceId now
        itemId: item.id,
        categoryMatch: itemCategoryType === 'taskTemplates',
        typeMatch: itemType === 'ProblemClassification' || rowType === 'ProblemClassification',
        timestamp: Date.now()
      });

      if (isProblemClassification) {
        // Use row.id as instanceId (they are the same now)
        const instanceIdToUse = row.id ?? (await import('uuid')).v4();
        const taskTypeToUse = item.type ?? 'ProblemClassification';

        console.log('[🔍 INTELLISENSE] Creating instance in InstanceRepository', {
          rowId: row.id,
          instanceId: instanceIdToUse,
          taskType: taskTypeToUse,
          hadExistingInstanceId: !!row.id, // row.id IS the instanceId now
          timestamp: Date.now()
        });

        // TaskRepository handles all task operations

        // ✅ RIMOSSO: findAgentAct - non esiste più il concetto di Act
        // ✅ Gli intents sono nel task.intents (campi diretti)
        let initialIntents: any[] = [];
        try {
          const task = taskRepository.getTask(instanceIdToUse);
          if (task?.intents) {
            initialIntents = task.intents;
          }
        } catch (err) {
          console.warn('[🔍 INTELLISENSE] Could not load template intents:', err);
        }

        // Create instance with intents
        const instanceId = row.id ?? generateId(); // Use row.id if available, otherwise generate
        const projectId = getProjectId?.() ?? undefined;

        // Migration: Create or update Task
        // ✅ Converti taskTypeToUse (stringa) a TaskType enum
        const taskTypeEnum = typeof taskTypeToUse === 'string' ? taskIdToTaskType(taskTypeToUse) : taskTypeToUse; // ✅ RINOMINATO: actIdToTaskType → taskIdToTaskType
        if (!row.taskId) {
          // Create Task for this row (dual mode)
          const task = createRowWithTask(instanceId, taskTypeEnum, row.text ?? '', projectId); // ✅ TaskType enum
          // FASE 4: Update Task with intents if ProblemClassification
          if (initialIntents.length > 0) {
            taskRepository.updateTask(task.id, { intents: initialIntents }, projectId);
          }
          // ✅ REGOLA ARCHITETTURALE: task.id = row.id (task.id === instanceId === row.id)
          // ✅ NON modificare row.taskId direttamente (row è una prop immutabile)
          // ✅ Il task è già stato creato con instanceId come ID, quindi task.id === instanceId è sempre vero
        } else {
          // Update Task type
          updateRowTaskType(row, taskTypeEnum, projectId); // ✅ RINOMINATO: updateRowTaskAction → updateRowTaskType
        }

        console.log('[✅ INTELLISENSE] Instance/Task created in repository', {
          instanceId: instanceId,
          taskId: row.taskId,
          taskType: taskTypeToUse,
          intentsCount: initialIntents.length,
          timestamp: Date.now()
        });

        // Update row (row.id is already the instanceId)
        if (onUpdateWithCategory) {
          console.log('[🔍 INTELLISENSE] Updating row', {
            rowId: row.id,
            instanceId: instanceId,
            taskId: row.taskId,
            timestamp: Date.now()
          });

          (onUpdateWithCategory as any)(row, item.name, item.categoryType, {
            instanceId: instanceId,
            taskId: row.taskId, // Include taskId in meta
            type: (item as any)?.type,
            mode: (item as any)?.mode
          });
        }
      }
    } catch (e) {
      try { console.warn('[Row][InstanceRepository:create] failed', e); } catch { }
    }
    console.log('[🔍 INTELLISENSE] Exiting editing mode', {
      rowId: row.id,
      itemName: item.name,
      timestamp: Date.now()
    });
    setIsEditing(false);
    setShowCreatePicker(false);
  };

  const handleIntellisenseClose = () => {
    setShowIntellisense(false);
    setIntellisenseQuery('');
    setShowCreatePicker(false);
  };

  // Removed previous force-visible effects for toolbar while picker is open.

  const handleDoubleClick = (e?: React.MouseEvent) => {
    setIsEditing(true);
  };

  // Open type picker when clicking the label icon (outside editing)
  // Note: pickerCurrentType and pickerPosition are declared above for use in handleKeyDownInternal

  const openTypePickerFromIcon = (anchor?: DOMRect, currentType?: TaskType) => { // ✅ TaskType enum invece di stringa
    const rect = anchor || labelRef.current?.getBoundingClientRect();
    if (!rect) { return; }
    // Position menu directly under icon with small negative offset to eliminate dead zone
    // Overlap by a few pixels to ensure smooth transition from button to picker
    const finalPos = { left: rect.left, top: (rect as any).bottom - 4 } as { left: number; top: number };
    // Removed verbose log
    setPickerPosition(finalPos);
    setShowIntellisense(false);
    setAllowCreatePicker(true);
    // keep toolbar visible while submenu is open
    setShowIcons(true);
    setShowCreatePicker(true);
    setPickerCurrentType(currentType);
    // Update toolbar state machine to show picker
    toolbarSM.picker.open();
    // close on outside click (not when moving between toolbar and picker)
    const onDocClick = (ev: MouseEvent) => {
      const target = ev.target as Node | null;
      const toolbarEl = typeToolbarRef.current as unknown as HTMLElement | null;
      const overToolbar = !!(toolbarEl && target && toolbarEl instanceof Node && toolbarEl.contains(target as Node));
      const rowEl = nodeContainerRef.current as HTMLElement | null;
      const overRow = !!(rowEl && target && target instanceof Node && rowEl.contains(target as Node));
      const overlayEl = overlayRef.current as HTMLElement | null;
      const overOverlay = !!(overlayEl && target && target instanceof Node && overlayEl.contains(target as Node));
      // Removed verbose log
      if (overToolbar || overRow || overOverlay) return; // clicks inside picker, row, or toolbar overlay should NOT close
      // Removed verbose log
      setShowCreatePicker(false);
      document.removeEventListener('mousedown', onDocClick, true);
      window.removeEventListener('mousemove', onMoveCloseIfFar, true);
    };
    document.addEventListener('mousedown', onDocClick, true);

    // close when moving far from row, toolbar and menu (proximity buffer)
    const onMoveCloseIfFar = (e: MouseEvent) => {
      // ✅ Verifica se il mouse è sopra il Response Editor - ignora l'evento
      const el = document.elementFromPoint(e.clientX, e.clientY) as HTMLElement;
      if (el?.closest?.('[data-response-editor]')) {
        return; // Non chiudere il picker se il mouse è sopra il Response Editor
      }

      const pt = { x: e.clientX, y: e.clientY };
      const rowRect = nodeContainerRef.current?.getBoundingClientRect() || null;
      const tbRect = overlayRef.current ? overlayRef.current.getBoundingClientRect() : (iconPos ? getToolbarRect(iconPos.left, iconPos.top, labelRef.current, 180) : null);
      const menuRect = (typeToolbarRef.current && (typeToolbarRef.current as any).getBoundingClientRect) ? (typeToolbarRef.current as any).getBoundingClientRect() : null;
      const nearRow = isInsideWithPadding(pt, rowRect, 20);
      const nearToolbar = isInsideWithPadding(pt, tbRect, 24);
      const nearMenu = isInsideWithPadding(pt, menuRect, 20);
      if (!nearRow && !nearToolbar && !nearMenu) {
        setShowCreatePicker(false);
        window.removeEventListener('mousemove', onMoveCloseIfFar, true);
        document.removeEventListener('mousedown', onDocClick, true);
        setShowIcons(false);
      } else {
        setShowIcons(true);
      }
    };
    window.addEventListener('mousemove', onMoveCloseIfFar, true);
  };

  // Ref per tracciare lo stato del drag iniziale
  const dragStartStateRef = useRef<{
    startX: number;
    startY: number;
    hasMoved: boolean;
    dragStarted: boolean;
  } | null>(null);

  // Drag & Drop personalizzato con distinzione click/drag
  const handleMouseDown = (e: React.MouseEvent) => {
    // Preveni il drag nativo
    e.preventDefault();
    e.stopPropagation();

    // Salva la posizione iniziale
    dragStartStateRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      hasMoved: false,
      dragStarted: false
    };

    // Handler per mousemove - controlla se il mouse si è mosso abbastanza
    const handleMouseMove = (moveEvent: MouseEvent) => {
      if (!dragStartStateRef.current || !onDragStart) return;

      const deltaX = Math.abs(moveEvent.clientX - dragStartStateRef.current.startX);
      const deltaY = Math.abs(moveEvent.clientY - dragStartStateRef.current.startY);
      const threshold = 5; // Soglia di 5px per distinguere click da drag

      if (deltaX > threshold || deltaY > threshold) {
        dragStartStateRef.current.hasMoved = true;

        // Avvia il drag solo se non è già stato avviato
        if (!dragStartStateRef.current.dragStarted) {
          dragStartStateRef.current.dragStarted = true;
          onDragStart(
            row.id,
            index,
            dragStartStateRef.current.startX,
            dragStartStateRef.current.startY,
            nodeContainerRef.current as HTMLElement
          );
        }
      }
    };

    // Handler per mouseup - pulisce i listener
    const handleMouseUp = () => {
      // Se non c'è stato movimento significativo, è stato un click normale
      // Non avviare il drag in questo caso

      // Pulisci lo stato e i listener
      dragStartStateRef.current = null;
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };

    // Aggiungi listener temporanei
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  };

  // DISABILITATO TEMPORANEAMENTE - Vecchio sistema di drag che interferisce
  // Also support simple immediate reordering by dragging label vertically:
  // compute target index from cursor Y over siblings and call onMoveRow during drag; onDropRow at end.
  /*
  useEffect(() => {
    if (!('current' in nodeContainerRef) || !nodeContainerRef.current) return;
    const el = nodeContainerRef.current;
    let dragging = false;
    let startY = 0;
    const onDown = (ev: MouseEvent) => {
      const t = ev.target as HTMLElement;
      if (!t || !(t.closest && t.closest('.node-row-outer'))) return;
      dragging = true;
      startY = ev.clientY;
    };
    const onMove = (ev: MouseEvent) => {
      if (!dragging || typeof onMoveRow !== 'function') return;
      const rows = Array.from((el.parentElement || document).querySelectorAll('.node-row-outer')) as HTMLElement[];
      const rects = rows.map((r, i) => ({ idx: i, top: r.getBoundingClientRect().top, h: r.getBoundingClientRect().height }));
      let to = index;
      for (const r of rects) { if (ev.clientY < r.top + r.h / 2) { to = r.idx; break; } to = r.idx + 1; }
      if (to !== index) {
        onMoveRow(index, to);
      }
    };
    const onUp = () => {
      if (dragging && typeof onDropRow === 'function') onDropRow();
      dragging = false;
    };
    el.addEventListener('mousedown', onDown);
    window.addEventListener('mousemove', onMove, { capture: true });
    window.addEventListener('mouseup', onUp, { capture: true });
    return () => {
      el.removeEventListener('mousedown', onDown);
      window.removeEventListener('mousemove', onMove as any, { capture: true } as any);
      window.removeEventListener('mouseup', onUp as any, { capture: true } as any);
    };
  }, [index, onMoveRow, onDropRow]);
  */

  // Ghost preview while dragging - DISABILITATO per evitare duplicazione
  // Il ghost element è ora gestito da NodeRowList.tsx

  // Visual state styles
  const getVisualStyles = (): React.CSSProperties => {
    switch (visualState) {
      case 'fade':
        return { opacity: 0.3, transition: 'opacity 0.2s ease' };
      case 'highlight':
        return {
          backgroundColor: 'rgba(16, 185, 129, 0.6)', // ✅ Verde emerald-500 con trasparenza
          borderRadius: '8px',
          // ✅ Nessun bordo, nessuna transizione per evitare il "bianco prima del verde"
          // ✅ Deve partire subito verde senza effetti di transizione
        };
      default:
        return {};
    }
  };

  // Checkbox visual effect: always grey when unchecked
  const getCheckboxStyles = (): React.CSSProperties => {
    if (!included) {
      return {
        opacity: 0.5,
        transition: 'opacity 0.2s ease'
      };
    }
    return {};
  };

  // Stili condizionali
  let conditionalStyles: React.CSSProperties = {};
  let conditionalClasses = '';

  if (isPlaceholder) {
    conditionalStyles = {
      display: 'none'
    };
  } else if (isBeingDragged) {
    conditionalStyles = {
      ...style,
      position: 'relative',
      zIndex: 0,
      opacity: 1,
      boxShadow: 'none',
      backgroundColor: 'transparent',
      outline: '1px dashed #94a3b8',
      outlineOffset: 2,
      pointerEvents: 'auto'
    };
  }

  // Merge visual styles with conditional styles
  conditionalStyles = { ...conditionalStyles, ...getVisualStyles() };

  // ✅ EXECUTION HIGHLIGHT: Get execution highlight styles for row
  // ✅ Task può non esistere ancora (viene creato solo quando si apre ResponseEditor)
  const taskId = getTaskIdFromRow(row);
  const rowHighlight = useRowExecutionHighlight(row.id, taskId || undefined);

  // ✅ Applica bordo invece di background
  const rowBorderStyle = rowHighlight.border !== 'transparent'
    ? {
      border: `${rowHighlight.borderWidth}px solid ${rowHighlight.border}`,
      borderRadius: '4px' // Opzionale: per rendere il bordo più visibile
    }
    : {};

  // Checkbox styles (always applied based on included state)
  const checkboxStyles = getCheckboxStyles();

  // Final styles that preserve highlight but apply defaults
  const finalStyles = visualState === 'highlight'
    ? {} // Don't override highlight styles
    : {
      backgroundColor: 'transparent',
      border: 'none',
      outline: 'none',
      boxShadow: 'none',
      paddingLeft: 0,
      paddingRight: 0,
      marginTop: 0,
      marginBottom: 0,
      paddingTop: 4,
      paddingBottom: 4,
      minHeight: 0,
      height: 'auto',
      width: '100%'
    };

  // Colore solo testo come in sidebar; sfondo trasparente
  let bgColor = 'transparent';
  let labelTextColor = '';
  let iconColor = '#94a3b8'; // Default grigio per l'icona

  // Icona e colore coerenti con la sidebar
  // ✅ NUOVO: Usa solo TaskRepository, non più AgentAct

  let Icon: React.ComponentType<any> | null = null;
  let currentTypeForPicker: TaskType | undefined = undefined; // ✅ TaskType enum invece di stringa

  // Check if this is an undefined node (no heuristic match found)
  const isUndefined = (row as any)?.isUndefined === true;

  // ✅ NUOVO: Usa solo TaskRepository (taskId già dichiarato sopra per useRowExecutionHighlight)
  if (taskId) {
    try {
      const task = taskRepository.getTask(taskId);
      if (task) {
        // ✅ Usa direttamente task.type (TaskType enum) se disponibile
        if (task.type !== undefined && task.type !== null && task.type !== TaskType.UNDEFINED) {
          // ✅ Se il task ha icon e color personalizzati (task "Other"), usali invece di getTaskVisualsByType
          if (task.icon || task.color) {
            const iconName = task.icon || task.iconName || 'Tag';
            const taskColor = task.color ? ensureHexColor(task.color) : '#94a3b8';

            // ✅ Crea un componente wrapper che renderizza l'icona usando getIconComponent
            Icon = isUndefined ? HelpCircle : (({ className, style, size, ...props }: any) => {
              const iconEl = getIconComponent(iconName, taskColor);
              return <span className={className} style={style} {...props}>{iconEl}</span>;
            }) as React.ComponentType<any>;
            labelTextColor = isUndefined ? '#94a3b8' : (taskColor || '#94a3b8');
            iconColor = isUndefined ? '#94a3b8' : (taskColor || '#94a3b8');
          } else {
            // ✅ Usa direttamente task.type (enum) per visuals invece di resolveTaskType
            // Questo garantisce che i visuals siano sempre aggiornati con il tipo corretto
            const taskTypeEnum = task.type;
            const has = hasTaskTree(row);
            // ✅ NUOVO: Usa getTaskVisuals con supporto per categorie
            // ✅ Leggi categoria da task.category OPPURE da row.meta.inferredCategory (se task non esiste ancora)
            const taskCategory = task.category || ((row as any)?.meta?.inferredCategory) || null;
            const visuals = getTaskVisuals(
              taskTypeEnum,
              taskCategory, // Preset category (da task o da row.meta)
              task.categoryCustom, // Custom category
              has
            );

            // Se è undefined, usa icona punto interrogativo invece dell'icona normale
            Icon = isUndefined ? HelpCircle : visuals.Icon;
            labelTextColor = isUndefined ? '#94a3b8' : visuals.labelColor;
            iconColor = isUndefined ? '#94a3b8' : visuals.iconColor;
          }

          // ✅ Imposta currentTypeForPicker con TaskType enum
          if (!isUndefined) {
            currentTypeForPicker = task.type; // ✅ Usa direttamente task.type (enum)
          }
        } else {
          // ✅ Task con tipo UNDEFINED - stato valido (euristica non ha determinato tipo)
          // L'utente deve selezionare manualmente il tipo tramite type picker
          // NON è un errore, quindi non loggare
          // ❌ RIMOSSO: Fallback visivo - se UNDEFINED, resta UNDEFINED (punto interrogativo)
          Icon = HelpCircle;
          labelTextColor = '#94a3b8';
          iconColor = '#94a3b8';
        }
      } else {
        // Task non trovato - questo è un problema reale, ma logga solo se necessario
        // (es. se il taskId esiste ma il task non è nel repository)
        if (row.taskId && process.env.NODE_ENV === 'development') {
          // Solo in dev e solo se c'è un taskId che dovrebbe esistere
          console.debug('[🎨 NODEROW] Task not found in repository', {
            taskId,
            rowId: row.id,
            hasTaskId: !!row.taskId
          });
        }
      }
    } catch (err) {
      console.error('[🎨 NODEROW] Error', { taskId, rowId: row.id, error: err });
    }
  }

  // ✅ Se non c'è task o non è stato possibile determinare il tipo
  // ✅ FIX: Usa sempre resolveTaskType per leggere row.meta.type (lazy creation)
  if (!Icon) {
    const resolvedType = resolveTaskType(row);

    // ✅ Se il tipo è stato risolto dai metadati, usa i visuals corretti
    if (resolvedType !== TaskType.UNDEFINED) {
      const has = hasTaskTree(row);
      // ✅ Leggi categoria da row.meta.inferredCategory (per lazy creation)
      const rowCategory = (row as any)?.meta?.inferredCategory || null;
      const visuals = getTaskVisuals(
        resolvedType,
        rowCategory, // Preset category da row.meta
        null, // Custom category (non disponibile in row.meta)
        has
      );

      Icon = visuals.Icon;
      labelTextColor = visuals.labelColor;
      iconColor = visuals.iconColor;
      currentTypeForPicker = resolvedType;
    } else {
      // ✅ Se UNDEFINED, mostra punto interrogativo (nessun fallback)
      Icon = HelpCircle;
      labelTextColor = '#94a3b8';
      iconColor = '#94a3b8';
    }
  }

  // FASE 4: Listen for instance updates to force re-render and update icon color
  // Note: TaskRepository doesn't emit events yet, but InstanceRepository still does
  // This listener is kept for backward compatibility during migration
  const [instanceUpdateTrigger, setInstanceUpdateTrigger] = useState(0);
  const instanceId = (row as any)?.instanceId || row.id;

  useEffect(() => {
    const handleInstanceUpdate = (event: CustomEvent) => {
      const { instanceId: updatedInstanceId } = event.detail;
      if (updatedInstanceId === instanceId) {
        // Force re-render by updating trigger
        setInstanceUpdateTrigger(prev => prev + 1);
      }
    };

    // FASE 4: Keep listener for backward compatibility (InstanceRepository still emits events)
    window.addEventListener('instanceRepository:updated', handleInstanceUpdate as EventListener);

    return () => {
      window.removeEventListener('instanceRepository:updated', handleInstanceUpdate as EventListener);
    };
  }, [instanceId, row.id]);

  // LOG: stampa id, forceEditing, isEditing
  useEffect(() => {
    // console.log(`[NodeRow] render row.id=${row.id} forceEditing=${forceEditing} isEditing=${isEditing}`);
  });

  // Editor host context (for opening the right editor per ActType) - host is always present
  const taskEditorCtx = useTaskEditor(); // ✅ RINOMINATO: actEditorCtx → taskEditorCtx, useActEditor → useTaskEditor


  // Icon già determinata sopra

  return (
    <>
      <div
        ref={nodeContainerRef}
        className={`node-row-outer nodrag flex items-center group ${conditionalClasses} ${!isBeingDragged && visualState !== 'highlight' ? 'node-row-hover-target' : ''}`}
        style={{
          ...conditionalStyles,
          ...checkboxStyles,
          ...finalStyles,
          ...rowBorderStyle, // ✅ Applica bordo invece di background
          backgroundColor: finalStyles.backgroundColor || 'transparent' // ✅ Mantieni background originale
        }}
        data-index={index}
        data-being-dragged={isBeingDragged ? 'true' : 'false'}
        data-row-id={row.id}
        draggable={false}
        onDragStart={(e) => e.preventDefault()}
        {...(onMouseEnter ? { onMouseEnter } : {})}
        {...(onMouseLeave ? { onMouseLeave } : {})}
        {...(onMouseMove ? { onMouseMove } : {})}
      >
        {isEditing ? (
          <div
            style={{
              flex: 1,
              minWidth: 0,
              marginRight: '8px', // Piccola marginatura a destra
              marginLeft: '4px'  // Piccola marginatura a sinistra
            }}
            data-row-id={row.id}
            ref={(divEl) => {
              // Editor container ref (debug disabled)
            }}
          >
            <NodeRowEditor
              value={currentText}
              onChange={handleTextChange}
              onKeyDown={handleKeyDownInternal}
              inputRef={inputRef}
              placeholder="Type what you need here..."
              fontStyles={labelFontStyles}
            />
          </div>
        ) : (
          <NodeRowLabel
            row={row}
            included={included}
            setIncluded={val => {
              setIncluded(val);
              if (typeof onUpdate === 'function') {
                onUpdate({ ...row, included: val }, row.text);
              }
            }}
            labelRef={labelRef}
            Icon={Icon}
            iconSize={undefined}
            showIcons={toolbarSM.showIcons}
            iconPos={iconPos}
            canDelete={canDelete}
            onEdit={() => enterEditing()}
            onDelete={() => onDelete(row)}
            onDrag={handleMouseDown}
            onLabelDragStart={handleMouseDown}
            isEditing={isEditing}
            setIsEditing={setIsEditing}
            bgColor={bgColor}
            labelTextColor={labelTextColor}
            iconColor={iconColor}
            hasTaskTree={isUndefined ? false : hasTaskTree(row)} // ✅ Usa hasTaskTree senza actFound
            gearColor={isUndefined ? '#94a3b8' : labelTextColor} // Se undefined, gear grigio
            // ✅ Disabilita ingranaggio se tipo UNDEFINED e non c'è template match (nessun TaskTree salvato)
            // ✅ Per DataRequest, sempre abilitato (può essere creato un TaskTree vuoto)
            gearDisabled={(() => {
              const taskType = resolveTaskType(row);
              if (taskType === TaskType.UtteranceInterpretation) {
                return false; // ✅ Sempre abilitato per DataRequest
              }
              return isUndefined && !hasTaskTree(row); // Disabilitato se undefined e nessun TaskTree
            })()}
            onOpenTaskTree={(() => {
              // ✅ Permetti sempre l'apertura per DataRequest (può essere creato un TaskTree vuoto)
              const taskType = resolveTaskType(row);
              if (taskType === TaskType.UtteranceInterpretation) {
                // ✅ Sempre permesso per DataRequest, anche se isUndefined o !hasTaskTree
                return async () => {
                  try {
                    console.log('[🔍 NodeRow][onOpenTaskTree] START', {
                      rowId: row.id,
                      rowText: row.text,
                      hasTaskId: !!(row as any)?.taskId,
                      taskId: (row as any)?.taskId || row.id,
                      taskType: resolveTaskType(row)
                    });

                    // ✅ REGOLA ARCHITETTURALE: task.id = row.id, quindi row.taskId = row.id
                    // Se row.taskId è corretto, il task esiste e può essere trovato
                    // ✅ FIX: taskForType deve essere let perché può essere riassegnato nel fallback
                    let taskForType = row.taskId ? taskRepository.getTask(row.taskId) : null;

                    console.log('[🔍 NodeRow][onOpenTaskTree] Task check', {
                      rowId: row.id,
                      rowTaskId: row.taskId,
                      taskExists: !!taskForType,
                      hasTemplateId: !!taskForType?.templateId
                    });

                    // ✅ CASO 1: Task esiste → apri direttamente (comportamento attuale)
                    if (taskForType) {
                      console.log('[🔍 NodeRow][onOpenTaskTree] ✅ CASO 1: Task esiste, aprendo direttamente ResponseEditor', {
                        rowId: row.id,
                        rowTaskId: row.taskId,
                        taskType: taskForType.type,
                        hasTemplateId: !!taskForType.templateId
                      });

                      // Task già esiste, apri direttamente ResponseEditor
                      const finalTaskType = taskForType.type as TaskType;
                      taskEditorCtx.open({ id: String(row.taskId), type: finalTaskType, label: row.text, instanceId: row.id });

                      // Costruisci TaskTree se necessario
                      let taskTree: any = null;
                      if (taskForType?.templateId && taskForType.templateId !== 'UNDEFINED') {
                        const DialogueTaskService = (await import('../../../../services/DialogueTaskService')).default;
                        const template = DialogueTaskService.getTemplate(taskForType.templateId);
                        if (template) {
                          const { RowHeuristicsService } = await import('../../../../services/RowHeuristicsService');
                          const templateType = RowHeuristicsService.getTemplateType(template);
                          if (templateType === TaskType.UtteranceInterpretation) {
                            const { buildTaskTree } = await import('../../../../utils/taskUtils');
                            const projectId = getProjectId?.() || undefined;
                            taskTree = await buildTaskTree(taskForType, projectId);
                          }
                        }
                      } else {
                        // ✅ Task senza templateId - ResponseEditor gestirà creando template automaticamente
                        taskTree = null;
                      }

                      const event = new CustomEvent('taskEditor:open', {
                        detail: {
                          id: String(row.taskId),
                          type: finalTaskType,
                          label: row.text,
                          taskTree: taskTree,
                          instanceId: row.id,
                          templateId: taskForType?.templateId || undefined
                        },
                        bubbles: true
                      });
                      document.dispatchEvent(event);
                      return;
                    }

                    // ✅ CASO 2: Task non esiste → cerca task nella libreria prima di aprire wizard
                    const rowMeta = (row as any)?.meta;
                    const metaTaskType = (rowMeta?.type !== undefined && rowMeta?.type !== null)
                      ? rowMeta.type
                      : TaskType.UNDEFINED;
                    const metaTemplateId = rowMeta?.templateId || null;
                    const projectId = getProjectId?.() || undefined;

                    // ✅ Sotto-caso 2a: C'è templateId → apri ResponseEditor direttamente (salta wizard)
                    if (metaTemplateId && metaTaskType === TaskType.UtteranceInterpretation) {
                      try {
                        console.log('[🔍 NodeRow][onOpenTaskTree] ✅ CASO 2a: Template trovato dall\'euristica, aprendo ResponseEditor direttamente', {
                          templateId: metaTemplateId,
                          rowText: row.text
                        });

                        const DialogueTaskService = (await import('../../../../services/DialogueTaskService')).default;

                        // Assicurati che i template siano caricati
                        if (!DialogueTaskService.isCacheLoaded()) {
                          await DialogueTaskService.loadTemplates();
                        }

                        const template = DialogueTaskService.getTemplate(metaTemplateId);

                        if (template) {
                          // Crea task dal template trovato dall'euristica
                          const newTask = taskRepository.createTask(
                            metaTaskType,
                            metaTemplateId,
                            { label: row.text || '' },
                            row.id,
                            projectId
                          );

                          // ✅ NON costruire taskTree qui - lascia che DDTHostAdapter lo faccia con buildTaskTree
                          // DDTHostAdapter chiamerà buildTaskTree che clonerà gli step correttamente
                          // Questo evita race condition: gli step saranno già disponibili quando viene selezionato il primo nodo

                          // Apri ResponseEditor direttamente
                          taskEditorCtx.open({
                            id: String(newTask.id),
                            type: metaTaskType,
                            label: row.text || '',
                            instanceId: row.id
                          });

                          // Emit event to open ResponseEditor tab
                          // ✅ NON passare taskTree - DDTHostAdapter lo costruirà da solo con buildTaskTree
                          const event = new CustomEvent('taskEditor:open', {
                            detail: {
                              id: String(newTask.id),
                              type: metaTaskType,
                              label: row.text || '',
                              // ✅ RIMOSSO: taskTree - DDTHostAdapter lo costruirà con buildTaskTree (clona step correttamente)
                              instanceId: row.id,
                              templateId: metaTemplateId
                            },
                            bubbles: true
                          });
                          document.dispatchEvent(event);
                          return; // ✅ Esci qui, non aprire wizard
                        }
                      } catch (err) {
                        console.error('[🔍 NodeRow][onOpenTaskTree] ❌ Errore caricamento template:', err);
                        // Fallback: continua con wizard
                      }
                    }

                    // ✅ Sotto-caso 2b: NON c'è templateId → apri wizard esterno direttamente (non generare AI qui)
                    if (!metaTemplateId && metaTaskType === TaskType.UtteranceInterpretation && row.text && row.text.trim().length >= 3) {
                      console.log('[🔍 NodeRow][onOpenTaskTree] ✅ CASO 2b: Nessun template, aprendo wizard esterno', {
                        label: row.text,
                        labelLength: row.text.trim().length
                      });

                      // ✅ Apri wizard esterno direttamente (il wizard gestirà la generazione AI internamente se necessario)
                      const wizardEvent = new CustomEvent('taskTreeWizard:open', {
                        detail: {
                          taskLabel: row.text || '',
                          taskType: TaskType.UtteranceInterpretation,
                          initialTaskTree: undefined, // Wizard parte da zero
                          startOnStructure: false, // Wizard parte da input step
                          rowId: row.id,
                          instanceId: row.id
                        },
                        bubbles: true
                      });
                      document.dispatchEvent(wizardEvent);
                      return; // ✅ Esci qui, non mostrare preview
                    }

                    // ✅ Fallback: Crea task base senza preview (comportamento legacy)
                    if (!taskForType) {
                      const rowMeta = (row as any)?.meta;
                      // ✅ Se rowMeta non esiste o type è undefined, usa UNDEFINED (non DataRequest)
                      const metaTaskType = (rowMeta?.type !== undefined && rowMeta?.type !== null)
                        ? rowMeta.type
                        : TaskType.UNDEFINED;
                      const metaTemplateId = rowMeta?.templateId || null;
                      const inferredCategory = rowMeta?.inferredCategory || null; // ✅ Categoria semantica dedotta
                      const projectId = getProjectId?.() || undefined;

                      console.log('🆕 [LAZY] Creando task usando metadati riga', {
                        rowId: row.id,
                        metaTaskType,
                        metaTaskTypeName: TaskType[metaTaskType],
                        metaTemplateId,
                        inferredCategory: inferredCategory || null
                      });

                      // ✅ Logica di creazione task:
                      // 1. Se c'è inferredCategory → crea data dalla categoria, NON cercare template
                      // 2. Se NON c'è categoria ma c'è templateId → usa template
                      // 3. Se NON c'è né categoria né template → l'utente crea manualmente
                      let initialTaskData: any = { label: row.text || '' };

                      // ✅ CASO 1: Se c'è inferredCategory (problem-classification, choice, confirmation)
                      if (inferredCategory && metaTaskType === TaskType.UtteranceInterpretation) {
                        const { v4: uuidv4 } = await import('uuid');
                        const { getdataLabelForCategory, getDefaultValuesForCategory, getCurrentProjectLocale } = await import('../../../../utils/categoryPresets');

                        initialTaskData.category = inferredCategory;
                        initialTaskData.templateId = null; // ✅ FORZA null, non cercare template

                        const projectLocale = getCurrentProjectLocale();
                        const categorydataLabel = getdataLabelForCategory(inferredCategory, projectLocale);

                        if (categorydataLabel) {
                          const defaultValues = getDefaultValuesForCategory(inferredCategory, projectLocale);

                          initialTaskData.data = [{
                            id: uuidv4(),
                            label: categorydataLabel,
                            kind: 'generic',
                            ...(defaultValues ? { values: defaultValues } : {}), // ✅ Valori predefiniti se presenti
                            subData: [],
                            steps: {
                              start: {
                                escalations: [{
                                  tasks: []
                                }]
                              }
                            }
                          }];

                          console.log('✅ [LAZY] TaskTree creato automaticamente da inferredCategory', {
                            category: inferredCategory,
                            dataLabel: categorydataLabel,
                            hasDefaultValues: !!defaultValues
                          });
                        }
                      }
                      // ✅ CASO 2: Se NON c'è categoria ma c'è templateId → usa template (NON creare data qui)
                      else if (metaTemplateId && metaTaskType === TaskType.UtteranceInterpretation) {
                        initialTaskData.templateId = metaTemplateId; // ✅ Usa template dall'euristica 2
                        // data sarà caricato dal template quando si apre ResponseEditor
                        console.log('✅ [LAZY] Task creato con templateId, data sarà caricato dal template', {
                          templateId: metaTemplateId
                        });
                      }
                      // ✅ CASO 3: Se NON c'è né categoria né template → apri wizard esterno (non creare task)
                      else {
                        // Nessun data, apri wizard esterno per creazione manuale
                        console.log('✅ [EXTERNAL_WIZARD] Aprendo wizard esterno (nessun template/categoria)', {
                          rowId: row.id,
                          rowText: row.text
                        });

                        // ✅ Emetti evento per aprire wizard esterno (non creare task qui)
                        const wizardEvent = new CustomEvent('taskTreeWizard:open', {
                          detail: {
                            taskLabel: row.text || '',
                            taskType: metaTaskType === TaskType.UNDEFINED ? TaskType.UtteranceInterpretation : metaTaskType,
                            initialTaskTree: undefined, // Wizard parte da zero
                            startOnStructure: false, // Wizard parte da input step
                            rowId: row.id,
                            instanceId: row.id
                          },
                          bubbles: true
                        });
                        document.dispatchEvent(wizardEvent);
                        return; // ✅ Esci qui, non creare task né aprire ResponseEditor
                      }

                      // ✅ Crea task base (con TaskTree se inferreddata presente) - solo se c'è categoria o template
                      // ✅ FIX: taskForType è già dichiarato come const sopra, quindi usiamo una nuova variabile
                      const newTask = taskRepository.createTask(
                        metaTaskType,
                        metaTemplateId,
                        initialTaskData,
                        row.id,
                        projectId
                      );
                      // ✅ REGOLA ARCHITETTURALE: task.id = row.id
                      // ✅ NON modificare row.taskId direttamente (row è una prop immutabile)
                      // ✅ Il task è già stato creato con row.id come ID, quindi task.id === row.id è sempre vero

                      // ✅ Assegna newTask a taskForType (ora taskForType punta al nuovo task)
                      taskForType = newTask;

                      // ✅ Se c'è templateId, usa funzione centralizzata per clonare e adattare
                      if (metaTemplateId) {
                        console.log('[🔍 NodeRow][LAZY] Clonando struttura dal template', {
                          rowId: row.id,
                          taskId: row.id,
                          templateId: metaTemplateId,
                          taskLabel: taskForType?.label
                        });

                        try {
                          const { loadAndAdaptTaskTreeForExistingTask } = await import('../../../../utils/taskTreeManager');

                          // ✅ Usa funzione centralizzata (gestisce tutto: buildTaskTreeNodes, cloneSteps, adattamento)
                          const { taskTree, adapted } = await loadAndAdaptTaskTreeForExistingTask(taskForType, projectId);

                          console.log('[🔍 NodeRow][LAZY] TaskTree ricevuto da loadAndAdaptTaskTreeForExistingTask', {
                            rowId: row.id,
                            taskId: row.id,
                            taskTreeStepsKeys: Object.keys(taskTree.steps || {}),
                            taskTreeStepsCount: Object.keys(taskTree.steps || {}).length,
                            mainNodesTemplateIds: taskTree.nodes?.map((n: any) => ({
                              id: n.id,
                              templateId: n.templateId,
                              label: n.label
                            })) || [],
                            adapted
                          });

                          // ✅ Salva task con steps (NON salvare data - si ricostruisce runtime)
                          taskRepository.updateTask(row.id, {
                            steps: taskTree.steps, // ✅ Steps con prompt adattati (solo main data)
                            metadata: { promptsAdapted: adapted || taskForType?.metadata?.promptsAdapted === true }
                          }, projectId);

                          console.log('[🔍 NodeRow][LAZY] ✅ Task salvato con steps', {
                            rowId: row.id,
                            taskId: row.id,
                            stepsCount: Object.keys(taskTree.steps || {}).length,
                            stepsKeys: Object.keys(taskTree.steps || {}),
                            promptsAdapted: adapted || taskForType?.metadata?.promptsAdapted === true
                          });
                        } catch (err) {
                          console.error('[🔍 NodeRow][LAZY] ❌ Errore durante clonazione/adattamento', err);
                        }
                      }
                    }

                    // ✅ Usa TaskType dal task o dai metadati
                    const finalTaskType = taskForType
                      ? (taskForType.type as TaskType)
                      : ((row as any)?.meta?.type || TaskType.UtteranceInterpretation);

                    taskEditorCtx.open({ id: String(row.id), type: finalTaskType, label: row.text, instanceId: row.id }); // ✅ REGOLA ARCHITETTURALE: task.id = row.id

                    // ✅ SOLO per DataRequest: costruisci TaskTree solo se:
                    // 1. C'è templateId E il template è di tipo DataRequest
                    // 2. OPPURE c'è data esistente (TaskTree già salvato, standalone o con override)
                    let taskTree: any = null;

                    if (taskForType?.templateId && taskForType.templateId !== 'UNDEFINED') {
                      // ✅ Verifica se il template è di tipo DataRequest prima di costruire TaskTree
                      const DialogueTaskService = (await import('../../../../services/DialogueTaskService')).default;
                      const template = DialogueTaskService.getTemplate(taskForType.templateId);

                      if (template) {
                        // ✅ Usa RowHeuristicsService per determinare il tipo del template
                        const { RowHeuristicsService } = await import('../../../../services/RowHeuristicsService');
                        const templateType = RowHeuristicsService.getTemplateType(template);

                        // ✅ Costruisci TaskTree SOLO se il template è di tipo DataRequest
                        if (templateType === TaskType.UtteranceInterpretation) {
                          // ✅ buildTaskTree costruisce TaskTree da template + instance
                          const { buildTaskTree } = await import('../../../../utils/taskUtils');
                          const projectId = getProjectId?.() || undefined;
                          taskTree = await buildTaskTree(taskForType, projectId);
                          if (!taskTree) {
                            // Fallback: create empty TaskTree solo se template è DataRequest ma buildTaskTree fallisce
                            taskTree = { label: taskForType.label || row.text || 'New Task', nodes: [] };
                          }
                        } else {
                          // ✅ NON costruire TaskTree se template non è DataRequest
                          taskTree = null;
                        }
                      } else {
                        taskTree = null;
                      }
                    }
                    // ✅ NON creare TaskTree vuoto se non c'è né templateId DataRequest né data
                    // ResponseEditor gestirà il caso di taskTree === null aprendo il wizard (AI genererà TaskTree)

                    // Emit event with TaskTree data so AppContent can open it as docking tab
                    const event = new CustomEvent('taskEditor:open', { // ✅ RINOMINATO: actEditor:open → taskEditor:open
                      detail: {
                        id: String(row.id), // ✅ REGOLA ARCHITETTURALE: task.id = row.id
                        type: finalTaskType, // ✅ TaskType enum invece di stringa
                        label: row.text,
                        taskTree: taskTree,
                        instanceId: row.id, // Pass instanceId from row
                        templateId: taskForType?.templateId || undefined
                      },
                      bubbles: true
                    });
                    document.dispatchEvent(event);
                  } catch (e) {
                    console.error('[NodeRow] Error opening editor:', e);
                  }
                };
              }
              // ✅ Per altri tipi, disabilita solo se undefined e nessun TaskTree
              if (isUndefined && !hasTaskTree(row)) {
                return undefined;
              }
              return async () => {
                try {
                  // ✅ REGOLA ARCHITETTURALE: task.id = row.id, quindi row.taskId = row.id
                  // Cerca il task con row.id
                  let taskForType = row.taskId ? taskRepository.getTask(row.taskId) : null;

                  // ✅ Se task non esiste, crealo usando metadati della riga
                  if (!taskForType) {
                    const rowMeta = (row as any)?.meta;
                    const metaTaskType = rowMeta?.type || resolveTaskType(row) || TaskType.SayMessage;
                    const metaTemplateId = rowMeta?.templateId || null;
                    const projectId = getProjectId?.() || undefined;

                    console.log('🆕 [LAZY] Creando task usando metadati riga', {
                      rowId: row.id,
                      metaTaskType,
                      metaTaskTypeName: TaskType[metaTaskType],
                      metaTemplateId
                    });

                    // ✅ Crea task base con row.id come ID
                    taskForType = taskRepository.createTask(
                      metaTaskType,
                      metaTemplateId,
                      metaTaskType === TaskType.SayMessage ? { text: row.text || '' } : undefined,
                      row.id,
                      projectId
                    );
                    // ✅ REGOLA ARCHITETTURALE: task.id = row.id
                    // ✅ NON modificare row.taskId direttamente (row è una prop immutabile)
                    // ✅ Il task è già stato creato con row.id come ID, quindi task.id === row.id è sempre vero

                    // ✅ Se c'è templateId, copia steps (escalations) dal template
                    if (metaTemplateId) {
                      console.log('📋 [LAZY] Copiando steps dal template', { templateId: metaTemplateId });
                      const DialogueTaskService = (await import('../../../../services/DialogueTaskService')).default;
                      const template = DialogueTaskService.getTemplate(metaTemplateId);

                      if (template) {
                        const { buildTaskTreeNodes } = await import('../../../../utils/taskUtils');
                        const nodes = buildTaskTreeNodes(template);

                        // ❌ DEPRECATED: Non salvare più .data - il modello Task non usa .data
                        // ✅ La struttura viene ricostruita runtime da template.subTasksIds
                        // taskRepository.updateTask(row.id, {
                        //   data: nodes
                        // }, projectId);

                        console.log('✅ [LAZY] Steps copiati dal template', {
                          dataLength: data.length,
                          hasSteps: data.some((n: any) => n.steps)
                        });
                      } else {
                        console.warn('⚠️ [LAZY] Template non trovato', { templateId: metaTemplateId });
                      }
                    }
                  }

                  // ✅ Usa TaskType dal task o dai metadati
                  const taskType = taskForType
                    ? (taskForType.type as TaskType)
                    : ((row as any)?.meta?.type || resolveTaskType(row) || TaskType.SayMessage);

                  // ✅ Determina quale editor aprire in base al tipo
                  const { getEditorFromTaskType } = await import('../../../../types/taskTypes');
                  const editorKind = getEditorFromTaskType(taskType);


                  // ✅ Apri editor tramite context (gestisce automaticamente il tipo corretto)
                  taskEditorCtx.open({ id: String(row.id), type: taskType, label: row.text, instanceId: row.id }); // ✅ REGOLA ARCHITETTURALE: task.id = row.id

                  // ✅ Solo per DataRequest (editorKind === 'ddt'), prepara TaskTree ed emetti evento
                  // ✅ Per altri tipi (SayMessage, BackendCall, AIAgent, Summarizer, Negotiation, ecc.), emetti evento senza TaskTree
                  if (editorKind === 'ddt' && taskType === TaskType.UtteranceInterpretation) {
                    // ✅ SOLO per DataRequest: costruisci TaskTree solo se:
                    // 1. C'è templateId E il template è di tipo DataRequest
                    // 2. OPPURE c'è data esistente (TaskTree già salvato, standalone o con override)
                    let taskTree: any = null;

                    if (taskForType?.templateId && taskForType.templateId !== 'UNDEFINED') {
                      // ✅ Verifica se il template è di tipo DataRequest prima di costruire TaskTree
                      const DialogueTaskService = (await import('../../../../services/DialogueTaskService')).default;
                      const template = DialogueTaskService.getTemplate(taskForType.templateId);

                      if (template) {
                        // ✅ Usa RowHeuristicsService per determinare il tipo del template
                        const { RowHeuristicsService } = await import('../../../../services/RowHeuristicsService');
                        const templateType = RowHeuristicsService.getTemplateType(template);

                        // ✅ Costruisci TaskTree SOLO se il template è di tipo DataRequest
                        if (templateType === TaskType.UtteranceInterpretation) {
                          // ✅ buildTaskTree costruisce TaskTree da template + instance
                          const { buildTaskTree } = await import('../../../../utils/taskUtils');
                          const projectId = getProjectId?.() || undefined;
                          taskTree = await buildTaskTree(taskForType, projectId);
                          if (!taskTree) {
                            // Fallback: create empty TaskTree solo se template è DataRequest ma buildTaskTree fallisce
                            taskTree = { label: taskForType.label || row.text || 'New Task', nodes: [] };
                          }
                        } else {
                          // ✅ NON costruire TaskTree se template non è DataRequest
                          taskTree = null;
                        }
                      } else {
                        taskTree = null;
                      }
                    }
                    // ✅ NON creare TaskTree vuoto se non c'è né templateId DataRequest né data
                    // ResponseEditor gestirà il caso di taskTree === null aprendo il wizard (AI genererà TaskTree)

                    // ✅ Emit event with TaskTree data so AppContent can open it as docking tab (solo per DataRequest)
                    const event = new CustomEvent('taskEditor:open', { // ✅ RINOMINATO: actEditor:open → taskEditor:open
                      detail: {
                        id: String(row.id), // ✅ REGOLA ARCHITETTURALE: task.id = row.id
                        type: taskType, // ✅ TaskType enum invece di stringa
                        label: row.text,
                        taskTree: taskTree,
                        instanceId: row.id, // Pass instanceId from row
                        templateId: taskForType?.templateId || undefined
                      },
                      bubbles: true
                    });
                    document.dispatchEvent(event);

                  } else {
                    // ✅ Per altri tipi (SayMessage, BackendCall, AIAgent, Summarizer, Negotiation, ecc.), emetti evento senza TaskTree
                    const event = new CustomEvent('taskEditor:open', {
                      detail: {
                        id: String(row.id), // ✅ REGOLA ARCHITETTURALE: task.id = row.id
                        type: taskType,
                        label: row.text,
                        instanceId: row.id
                      },
                      bubbles: true
                    });
                    document.dispatchEvent(event);
                  }
                } catch (e) {
                  console.error('[NodeRow][onOpenTaskTree] Failed to open editor', e);
                }
              };
            })()}
            onDoubleClick={handleDoubleClick}
            onIconsHoverChange={(v: boolean) => { v ? toolbarSM.overlay.onEnter() : toolbarSM.overlay.onLeave(); }}
            onLabelHoverChange={(v: boolean) => { v ? toolbarSM.row.onEnter() : toolbarSM.row.onLeave({ relatedTarget: null } as any); }}
            onTypeChangeRequest={(anchor) => openTypePickerFromIcon(anchor, currentTypeForPicker)}
            onRequestClosePicker={() => {
              if (buttonCloseTimeoutRef.current) {
                clearTimeout(buttonCloseTimeoutRef.current);
                buttonCloseTimeoutRef.current = null;
              }
              toolbarSM.picker.close();
            }}
            buttonCloseTimeoutRef={buttonCloseTimeoutRef}
            overlayRef={overlayRef}
          />
        )}
      </div>

      <NodeRowIntellisense
        showIntellisense={showIntellisense}
        isEditing={isEditing}
        nodeOverlayPosition={nodeOverlayPosition}
        intellisenseQuery={intellisenseQuery}
        inputRef={inputRef}
        handleIntellisenseSelect={handleIntellisenseSelect}
        handleIntellisenseClose={handleIntellisenseClose}
        allowCreatePicker={false}
        onCreateFactoryTask={onCreateFactoryTask} // ✅ RINOMINATO: onCreateAgentAct → onCreateFactoryTask
        onCreateBackendCall={onCreateBackendCall}
        onCreateTask={onCreateTask}
      />

      {toolbarSM.showPicker && pickerPosition && createPortal(
        <>
          <FontProvider>
            <RowTypePickerToolbar
              left={pickerPosition.left}
              top={pickerPosition.top}
              onPick={(key) => handlePickType(key)}
              rootRef={typeToolbarRef}
              currentType={pickerCurrentType}
              onRequestClose={() => toolbarSM.picker.close()}
              buttonCloseTimeoutRef={buttonCloseTimeoutRef}
            />
          </FontProvider>
        </>, document.body
      )}

    </>
  );
};

export const NodeRow = React.forwardRef(NodeRowInner);
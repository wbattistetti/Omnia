import React, { useState, useEffect, useLayoutEffect, useRef, useCallback } from 'react';
import { useProjectData } from '../../../../context/ProjectDataContext';
import { useDDTManager } from '../../../../context/DDTManagerContext';
import { ProjectDataService } from '../../../../services/ProjectDataService';
import { EntityCreationService } from '../../../../services/EntityCreationService';
import { createAndAttachAct } from '../../../../services/ActFactory';
import { useActEditor } from '../../../ActEditor/EditorHost/ActEditorContext';
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
import { getAgentActVisualsByType, findAgentAct, resolveActMode, resolveActType, hasActDDT } from '../../utils/actVisuals';
import { inferActType, heuristicToInternal } from '../../../../nlp/actType';
import { modeToType, typeToMode } from '../../../../utils/normalizers';
import { idMappingService } from '../../../../services/IdMappingService';
import { generateId } from '../../../../utils/idGenerator';
import { taskRepository } from '../../../../services/TaskRepository';
import { useRowExecutionHighlight } from '../../executionHighlight/useExecutionHighlight';
import { getTaskIdFromRow, updateRowTaskAction, createRowWithTask } from '../../../../utils/taskHelpers';

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
    onCreateAgentAct,
    onCreateBackendCall,
    onCreateTask,
    getProjectId
  }: NodeRowProps,
  ref
) => {
  const { data: projectDataCtx } = useProjectData();
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
  const { openDDT } = useDDTManager();
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
    if (forceEditing) setIsEditing(true);
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
      onEditingEnd();
    }
  }, [isEditing, hasEverBeenEditing]);

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
        onEditingEnd();
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
        const instanceId = (row as any)?.instanceId || row.id;
        const baseActId = (row as any)?.actId || (row as any)?.baseActId || 'Message';

        console.log('[Message][SAVE][START]', {
          rowId: row.id,
          rowInstanceId: (row as any)?.instanceId,
          finalInstanceId: instanceId,
          baseActId,
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
          console.log('[Message][SAVE][CREATE_IN_MEMORY]', { instanceId, baseActId });
          const projectId = getProjectId?.() || undefined;

          // FASE 4: Create Task if row doesn't have taskId
          if (!row.taskId) {
            // Create Task for this row
            const newTask = createRowWithTask(instanceId, baseActId, label, projectId);
            // Update row to include taskId (will be persisted via onUpdate)
            (row as any).taskId = newTask.taskId;
          } else {
            // Row already has Task, update it
            taskRepository.updateTaskValue(row.taskId, { text: label }, projectId);
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
            oldText: task.value?.text?.substring(0, 50) || 'N/A',
            newText: label.substring(0, 50)
          });

          // FASE 4: Update Task (TaskRepository internally updates InstanceRepository)
          const taskId = getTaskIdFromRow(row);
          taskRepository.updateTaskValue(taskId, { text: label }, getProjectId?.() || undefined);
        }

        // FASE 4: Verifica dopo l'aggiornamento
        const taskAfter = taskRepository.getTask(instanceId);
        console.log('[Message][SAVE][MEMORY_AFTER_UPDATE]', {
          instanceId,
          taskExists: !!taskAfter,
          messageText: taskAfter?.value?.text?.substring(0, 50) || 'N/A'
        });

        // Passa mode e baseActId per permettere la creazione corretta se l'istanza non esiste nel DB
        // Questo è cruciale: se l'istanza non esiste, il backend la crea con questi valori
        const payload = {
          message: { text: label },
          mode: 'Message', // Esplicito: mode Message per evitare default 'DataRequest'
          baseActId: baseActId // baseActId corretto invece di 'Unknown'
        };

        console.log('[Message][SAVE][DB_PAYLOAD]', {
          instanceId,
          projectId: pid,
          payload: {
            message: { text: label.substring(0, 50) + '...' },
            mode: payload.mode,
            baseActId: payload.baseActId
          }
        });

        void ProjectDataService.updateInstance(pid, instanceId, payload)
          .then((result) => {
            console.log('[Message][SAVE][DB_SUCCESS]', {
              instanceId,
              projectId: pid,
              result: result ? {
                _id: result._id,
                rowId: result.rowId,
                mode: result.mode,
                messageText: result.message?.text?.substring(0, 50) || 'N/A'
              } : null
            });
          })
          .catch((e) => {
            console.error('[Message][SAVE][DB_FAILED]', {
              instanceId,
              projectId: pid,
              error: String(e),
              stack: e?.stack?.substring(0, 200)
            });
          });
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
        onEditingEnd();
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
      // Heuristica multilingua: IT/EN/PT con fallback a UNDEFINED
      try {
        const inf = await inferActType(q, { languageOrder: ['IT', 'EN', 'PT'] as any });
        const internal = heuristicToInternal(inf.type as any);

        // Se il tipo è UNDEFINED, passa un flag speciale
        if (inf.type === 'UNDEFINED') {
          // Crea un task Message ma con flag isUndefined per mostrare icona punto interrogativo
          const projectId = getProjectId?.() || undefined;
          if (!row.taskId) {
            const task = createRowWithTask(row.id, 'Message', q, projectId);
            (row as any).taskId = task.id;
          }
          // Aggiorna la row con flag isUndefined e tipo Message per permettere cambio tipo
          const updatedRow = {
            ...row,
            text: q,
            type: 'Message' as any,
            mode: 'Message' as any,
            isUndefined: true // Flag per icona punto interrogativo
          };
          // onUpdate richiede (row, newText) - passa entrambi i parametri
          onUpdate(updatedRow as any, q);
          setIsEditing(false);
          return;
        }

        if (dbg) { }
        await handlePickType(internal);
        return;
      } catch (err) {
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
  const handlePickType = async (key: string) => {
    console.log('🎯 [HANDLE_PICK_TYPE][START]', {
      key,
      currentText,
      rowId: row.id,
      rowText: row.text,
      isEditing,
      hasOnCreateAgentAct: !!onCreateAgentAct,
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
    // In questo caso aggiorniamo solo il tipo senza creare un nuovo agent act
    if (!isEditing && onUpdateWithCategory) {
      console.log('🎯 [CHANGE_TYPE][EXISTING_ROW]', {
        rowId: row.id,
        oldType: row.categoryType,
        newType: key,
        wasUndefined: (row as any)?.isUndefined,
        timestamp: Date.now()
      });

      const finalType = key;
      const finalMode = typeToMode(key as any);

      const updateMeta = {
        id: row.id,
        type: finalType,
        mode: finalMode,
        actId: (row as any).actId,
        baseActId: (row as any).baseActId,
        factoryId: (row as any).factoryId,
        instanceId: (row as any).instanceId,
        // ✅ Rimuovi flag isUndefined quando viene selezionato un tipo
        isUndefined: false
      };

      console.log('🎯 [CHANGE_TYPE][CALLING_UPDATE]', {
        rowId: row.id,
        label: row.text,
        categoryType: 'agentActs',
        meta: updateMeta,
        isUndefinedRemoved: true
      });

      (onUpdateWithCategory as any)(row, row.text, 'agentActs', updateMeta);

      console.log('🎯 [CHANGE_TYPE][COMPLETE]', {
        rowId: row.id,
        timestamp: Date.now()
      });

      // Chiudi il picker e aggiorna lo stato del toolbar
      toolbarSM.picker.close();
      return;
    }

    // ❌ NON chiudere la riga qui: aspetta che il testo sia salvato nel callback

    // ✅ NUOVO: Crea il template agent act se onCreateAgentAct è disponibile
    // Questo permette di ritrovare la riga nell'Intellisense quando viene riutilizzata
    if (onCreateAgentAct) {
      console.log('🎯 [HANDLE_PICK_TYPE][CALLING_CREATE_AGENT_ACT]', {
        label,
        key,
        timestamp: Date.now()
      });

      try {
        // Crea il template agent act con il nome della riga e il tipo inferito
        // Il callback onRowUpdate viene chiamato immediatamente da EntityCreationService
        onCreateAgentAct(label, (createdItem: any) => {
          console.log('🎯 [TEMPLATE_CREATION][CALLBACK_START]', {
            label,
            createdItem,
            hasCreatedItem: !!createdItem,
            actId: createdItem?.actId,
            id: createdItem?.id,
            type: createdItem?.type,
            mode: createdItem?.mode,
            timestamp: Date.now()
          });

          // Callback che riceve l'item creato con actId e altri metadati
          const createdActId = createdItem?.actId || createdItem?.id;
          console.log('🎯 [TEMPLATE_CREATION] Agent act template created:', {
            label,
            actId: createdActId,
            type: createdItem?.type,
            mode: createdItem?.mode
          });

          // Aggiorna la riga con i metadati del template creato
          const instanceId = row.id;
          const projectId = getProjectId?.() || undefined;

          // Migration: Create or update Task
          if (!row.taskId) {
            // Create Task for this row
            const task = createRowWithTask(instanceId, key, '', projectId);
            (row as any).taskId = task.taskId;
          } else {
            // Update Task action
            updateRowTaskAction(row, key, projectId);
          }

          const finalType = createdItem?.type || key;
          const finalMode = createdItem?.mode || typeToMode(key as any);

          const updateMeta = {
            id: instanceId,
            type: finalType,
            mode: finalMode,
            actId: createdActId,
            baseActId: createdActId,
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
              categoryType: 'agentActs',
              meta: updateMeta
            });
            (onUpdateWithCategory as any)(row, label, 'agentActs', updateMeta);
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

    // ✅ Fallback: comportamento originale se onCreateAgentAct non è disponibile
    const immediate = (patch: any) => {
      if (onUpdateWithCategory) {
        (onUpdateWithCategory as any)(row, label, 'agentActs', patch);
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
    if (!row.taskId) {
      // Create Task for this row
      const task = createRowWithTask(instanceId, key, row.text || '', projectId);
      (row as any).taskId = task.taskId;
    } else {
      // Update Task action
      updateRowTaskAction(row, key, projectId);
    }
    console.log('🎯 [INSTANCE_CREATION] Instance/Task created successfully', {
      projectId: projectId || 'N/A',
      taskId: row.taskId
    });

    console.log('🎯 [INSTANCE_CREATION] Row will be updated with ID:', instanceId);

    // ✅ Simple row update without createAndAttachAct - ELIMINATED!
    const mode = typeToMode(key as any);
    console.log('🎯 [DIRECT_UPDATE] Updating row directly:', {
      id: instanceId,
      type: key,
      mode
    });

    immediate({
      id: instanceId,
      type: key,
      mode,
      actId: key, // Use type as actId for now
      baseActId: key
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
        actId: item.actId,
        factoryId: item.factoryId,
        type: (item as any)?.type,
        mode: (item as any)?.mode,
        userActs: item.userActs,
        categoryType: item.categoryType,
        baseActId: item.actId
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
      try { pid = ((require('../../state/runtime') as any).getCurrentProjectId?.() || undefined); } catch { }

      console.log('[🔍 ROW_CREATION] Item details:', {
        pid,
        itemActId: item.actId,
        itemCategoryType: item.categoryType,
        hasActId: !!item.actId,
        hasCategoryType: item.categoryType === 'agentActs',
        willCreateInstance: pid && item.actId && item.categoryType === 'agentActs'
      });

      let backendInstanceId: string | undefined = undefined;
      if (pid && item.actId && item.categoryType === 'agentActs') {
        // Avoid require in browser; import mapping helpers at top-level
        const chosenType = (item as any)?.type || modeToType((item as any)?.mode);
        const modeFromType = typeToMode(chosenType);
        const inst = await ProjectDataService.createInstance(pid, { baseActId: item.actId, mode: (item as any)?.mode || (modeFromType as any) });

        console.log('[🔍 INTELLISENSE] ProjectDataService.createInstance result', {
          success: !!inst,
          instance: inst,
          backendId: inst?._id,
          hasActId: !!item.actId,
          timestamp: Date.now()
        });

        if (inst && (onUpdateWithCategory as any)) {
          // Usa il mapping service per convertire l'ID backend in UUID frontend
          const frontendInstanceId = idMappingService.mapBackendToFrontend(inst._id);
          backendInstanceId = frontendInstanceId;

          console.log('[🔍 INTELLISENSE] ID Mapping result', {
            backendId: inst._id,
            frontendId: frontendInstanceId,
            timestamp: Date.now()
          });

          (onUpdateWithCategory as any)(row, item.name, item.categoryType, {
            instanceId: frontendInstanceId,
            baseActId: item.actId,
            type: chosenType,
            mode: (item as any)?.mode || modeFromType
          });
        } else {
          console.log('[⚠️ INTELLISENSE] createInstance failed or returned null', {
            pid,
            itemActId: item.actId,
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
      // FASE 4: Get row type from Task (since we removed it from NodeRowData)
      const rowTask = taskRepository.getTask(row.id);
      // Map action back to actId (reverse mapping)
      const actionToActId: Record<string, string> = {
        'SayMessage': 'Message',
        'GetData': 'DataRequest',
        'ClassifyProblem': 'ProblemClassification',
        'callBackend': 'BackendCall'
      };
      const rowType = rowTask?.action ? (actionToActId[rowTask.action] || rowTask.action) : undefined;

      const isProblemClassification = itemCategoryType === 'agentActs' &&
        (itemType === 'ProblemClassification' || rowType === 'ProblemClassification');

      console.log('[🔍 INTELLISENSE] Checking if should create instance', {
        isProblemClassification,
        itemCategoryType,
        itemType,
        rowType,
        rowInstanceId: row.id, // row.id IS the instanceId now
        itemActId: item.actId,
        categoryMatch: itemCategoryType === 'agentActs',
        typeMatch: itemType === 'ProblemClassification' || rowType === 'ProblemClassification',
        timestamp: Date.now()
      });

      if (isProblemClassification) {
        // Use row.id as instanceId (they are the same now)
        const instanceIdToUse = row.id || (await import('uuid')).v4();
        const actIdToUse = item.actId || 'problem-classification-fallback';

        console.log('[🔍 INTELLISENSE] Creating instance in InstanceRepository', {
          rowId: row.id,
          instanceId: instanceIdToUse,
          actId: actIdToUse,
          hadExistingInstanceId: !!row.id, // row.id IS the instanceId now
          timestamp: Date.now()
        });

        // TaskRepository handles all task operations

        // Try to find the template act to get intents
        let initialIntents: any[] = [];
        try {
          if (projectDataCtx) {
            const { findAgentAct } = await import('../../utils/actVisuals');
            const templateAct = findAgentAct(projectDataCtx, { actId: actIdToUse });
            if (templateAct?.problem?.intents) {
              initialIntents = templateAct.problem.intents;
            }
          }
        } catch (err) {
          console.warn('[🔍 INTELLISENSE] Could not load template intents:', err);
        }

        // Create instance with intents
        const instanceId = row.id || generateId(); // Use row.id if available, otherwise generate
        const projectId = getProjectId?.() || undefined;

        // Migration: Create or update Task
        if (!row.taskId) {
          // Create Task for this row (dual mode)
          const task = createRowWithTask(instanceId, actIdToUse, row.text || '', projectId);
          // FASE 4: Update Task with intents if ProblemClassification
          if (initialIntents.length > 0) {
            taskRepository.updateTaskValue(task.id, { intents: initialIntents }, projectId);
          }
          (row as any).taskId = task.id;
        } else {
          // Update Task action
          updateRowTaskAction(row, actIdToUse, projectId);
        }

        console.log('[✅ INTELLISENSE] Instance/Task created in repository', {
          instanceId: instanceId,
          taskId: row.taskId,
          actId: actIdToUse,
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
            actId: actIdToUse,
            baseActId: actIdToUse,
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
  const [pickerCurrentType, setPickerCurrentType] = useState<string | undefined>(undefined);
  const [pickerPosition, setPickerPosition] = useState<{ left: number; top: number } | null>(null);

  const openTypePickerFromIcon = (anchor?: DOMRect, currentType?: string) => {
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

  // Drag & Drop personalizzato
  const handleMouseDown = (e: React.MouseEvent) => {
    // Preveni il drag nativo
    e.preventDefault();
    e.stopPropagation();

    // Avvia il drag personalizzato
    if (onDragStart) {
      onDragStart(row.id, index, e.clientX, e.clientY, nodeContainerRef.current as HTMLElement);
    }
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
  const taskId = getTaskIdFromRow(row);
  const rowHighlight = useRowExecutionHighlight(row.id, taskId);

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
  const { data: projectData } = useProjectData();
  let resolvedCategoryType: string | undefined = (row as any).categoryType;
  let actFound: any = null;
  if ((row as any).actId || (row as any).baseActId || (row as any).factoryId) {
    actFound = findAgentAct(projectData, row);
    if (actFound) resolvedCategoryType = 'agentActs';
  }

  const isAgentAct = resolvedCategoryType === 'agentActs';

  let Icon: React.ComponentType<any> | null = null;
  let currentTypeForPicker: string | undefined = undefined;

  // Check if this is an undefined node (no heuristic match found)
  const isUndefined = (row as any)?.isUndefined === true;

  if (isAgentAct) {
    const typeResolved = resolveActType(row as any, actFound) as any;
    currentTypeForPicker = typeResolved;
    const has = hasActDDT(row as any, actFound);

    const visuals = getAgentActVisualsByType(typeResolved, has);
    // Se è undefined, usa icona punto interrogativo invece dell'icona normale
    Icon = isUndefined ? HelpCircle : visuals.Icon;
    labelTextColor = isUndefined ? '#94a3b8' : visuals.labelColor; // Label: grigio se undefined, altrimenti colore del tipo
    iconColor = isUndefined ? '#94a3b8' : visuals.iconColor; // Icona: sempre grigio se undefined
  } else {
    // Since we removed categoryType and userActs from NodeRowData, use defaults
    labelTextColor = (typeof propTextColor === 'string' ? propTextColor : '#111');
    if (!labelTextColor) {
      const colorObj = getLabelColor('', []);
      labelTextColor = colorObj.text;
    }
    // Se è undefined, mostra icona punto interrogativo
    // NON impostare currentTypeForPicker per undefined, così nessuna voce sarà selezionata nel picker
    if (isUndefined) {
      Icon = HelpCircle;
      labelTextColor = '#94a3b8'; // Grigio per undefined
      iconColor = '#94a3b8';
      // Lascia currentTypeForPicker undefined così il picker non mostra nessuna voce selezionata
      // Il picker funzionerà comunque per permettere cambio tipo
    } else {
      Icon = null;
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
  const actEditorCtx = useActEditor();


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
            hasDDT={isUndefined ? false : hasActDDT(row as any, actFound)} // Se undefined, non mostrare DDT gear
            gearColor={isUndefined ? '#94a3b8' : labelTextColor} // Se undefined, gear grigio
            onOpenDDT={async () => {
              try {
                // Open ActEditorHost (envelope) which routes to the correct sub-editor by ActType
                const baseId = (row as any).baseActId || (row as any).actId || (row as any).factoryId || row.id;
                const type = resolveActType(row as any, actFound) as any;

                // Host present → open deterministically
                actEditorCtx.open({ id: String(baseId), type, label: row.text, instanceId: row.id });
                return;
              } catch (e) {
                console.error('[NodeRow][onOpenDDT] Failed to open editor', {
                  error: e,
                  rowId: row.id,
                  rowText: row.text,
                  timestamp: Date.now()
                });
              }
            }}
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
        onCreateAgentAct={onCreateAgentAct}
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
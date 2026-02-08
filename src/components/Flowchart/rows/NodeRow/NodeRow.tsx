import React, { useState, useEffect, useLayoutEffect, useRef, useCallback } from 'react';
import { useProjectData } from '@context/ProjectDataContext';
import { useTaskTreeManager } from '@context/DDTManagerContext';
import { useTaskTreeContext } from '@context/DDTContext';
import { EntityCreationService } from '@services/EntityCreationService';
import { useTaskEditor } from '@taskEditor/EditorHost/TaskEditorContext';
import { emitSidebarRefresh } from '@ui/events';
import { createPortal } from 'react-dom';
import { useReactFlow } from 'reactflow';
import { SIDEBAR_TYPE_ICONS, getSidebarIconComponent, SIDEBAR_ICON_COMPONENTS } from '@components/Sidebar/sidebarTheme';
import { HelpCircle } from 'lucide-react';
import { IntellisenseItem } from '@components/Intellisense/IntellisenseTypes';
import { getLabelColor } from '@utils/labelColor';
import { NodeRowEditor } from '@components/Flowchart/NodeRowEditor';
import { NodeRowProps } from '@types/NodeRowTypes';
import { SIDEBAR_TYPE_COLORS } from '@components/Sidebar/sidebarTheme';
import { NodeRowLabel } from './NodeRowLabel';
import { NodeRowIntellisense } from './NodeRowIntellisense';
import { RowTypePickerToolbar } from './RowTypePickerToolbar';
import { FontProvider } from '@context/FontContext';
import { useRowToolbar } from '@components/Flowchart/hooks/useRowToolbar';
import { useRowState } from './hooks/useRowState';
import { useIntellisensePosition } from './hooks/useIntellisensePosition';
import { useRowRegistry } from './hooks/useRowRegistry';
import { useNodeRowEventHandlers } from './hooks/useNodeRowEventHandlers';
import { isInsideWithPadding, getToolbarRect } from './utils/geometry';
import { getTaskVisualsByType, getTaskVisuals, resolveTaskType, hasTaskTree } from '@components/Flowchart/utils/taskVisuals';
import { TaskType, taskTypeToTemplateId, taskIdToTaskType } from '@types/taskTypes';
import getIconComponent from '@responseEditor/icons';
import { ensureHexColor } from '@responseEditor/utils/color';
import { idMappingService } from '@services/IdMappingService';
import { generateId } from '@utils/idGenerator';
import { taskRepository } from '@services/TaskRepository';
import { useRowExecutionHighlight } from '@components/Flowchart/executionHighlight/useExecutionHighlight';
import { getTaskIdFromRow, updateRowTaskType, createRowWithTask, getTemplateId } from '@utils/taskHelpers';
import { TaskTreeOpener } from './application/TaskTreeOpener';
import { RowSaveHandler } from './application/RowSaveHandler';
import { RowHeuristicsHandler } from './application/RowHeuristicsHandler';
import { IntellisenseSelectionHandler } from './application/IntellisenseSelectionHandler';
import { RowTypeHandler } from './application/RowTypeHandler';
import { FactoryTaskCreator } from './application/FactoryTaskCreator';

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

  // ✅ REFACTOR: Extract event handlers to custom hook
  const {
    handleSave,
    handleCancel,
    handleKeyDownInternal,
    handleTextChange,
    handlePickType,
    handleIntellisenseSelect,
    handleIntellisenseClose,
    handleDoubleClick,
    enterEditing,
  } = useNodeRowEventHandlers({
    row,
    currentText,
    setCurrentText,
    isEditing,
    setIsEditing,
    showIntellisense,
    setShowIntellisense,
    intellisenseQuery,
    setIntellisenseQuery,
    setShowCreatePicker,
    setAllowCreatePicker,
    setPickerPosition,
    setPickerCurrentType,
    setShowIcons,
    suppressIntellisenseRef,
    intellisenseTimerRef,
    inputRef,
    labelRef,
    projectData: projectDataCtx,
    onUpdate,
    onUpdateWithCategory,
    onDelete,
    onKeyDown,
    onEditingEnd,
    onCreateFactoryTask,
    getProjectId,
    toolbarSM,
  });

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

  // ✅ All event handlers are now extracted to useNodeRowEventHandlers hook (see above)
  // Note: openTypePickerFromIcon and handleMouseDown remain in component due to complex event listener logic

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
              // ✅ REFACTOR: Use TaskTreeOpener service
              const taskType = resolveTaskType(row);
              if (taskType === TaskType.UtteranceInterpretation) {
                // ✅ Sempre permesso per DataRequest, anche se isUndefined o !hasTaskTree
                return async () => {
                  try {
                    const opener = new TaskTreeOpener({
                      taskEditorCtx,
                      getProjectId,
                      row,
                    });
                    await opener.open();
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
                  const opener = new TaskTreeOpener({
                    taskEditorCtx,
                    getProjectId,
                    row,
                  });
                  await opener.open();
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
        onCreateFactoryTask={onCreateFactoryTask}
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
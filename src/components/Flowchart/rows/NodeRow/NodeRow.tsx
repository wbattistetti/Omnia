import React, { useState, useEffect, useRef } from 'react';
import { useProjectData } from '../../../../context/ProjectDataContext';
import { useDDTManager } from '../../../../context/DDTManagerContext';
import { ProjectDataService } from '../../../../services/ProjectDataService';
import { EntityCreationService } from '../../../../services/EntityCreationService';
import { createAndAttachAct } from '../../../../services/ActFactory';
import { useActEditor } from '../../../ActEditor/EditorHost/ActEditorContext';
import { emitSidebarRefresh } from '../../../../ui/events';
import { createPortal } from 'react-dom';
import { useReactFlow } from 'reactflow';
import { SIDEBAR_TYPE_ICONS, getSidebarIconComponent } from '../../../Sidebar/sidebarTheme';
import { IntellisenseItem } from '../../../Intellisense/IntellisenseTypes';
import { getLabelColor } from '../../../../utils/labelColor';
import { NodeRowEditor } from '../../NodeRowEditor';
import { NodeRowProps } from '../../../../types/NodeRowTypes';
import { SIDEBAR_TYPE_COLORS } from '../../../Sidebar/sidebarTheme';
import { NodeRowLabel } from './NodeRowLabel';
import { NodeRowIntellisense } from './NodeRowIntellisense';
import { RowTypePickerToolbar } from './RowTypePickerToolbar';
import { useRowToolbar } from '../../hooks/useRowToolbar';
import { useRowState } from './hooks/useRowState';
import { useIntellisensePosition } from './hooks/useIntellisensePosition';
import { isInsideWithPadding, getToolbarRect } from './utils/geometry';
import { getAgentActVisualsByType, findAgentAct, resolveActMode, resolveActType, hasActDDT } from '../../utils/actVisuals';
import { inferActType, heuristicToInternal } from '../../../../nlp/actType';
import { modeToType, typeToMode } from '../../../../utils/normalizers';
import { idMappingService } from '../../../../services/IdMappingService';
import { generateId } from '../../../../utils/idGenerator';
import { instanceRepository } from '../../../../services/InstanceRepository';

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
    typeToolbarRef, inputRef, nodeContainerRef, labelRef, overlayRef, mousePosRef
  } = rowState;

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
  useEffect(() => {
    if (showIcons && labelRef.current) {
      const labelRect = labelRef.current.getBoundingClientRect();
      const nodeEl = labelRef.current.closest('.react-flow__node') as HTMLElement | null;
      const nodeRect = nodeEl ? nodeEl.getBoundingClientRect() : labelRect;
      setIconPos({
        top: labelRect.top,
        left: nodeRect.right + 6 // 6px fuori dal bordo destro del nodo
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
      if (pid && (row as any)?.instanceId && ((row as any)?.mode === 'Message' || !(row as any)?.mode)) {
        void ProjectDataService.updateInstance(pid, (row as any).instanceId, { message: { text: label } })
          .catch((e) => { try { console.warn('[Row][save][instance:update] failed', e); } catch { } });
      }
    } catch { }
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
      // Heuristica multilingua: IT/EN/PT con fallback a Message
      try {
        const inf = inferActType(q, { languageOrder: ['IT', 'EN', 'PT'] as any });
        const internal = heuristicToInternal(inf.type as any);
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
    setShowCreatePicker(false);
    setAllowCreatePicker(false);
    setShowIntellisense(false);
    const label = (currentText || '').trim();
    if (!label) { setIsEditing(false); return; }
    const immediate = (patch: any) => {
      if (onUpdateWithCategory) {
        (onUpdateWithCategory as any)(row, label, 'agentActs', patch);
      } else {
        onUpdate(row, label);
      }
    };
    setIsEditing(false);

    // ✅ Create instance when type is determined (Intellisense or inference)
    console.log('🎯 [INSTANCE_CREATION] Creating instance for type:', key);
    const instanceId = row.id; // ✅ Use existing row ID as instance ID
    console.log('🎯 [INSTANCE_CREATION] Instance ID:', instanceId);

    instanceRepository.createInstance(key, [], instanceId);
    console.log('🎯 [INSTANCE_CREATION] Instance created successfully');

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
      // Get row type from instance repository (since we removed it from NodeRowData)
      const rowInstance = instanceRepository.getInstance(row.id);
      const rowType = rowInstance?.actId;

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

        // Import InstanceRepository
        const { instanceRepository } = await import('../../../../services/InstanceRepository');

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
        const instanceId = generateId(); // Stesso ID per riga e istanza
        instanceRepository.createInstance(actIdToUse, initialIntents, instanceId);

        console.log('[✅ INTELLISENSE] Instance created in repository', {
          instanceId: instanceId,
          actId: actIdToUse,
          intentsCount: initialIntents.length,
          timestamp: Date.now()
        });

        // Update row (row.id is already the instanceId)
        if (onUpdateWithCategory) {
          console.log('[🔍 INTELLISENSE] Updating row', {
            rowId: row.id,
            instanceId: instanceIdToUse,
            timestamp: Date.now()
          });

          (onUpdateWithCategory as any)(row, item.name, item.categoryType, {
            instanceId: instanceIdToUse,
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
    // Position menu close to icon with minimal padding to avoid right whitespace
    const finalPos = { left: rect.left, top: (rect as any).bottom } as { left: number; top: number };
    console.log('[Picker][open]', { anchor: { x: rect.left, y: rect.top, w: rect.width, h: rect.height }, currentType });
    setPickerPosition(finalPos);
    setShowIntellisense(false);
    setAllowCreatePicker(true);
    // keep toolbar visible while submenu is open
    setShowIcons(true);
    setShowCreatePicker(true);
    setPickerCurrentType(currentType);
    // close on outside click (not when moving between toolbar and picker)
    const onDocClick = (ev: MouseEvent) => {
      const target = ev.target as Node | null;
      const toolbarEl = typeToolbarRef.current as unknown as HTMLElement | null;
      const overToolbar = !!(toolbarEl && target && toolbarEl instanceof Node && toolbarEl.contains(target as Node));
      const rowEl = nodeContainerRef.current as HTMLElement | null;
      const overRow = !!(rowEl && target && target instanceof Node && rowEl.contains(target as Node));
      const overlayEl = overlayRef.current as HTMLElement | null;
      const overOverlay = !!(overlayEl && target && target instanceof Node && overlayEl.contains(target as Node));
      console.log('[Picker][docClick]', { overToolbar, overRow, overOverlay, targetTag: (ev.target as HTMLElement)?.tagName, class: (ev.target as HTMLElement)?.className });
      if (overToolbar || overRow || overOverlay) return; // clicks inside picker, row, or toolbar overlay should NOT close
      console.log('[Picker][close] docClick outside → close picker');
      setShowCreatePicker(false);
      document.removeEventListener('mousedown', onDocClick, true);
      window.removeEventListener('mousemove', onMoveCloseIfFar, true);
    };
    document.addEventListener('mousedown', onDocClick, true);

    // close when moving far from row, toolbar and menu (proximity buffer)
    const onMoveCloseIfFar = (e: MouseEvent) => {
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

  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    if (onDragStart) {
      const fromRef = (ref && 'current' in ref && ref.current) ? ref.current.getBoundingClientRect() : null;
      const fromNode = nodeContainerRef.current ? nodeContainerRef.current.getBoundingClientRect() : null;
      const fallback = (e.currentTarget as HTMLElement).getBoundingClientRect();
      const rect = fromRef || fromNode || fallback;
      onDragStart(row.id, index, e.clientX, e.clientY, rect);
    }
  };

  // Also support simple immediate reordering by dragging label vertically:
  // compute target index from cursor Y over siblings and call onMoveRow during drag; onDropRow at end.
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

  // Ghost preview while dragging
  useEffect(() => {
    if (!isBeingDragged) return;
    const ghost = document.createElement('div');
    ghost.style.position = 'fixed';
    ghost.style.pointerEvents = 'none';
    ghost.style.opacity = '0.75';
    ghost.style.zIndex = '1001';
    ghost.style.background = 'rgba(71,85,105,0.9)';
    ghost.style.color = '#fff';
    ghost.style.borderRadius = '6px';
    ghost.style.padding = '2px 6px';
    ghost.style.boxShadow = '0 4px 12px rgba(0,0,0,0.35)';
    ghost.textContent = row.text || '';
    document.body.appendChild(ghost);

    const move = (ev: MouseEvent) => {
      ghost.style.top = ev.clientY + 8 + 'px';
      ghost.style.left = ev.clientX + 8 + 'px';
    };
    document.addEventListener('mousemove', move);
    return () => {
      document.removeEventListener('mousemove', move);
      document.body.removeChild(ghost);
    };
  }, [isBeingDragged, row.text]);

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

  // Colore solo testo come in sidebar; sfondo trasparente
  let bgColor = 'transparent';
  let labelTextColor = '';

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

  if (isAgentAct) {
    const typeResolved = resolveActType(row as any, actFound) as any;
    currentTypeForPicker = typeResolved;
    const has = hasActDDT(row as any, actFound);
    // silent by default; enable only if strictly needed
    // try { if (localStorage.getItem('debug.mode')) console.log('[Type][NodeRow]', { rowId: row.id, text: row.text, type, hasDDT: has, actFound: !!actFound }); } catch {}
    const visuals = getAgentActVisualsByType(typeResolved, has);
    Icon = visuals.Icon;
    labelTextColor = visuals.color;
  } else {
    // Since we removed categoryType and userActs from NodeRowData, use defaults
    labelTextColor = (typeof propTextColor === 'string' ? propTextColor : '#111');
    if (!labelTextColor) {
      const colorObj = getLabelColor('', []);
      labelTextColor = colorObj.text;
    }
    Icon = null;
  }

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
        className={`node-row-outer flex items-center group transition-colors ${conditionalClasses}`}
        style={{ ...conditionalStyles, backgroundColor: 'transparent', border: 'none', outline: 'none', boxShadow: 'none', paddingLeft: 0, paddingRight: 0, marginTop: 0, marginBottom: 0, paddingTop: 4, paddingBottom: 4, minHeight: 0, height: 'auto', width: '100%' }}
        data-index={index}
        onMouseEnter={() => toolbarSM.row.onEnter()}
        onMouseLeave={(e) => toolbarSM.row.onLeave(e as any)}
        {...(onMouseMove ? { onMouseMove } : {})}
      >
        {isEditing ? (
          <div style={{ flex: 1, minWidth: 0 }} data-row-id={row.id}>
            <NodeRowEditor
              value={currentText}
              onChange={handleTextChange}
              onKeyDown={handleKeyDownInternal}
              inputRef={inputRef}
              placeholder="Type what you need here..."
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
            iconSize={Math.max(10, Math.min(18, Math.round(12 * getZoom())))}
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
            hasDDT={hasActDDT(row as any, actFound)}
            gearColor={labelTextColor}
            onOpenDDT={async () => {
              try {
                console.log('[DDT][open] request', { rowId: row.id, text: row.text });
              } catch { }
              try {
                // Open ActEditorHost (envelope) which routes to the correct sub-editor by ActType
                const baseId = (row as any).baseActId || (row as any).actId || (row as any).factoryId || row.id;
                const type = resolveActType(row as any, actFound) as any;
                // Host present → open deterministically
                actEditorCtx.open({ id: String(baseId), type, label: row.text, instanceId: row.id });
                console.log('[DDT][open] done', { baseId, type });
                return;
              } catch (e) { console.warn('[Row][openDDT] failed', e); }
            }}
            onDoubleClick={handleDoubleClick}
            onIconsHoverChange={(v: boolean) => { v ? toolbarSM.overlay.onEnter() : toolbarSM.overlay.onLeave(); }}
            onLabelHoverChange={(v: boolean) => { v ? toolbarSM.row.onEnter() : toolbarSM.row.onLeave({ relatedTarget: null } as any); }}
            onTypeChangeRequest={(anchor) => openTypePickerFromIcon(anchor, currentTypeForPicker)}
            onRequestClosePicker={() => setShowCreatePicker(false)}
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
          <RowTypePickerToolbar
            left={pickerPosition.left}
            top={pickerPosition.top}
            onPick={(key) => handlePickType(key)}
            rootRef={typeToolbarRef}
            currentType={pickerCurrentType}
            onRequestClose={() => setShowCreatePicker(false)}
          />
        </>, document.body
      )}
    </>
  );
};

export const NodeRow = React.forwardRef(NodeRowInner);
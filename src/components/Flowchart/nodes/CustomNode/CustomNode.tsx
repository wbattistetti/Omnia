import React, { useState, useRef, useEffect, useMemo } from 'react';
import { typeToMode } from '../../../../utils/normalizers';
import { NodeProps } from 'reactflow';
import { NodeHeader } from './NodeHeader';
import { NodeDragHeader } from '../shared/NodeDragHeader';
import { NodeHandles } from '../../NodeHandles';
import { IntellisenseMenu } from '../../../Intellisense/IntellisenseMenu';
import { IntellisenseItem } from '../../../Intellisense/IntellisenseTypes';
import { NodeRowData, EntityType } from '../../../../types/project';
import { useNodeRowDrag } from '../../../../hooks/useNodeRowDrag';
import { NodeRowList } from '../../rows/shared/NodeRowList';
import { useNodeState } from './hooks/useNodeState';
import { useNodeEventHandlers } from './hooks/useNodeEventHandlers';
import { useNodeInitialization } from './hooks/useNodeInitialization';
import { useNodeRowManagement } from './hooks/useNodeRowManagement';
import { useNodeIntellisense } from './hooks/useNodeIntellisense';
import { useRegisterAsNode } from '../../../../context/NodeRegistryContext';

// (Helper functions moved to useNodeInitialization hook)

/**
 * Dati custom per un nodo del flowchart
 * @property title - titolo del nodo
 * @property rows - array di righe (azioni/step)
 * @property isTemporary - true se nodo temporaneo
 * @property onDelete - callback per eliminare il nodo
 * @property onUpdate - callback per aggiornare i dati del nodo
 */
export interface CustomNodeData {
  title: string;
  rows: NodeRowData[];
  isTemporary?: boolean;
  onDelete?: () => void;
  onUpdate?: (updates: any) => void;
  onPlayNode?: (nodeId: string) => void; // nuova prop opzionale
  hidden?: boolean; // render invisibile finché non riposizionato
  focusRowId?: string; // row da mettere in edit al mount
  hideUncheckedRows?: boolean; // nasconde le righe non incluse
  onCreateAgentAct?: (name: string, onRowUpdate?: (item: any) => void, scope?: 'global' | 'industry', categoryName?: string) => void;
  onCreateBackendCall?: (name: string, onRowUpdate?: (item: any) => void, scope?: 'global' | 'industry', categoryName?: string) => void;
  onCreateTask?: (name: string, onRowUpdate?: (item: any) => void, scope?: 'global' | 'industry', categoryName?: string) => void;
}

export const CustomNode: React.FC<NodeProps<CustomNodeData>> = ({
  id,
  data,
  isConnectable,
  selected
}) => {
  // ✅ REGISTRY: Register node with NodeRegistry
  const nodeRegistryRef = useRegisterAsNode(id);

  // ✅ INITIALIZATION: Initialize node data and rows
  const { displayRows, normalizedData } = useNodeInitialization(id, data);

  // ✅ ROW MANAGEMENT: Manage all row operations
  const rowManagement = useNodeRowManagement({ nodeId: id, normalizedData, displayRows });
  const {
    nodeRows, setNodeRows,
    editingRowId, setEditingRowId,
    isEmpty, setIsEmpty,
    handleUpdateRow, handleDeleteRow, handleInsertRow,
    handleExitEditing, validateRows, computeIsEmpty,
    makeRowId, inAutoAppend, beginAutoAppendGuard
  } = rowManagement;

  // ✅ INTELLISENSE: Manage intellisense functionality
  const intellisense = useNodeIntellisense({
    nodeRows,
    setNodeRows,
    editingRowId,
    normalizedData
  });
  const {
    showIntellisense, intellisensePosition,
    handleIntellisenseSelectItem, openIntellisense, closeIntellisense
  } = intellisense;

  // Extract all state management to custom hook
  const nodeState = useNodeState({ data: normalizedData });
  const {
    isEditingNode, setIsEditingNode,
    nodeTitle, setNodeTitle,
    isHoveredNode, setIsHoveredNode,
    isHoverHeader, setIsHoverHeader,
    isDragging, setIsDragging,
    isToolbarDrag, setIsToolbarDrag,
    nodeBufferRect, setNodeBufferRect,
    hideToolbarTimeoutRef,
    hasTitle, showPermanentHeader, showDragHeader
  } = nodeState;

  // Extract all event handlers to custom hook
  const handlers = useNodeEventHandlers({
    data: normalizedData,
    nodeTitle,
    setNodeTitle,
    setIsEditingNode,
    setIsHoverHeader,
    hideToolbarTimeoutRef,
    setIsHoveredNode
  });
  const {
    handleEndTitleEditing,
    handleTitleUpdate,
    handleDeleteNode,
    handleNodeMouseEnter,
    handleNodeMouseLeave,
    handleBufferMouseEnter,
    handleBufferMouseLeave
  } = handlers;

  // Se l'header viene nascosto, azzera sempre lo stato hover header
  useEffect(() => { if (!showPermanentHeader) setIsHoverHeader(false); }, [showPermanentHeader]);
  useEffect(() => {
    // debug removed
  }, [showPermanentHeader, hasTitle, isHoveredNode, isEditingNode, id]);

  // Calcola area estesa per toolbar nodo (include nodo + toolbar + padding)
  useEffect(() => {
    const shouldShowToolbar = (isHoveredNode || selected) && !isEditingNode;


    if (shouldShowToolbar && rootRef.current) {
      const updateRect = () => {
        if (!rootRef.current) return;
        const nodeRect = rootRef.current.getBoundingClientRect();
        // Toolbar sopra nodo: marginBottom 8px, altezza ~18-20px
        const toolbarHeight = 20;
        const toolbarMargin = 8;
        const padding = 7;

        // Area sopra il nodo per hover: stessa larghezza del nodo, altezza toolbar
        setNodeBufferRect({
          top: nodeRect.top - toolbarHeight, // Sopra il nodo, altezza toolbar
          left: nodeRect.left, // Stessa posizione del nodo
          width: nodeRect.width, // Stessa larghezza del nodo
          height: toolbarHeight, // Altezza toolbar
        });
      };

      updateRect();
      // Ricalcola su resize/scroll
      window.addEventListener('resize', updateRect);
      window.addEventListener('scroll', updateRect, true);
      return () => {
        window.removeEventListener('resize', updateRect);
        window.removeEventListener('scroll', updateRect, true);
      };
    } else {
      setNodeBufferRect(null);
    }
  }, [showPermanentHeader, isHoveredNode, selected, isEditingNode]);

  // Nascondi header su click canvas se il titolo è vuoto
  useEffect(() => {
    const hideOnCanvasClick = () => {
      if (!hasTitle) {
        setIsHoveredNode(false);
      }
    };
    window.addEventListener('flow:canvas:click', hideOnCanvasClick as any);
    return () => window.removeEventListener('flow:canvas:click', hideOnCanvasClick as any);
  }, [hasTitle, id]);
  // (showIntellisense and intellisensePosition moved to useNodeIntellisense hook)

  // (makeRowId and appendEmptyRow moved to useNodeRowManagement hook)

  // (nodeRows, editingRowId moved to useNodeRowManagement hook)

  // (autoAppendGuard, inAutoAppend, beginAutoAppendGuard moved to useNodeRowManagement hook)

  // ✅ Fallback per relatedTarget null (focus programmatico) - pointerdown copre mouse+touch+pen
  const nextPointerTargetRef = useRef<EventTarget | null>(null);
  useEffect(() => {
    const onPointerDown = (e: PointerEvent) => { nextPointerTargetRef.current = e.target; };
    window.addEventListener("pointerdown", onPointerDown, { capture: true, passive: true });
    return () => window.removeEventListener("pointerdown", onPointerDown, { capture: true } as any);
  }, []);

  // ✅ Ref per il container del nodo per controllo blur interno
  const nodeContainerRef = useRef<HTMLDivElement>(null);

  // (isEmpty, computeIsEmpty moved to useNodeRowManagement hook)

  // ✅ CORREZIONE 2: Evita isNewNode stale - usa stato corrente invece di flag globale

  // Funzione per uscire dall'editing con pulizia righe non valide
  const exitEditing = (nativeEvt?: Event | null) => {
    if (inAutoAppend()) {
      console.log('🔒 [AUTO_APPEND_GUARD] Soppresso exitEditing durante auto-append');
      return; // sopprimi durante l'auto-append
    }

    // ✅ Determina il nextTarget considerando tutti i casi
    const nextTarget =
      (nativeEvt as any)?.relatedTarget ||
      (nativeEvt as any)?.target || // per onBlur(nativeEvent)
      (nextPointerTargetRef.current as Node | null) ||
      document.activeElement;

    // ✅ Controlla se il blur è interno al nodo
    if (nextTarget && nodeContainerRef.current?.contains(nextTarget as Node)) {
      console.log('🔒 [BLUR_INTERNO] Blur interno, non uscire dall\'editing');
      nextPointerTargetRef.current = null; // Azzera dopo l'uso
      return;
    }

    // Usa la funzione del hook
    handleExitEditing();
    validateRows(nodeRows);
  };

  // ✅ Effetto per mantenere isEmpty allineato alle righe (fuori dalla finestra auto-append)
  useEffect(() => {
    if (inAutoAppend()) return; // evita transizioni spurie durante auto-append

    setIsEmpty(prev => {
      const next = computeIsEmpty(nodeRows);
      return next === prev ? prev : next;
    });
  }, [nodeRows]);

  // ✅ PATCH 1: Focus per nodi nuovi (semplificato) - NON per nodi hidden!
  useEffect(() => {
    // ✅ SKIP auto-focus solo se il nodo è hidden (per edge temporanei)
    // ✅ PERMETTI auto-focus se isTemporary ma non hidden (nodi creati con doppio click)
    if (normalizedData.hidden) {
      return;
    }

    // Se abbiamo focusRowId (nodo nuovo) e non c'è editingRowId, impostalo
    if (normalizedData.focusRowId && !editingRowId && nodeRows.length > 0) {
      const firstRow = nodeRows[0];
      if (firstRow && firstRow.text.trim() === '') {
        setEditingRowId(firstRow.id);
      }
    }
  }, [normalizedData.focusRowId, normalizedData.hidden, normalizedData.isTemporary, editingRowId, nodeRows.length, id]);

  // ✅ Rimuovi auto-editing del titolo per nodi temporanei
  // (Mantieni solo l'auto-focus sulla prima riga)

  // Stati per il drag-and-drop
  const drag = useNodeRowDrag(nodeRows);

  // ✅ PATCH 2: Rimossa variabile hasAddedNewRow non più necessaria

  // Riferimenti DOM per le righe
  // const rowRefs = useRef(new Map<string, HTMLDivElement>());

  // Stato per gestire l'inserter hover
  const [hoveredInserter, setHoveredInserter] = useState<number | null>(null);

  // Inizio stato per overlay azioni
  // const [showActions, setShowActions] = useState(false);

  // Ref al contenitore delle righe per calcoli DnD locali
  const rowsContainerRef = useRef<HTMLDivElement | null>(null);
  // ✅ CORREZIONE 4: Ref per il container root del nodo
  const rootRef = useRef<HTMLDivElement>(null);

  // Keep latest rows in a ref to update safely from DOM events
  const latestRowsRef = useRef<NodeRowData[]>(nodeRows);
  useEffect(() => { latestRowsRef.current = nodeRows; }, [nodeRows]);

  // Listen for global message text updates coming from NonInteractive editor
  useEffect(() => {
    const handler = (e: any) => {
      const d = (e && e.detail) || {};
      if (!d || !d.instanceId) return;
      const next = (latestRowsRef.current || []).map(r => (r as any)?.instanceId === d.instanceId ? { ...r, message: { ...(r as any)?.message, text: d.text } } : r);
      setNodeRows(next);
      // Schedule parent update outside render/setState to avoid warnings
      try { Promise.resolve().then(() => normalizedData.onUpdate?.({ rows: next })); } catch { }
    };
    document.addEventListener('rowMessage:update', handler as any);
    return () => document.removeEventListener('rowMessage:update', handler as any);
  }, [normalizedData.onUpdate]);

  // (handleUpdateRow moved to useNodeRowManagement hook)

  // (handleDeleteRow moved to useNodeRowManagement hook)

  // Funzioni rimosse - non più utilizzate

  // const handleIntellisenseSelect = (selectedText: string) => {
  //   if (editingRowId) {
  //     handleUpdateRow(editingRowId, selectedText);
  //   }
  //   setShowIntellisense(false);
  //   setEditingRowIdWithLog(null);
  // };

  // (handleIntellisenseSelectItem moved to useNodeIntellisense hook)

  // (handleInsertRow moved to useNodeRowManagement hook)

  // Gestione del drag-and-drop
  // Legacy drag start (kept temporarily). Prefer onMoveRow/onDropRow below.
  const handleRowDragStart = (id: string, index: number, clientX: number, clientY: number, rect: DOMRect) => {
    drag.setDraggedRowId(id);
    drag.setDraggedRowOriginalIndex(index);
    drag.setDraggedRowInitialClientX(clientX);
    drag.setDraggedRowInitialClientY(clientY);
    drag.setDraggedRowInitialRect(rect);
    drag.setDraggedRowCurrentClientX(clientX);
    drag.setDraggedRowCurrentClientY(clientY);
    drag.setHoveredRowIndex(index);
    drag.setVisualSnapOffset({ x: 0, y: 0 });

    document.body.style.cursor = 'grabbing';
    document.body.style.userSelect = 'none';

    window.addEventListener('pointermove', handleGlobalMouseMove as any, { capture: true });
    window.addEventListener('pointerup', handleGlobalMouseUp as any, { capture: true });
    window.addEventListener('mousemove', handleGlobalMouseMove as any, { capture: true });
    window.addEventListener('mouseup', handleGlobalMouseUp as any, { capture: true });
  };

  // React-DnD-like simple move API used by NodeRow when dragging label
  // Funzioni drag-and-drop rimosse - gestite dal hook useNodeRowDrag

  const handleGlobalMouseMove = (event: MouseEvent | PointerEvent) => {
    if (!drag.draggedRowId || !drag.draggedRowInitialRect || drag.draggedRowInitialClientY === null) return;

    drag.setDraggedRowCurrentClientX(event.clientX);
    drag.setDraggedRowCurrentClientY(event.clientY);

    // Determine hovered index using actual DOM positions of this node only
    let newHoveredIndex = drag.draggedRowOriginalIndex || 0;
    const scope = rowsContainerRef.current || document;
    const elements = Array.from(scope.querySelectorAll('.node-row-outer')) as HTMLElement[];
    const rects = elements.map((el) => ({ idx: Number(el.dataset.index), top: el.getBoundingClientRect().top, height: el.getBoundingClientRect().height }));
    const centerY = event.clientY;
    for (const r of rects) {
      if (centerY < r.top + r.height / 2) { newHoveredIndex = r.idx; break; }
      newHoveredIndex = r.idx + 1;
    }

    if (newHoveredIndex !== drag.hoveredRowIndex) {
      drag.setHoveredRowIndex(newHoveredIndex);
      // Snap offset for visual feedback
      const rowHeight = 40; // approx
      const targetY = drag.draggedRowInitialRect.top + (newHoveredIndex * rowHeight);
      const currentMouseBasedY = drag.draggedRowInitialRect.top + (event.clientY - drag.draggedRowInitialClientY);
      const snapOffsetY = targetY - currentMouseBasedY;
      drag.setVisualSnapOffset({ x: 0, y: snapOffsetY });
    }
  };

  const handleGlobalMouseUp = () => {
    const hasOriginal = drag.draggedRowOriginalIndex !== null;
    let targetIndex = drag.hoveredRowIndex;
    // Fallback: if no hovered index, infer from total delta in pixels
    if (hasOriginal && (targetIndex === null || targetIndex === undefined)) {
      const scope = rowsContainerRef.current || document;
      const elements = Array.from(scope.querySelectorAll('.node-row-outer')) as HTMLElement[];
      const rects = elements.map((el) => ({ idx: Number(el.dataset.index), top: el.getBoundingClientRect().top, height: el.getBoundingClientRect().height }));
      const centerY = (drag.draggedRowCurrentClientY ?? drag.draggedRowInitialClientY) as number;
      let inferred = drag.draggedRowOriginalIndex as number;
      for (const r of rects) { if (centerY < r.top + r.height / 2) { inferred = r.idx; break; } inferred = r.idx + 1; }
      targetIndex = Math.max(0, Math.min(nodeRows.length - 1, inferred));
    }
    if (hasOriginal && targetIndex !== null && (drag.draggedRowOriginalIndex as number) !== targetIndex) {
      const updatedRows = [...nodeRows];
      const draggedRow = updatedRows[drag.draggedRowOriginalIndex as number];
      updatedRows.splice(drag.draggedRowOriginalIndex as number, 1);
      updatedRows.splice(targetIndex as number, 0, draggedRow);
      setNodeRows(updatedRows);
      if (data.onUpdate) data.onUpdate({ rows: updatedRows });
    }

    // Reset stati
    drag.setDraggedRowId(null);
    drag.setDraggedRowOriginalIndex(null);
    drag.setDraggedRowInitialClientX(null);
    drag.setDraggedRowInitialClientY(null);
    drag.setDraggedRowInitialRect(null);
    drag.setDraggedRowCurrentClientX(null);
    drag.setDraggedRowCurrentClientY(null);
    drag.setHoveredRowIndex(null);
    drag.setVisualSnapOffset({ x: 0, y: 0 });

    document.body.style.cursor = '';
    document.body.style.userSelect = '';

    window.removeEventListener('pointermove', handleGlobalMouseMove as any);
    window.removeEventListener('pointerup', handleGlobalMouseUp as any);
    window.removeEventListener('mousemove', handleGlobalMouseMove as any);
    window.removeEventListener('mouseup', handleGlobalMouseUp as any);
  };

  // Cleanup dei listener quando il componente si smonta
  useEffect(() => {
    return () => {
      document.removeEventListener('mousemove', handleGlobalMouseMove);
      document.removeEventListener('mouseup', handleGlobalMouseUp);
    };
  }, []);

  // ✅ PATCH 2: Rimosso useEffect problematico che generava loop di instabilità
  // La gestione delle righe vuote è ora gestita direttamente in handleUpdateRow


  // ✅ PATCH 3: Canvas click semplificato - solo exit editing, niente cancellazione automatica
  useEffect(() => {
    const onCanvasClick = () => {
      console.log("🎯 [CANVAS_CLICK] Canvas click detected", {
        nodeId: id,
        isTemporary: data.isTemporary,
        nodeRowsCount: nodeRows.length,
        timestamp: Date.now()
      });

      // Esci dall'editing e stabilizza il nodo se è temporaneo
      exitEditing();
      if (data.isTemporary) {
        console.log("🔧 [CANVAS_CLICK] Stabilizing temporary node", {
          nodeId: id,
          originalRowsCount: nodeRows.length
        });

        // Filtra via tutte le righe vuote/non stabilizzate
        const stabilizedRows = nodeRows.filter(row => row.text && row.text.trim().length > 0);
        if (stabilizedRows.length > 0) {
          console.log("🔧 [STABILIZE] Stabilizing temporary node", {
            nodeId: id,
            stabilizedRowsCount: stabilizedRows.length,
            updates: { rows: stabilizedRows, isTemporary: false, hidden: false },
            timestamp: Date.now()
          });

          // Delay stabilization to avoid conflicts with node creation lock
          setTimeout(() => {
            setNodeRows(stabilizedRows);
            data.onUpdate?.({ rows: stabilizedRows, isTemporary: false, hidden: false });
          }, 100);
        } else {
          console.log("🗑️ [STABILIZE] No valid rows, deleting node", {
            nodeId: id
          });
          data.onDelete?.();
        }
      }
    };

    window.addEventListener('flow:canvas:click', onCanvasClick as any);
    return () => window.removeEventListener('flow:canvas:click', onCanvasClick as any);
  }, [editingRowId, id, nodeRows, normalizedData]);

  // Crea l'array di visualizzazione per il feedback visivo
  const visibleRows = useMemo(() => nodeRows, [nodeRows]);

  // Trova la riga trascinata per il rendering separato
  const draggedItem = drag.draggedRowId ? nodeRows.find(row => row.id === drag.draggedRowId) : null;

  // Calcola lo stile per la riga trascinata
  const draggedRowStyle = useMemo(() => {
    if (!draggedItem || !drag.draggedRowInitialRect || drag.draggedRowInitialClientX === null ||
      drag.draggedRowInitialClientY === null || drag.draggedRowCurrentClientX === null ||
      drag.draggedRowCurrentClientY === null) {
      return {};
    }

    return {
      top: drag.draggedRowInitialRect.top + (drag.draggedRowCurrentClientY - drag.draggedRowInitialClientY) + drag.visualSnapOffset.y,
      left: drag.draggedRowInitialRect.left + (drag.draggedRowCurrentClientX - drag.draggedRowInitialClientX) + drag.visualSnapOffset.x,
      width: drag.draggedRowInitialRect.width
    };
  }, [draggedItem, drag.draggedRowInitialRect, drag.draggedRowInitialClientX, drag.draggedRowInitialClientY,
    drag.draggedRowCurrentClientX, drag.draggedRowCurrentClientY, drag.visualSnapOffset]);

  // ✅ RIMOSSO: I nodi temporanei ora sono visibili e funzionanti

  // Do NOT auto-append an extra row at mount; start with a single textarea only.


  return (
    <div style={{ position: 'relative', display: 'inline-block' }}>
      {/* Area hover gestita dalla toolbar fullWidth */}

      <div
        ref={(el) => {
          // ✅ Assign to ALL three refs in a single callback
          (rootRef as any).current = el;
          (nodeRegistryRef as any).current = el;
          (nodeContainerRef as any).current = el;
        }}
        data-id={id}
        className={`bg-white border-black rounded-lg shadow-xl min-h-[40px] relative ${selected ? 'border-2' : 'border'}`}
        style={{ opacity: data.hidden ? 0 : 1, minWidth: 140, width: 'fit-content', position: 'relative', zIndex: 1 }}
        tabIndex={-1}
        draggable={true}
        onDragStart={(e) => {
          console.log('🎯 [CustomNode] Drag start - Setting isDragging = true', {
            type: e.type,
            target: e.target,
            currentTarget: e.currentTarget,
            isDragging: isDragging,
            isToolbarDrag: isToolbarDrag,
            timestamp: Date.now()
          });
          setIsDragging(true);
          document.body.style.cursor = 'move';
        }}
        onDragEnd={(e) => {
          console.log('🎯 [CustomNode] Drag end - Setting isDragging = false', {
            type: e.type,
            target: e.target,
            currentTarget: e.currentTarget,
            isDragging: isDragging,
            isToolbarDrag: isToolbarDrag,
            timestamp: Date.now()
          });
          setIsDragging(false);
          setIsToolbarDrag(false);
          document.body.style.cursor = 'default';
        }}
        onMouseEnter={handleNodeMouseEnter}
        onMouseLeave={handleNodeMouseLeave}
        onMouseDownCapture={(e) => {
          // Permetti di trascinare il nodo prendendo il corpo (evita solo l'input riga)
          const t = e.target as HTMLElement;
          const isInput = t?.classList?.contains('node-row-input') || !!t?.closest?.('.node-row-input');
          if (!isInput) {
            // Non bloccare la propagazione: lascia passare a React Flow per il drag
            return;
          }
          // Se stai interagendo con l'input riga, non trascinare
          e.stopPropagation();
        }}

        onMouseUpCapture={(e) => {
          if (!editingRowId) return;
          const t = e.target as HTMLElement;
          const isInput = t?.classList?.contains('node-row-input') || !!t?.closest?.('.node-row-input');
          if (isInput) { e.stopPropagation(); }
        }}
        onFocusCapture={() => { /* no-op: lasciamo passare focus per drag header */ }}
      >
        {/* Toolbar sopra il nodo: visibile solo quando c'è header permanente + hover */}
        {/* NON ha più onMouseEnter/Leave: l'area buffer gestisce tutto */}
        {showPermanentHeader && (isHoveredNode || selected) && !isEditingNode && (
          <div
            style={{
              position: 'absolute',
              left: 0,
              right: 0,
              bottom: '100%',
              marginBottom: 0, // Appoggiata al nodo
              zIndex: 1000, // Sopra il buffer area
              pointerEvents: 'auto',
              width: '100%', // Larga quanto il nodo
              opacity: 1,
              transition: 'opacity 0.2s ease'
            }}
          >
            {console.log('🎯 [CustomNode] TOOLBAR RENDERING:', {
              showPermanentHeader,
              isHoveredNode,
              selected,
              isEditingNode,
              zIndex: 1000,
              position: 'absolute'
            })}
            <NodeDragHeader
              onEditTitle={() => setIsEditingNode(true)}
              onDelete={handleDeleteNode}
              compact={true}
              showDragHandle={false}
              fullWidth={true}
              isToolbarDrag={isToolbarDrag}
              onDragStart={() => {
                console.log('🎯 [CustomNode] onDragStart from Move button', {
                  isDragging: isDragging,
                  isToolbarDrag: isToolbarDrag
                });
                setIsDragging(true);
                setIsToolbarDrag(true);
              }}
            />
          </div>
        )}

        {/* Header permanente: DENTRO il nodo come fascia colorata in alto */}
        {showPermanentHeader && (
          <div
            onMouseEnter={() => setIsHoverHeader(true)}
            onMouseLeave={() => setIsHoverHeader(false)}
          >
            <NodeHeader
              title={nodeTitle}
              onDelete={handleDeleteNode}
              onToggleEdit={handleEndTitleEditing}
              onTitleUpdate={handleTitleUpdate}
              isEditing={isEditingNode}
              startEditingTitle={isEditingNode}
              hasUnchecked={nodeRows.some(r => r.included === false)}
              hideUnchecked={(data as any)?.hideUncheckedRows === true}
              onToggleHideUnchecked={() => {
                if (typeof data.onUpdate === 'function') {
                  data.onUpdate({ hideUncheckedRows: !(data as any)?.hideUncheckedRows });
                }
              }}
            />
          </div>
        )}

        {/* Header drag: sempre presente ma invisibile durante editing per evitare rimozione DOM */}
        <div
          style={{
            position: 'absolute',
            left: 0,
            right: 0,
            bottom: '100%',
            marginBottom: 0, // Appoggiata al nodo
            zIndex: 1000, // Sopra il buffer area
            pointerEvents: showDragHeader ? 'auto' : 'none',
            opacity: showDragHeader ? 1 : 0,
            userSelect: 'none',
            transition: 'opacity 0.2s ease',
            width: '100%' // Larga quanto il nodo
          }}
          onMouseEnter={() => {
            if (showDragHeader) {
              console.log('[🎯 DRAG HEADER] Mouse entered - DRAG AREA ACTIVE');
              setIsHoveredNode(true);
            }
          }}
          onMouseLeave={() => {
            if (showDragHeader) {
              console.log('[🎯 DRAG HEADER] Mouse left - DRAG AREA INACTIVE');
              setIsHoveredNode(false);
            }
          }}
          onMouseDown={(e) => {
            if (showDragHeader) {
              console.log('[🎯 DRAG HEADER] Mouse DOWN - DRAG ATTEMPT', {
                button: e.button,
                ctrlKey: e.ctrlKey,
                shiftKey: e.shiftKey,
                target: e.target
              });
            }
          }}
          onClick={(e) => {
            if (showDragHeader) {
              console.log('[🎯 DRAG HEADER] CLICK - should not happen if drag works');
              e.stopPropagation();
            }
          }}
        >
          <NodeDragHeader
            onEditTitle={() => setIsEditingNode(true)}
            onDelete={handleDeleteNode}
            compact={true}
            showDragHandle={true}
            fullWidth={true}
            isToolbarDrag={isToolbarDrag}
            onDragStart={() => {
              console.log('🎯 [CustomNode] onDragStart from Move button (second)', {
                isDragging: isDragging,
                isToolbarDrag: isToolbarDrag
              });
              setIsDragging(true);
              setIsToolbarDrag(true);
            }}
          />
        </div>
        <div className="px-1.5" ref={rowsContainerRef}>
          <NodeRowList
            rows={((normalizedData as any)?.hideUncheckedRows === true) ? visibleRows.filter(r => r.included !== false) : visibleRows}
            editingRowId={editingRowId}
            hoveredInserter={hoveredInserter}
            setHoveredInserter={setHoveredInserter}
            handleInsertRow={handleInsertRow}
            nodeTitle={nodeTitle}
            onUpdate={(row, newText) => handleUpdateRow(row.id, newText, row.categoryType, { included: (row as any).included })}
            onUpdateWithCategory={(row, newText, categoryType, meta) => handleUpdateRow(row.id, newText, categoryType as EntityType, { included: (row as any).included, ...(meta || {}) })}
            onDelete={(row) => handleDeleteRow(row.id)}
            onKeyDown={(e) => {
              // Non auto-aggiungere righe su Enter: la creazione avviene solo dopo scelta tipo
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                return;
              } else if (e.key === 'Escape') {
                const singleEmpty = nodeRows.length === 1 && nodeRows[0].text.trim() === '';
                singleEmpty ? data.onDelete?.() : exitEditing();
              }
            }}
            onDragStart={handleRowDragStart}
            canDelete={() => nodeRows.length > 1}
            totalRows={nodeRows.length}
            onCreateAgentAct={data.onCreateAgentAct}
            onCreateBackendCall={data.onCreateBackendCall}
            onCreateTask={data.onCreateTask}
            getProjectId={() => {
              try { return (window as any).__omniaRuntime?.getCurrentProjectId?.() || null; } catch { return null; }
            }}
            hoveredRowIndex={drag.hoveredRowIndex}
            draggedRowId={drag.draggedRowId}
            draggedRowOriginalIndex={drag.draggedRowOriginalIndex}
            draggedItem={draggedItem ?? null}
            draggedRowStyle={draggedRowStyle}
            onEditingEnd={exitEditing}
          />
          {/* Renderizza la riga trascinata separatamente */}
          {/* Do not render an extra floating NodeRow; use ghost element only to avoid layout shift */}
        </div>
        <NodeHandles isConnectable={isConnectable} />
        {/* Mock Intellisense Menu */}
        {showIntellisense && (
          <>
            {console.log("🎯 [CustomNode] ROW INTELLISENSE OPENED", {
              nodeId: id,
              isTemporary: data.isTemporary,
              hidden: data.hidden,
              editingRowId,
              timestamp: Date.now()
            })}
            <IntellisenseMenu
              isOpen={showIntellisense}
              query={editingRowId ? nodeRows.find(row => row.id === editingRowId)?.text || '' : ''}
              position={intellisensePosition}
              referenceElement={null}
              onSelect={handleIntellisenseSelectItem}
              onClose={() => {
                console.log("🎯 [CustomNode] ROW INTELLISENSE CLOSED", { nodeId: id });
                closeIntellisense();
              }}
              filterCategoryTypes={['agentActs', 'userActs', 'backendActions']}
            />
          </>
        )}
      </div>
    </div>
  );
};
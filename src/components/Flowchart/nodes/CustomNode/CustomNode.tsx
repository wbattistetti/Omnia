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
import { useNodeDragDrop } from './hooks/useNodeDragDrop';
import { useNodeRendering } from './hooks/useNodeRendering';
import { useNodeEffects } from './hooks/useNodeEffects';
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

  // Ref al contenitore delle righe per calcoli DnD locali (dichiarato prima dell'uso)
  const rowsContainerRef = useRef<HTMLDivElement | null>(null);

  // ✅ CORREZIONE 5: Ref per il container root del nodo (dichiarato prima dell'uso)
  const rootRef = useRef<HTMLDivElement>(null);

  // ✅ CORREZIONE 6: Ref per il container del nodo (dichiarato prima dell'uso)
  const nodeContainerRef = useRef<HTMLDivElement>(null);

  // ✅ DRAG & DROP: Manage row drag and drop functionality
  const dragDrop = useNodeDragDrop({
    nodeRows,
    setNodeRows,
    data: normalizedData,
    rowsContainerRef
  });
  const {
    drag, draggedItem, draggedRowStyle,
    handleRowDragStart, handleGlobalMouseMove, handleGlobalMouseUp
  } = dragDrop;

  // ✅ STATE: Extract all state management to custom hook (MUST BE FIRST)
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

  // ✅ EVENT HANDLERS: Extract all event handlers to custom hook (BEFORE rendering)
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

  // ✅ RENDERING: Manage rendering logic and props (AFTER state and handlers)
  const rendering = useNodeRendering({
    nodeRows,
    normalizedData,
    isHoveredNode,
    selected,
    isEditingNode,
    showPermanentHeader,
    showDragHeader,
    isDragging,
    isToolbarDrag,
    draggedItem,
    draggedRowStyle,
    editingRowId,
    showIntellisense,
    intellisensePosition,
    handleIntellisenseSelectItem,
    closeIntellisense,
    handleRowDragStart,
    handleUpdateRow,
    handleDeleteRow,
    handleInsertRow,
    handleExitEditing,
    setIsEditingNode,
    handleDeleteNode,
    setIsHoveredNode,
    setIsHoverHeader,
    id
  });
  const {
    visibleRows,
    nodeRowListProps,
    permanentToolbarProps,
    dragHeaderProps,
    intellisenseProps,
    nodeStyles,
    toolbarStyles,
    dragHeaderStyles
  } = rendering;

  // ✅ EFFECTS: Manage all useEffect logic (AFTER state)
  const effects = useNodeEffects({
    showPermanentHeader,
    hasTitle,
    isHoveredNode,
    isEditingNode,
    selected,
    id,
    nodeRows,
    editingRowId,
    normalizedData,
    isEmpty,
    inAutoAppend,
    computeIsEmpty,
    setIsHoverHeader,
    setNodeBufferRect,
    setIsHoveredNode,
    setNodeRows,
    setIsEmpty,
    setEditingRowId,
    rootRef,
    nodeContainerRef,
    exitEditing: handleExitEditing
  });
  const { nextPointerTargetRef, latestRowsRef } = effects;

  // (useEffect logic moved to useNodeEffects hook)
  // (debug useEffect removed)

  // (toolbar area calculation moved to useNodeEffects hook)

  // (canvas click handler moved to useNodeEffects hook)
  // (showIntellisense and intellisensePosition moved to useNodeIntellisense hook)

  // (makeRowId and appendEmptyRow moved to useNodeRowManagement hook)

  // (nodeRows, editingRowId moved to useNodeRowManagement hook)

  // (autoAppendGuard, inAutoAppend, beginAutoAppendGuard moved to useNodeRowManagement hook)

  // (pointer target ref moved to useNodeEffects hook)

  // (nodeContainerRef moved to useNodeEffects hook)

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

  // (isEmpty alignment effect moved to useNodeEffects hook)

  // (focus effect moved to useNodeEffects hook)

  // ✅ Rimuovi auto-editing del titolo per nodi temporanei
  // (Mantieni solo l'auto-focus sulla prima riga)

  // (drag state moved to useNodeDragDrop hook)

  // ✅ PATCH 2: Rimossa variabile hasAddedNewRow non più necessaria

  // Riferimenti DOM per le righe
  // const rowRefs = useRef(new Map<string, HTMLDivElement>());

  // Stato per gestire l'inserter hover
  const [hoveredInserter, setHoveredInserter] = useState<number | null>(null);

  // Inizio stato per overlay azioni
  // const [showActions, setShowActions] = useState(false);

  // (rowsContainerRef moved up before useNodeDragDrop hook)
  // (rootRef moved up before useNodeEffects hook)
  // (latest rows ref moved to useNodeEffects hook)

  // (global message updates effect moved to useNodeEffects hook)

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

  // (handleRowDragStart moved to useNodeDragDrop hook)

  // React-DnD-like simple move API used by NodeRow when dragging label
  // Funzioni drag-and-drop rimosse - gestite dal hook useNodeRowDrag

  // (handleGlobalMouseMove moved to useNodeDragDrop hook)

  // (handleGlobalMouseUp moved to useNodeDragDrop hook)

  // (cleanup listeners moved to useNodeDragDrop hook)

  // ✅ PATCH 2: Rimosso useEffect problematico che generava loop di instabilità
  // La gestione delle righe vuote è ora gestita direttamente in handleUpdateRow


  // (canvas click effect moved to useNodeEffects hook)

  // (visibleRows moved to useNodeRendering hook)

  // (draggedItem and draggedRowStyle moved to useNodeDragDrop hook)

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
        style={nodeStyles}
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
              ...toolbarStyles,
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
            ...dragHeaderStyles
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
            {...nodeRowListProps}
            hoveredInserter={hoveredInserter}
            setHoveredInserter={setHoveredInserter}
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
            <IntellisenseMenu {...intellisenseProps} />
          </>
        )}
      </div>
    </div>
  );
};
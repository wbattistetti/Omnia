import React, { useState, useRef, useCallback } from 'react';
import { NodeProps } from 'reactflow';
import { NodeHeader } from './NodeHeader';
import { NodeDragHeader } from '../shared/NodeDragHeader';
import { NodeHandles } from '../../NodeHandles';
import { IntellisenseMenu } from '../../../Intellisense/IntellisenseMenu';
import { NodeRowData } from '../../../../types/project';
import { NodeRowList } from '../../rows/shared/NodeRowList';
import { useNodeState } from './hooks/useNodeState';
import { useNodeEventHandlers } from './hooks/useNodeEventHandlers';
import { useNodeInitialization } from './hooks/useNodeInitialization';
import { useNodeRowManagement } from './hooks/useNodeRowManagement';
import { useNodeIntellisense } from './hooks/useNodeIntellisense';
import { useNodeDragDrop } from './hooks/useNodeDragDrop';
import { useRowRegistry } from '../../rows/NodeRow/hooks/useRowRegistry';
import { useNodeRendering } from './hooks/useNodeRendering';
import { useNodeEffects } from './hooks/useNodeEffects';
import { useNodeExitEditing } from './hooks/useNodeExitEditing';
import { useRegisterAsNode } from '../../../../context/NodeRegistryContext';

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
    inAutoAppend
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
    handleIntellisenseSelectItem, closeIntellisense
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
    rowsContainerRef,
    nodeId: id
  });
  const {
    draggedRowId, handleRowDragStart
  } = dragDrop;

  // ✅ STATE: Extract all state management to custom hook (MUST BE FIRST)
  const nodeState = useNodeState({ data: normalizedData });
  const {
    isEditingNode, setIsEditingNode,
    nodeTitle, setNodeTitle,
    isHoveredNode, setIsHoveredNode,
    setIsHoverHeader,
    isDragging, setIsDragging,
    isToolbarDrag, setIsToolbarDrag,
    showUnchecked, setShowUnchecked,
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
    handleNodeMouseLeave
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
    nodeRowListProps,
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
    setIsHoveredNode,
    setNodeRows,
    setIsEmpty,
    setEditingRowId,
    rootRef,
    nodeContainerRef,
    exitEditing: handleExitEditing
  });
  const { nextPointerTargetRef } = effects;

  // ✅ EXIT EDITING: Extract exit editing logic to custom hook
  const { exitEditing } = useNodeExitEditing({
    inAutoAppend,
    nextPointerTargetRef,
    nodeContainerRef,
    handleExitEditing,
    validateRows,
    nodeRows
  });

  // Stato per gestire l'inserter hover
  const [hoveredInserter, setHoveredInserter] = useState<number | null>(null);

  // Registry per accedere ai componenti NodeRow
  const { getRowComponent } = useRowRegistry();

  // ✅ TOGGLE UNCHECKED ROWS: Handle eye icon click
  const handleToggleUnchecked = useCallback(() => {
    const newShowUnchecked = !showUnchecked;
    setShowUnchecked(newShowUnchecked);

    // Update the node data
    if (typeof data.onUpdate === 'function') {
      data.onUpdate({ hideUncheckedRows: !newShowUnchecked });
    }
  }, [showUnchecked, setShowUnchecked, data]);

  // ✅ CHECK FOR UNCHECKED ROWS: Calculate if there are any unchecked rows
  const hasUncheckedRows = nodeRows.some(row => row.included === false);

  // ✅ CROSS-NODE DRAG: Listen for cross-node row moves - VERSIONE SEMPLIFICATA
  React.useEffect(() => {
    const handleCrossNodeMove = (event: CustomEvent) => {
      const { toNodeId, rowData, mousePosition } = event.detail;

      if (toNodeId === id && rowData) {

        // Verifica che la riga non esista già
        const existingRow = nodeRows.find(row => row.id === rowData.id);
        if (!existingRow) {
          // Calcola la posizione di inserimento basata sul mouse
          const elements = Array.from(rowsContainerRef.current?.querySelectorAll('.node-row-outer') || []) as HTMLElement[];
          const rects = elements.map((el) => ({
            idx: Number(el.dataset.index),
            top: el.getBoundingClientRect().top,
            height: el.getBoundingClientRect().height
          }));

          let targetIndex = nodeRows.length; // Default: alla fine
          if (mousePosition) {
            for (const r of rects) {
              if (mousePosition.y < r.top + r.height / 2) {
                targetIndex = r.idx;
                break;
              }
              targetIndex = r.idx + 1;
            }
          }

          // Inserisci alla posizione corretta
          const updatedRows = [...nodeRows];
          updatedRows.splice(targetIndex, 0, rowData);
          setNodeRows(updatedRows);

          if (data.onUpdate) {
            data.onUpdate({ rows: updatedRows });
          }

          // ELEGANTE: Usa il componente per l'evidenziazione
          // Aspetta un po' per assicurarsi che il componente sia stato renderizzato
          setTimeout(() => {
            const rowComponent = getRowComponent(rowData.id);
            if (rowComponent) {
              rowComponent.highlight();
            }
          }, 50);
        } else {
          // Row already exists, skipping
        }
      }
    };

    window.addEventListener('crossNodeRowMove', handleCrossNodeMove as EventListener);
    return () => {
      window.removeEventListener('crossNodeRowMove', handleCrossNodeMove as EventListener);
    };
  }, [id, nodeRows, setNodeRows, data, rowsContainerRef, getRowComponent]);

  return (
    <div style={{ position: 'relative', display: 'inline-block' }}>

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
          const t = e.target as HTMLElement;
          const isHandle = t?.classList.contains('react-flow__handle') ||
                           t?.closest('.react-flow__handle');
          const isConnecting = (window as any).__isConnecting;

          console.log('🔥🔥🔥 [CUSTOM_NODE_DRAG_START] HTML5 DragStart:', {
            nodeId: id,
            targetTag: t?.tagName,
            targetClass: t?.className,
            isHandle: !!isHandle,
            isConnecting: !!isConnecting,
            timestamp: Date.now(),
            eventType: e.type
          });

          // ✅ SOLUZIONE: Blocca drag HTML5 se si sta tracciando una connessione
          if (isConnecting) {
            console.error('❌❌❌ [CUSTOM_NODE_DRAG_START] BLOCCATO - connessione in corso!', {
              nodeId: id,
              timestamp: Date.now()
            });
            e.preventDefault();
            e.stopPropagation();
            e.stopImmediatePropagation();
            return false;
          }

          // ✅ Se parte da un handle, blocca il drag HTML5
          if (isHandle) {
            console.error('❌❌❌ [CUSTOM_NODE_DRAG_START] PROBLEMA: HTML5 dragStart su handle!', {
              nodeId: id,
              timestamp: Date.now()
            });
            e.preventDefault();
            e.stopPropagation();
            return false;
          }

          setIsDragging(true);
          document.body.style.cursor = 'move';
        }}
        onDragEnd={() => {
          // ✅ Reset flag connessione quando finisce il drag
          if ((window as any).__isConnecting) {
            console.log('🔄 [CUSTOM_NODE_DRAG_END] Reset flag __isConnecting');
            (window as any).__isConnecting = false;
          }
          setIsDragging(false);
          setIsToolbarDrag(false);
          document.body.style.cursor = 'default';
        }}
        onMouseEnter={handleNodeMouseEnter}
        onMouseLeave={handleNodeMouseLeave}
        onMouseDownCapture={(e) => {
          const t = e.target as HTMLElement;

          // ✅ LOG DETTAGLIATO
          const isHandle = t?.classList.contains('react-flow__handle') ||
                           t?.closest('.react-flow__handle');
          const isInput = t?.classList?.contains('node-row-input') || !!t?.closest?.('.node-row-input');

          console.log('🔥🔥🔥 [CUSTOM_NODE_MOUSE_DOWN_CAPTURE] MouseDown:', {
            nodeId: id,
            targetTag: t?.tagName,
            targetClass: t?.className,
            targetId: t?.id,
            isHandle: !!isHandle,
            isInput: !!isInput,
            hasHandleClass: t?.classList.contains('react-flow__handle'),
            closestHandle: !!t?.closest('.react-flow__handle'),
            eventButton: e.button,
            eventClientX: e.clientX,
            eventClientY: e.clientY,
            timestamp: Date.now()
          });

          if (isHandle) {
            console.log('🚫 [CUSTOM_NODE_MOUSE_DOWN_CAPTURE] Handle rilevato - dovrebbe bloccare drag');
            // ✅ Non fermiamo la propagazione qui, React Flow deve gestire la connessione
          }

          if (isInput) {
            e.stopPropagation();
          }
        }}
        onMouseUpCapture={(e) => {
          if (!editingRowId) return;
          const t = e.target as HTMLElement;
          const isInput = t?.classList?.contains('node-row-input') || !!t?.closest?.('.node-row-input');
          if (isInput) e.stopPropagation();
        }}
        onFocusCapture={() => { }}
      >
        {/* Toolbar sopra il nodo */}
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
            <NodeDragHeader
              onEditTitle={() => setIsEditingNode(true)}
              onDelete={handleDeleteNode}
              compact={true}
              showDragHandle={false}
              fullWidth={true}
              isToolbarDrag={isToolbarDrag}
              showUnchecked={showUnchecked}
              onToggleUnchecked={handleToggleUnchecked}
              hasUncheckedRows={hasUncheckedRows}
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
            ...dragHeaderStyles,
            bottom: '100%'
          }}
          onMouseEnter={() => {
            if (showDragHeader) {
              setIsHoveredNode(true);
            }
          }}
          onMouseLeave={() => {
            if (showDragHeader) {
              setIsHoveredNode(false);
            }
          }}
          onMouseDown={() => {
            if (showDragHeader) {
              setIsDragging(true);
              setIsToolbarDrag(true);
            }
          }}
          onClick={(e) => {
            if (showDragHeader) {
              e.stopPropagation();
            }
          }}
        >
          <NodeDragHeader
            onEditTitle={() => setIsEditingNode(true)}
            onDelete={handleDeleteNode}
            compact={true}
            showDragHandle={true}
            fullWidth={false}
            isToolbarDrag={isToolbarDrag}
            showUnchecked={showUnchecked}
            onToggleUnchecked={handleToggleUnchecked}
            hasUncheckedRows={hasUncheckedRows}
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
            hideUnchecked={!showUnchecked}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                return;
              } else if (e.key === 'Escape') {
                const singleEmpty = nodeRows.length === 1 && nodeRows[0].text.trim() === '';
                singleEmpty ? data.onDelete?.() : exitEditing();
              }
            }}
            canDelete={() => nodeRows.length > 1}
            totalRows={nodeRows.length}
            onCreateAgentAct={data.onCreateAgentAct}
            onCreateBackendCall={data.onCreateBackendCall}
            onCreateTask={data.onCreateTask}
            getProjectId={() => {
              try { return (window as any).__omniaRuntime?.getCurrentProjectId?.() || null; } catch { return null; }
            }}
            hoveredRowIndex={null}
            draggedRowId={draggedRowId}
            draggedRowOriginalIndex={null}
            draggedItem={null}
            draggedRowStyle={{}}
            onEditingEnd={exitEditing}
          />
        </div>
        <NodeHandles isConnectable={isConnectable} />
        {showIntellisense && <IntellisenseMenu {...intellisenseProps} />}
      </div>
    </div>
  );
};
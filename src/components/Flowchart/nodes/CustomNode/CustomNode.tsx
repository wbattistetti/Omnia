import React, { useState, useRef, useCallback } from 'react';
import { NodeProps, useReactFlow } from 'reactflow';
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

  // ✅ NODE DRAG: Hook per accedere a React Flow per aggiornare posizione nodo
  const { getNode, setNodes, getViewport } = useReactFlow();

  // ✅ NODE DRAG: Ref per gestire il drag personalizzato del nodo (solo quando parte dall'icona Move)
  const nodeDragStateRef = useRef<{
    startX: number;
    startY: number;
    nodeStartX: number;
    nodeStartY: number;
    isActive: boolean;
  } | null>(null);

  // ✅ NODE DRAG: Cleanup listener quando il componente viene smontato
  React.useEffect(() => {
    return () => {
      if (nodeDragStateRef.current?.isActive) {
        // Cleanup se il componente viene smontato durante un drag
        document.body.style.cursor = 'default';
        nodeDragStateRef.current = null;
      }
    };
  }, []);

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

          // ✅ Highlight unificato: evidenzia la riga SUBITO dopo il drop
          // Usa requestAnimationFrame per essere il più veloce possibile
          requestAnimationFrame(() => {
            const rowComponent = getRowComponent(rowData.id);
            if (rowComponent) {
              rowComponent.highlight();
            } else {
              // Fallback: se il componente non è ancora renderizzato, riprova dopo un frame
              requestAnimationFrame(() => {
                const rowComponentRetry = getRowComponent(rowData.id);
                if (rowComponentRetry) {
                  rowComponentRetry.highlight();
                }
              });
            }
          });
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
        draggable={false}
        onMouseEnter={handleNodeMouseEnter}
        onMouseLeave={handleNodeMouseLeave}
        onMouseDownCapture={(e) => {
          const t = e.target as HTMLElement;
          const isInput = t?.classList?.contains('node-row-input') || !!t?.closest?.('.node-row-input');

          // ✅ Solo blocca input, lascia passare tutto il resto (incluso nodrag) alla label
          if (isInput) {
            e.stopPropagation();
          }
          // ✅ NON bloccare nodrag - l'evento deve arrivare alla label che gestirà stopPropagation
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
              marginBottom: 8, // Spazio tra toolbar e bordo del nodo
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
              nodeRef={nodeContainerRef}
              onDragStart={() => {
                // ✅ Verifica che NON ci sia una riga in drag (PROTEZIONE CRITICA)
                const isDraggingRow = document.querySelector('.node-row-outer[data-being-dragged="true"]');
                if (isDraggingRow) {
                  // Se c'è una riga in drag, NON permettere il drag del nodo
                  console.log('🚫 [NODE DRAG] Blocked - row is being dragged');
                  return;
                }

                // ✅ Ottieni la posizione corrente del nodo
                const currentNode = getNode(id);
                if (!currentNode) {
                  console.warn('⚠️ [NODE DRAG] Node not found:', id);
                  return;
                }

                // ✅ Prepara stato per drag personalizzato
                const nodeEl = nodeContainerRef.current;
                if (!nodeEl) return;

                const nodeRect = nodeEl.getBoundingClientRect();
                const viewport = getViewport();

                nodeDragStateRef.current = {
                  startX: nodeRect.left,
                  startY: nodeRect.top,
                  nodeStartX: currentNode.position.x,
                  nodeStartY: currentNode.position.y,
                  isActive: true
                };

                // ✅ Imposta flag e stato
                (window as any).__isToolbarDrag = id;
                (window as any).__blockNodeDrag = null;
                setIsDragging(true);
                setIsToolbarDrag(true);
                document.body.style.cursor = 'move';

                // ✅ Handler per mouse move - aggiorna posizione del nodo
                const handleMouseMove = (e: MouseEvent) => {
                  // ✅ VERIFICA CRITICA: se inizia un drag di riga, annulla il drag del nodo
                  const isDraggingRow = document.querySelector('.node-row-outer[data-being-dragged="true"]');
                  if (isDraggingRow) {
                    console.log('🚫 [NODE DRAG] Row drag detected during node drag - cancelling');
                    handleMouseUp();
                    return;
                  }

                  if (!nodeDragStateRef.current?.isActive) return;

                  // Calcola offset del mouse
                  const deltaX = e.clientX - nodeDragStateRef.current.startX;
                  const deltaY = e.clientY - nodeDragStateRef.current.startY;

                  // Converti in coordinate React Flow (considera zoom)
                  const flowDeltaX = deltaX / viewport.zoom;
                  const flowDeltaY = deltaY / viewport.zoom;

                  // Aggiorna posizione del nodo
                  const newPosition = {
                    x: nodeDragStateRef.current.nodeStartX + flowDeltaX,
                    y: nodeDragStateRef.current.nodeStartY + flowDeltaY
                  };

                  setNodes((nds) => nds.map((n) =>
                    n.id === id ? { ...n, position: newPosition } : n
                  ));
                };

                // ✅ Handler per mouse up - termina il drag
                const handleMouseUp = () => {
                  if (!nodeDragStateRef.current?.isActive) return;

                  // Reset stato
                  nodeDragStateRef.current.isActive = false;
                  nodeDragStateRef.current = null;

                  // Rimuovi listener
                  document.removeEventListener('mousemove', handleMouseMove);
                  document.removeEventListener('mouseup', handleMouseUp);

                  // Reset flag e stato
                  (window as any).__isToolbarDrag = null;
                  setIsDragging(false);
                  setIsToolbarDrag(false);
                  document.body.style.cursor = 'default';
                };

                // ✅ Aggiungi listener globali (capture per intercettare anche eventi sopra altri elementi)
                document.addEventListener('mousemove', handleMouseMove, { capture: true });
                document.addEventListener('mouseup', handleMouseUp, { capture: true });
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
            // ✅ Questo handler è per il drag header, non per l'icona Move
            // L'icona Move gestisce il drag tramite onDragStart callback
            // Non serve più impostare draggable="true" qui
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
              // ✅ Verifica che NON ci sia una riga in drag (PROTEZIONE CRITICA)
              const isDraggingRow = document.querySelector('.node-row-outer[data-being-dragged="true"]');
              if (isDraggingRow) {
                // Se c'è una riga in drag, NON permettere il drag del nodo
                console.log('🚫 [NODE DRAG] Blocked - row is being dragged');
                return;
              }

              // ✅ Ottieni la posizione corrente del nodo
              const currentNode = getNode(id);
              if (!currentNode) {
                console.warn('⚠️ [NODE DRAG] Node not found:', id);
                return;
              }

              // ✅ Prepara stato per drag personalizzato
              const nodeEl = nodeContainerRef.current;
              if (!nodeEl) return;

              const nodeRect = nodeEl.getBoundingClientRect();
              const viewport = getViewport();

              nodeDragStateRef.current = {
                startX: nodeRect.left,
                startY: nodeRect.top,
                nodeStartX: currentNode.position.x,
                nodeStartY: currentNode.position.y,
                isActive: true
              };

              // ✅ Imposta flag e stato
              (window as any).__isToolbarDrag = id;
              (window as any).__blockNodeDrag = null;
              setIsDragging(true);
              setIsToolbarDrag(true);
              document.body.style.cursor = 'move';

              // ✅ Handler per mouse move - aggiorna posizione del nodo
              const handleMouseMove = (e: MouseEvent) => {
                // ✅ VERIFICA CRITICA: se inizia un drag di riga, annulla il drag del nodo
                const isDraggingRow = document.querySelector('.node-row-outer[data-being-dragged="true"]');
                if (isDraggingRow) {
                  console.log('🚫 [NODE DRAG] Row drag detected during node drag - cancelling');
                  handleMouseUp();
                  return;
                }

                if (!nodeDragStateRef.current?.isActive) return;

                // Calcola offset del mouse
                const deltaX = e.clientX - nodeDragStateRef.current.startX;
                const deltaY = e.clientY - nodeDragStateRef.current.startY;

                // Converti in coordinate React Flow (considera zoom)
                const flowDeltaX = deltaX / viewport.zoom;
                const flowDeltaY = deltaY / viewport.zoom;

                // Aggiorna posizione del nodo
                const newPosition = {
                  x: nodeDragStateRef.current.nodeStartX + flowDeltaX,
                  y: nodeDragStateRef.current.nodeStartY + flowDeltaY
                };

                setNodes((nds) => nds.map((n) =>
                  n.id === id ? { ...n, position: newPosition } : n
                ));
              };

              // ✅ Handler per mouse up - termina il drag
              const handleMouseUp = () => {
                if (!nodeDragStateRef.current?.isActive) return;

                // Reset stato
                nodeDragStateRef.current.isActive = false;
                nodeDragStateRef.current = null;

                // Rimuovi listener
                document.removeEventListener('mousemove', handleMouseMove);
                document.removeEventListener('mouseup', handleMouseUp);

                // Reset flag e stato
                (window as any).__isToolbarDrag = null;
                setIsDragging(false);
                setIsToolbarDrag(false);
                document.body.style.cursor = 'default';
              };

              // ✅ Aggiungi listener globali (capture per intercettare anche eventi sopra altri elementi)
              document.addEventListener('mousemove', handleMouseMove, { capture: true });
              document.addEventListener('mouseup', handleMouseUp, { capture: true });
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
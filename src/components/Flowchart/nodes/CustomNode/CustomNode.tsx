import React, { useState, useRef, useCallback, useEffect } from 'react';
import { NodeProps, useReactFlow, NodeToolbar, Position } from 'reactflow';
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
import { useNodeExecutionHighlight } from '../../executionHighlight/useExecutionHighlight';

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

  // ✅ MEASURE NODE WIDTH: Track node width to prevent shrinking when editing
  const [nodeWidth, setNodeWidth] = useState<number | null>(null);
  const nodeWidthRef = useRef<number | null>(null);

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

  // Measure node width when not editing any row to preserve it during editing
  useEffect(() => {
    if (!editingRowId && nodeContainerRef.current) {
      // Use multiple frames to ensure layout is stable
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          if (!nodeContainerRef.current) return;
          const rect = nodeContainerRef.current.getBoundingClientRect();
          const computedStyle = window.getComputedStyle(nodeContainerRef.current);
          const width = rect.width;
          setNodeWidth(width);
          nodeWidthRef.current = width;

          // Node width measured (debug disabled)
        });
      });
    } else if (editingRowId && nodeWidthRef.current && nodeContainerRef.current) {
      // When editing, enforce the saved width directly on DOM
      nodeContainerRef.current.style.setProperty('min-width', `${nodeWidthRef.current}px`, 'important');
      nodeContainerRef.current.style.setProperty('width', `${nodeWidthRef.current}px`, 'important');
      nodeContainerRef.current.style.setProperty('flex-shrink', '0', 'important');
    }
  }, [editingRowId, id, nodeRows.length]);

  // ✅ TOOLBAR: Ref per l'elemento toolbar (dichiarato prima dell'uso)
  const toolbarElementRef = useRef<HTMLDivElement>(null);

  // ✅ NODE DRAG: Hook per accedere a React Flow per aggiornare posizione nodo
  const { getNode, setNodes, getViewport, getEdges } = useReactFlow();

  // ✅ Funzione per trovare tutti i discendenti di un nodo (ricorsivo)
  const findAllDescendants = useCallback((nodeId: string, visited: Set<string> = new Set()): string[] => {
    if (visited.has(nodeId)) return []; // Evita cicli
    visited.add(nodeId);

    const edges = getEdges();
    const descendants: string[] = [];

    // Trova tutti i nodi raggiungibili da questo nodo
    edges.forEach(edge => {
      if (edge.source === nodeId) {
        const targetId = edge.target;
        if (!visited.has(targetId)) {
          descendants.push(targetId);
          // Ricorsivamente trova i discendenti del target
          const nestedDescendants = findAllDescendants(targetId, visited);
          descendants.push(...nestedDescendants);
        }
      }
    });

    return descendants;
  }, [getEdges]);

  // ✅ NODE DRAG: Ref per gestire il drag personalizzato del nodo
  const nodeDragStateRef = useRef<{
    startX: number;
    startY: number;
    nodeStartX: number;
    nodeStartY: number;
    isActive: boolean;
    // ✅ Salva le posizioni relative dei discendenti per drag rigido
    descendantOffsets?: Map<string, { offsetX: number; offsetY: number }>;
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
    hasTitle, showPermanentHeader, showDragHeader
  } = nodeState;

  // ✅ EVENT HANDLERS: Extract all event handlers to custom hook (BEFORE rendering)
  const handlers = useNodeEventHandlers({
    data: normalizedData,
    nodeTitle,
    setNodeTitle,
    setIsEditingNode,
    setIsHoverHeader,
    setIsHoveredNode,
    toolbarElementRef // Passo il ref della toolbar per verificare hover
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
    nodeWidth: editingRowId ? nodeWidth : null,
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
    id,
    isEmpty
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
    handleExitEditing: (rowId?: string) => handleExitEditing(rowId || editingRowId || null),
    validateRows,
    nodeRows,
    editingRowId
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

  // ✅ EXECUTION HIGHLIGHT: Get execution highlight styles
  const executionHighlight = useNodeExecutionHighlight(id, nodeRows);

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

  // Ref per il wrapper esterno (per calcolare posizione toolbar)
  const wrapperRef = useRef<HTMLDivElement>(null);

  // ✅ LISTENER GLOBALE: Nascondi toolbar quando il mouse è sul canvas (con debouncing)
  useEffect(() => {
    let rafId: number | null = null;

    const handleCanvasMouseMove = (e: MouseEvent) => {
      // Debounce con requestAnimationFrame per ridurre il carico
      if (rafId) {
        cancelAnimationFrame(rafId);
      }

      rafId = requestAnimationFrame(() => {
        // Usa elementFromPoint per verificare la posizione effettiva del mouse
        const el = document.elementFromPoint(e.clientX, e.clientY) as HTMLElement;
        if (!el) return;

        // ✅ Verifica se il mouse è sopra il Response Editor o altri pannelli docked
        const isOverResponseEditor = el?.closest?.('[data-response-editor]') ||
          el?.closest?.('.response-editor-container') ||
          el?.closest?.('[data-dockable-panel]');
        if (isOverResponseEditor) {
          // Se il mouse è sopra il Response Editor, nascondi immediatamente la toolbar
          if (!selected) {
            setIsHoveredNode(false);
          }
          return;
        }

        // Verifica se il mouse è sul canvas (react-flow__pane ma non sui nodi)
        const isCanvas = el?.closest?.('.react-flow__pane') && !el?.closest?.('.react-flow__node');
        const isOverToolbar = toolbarElementRef.current?.contains(el);
        const isOverNode = nodeContainerRef.current?.contains(el) || wrapperRef.current?.contains(el);

        if (isCanvas && !selected && !isOverToolbar && !isOverNode) {
          setIsHoveredNode(false);
        }
      });
    };

    document.addEventListener('mousemove', handleCanvasMouseMove, true);

    return () => {
      if (rafId) {
        cancelAnimationFrame(rafId);
      }
      document.removeEventListener('mousemove', handleCanvasMouseMove, true);
    };
  }, [selected, setIsHoveredNode]);

  return (
    <>
      {/* Toolbar sopra il nodo - Usa NodeToolbar nativo di React Flow */}
      <NodeToolbar
        isVisible={(isHoveredNode || selected) && !isEditingNode}
        position={Position.Top}
        offset={0}
        align="start"
        style={{
          width: nodeContainerRef.current
            ? `${nodeContainerRef.current.offsetWidth}px`
            : '100%',
          zIndex: 1000,
          pointerEvents: 'auto',
          minHeight: '32px'
        }}
        className="node-toolbar-custom"
        onMouseEnter={() => {
          setIsHoveredNode(true);
        }}
        onMouseLeave={(e) => {
          // ✅ Mantieni la stessa logica custom per hover
          const el = document.elementFromPoint(e.clientX, e.clientY) as HTMLElement;

          // ✅ Verifica se il mouse è sopra il Response Editor
          const isOverResponseEditor = el?.closest?.('[data-response-editor]');
          if (isOverResponseEditor) {
            setIsHoveredNode(false);
            return;
          }

          // Verifica se il mouse è ancora sul nodo o sulla toolbar
          const isOverNode = el && (nodeContainerRef.current?.contains(el) || wrapperRef.current?.contains(el));
          const isOverToolbar = el && toolbarElementRef.current?.contains(el);
          const isOverCanvas = el?.closest?.('.react-flow__pane') && !el?.closest?.('.react-flow__node');

          if (selected) {
            return;
          }

          if (isOverNode || isOverToolbar) {
            return;
          }

          if (isOverCanvas) {
            setIsHoveredNode(false);
            return;
          }

          const relatedTarget = e.relatedTarget as HTMLElement;
          const isGoingToNode = relatedTarget && (nodeContainerRef.current?.contains(relatedTarget) || wrapperRef.current?.contains(relatedTarget));

          if (isGoingToNode) {
            return;
          }

          setIsHoveredNode(false);
        }}
      >
        <div
          ref={toolbarElementRef}
          data-toolbar-debug
          style={{ width: '100%' }}
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
                return;
              }

              // ✅ Ottieni la posizione corrente del nodo
              const currentNode = getNode(id);
              if (!currentNode) {
                return;
              }

              // ✅ Prepara stato per drag personalizzato
              const nodeEl = nodeContainerRef.current;
              if (!nodeEl) return;

              const nodeRect = nodeEl.getBoundingClientRect();
              const viewport = getViewport();

              // ✅ Verifica se è drag rigido (ancora) o normale (move)
              const isRigidDrag = (window as any).__flowDragMode === 'rigid';

              // ✅ Se è drag rigido, calcola le posizioni relative dei discendenti
              let descendantOffsets: Map<string, { offsetX: number; offsetY: number }> | undefined;
              if (isRigidDrag) {
                const descendants = findAllDescendants(id);
                descendantOffsets = new Map();

                descendants.forEach(descendantId => {
                  const descNode = getNode(descendantId);
                  if (descNode) {
                    descendantOffsets!.set(descendantId, {
                      offsetX: descNode.position.x - currentNode.position.x,
                      offsetY: descNode.position.y - currentNode.position.y
                    });
                  }
                });

                console.log('🔗 [RIGID_DRAG] Trovati discendenti', {
                  nodeId: id,
                  descendantsCount: descendants.length,
                  descendantIds: descendants,
                  timestamp: Date.now()
                });
              }

              nodeDragStateRef.current = {
                startX: nodeRect.left,
                startY: nodeRect.top,
                nodeStartX: currentNode.position.x,
                nodeStartY: currentNode.position.y,
                isActive: true,
                descendantOffsets
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

                // ✅ Se è drag rigido, sposta anche tutti i discendenti mantenendo le posizioni relative
                const isRigidDrag = (window as any).__flowDragMode === 'rigid';
                if (isRigidDrag && nodeDragStateRef.current.descendantOffsets) {
                  setNodes((nds) => nds.map((n) => {
                    if (n.id === id) {
                      return { ...n, position: newPosition };
                    }
                    // ✅ Sposta i discendenti mantenendo l'offset relativo
                    const offset = nodeDragStateRef.current.descendantOffsets!.get(n.id);
                    if (offset) {
                      return {
                        ...n,
                        position: {
                          x: newPosition.x + offset.offsetX,
                          y: newPosition.y + offset.offsetY
                        }
                      };
                    }
                    return n;
                  }));
                } else {
                  // ✅ Drag normale: sposta solo il nodo
                  setNodes((nds) => nds.map((n) =>
                    n.id === id ? { ...n, position: newPosition } : n
                  ));
                }

                // ✅ NodeToolbar si aggiorna automaticamente durante il drag
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
                (window as any).__flowDragMode = null; // ✅ Reset anche il flag rigid
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
      </NodeToolbar>
      <div
        ref={wrapperRef}
        style={{ position: 'relative', display: 'inline-block' }}
        onMouseEnter={() => {
          setIsHoveredNode(true);
        }}
        onMouseLeave={(e) => {
          // ✅ Usa elementFromPoint invece di relatedTarget (più affidabile)
          const el = document.elementFromPoint(e.clientX, e.clientY) as HTMLElement;

          // ✅ Verifica se il mouse è sopra il Response Editor - nascondi immediatamente
          const isOverResponseEditor = el?.closest?.('[data-response-editor]');
          if (isOverResponseEditor) {
            setIsHoveredNode(false);
            return;
          }

          // Verifica dove è effettivamente il mouse
          const isOverToolbar = el && toolbarElementRef.current?.contains(el);
          const isOverNode = el && (nodeContainerRef.current?.contains(el) || wrapperRef.current?.contains(el));
          const isOverCanvas = el?.closest?.('.react-flow__pane') && !el?.closest?.('.react-flow__node');

          // Se il nodo è selected, mantieni sempre visibile
          if (selected) {
            return;
          }

          // Se il mouse è ancora sulla toolbar o sul nodo, mantieni visibile
          if (isOverToolbar || isOverNode) {
            return;
          }

          // Se il mouse è sul canvas, nascondi immediatamente
          if (isOverCanvas) {
            setIsHoveredNode(false);
            return;
          }

          // Fallback: usa relatedTarget se elementFromPoint non funziona
          const relatedTarget = e.relatedTarget as HTMLElement;
          const isGoingToToolbar = relatedTarget && toolbarElementRef.current?.contains(relatedTarget);
          const isGoingToNodeContainer = relatedTarget && (nodeContainerRef.current?.contains(relatedTarget) || wrapperRef.current?.contains(relatedTarget));

          if (isGoingToToolbar || isGoingToNodeContainer) {
            return;
          }

          // Altrimenti nascondi
          setIsHoveredNode(false);
        }}
      >
        <div
          ref={(el) => {
            // ✅ Assign to ALL three refs in a single callback
            (rootRef as any).current = el;
            (nodeRegistryRef as any).current = el;
            (nodeContainerRef as any).current = el;
          }}
          data-id={id}
          className={`bg-white border-black rounded-lg shadow-xl min-h-[40px] relative ${selected ? 'border-2' : 'border'}`}
          style={{
            ...nodeStyles,
            // ✅ Solo bordo, NO background
            border: executionHighlight.nodeBorder !== 'transparent'
              ? `${executionHighlight.nodeBorderWidth}px solid ${executionHighlight.nodeBorder}`
              : (selected ? '2px solid black' : '1px solid black'),
            backgroundColor: 'white' // ✅ Sempre bianco, non toccare
          }}
          tabIndex={-1}
          draggable={false}
          onMouseEnter={() => {
            setIsHoveredNode(true);
          }}
          onMouseLeave={(e) => {
            // ✅ Usa elementFromPoint invece di relatedTarget (più affidabile)
            const el = document.elementFromPoint(e.clientX, e.clientY) as HTMLElement;

            // Verifica dove è effettivamente il mouse
            const isOverToolbar = el && toolbarElementRef.current?.contains(el);
            const isOverNode = el && (wrapperRef.current?.contains(el) || nodeContainerRef.current?.contains(el));
            const isOverCanvas = el?.closest?.('.react-flow__pane') && !el?.closest?.('.react-flow__node');

            // Se il nodo è selected, mantieni sempre visibile
            if (selected) {
              return;
            }

            // Se il mouse è ancora sulla toolbar o sul nodo, mantieni visibile
            if (isOverToolbar || isOverNode) {
              return;
            }

            // Se il mouse è sul canvas, nascondi immediatamente
            if (isOverCanvas) {
              setIsHoveredNode(false);
              return;
            }

            // Fallback: usa relatedTarget se elementFromPoint non funziona
            const relatedTarget = e.relatedTarget as HTMLElement;
            const isGoingToToolbar = relatedTarget && toolbarElementRef.current?.contains(relatedTarget);
            const isStillInWrapper = relatedTarget && (wrapperRef.current?.contains(relatedTarget) || nodeContainerRef.current?.contains(relatedTarget));

            if (isGoingToToolbar || isStillInWrapper) {
              return;
            }

            // Altrimenti nascondi
            setIsHoveredNode(false);
          }}
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

          {/* Header drag: RIMOSSO - ora gestito dalla toolbar sopra il nodo */}
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
    </>
  );
};
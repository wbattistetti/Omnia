import { useState, useCallback, useEffect, useRef } from 'react';
import { NodeRowData } from '../../../../../types/project';
import type { Task } from '../../../../../types/taskTypes';
import { useRowRegistry } from '../../../rows/NodeRow/hooks/useRowRegistry';
import { useFlowActions } from '../../../../../context/FlowActionsContext';
import { taskRepository } from '../../../../../services/TaskRepository';
import { generateId } from '../../../../../utils/idGenerator';
import {
    FLOW_BACKEND_MAPPING_POINTER_DROP,
    FLOW_INTERFACE_POINTER_PREVIEW,
    FLOW_INTERFACE_ROW_POINTER_DROP,
    computeInterfacePointerPreview,
    findBackendMappingZoneAtPoint,
    findInterfaceZoneRootAtPoint,
    stableInterfacePathForVariable,
    type FlowBackendMappingPointerDropDetail,
    type FlowInterfacePointerPreviewDetail,
    type FlowInterfaceRowPointerDropDetail,
} from '../../../../FlowMappingPanel/flowInterfaceDragTypes';
import {
    evaluateSubflowPortalRowDropAtPointer,
    isSubflowPortalRowDropAllowed,
} from '@domain/taskSubflowMove/subflowRowDragAtPointer';
import {
    getVariableRefIdsBoundToTaskRow,
    taskRowAllowsInterfaceVariableExpansionFromRow,
} from '../../../../FlowMappingPanel/interfaceNodeRowDrop';

/**
 * Walks the hit-test stack at (x,y) to find which React Flow canvas root received the drop.
 * Uses `data-omnia-flowchart-canvas-root` only — not `data-flow-canvas-id` (also on Interface MappingBlock).
 */
function resolveProjectIdForInterfaceDrop(): string | undefined {
    try {
        const w = (window as unknown as { __omniaRuntime?: { getCurrentProjectId?: () => string } }).__omniaRuntime
            ?.getCurrentProjectId?.();
        if (w) return String(w).trim();
    } catch {
        /* noop */
    }
    try {
        const s = localStorage.getItem('currentProjectId');
        if (s) return String(s).trim();
    } catch {
        /* noop */
    }
    return undefined;
}

function resolveFlowCanvasIdAtScreenPoint(clientX: number, clientY: number, fallback: string): string {
  const fb = String(fallback || 'main').trim() || 'main';
  try {
    const stack = document.elementsFromPoint(clientX, clientY);
    for (const top of stack) {
      let cur: Element | null = top;
      while (cur) {
        if (cur instanceof HTMLElement) {
          const id = cur.getAttribute('data-omnia-flowchart-canvas-root');
          if (id && String(id).trim()) {
            return String(id).trim();
          }
        }
        cur = cur.parentElement;
      }
    }
  } catch {
    /* noop */
  }
  return fb;
}

interface UseNodeDragDropProps {
    nodeRows: NodeRowData[];
    setNodeRows: (rows: NodeRowData[]) => void;
    data: any;
    rowsContainerRef: React.RefObject<HTMLElement>;
    nodeId: string;
    /** Current flow canvas id — enables drop on Interface INPUT/OUTPUT without removing the row. */
    flowCanvasId?: string;
    /** Called after same-node row reorder commits so the node can remeasure width (DOM order updates after setState). */
    onSameNodeRowsReordered?: () => void;
}

/**
 * Hook for managing custom row drag & drop
 * Approach: Mouse down → Create image following mouse → Mouse up → Insert/remove
 */
export function useNodeDragDrop({
    nodeRows,
    setNodeRows,
    data,
    rowsContainerRef,
    nodeId,
    flowCanvasId,
    onSameNodeRowsReordered,
}: UseNodeDragDropProps) {
    // Context for node operations (with fallback to legacy)
    const flowActions = useFlowActions();

    // Registry for accessing NodeRow components
    const { getRowComponent } = useRowRegistry();

    // Ref per salvare la posizione iniziale della riga (per verificare se è stata spostata)
    const initialRowPositionRef = useRef<{ index: number; top: number } | null>(null);
    const lastIfacePreviewKeyRef = useRef<string | null>(null);
    /** Task for the dragged row (row.id === task.id), read once at drag start for Subflow portal policy. */
    const draggedRowTaskRef = useRef<Task | null | undefined>(undefined);

    // Stato per il drag personalizzato
    const [isRowDragging, setIsRowDragging] = useState(false);
    const [draggedRowId, setDraggedRowId] = useState<string | null>(null);
    const [draggedRowIndex, setDraggedRowIndex] = useState<number | null>(null);
    /** Last pointer position during row drag (ref avoids stale closure on mouseup). */
    const mousePositionRef = useRef({ x: 0, y: 0 });
    const [dragElement, setDragElement] = useState<HTMLElement | null>(null);
    const [draggedRowData, setDraggedRowData] = useState<NodeRowData | null>(null);
    const [targetNodeId, setTargetNodeId] = useState<string | null>(null);
    const [textOffsetInClone, setTextOffsetInClone] = useState<{ x: number; y: number; nodeOffset?: { x: number; y: number } } | null>(null);

    // Gestione drag start personalizzato
    const handleRowDragStart = useCallback((id: string, index: number, clientX: number, clientY: number, originalElement: HTMLElement) => {
        // 1. Trova il componente NodeRow e fai il fade
        const rowComponent = getRowComponent(id);
        if (rowComponent) {
            try {
                rowComponent.fade();
            } catch (error) {
                console.error('[DRAG] Error calling fade():', error);
            }
        }

        // ✅ Calcola l'offset del testo nel nodo originale usando getBoundingClientRect
        const nodeEl = originalElement.closest('.react-flow__node') as HTMLElement | null;
        const labelSpan = originalElement.querySelector('span.nodrag') as HTMLElement | null;

        let textOffsetInNode = { x: 0, y: 0 };
        if (nodeEl && labelSpan) {
            const nodeRect = nodeEl.getBoundingClientRect();
            const labelRect = labelSpan.getBoundingClientRect();
            // Offset dell'inizio del testo rispetto al bordo superiore-sinistro del nodo
            textOffsetInNode = {
                x: labelRect.left - nodeRect.left, // Distanza orizzontale dall'inizio del testo al bordo sinistro del nodo
                y: labelRect.top - nodeRect.top    // Distanza verticale dall'inizio del testo al bordo superiore del nodo
            };
        }

        // 2. Crea clone semplice per il drag visual
        const clone = originalElement.cloneNode(true) as HTMLElement;

        // ✅ Recupera il font-size e altri stili di testo dall'elemento originale
        const computedStyle = window.getComputedStyle(originalElement);
        const fontSize = computedStyle.fontSize;
        const fontFamily = computedStyle.fontFamily;
        const lineHeight = computedStyle.lineHeight;

        // ✅ Calcola l'offset del testo all'interno del clone
        // Il clone ha padding: 8px 12px, quindi il contenuto inizia a 12px da sinistra
        const clonePaddingLeft = 12; // padding left del clone
        const clonePaddingTop = 8; // padding top del clone
        const checkboxWidth = 14;
        const checkboxMargin = 6;
        const iconWidth = 12;
        const iconMargin = 4;
        const labelPaddingLeft = 4; // se icona presente

        // Trova se c'è un'icona nel clone originale
        const hasIcon = originalElement.querySelector('button[type="button"]') !== null;

        // Calcola offset del testo rispetto al bordo sinistro del clone
        const textOffsetInCloneX = clonePaddingLeft + checkboxWidth + checkboxMargin + (hasIcon ? iconWidth + iconMargin + labelPaddingLeft : 0);
        const textOffsetInCloneY = clonePaddingTop;

        clone.style.position = 'fixed';
        clone.style.pointerEvents = 'none';
        clone.style.zIndex = '9999';
        clone.style.opacity = '0.9';
        clone.style.left = clientX + 10 + 'px';
        clone.style.top = clientY - 10 + 'px';
        clone.style.transform = 'none';
        clone.style.border = '2px solid #3b82f6';
        clone.style.borderRadius = '4px';
        clone.style.backgroundColor = '#e6f3ff';
        clone.style.padding = '8px 12px';
        clone.style.boxShadow = '0 4px 12px rgba(0,0,0,0.15)';
        clone.style.width = 'auto';
        clone.style.maxWidth = '300px';
        clone.style.minWidth = 'fit-content';
        // ✅ Applica il font-size e altri stili di testo dall'originale
        clone.style.fontSize = fontSize;
        clone.style.fontFamily = fontFamily;
        clone.style.lineHeight = lineHeight;
        document.body.appendChild(clone);

        // ✅ Salva gli offset per usarlo al rilascio
        setTextOffsetInClone({
            x: textOffsetInCloneX,
            y: textOffsetInCloneY,
            nodeOffset: textOffsetInNode // ✅ Offset del testo nel nodo originale
        });

        // 3. Trova i dati della riga
        const rowData = nodeRows.find(row => row.id === id);

        // 4. Salva la posizione iniziale della riga per verificare se è stata spostata
        const rowElement = originalElement.closest('.node-row-outer') as HTMLElement | null;
        const initialTop = rowElement ? rowElement.getBoundingClientRect().top : 0;
        initialRowPositionRef.current = { index, top: initialTop };

        // 5. Aggiorna stato
        setIsRowDragging(true);
        setDraggedRowId(id);
        setDraggedRowIndex(index);
        const pos = { x: clientX, y: clientY };
        mousePositionRef.current = pos;
        setDragElement(clone);
        setDraggedRowData(rowData || null);
        setTargetNodeId(null);
        lastIfacePreviewKeyRef.current = null;
        draggedRowTaskRef.current = taskRepository.getTask(id);

        // 6. Cursor
        document.body.style.cursor = 'grabbing';
        document.body.style.userSelect = 'none';
    }, [getRowComponent, nodeRows]);

    // Gestione movimento del mouse
    const handleMouseMove = useCallback((e: MouseEvent) => {
        if (!isRowDragging || !dragElement) return;

        mousePositionRef.current = { x: e.clientX, y: e.clientY };
        dragElement.style.left = e.clientX + 10 + 'px';
        dragElement.style.top = e.clientY - 10 + 'px';

        // Trova il nodo sotto il mouse per cross-node drag
        const elementUnderMouse = document.elementFromPoint(e.clientX, e.clientY);
        let targetNode = elementUnderMouse?.closest('.react-flow__node');

        // ✅ Se non trovi un nodo ma stai trascinando una riga del nodo corrente,
        // usa il nodo corrente stesso (per evidenziare anche quando si trascina all'interno)
        if (!targetNode && rowsContainerRef.current) {
            // Verifica se il mouse è sopra il contenitore delle righe del nodo corrente
            const containerRect = rowsContainerRef.current.getBoundingClientRect();
            if (e.clientX >= containerRect.left && e.clientX <= containerRect.right &&
                e.clientY >= containerRect.top && e.clientY <= containerRect.bottom) {
                // Il mouse è sopra il nodo corrente, trova il nodo
                targetNode = rowsContainerRef.current.closest('.react-flow__node');
            }
        }

        // Prima rimuovi evidenziazione da tutti i nodi e ripristina classi Tailwind
        document.querySelectorAll('.react-flow__node').forEach(node => {
            const el = node as HTMLElement;
            // Rimuovi stili inline
            el.style.removeProperty('border');
            el.style.removeProperty('border-width');
            el.style.removeProperty('border-color');
            el.style.removeProperty('border-style');
            el.style.removeProperty('border-radius');
            // Rimuovi classe di evidenziazione se presente
            el.classList.remove('node-drop-highlight');
        });

        const mx = e.clientX;
        const my = e.clientY;
        let dropForbidden = false;

        if (targetNode) {
            const targetNodeIdAttr = targetNode.getAttribute('data-id');

            if (targetNodeIdAttr) {
                const dropAllowed = isSubflowPortalRowDropAllowed({
                    task: draggedRowTaskRef.current,
                    sourceFlowCanvasId: flowCanvasId,
                    sourceNodeId: nodeId,
                    targetNodeIdAttr,
                    clientX: mx,
                    clientY: my,
                    resolveFlowCanvasId: resolveFlowCanvasIdAtScreenPoint,
                });
                dropForbidden = !dropAllowed;

                if (!dropAllowed) {
                    setTargetNodeId(null);
                } else {
                    // ✅ Evidenzia il nodo di destinazione (anche se è lo stesso nodo)
                    const targetEl = targetNode as HTMLElement;

                    // ✅ Rimuovi temporaneamente le classi Tailwind del bordo per permettere allo stile inline di funzionare
                    targetEl.classList.remove('border', 'border-2', 'border-black');

                    // ✅ Aggiungi classe per identificare il nodo evidenziato
                    targetEl.classList.add('node-drop-highlight');

                    // ✅ Applica bordo verde sottile con !important
                    targetEl.style.setProperty('border', '1px solid #10b981', 'important');
                    targetEl.style.setProperty('border-radius', '8px', 'important');
                    setTargetNodeId(targetNodeIdAttr);
                }
            } else {
                setTargetNodeId(null);
                const ev = evaluateSubflowPortalRowDropAtPointer({
                    task: draggedRowTaskRef.current,
                    sourceFlowCanvasId: flowCanvasId,
                    sourceNodeId: nodeId,
                    targetNodeIdAttr: null,
                    clientX: mx,
                    clientY: my,
                    resolveFlowCanvasId: resolveFlowCanvasIdAtScreenPoint,
                });
                dropForbidden =
                    String(ev.targetFlowCanvasId).trim() === String(ev.sourceFlowCanvasId).trim() ||
                    !ev.allowed;
            }
        } else {
            setTargetNodeId(null);
            const ev = evaluateSubflowPortalRowDropAtPointer({
                task: draggedRowTaskRef.current,
                sourceFlowCanvasId: flowCanvasId,
                sourceNodeId: nodeId,
                targetNodeIdAttr: null,
                clientX: mx,
                clientY: my,
                resolveFlowCanvasId: resolveFlowCanvasIdAtScreenPoint,
            });
            dropForbidden =
                String(ev.targetFlowCanvasId).trim() === String(ev.sourceFlowCanvasId).trim() ||
                !ev.allowed;
        }

        document.body.style.cursor = dropForbidden ? 'not-allowed' : 'grabbing';

        const fcMove = String(flowCanvasId ?? 'main').trim() || 'main';
        if (fcMove) {
            const pv = computeInterfacePointerPreview(e.clientX, e.clientY, fcMove);
            const key = pv ? `${pv.flowId}|${pv.zone}|${pv.targetPathKey}|${pv.placement}` : 'null';
            if (key !== lastIfacePreviewKeyRef.current) {
                lastIfacePreviewKeyRef.current = key;
                window.dispatchEvent(
                    new CustomEvent<FlowInterfacePointerPreviewDetail | null>(FLOW_INTERFACE_POINTER_PREVIEW, {
                        detail: pv,
                    })
                );
            }
        }
    }, [isRowDragging, dragElement, nodeId, rowsContainerRef, flowCanvasId]);

    // Gestione rilascio del mouse - VERSIONE SEMPLIFICATA
    const handleMouseUp = useCallback(() => {
        if (!isRowDragging || !draggedRowId || draggedRowIndex === null) return;

        const cleanupRowDragWithoutMutation = () => {
            if (dragElement) {
                document.body.removeChild(dragElement);
            }
            const originalRowComponent = getRowComponent(draggedRowId);
            if (originalRowComponent) {
                originalRowComponent.normal();
            }
            setIsRowDragging(false);
            setDraggedRowId(null);
            setDraggedRowIndex(null);
            setDragElement(null);
            setDraggedRowData(null);
            setTargetNodeId(null);
            document.body.style.cursor = '';
            document.body.style.userSelect = '';
            initialRowPositionRef.current = null;
            draggedRowTaskRef.current = undefined;
        };

        const fcUp = String(flowCanvasId ?? 'main').trim() || 'main';
        if (fcUp) {
            lastIfacePreviewKeyRef.current = null;
            window.dispatchEvent(
                new CustomEvent<FlowInterfacePointerPreviewDetail | null>(FLOW_INTERFACE_POINTER_PREVIEW, {
                    detail: null,
                })
            );
        }

        // Drag ended

        // ✅ UNIFICATO: Mantieni evidenziazione del nodo target (sia cross-node che same-node) per feedback visivo
        // Rimuovi evidenziazione da tutti i nodi tranne quello di destinazione
        const targetNodeToKeep = targetNodeId; // Nodo da mantenere evidenziato

        document.querySelectorAll('.react-flow__node').forEach(node => {
            const el = node as HTMLElement;
            const nodeIdAttr = el.getAttribute('data-id');

            // ✅ Mantieni evidenziazione solo per il nodo target (sia cross-node che same-node)
            if (targetNodeToKeep && nodeIdAttr === targetNodeToKeep) {
                // Non rimuovere ancora - sarà rimosso dopo il timeout
                return;
            }

            // Rimuovi stili inline da tutti gli altri nodi
            el.style.removeProperty('border');
            el.style.removeProperty('border-width');
            el.style.removeProperty('border-color');
            el.style.removeProperty('border-style');
            el.style.removeProperty('border-radius');
            // Rimuovi classe di evidenziazione
            el.classList.remove('node-drop-highlight');
            // ✅ Le classi Tailwind verranno riapplicate automaticamente da React al re-render
        });

        // ✅ Funzione unificata per rimuovere evidenziazione del nodo dopo timeout
        const removeNodeHighlight = (nodeIdToRemove: string) => {
            setTimeout(() => {
                const targetNode = document.querySelector(`[data-id="${nodeIdToRemove}"]`) as HTMLElement;
                if (targetNode) {
                    targetNode.style.removeProperty('border');
                    targetNode.style.removeProperty('border-width');
                    targetNode.style.removeProperty('border-color');
                    targetNode.style.removeProperty('border-style');
                    targetNode.style.removeProperty('border-radius');
                    targetNode.classList.remove('node-drop-highlight');
                }
            }, 300); // 300ms di feedback visivo
        };

        if (targetNodeId && targetNodeId !== nodeId) {
            // CROSS-NODE DROP: Sposta la riga a un altro nodo
            const rowDataToMove = draggedRowData || nodeRows.find(row => row.id === draggedRowId);

            if (!rowDataToMove) {
                return;
            }

            const mx = mousePositionRef.current.x;
            const my = mousePositionRef.current.y;
            const ev = evaluateSubflowPortalRowDropAtPointer({
                task: draggedRowTaskRef.current,
                sourceFlowCanvasId: flowCanvasId,
                sourceNodeId: nodeId,
                targetNodeIdAttr: targetNodeId,
                clientX: mx,
                clientY: my,
                resolveFlowCanvasId: resolveFlowCanvasIdAtScreenPoint,
            });

            if (!ev.allowed) {
                if (targetNodeId) removeNodeHighlight(targetNodeId);
            } else {
            const crossNodeDetail: Record<string, unknown> = {
                fromNodeId: nodeId,
                toNodeId: targetNodeId,
                rowId: draggedRowId,
                rowData: rowDataToMove,
                originalIndex: draggedRowIndex,
                mousePosition: { x: mx, y: my },
                fromFlowCanvasId: ev.sourceFlowCanvasId,
                toFlowCanvasId: ev.targetFlowCanvasId,
                _state: { handled: false },
            };
            const crossNodeEvent = new CustomEvent('crossNodeRowMove', { detail: crossNodeDetail });
            window.dispatchEvent(crossNodeEvent);

            const storeHandled =
                (crossNodeDetail._state as { handled?: boolean } | undefined)?.handled === true;

            if (targetNodeId) {
                removeNodeHighlight(targetNodeId);
            }

            /**
             * Remove the row from the source node only when the structural orchestrator committed
             * (`handled`). If the drop was a no-op (e.g. same-flow Subflow portal skip, cross-flow
             * rejected), leaving the row avoids removing it from the origin when nothing was added
             * on the destination.
             */
            if (storeHandled) {
                const updatedRows = nodeRows.filter((row) => row.id !== draggedRowId);
                setNodeRows(updatedRows);

                if (updatedRows.length === 0) {
                    setTimeout(() => {
                        if (flowActions?.deleteNode) {
                            flowActions.deleteNode(nodeId);
                        } else if (data.onDelete) {
                            data.onDelete();
                        }
                    }, 50);
                }
            }
            }

        } else if (!targetNodeId) {
            // Drop on Flow Interface: semantic binding only — never remove or mutate node rows here.
            let handledFlowInterface = false;
            // Drag clone sits on top (fixed, high z-index); hide it so elementsFromPoint hits Interface / canvas below.
            if (dragElement) {
                dragElement.style.pointerEvents = 'none';
                dragElement.style.visibility = 'hidden';
            }
            const fc = String(flowCanvasId ?? 'main').trim() || 'main';
            if (fc) {
                const mx = mousePositionRef.current.x;
                const my = mousePositionRef.current.y;

                const backendZone = findBackendMappingZoneAtPoint(mx, my, fc);
                if (backendZone) {
                    const rowDataToMove = draggedRowData || nodeRows.find((row) => row.id === draggedRowId);
                    if (rowDataToMove) {
                        let variableRefId = rowDataToMove.meta?.variableRefId?.trim();
                        if (!variableRefId) {
                            variableRefId = generateId();
                            const nextRows = nodeRows.map((r) =>
                                r.id === rowDataToMove.id
                                    ? { ...r, meta: { ...r.meta, variableRefId } }
                                    : r
                            );
                            setNodeRows(nextRows);
                            if (flowActions?.updateNode) {
                                flowActions.updateNode(nodeId, { rows: nextRows });
                            } else if (data.onUpdate) {
                                data.onUpdate({ rows: nextRows });
                            }
                        }
                        const rowLabel = (rowDataToMove.text ?? '').trim() || 'field';
                        const detail: FlowBackendMappingPointerDropDetail = {
                            flowCanvasId: fc,
                            zone: backendZone,
                            variableRefId,
                            rowLabel,
                        };
                        window.dispatchEvent(
                            new CustomEvent<FlowBackendMappingPointerDropDetail>(FLOW_BACKEND_MAPPING_POINTER_DROP, {
                                detail,
                            })
                        );
                        handledFlowInterface = true;
                    }
                }

                if (!handledFlowInterface) {
                const dropRoot = findInterfaceZoneRootAtPoint(mx, my, fc);
                if (dropRoot) {
                    const zone = dropRoot.getAttribute('data-flow-interface-zone') as 'input' | 'output' | null;
                    const fid = String(dropRoot.getAttribute('data-flow-canvas-id') ?? '').trim();
                    if (fid === fc && (zone === 'input' || zone === 'output')) {
                        const rowDataToMove = draggedRowData || nodeRows.find((row) => row.id === draggedRowId);
                        if (rowDataToMove) {
                            if (!taskRowAllowsInterfaceVariableExpansionFromRow(rowDataToMove)) {
                                handledFlowInterface = true;
                            } else {
                                const pid = resolveProjectIdForInterfaceDrop();
                                const varIds = getVariableRefIdsBoundToTaskRow(pid, rowDataToMove.id);
                                if (varIds.length === 0) {
                                    handledFlowInterface = true;
                                } else {
                                    const rowLabel = (rowDataToMove.text ?? '').trim() || 'field';
                                    const primaryId = varIds[0]!;
                                    const wireKey = stableInterfacePathForVariable(primaryId);
                                    const pv = computeInterfacePointerPreview(mx, my, fc);
                                    const insertTargetPathKey = pv?.targetPathKey ?? null;
                                    const insertPlacement = pv?.placement ?? 'append';
                                    const detail: FlowInterfaceRowPointerDropDetail = {
                                        flowId: fid,
                                        zone,
                                        wireKey,
                                        variableRefId: primaryId,
                                        variableRefIds: varIds.length > 1 ? varIds : undefined,
                                        rowId: rowDataToMove.id,
                                        fromNodeId: nodeId,
                                        rowLabel,
                                        insertTargetPathKey,
                                        insertPlacement,
                                    };
                                    window.dispatchEvent(
                                        new CustomEvent<FlowInterfaceRowPointerDropDetail>(
                                            FLOW_INTERFACE_ROW_POINTER_DROP,
                                            {
                                                detail,
                                            }
                                        )
                                    );
                                    handledFlowInterface = true;
                                }
                            }
                        }
                    }
                }
                }
            }

            if (handledFlowInterface) {
                if (dragElement) {
                    document.body.removeChild(dragElement);
                }
                const originalRowComponent = getRowComponent(draggedRowId);
                if (originalRowComponent) {
                    originalRowComponent.normal();
                }
                setIsRowDragging(false);
                setDraggedRowId(null);
                setDraggedRowIndex(null);
                setDragElement(null);
                setDraggedRowData(null);
                setTargetNodeId(null);
                document.body.style.cursor = '';
                document.body.style.userSelect = '';
                initialRowPositionRef.current = null;
                draggedRowTaskRef.current = undefined;
                return;
            }

            // ✅ CANVAS DROP: Crea un nuovo nodo sul canvas con la riga trascinata
            const rowDataToMove = draggedRowData || nodeRows.find(row => row.id === draggedRowId);

            if (!rowDataToMove) {
                return;
            }

            // ✅ Posizione schermo del clone (position: fixed)
            // Il clone è posizionato a mousePosition + (10, -10)
            const cloneScreenX = mousePositionRef.current.x + 10;
            const cloneScreenY = mousePositionRef.current.y - 10;

            const mx = mousePositionRef.current.x;
            const my = mousePositionRef.current.y;
            const ev = evaluateSubflowPortalRowDropAtPointer({
                task: draggedRowTaskRef.current,
                sourceFlowCanvasId: flowCanvasId,
                sourceNodeId: nodeId,
                targetNodeIdAttr: null,
                clientX: mx,
                clientY: my,
                resolveFlowCanvasId: resolveFlowCanvasIdAtScreenPoint,
            });
            const dropTargetFlowId = ev.targetFlowCanvasId;
            const sourceFlowFallback = ev.sourceFlowCanvasId;

            /**
             * Same-flow pane drop (no target node under pointer): treat as cancel — do not remove the row,
             * do not spawn `createNodeFromRow` (avoids deleting the source node and creating a duplicate).
             * Cross-flow pane drop still creates a node on the destination canvas.
             */
            if (String(dropTargetFlowId).trim() === String(sourceFlowFallback).trim()) {
                cleanupRowDragWithoutMutation();
                return;
            }

            if (!ev.allowed) {
                cleanupRowDragWithoutMutation();
                return;
            }

            // Dispatch evento per creare un nuovo nodo sul canvas
            const createNodeEvent = new CustomEvent('createNodeFromRow', {
                detail: {
                    fromNodeId: nodeId,
                    rowId: draggedRowId,
                    rowData: rowDataToMove,
                    cloneScreenPosition: { x: cloneScreenX, y: cloneScreenY }, // ✅ Posizione schermo del clone
                    flowCanvasId: dropTargetFlowId,
                }
            });

            setTimeout(() => {
                window.dispatchEvent(createNodeEvent);
            }, 10);

            // Remove the row from current node
            const updatedRows = nodeRows.filter(row => row.id !== draggedRowId);
            setNodeRows(updatedRows);

            // Update node via context or fallback
            if (flowActions?.updateNode) {
                flowActions.updateNode(nodeId, { rows: updatedRows });
            } else if (data.onUpdate) {
                data.onUpdate({ rows: updatedRows });
            }

            // If source node becomes empty after move, delete it
            if (updatedRows.length === 0) {
                setTimeout(() => {
                    if (flowActions?.deleteNode) {
                        flowActions.deleteNode(nodeId);
                    } else if (data.onDelete) {
                        data.onDelete();
                    }
                }, 50); // Small delay to allow new node creation
            }

        } else {
            // SAME-NODE DROP: Internal reordering
            const elements = Array.from(rowsContainerRef.current?.querySelectorAll('.node-row-outer') || []) as HTMLElement[];
            const rects = elements.map((el, idx) => ({
                idx: Number(el.dataset.index),
                top: el.getBoundingClientRect().top,
                height: el.getBoundingClientRect().height
            }));

            let targetIndex = draggedRowIndex;
            for (const r of rects) {
                if (mousePositionRef.current.y < r.top + r.height / 2) {
                    targetIndex = r.idx;
                    break;
                }
                targetIndex = r.idx + 1;
            }

            // ✅ Verifica se la riga è stata effettivamente spostata
            // 1. Verifica se l'indice è cambiato
            const hasMovedIndex = targetIndex !== draggedRowIndex;

            // 2. Verifica se la posizione Y del mouse al rilascio è vicina alla posizione originale della riga
            const initialTop = initialRowPositionRef.current?.top ?? 0;
            const initialIndex = initialRowPositionRef.current?.index ?? draggedRowIndex;

            // Trova la posizione Y centrale della riga originale
            const originalRowElement = elements.find(el => Number(el.dataset.index) === initialIndex);
            const originalRowCenter = originalRowElement
                ? originalRowElement.getBoundingClientRect().top + originalRowElement.getBoundingClientRect().height / 2
                : initialTop;

            // Calcola la distanza tra la posizione Y del mouse e la posizione originale della riga
            const verticalDistance = Math.abs(mousePositionRef.current.y - originalRowCenter);
            const threshold = 30; // Soglia di 30px: se il mouse è entro 30px dalla posizione originale, non spostare

            // Execute reordering only if:
            // - Index has changed AND
            // - Mouse has moved far enough from original position
            if (hasMovedIndex && verticalDistance > threshold) {
                const updatedRows = [...nodeRows];
                const draggedRow = updatedRows[draggedRowIndex];
                updatedRows.splice(draggedRowIndex, 1);
                updatedRows.splice(targetIndex, 0, draggedRow);

                setNodeRows(updatedRows);

                // Update node via context or fallback
                if (flowActions?.updateNode) {
                    flowActions.updateNode(nodeId, { rows: updatedRows });
                } else if (data.onUpdate) {
                    data.onUpdate({ rows: updatedRows });
                }

                // Highlight row immediately after drop
                // Usa requestAnimationFrame per assicurarsi che il DOM sia aggiornato
                requestAnimationFrame(() => {
                    const rowComponent = getRowComponent(draggedRow.id);
                    if (rowComponent) {
                        rowComponent.highlight();
                    }
                });

                // Remeasure node width after React commits new row order (layout + paint)
                requestAnimationFrame(() => {
                    requestAnimationFrame(() => {
                        onSameNodeRowsReordered?.();
                    });
                });
            } else {
                // ✅ La riga non è stata spostata - non fare nulla
                // Rimuovi solo l'evidenziazione del nodo
                if (targetNodeId === nodeId) {
                    removeNodeHighlight(nodeId);
                }
            }

            // ✅ Pulisci il ref della posizione iniziale
            initialRowPositionRef.current = null;
        }

        // Cleanup
        if (dragElement) {
            document.body.removeChild(dragElement);
        }

        // Ripristina lo stato normale della riga originale
        const originalRowComponent = getRowComponent(draggedRowId);
        if (originalRowComponent) {
            originalRowComponent.normal();
        }

        setIsRowDragging(false);
        setDraggedRowId(null);
        setDraggedRowIndex(null);
        setDragElement(null);
        setDraggedRowData(null);
        setTargetNodeId(null);
        draggedRowTaskRef.current = undefined;

        document.body.style.cursor = '';
        document.body.style.userSelect = '';
    }, [isRowDragging, draggedRowId, draggedRowIndex, nodeRows, setNodeRows, data, dragElement, rowsContainerRef, targetNodeId, nodeId, draggedRowData, getRowComponent, flowCanvasId, flowActions, onSameNodeRowsReordered]);

    // Event listeners
    useEffect(() => {
        if (isRowDragging) {
            window.addEventListener('mousemove', handleMouseMove);
            window.addEventListener('mouseup', handleMouseUp);
            return () => {
                window.removeEventListener('mousemove', handleMouseMove);
                window.removeEventListener('mouseup', handleMouseUp);
            };
        }
    }, [isRowDragging, handleMouseMove, handleMouseUp]);

    return {
        isRowDragging,
        draggedRowId,
        handleRowDragStart
    };
}

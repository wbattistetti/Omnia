import { useState, useCallback, useEffect, useRef } from 'react';
import { NodeRowData } from '../../../../../types/project';
import type { Task } from '../../../../../types/taskTypes';
import { useRowRegistry } from '../../../rows/NodeRow/hooks/useRowRegistry';
import { useFlowActionsStrict } from '../../../../../context/FlowActionsContext';
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
import type { NodeRowsCommitOptions } from './useNodeRowManagement';
import { resolveCrossNodeDropHitTest } from '../../../utils/crossNodeRowDropHitTest';
import {
    buildCrossNodeRowMoveDetail,
    newDndTraceId,
    inferDndRowCommandKind,
    warnLocalGraphMutation,
    logDndRouting,
    buildDragPayloadSameNodeReorder,
    buildDragPayloadCanvasExtract,
} from '@domain/flowGraph';
import { isDndOperationInstrumentEnabled, setActiveDndOperationId, clearActiveDndOperationId } from '@utils/dndOperationInstrument';

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

/**
 * Insert index for cross-node drops: same half-row logic as same-node reorder (see mouseup branch).
 * Returns undefined if the target RF node is not in the DOM (structural move still appends).
 */
function computeTargetRowInsertIndexFromDom(targetNodeId: string, clientY: number): number | undefined {
  let root: HTMLElement | null = null;
  try {
    root = document.querySelector(`[data-id="${CSS.escape(targetNodeId)}"]`) as HTMLElement | null;
  } catch {
    root = document.querySelector(`[data-id="${targetNodeId}"]`) as HTMLElement | null;
  }
  if (!root) return undefined;
  const elements = Array.from(root.querySelectorAll('.node-row-outer')) as HTMLElement[];
  if (elements.length === 0) return 0;

  const rects = elements.map((el) => ({
    idx: Number(el.dataset.index),
    top: el.getBoundingClientRect().top,
    height: el.getBoundingClientRect().height,
  }));
  rects.sort((a, b) => a.idx - b.idx);

  let targetIndex = 0;
  for (const r of rects) {
    if (Number.isNaN(r.idx)) continue;
    if (clientY < r.top + r.height / 2) {
      targetIndex = r.idx;
      break;
    }
    targetIndex = r.idx + 1;
  }
  return targetIndex;
}

/** Nodo React Flow sotto il puntatore al drop (clone nascosto dal chiamante per hit-test affidabile). */
function resolveReactFlowNodeIdUnderPoint(clientX: number, clientY: number): string | null {
  try {
    const topEl = document.elementFromPoint(clientX, clientY);
    return topEl?.closest('.react-flow__node')?.getAttribute('data-id')?.trim() ?? null;
  } catch {
    return null;
  }
}

/**
 * Extra margin around the rows container / RF node shell so a release still counts as same-node reorder
 * when the pointer sits on chrome, padding, or 1–2 px outside (avoids misrouting to canvas extract).
 * Keep small so pane drops clearly outside the source node still create a new node.
 */
const SAME_NODE_DROP_TOLERANCE_PX = 10;

function getReactFlowNodeShellElement(nodeId: string): HTMLElement | null {
  try {
    return document.querySelector(`[data-id="${CSS.escape(nodeId)}"]`) as HTMLElement | null;
  } catch {
    return document.querySelector(`[data-id="${nodeId}"]`) as HTMLElement | null;
  }
}

function isPointInsideExpandedRect(
  x: number,
  y: number,
  rect: DOMRectReadOnly,
  padPx: number
): boolean {
  return (
    x >= rect.left - padPx &&
    x <= rect.right + padPx &&
    y >= rect.top - padPx &&
    y <= rect.bottom + padPx
  );
}

/**
 * Vertical slack when comparing `clientY` to row midpoints for same-node reorder.
 * Gaps between `.node-row-outer` blocks + float rounding can leave the pointer between midlines;
 * a few px bias avoids false `targetIndex === draggedRowIndex` when the dashed preview shows a slot.
 */
const SAME_NODE_ROW_INSERT_EPS_PX = 3;

/**
 * Computes drop index (0..N, same semantics as the legacy loop on all rows: insert before `idx`,
 * or `N` after the last row). **Excludes** the dragged row shell so gaps between other rows map to
 * real moves instead of no-ops (the dragged row's rect sat in the gap between neighbours).
 */
function computeSameNodeReorderTargetIndex(
  rowsContainer: HTMLElement | null,
  clientY: number,
  draggedRowIndex: number
): number {
  const elements = Array.from(rowsContainer?.querySelectorAll('.node-row-outer') ?? []).filter(
    (el) => (el as HTMLElement).getAttribute('data-being-dragged') !== 'true'
  ) as HTMLElement[];
  const rects = elements
    .map((el) => ({
      idx: Number(el.dataset.index),
      top: el.getBoundingClientRect().top,
      height: el.getBoundingClientRect().height,
    }))
    .filter((r) => !Number.isNaN(r.idx));
  rects.sort((a, b) => a.idx - b.idx);

  let targetIndex = draggedRowIndex;
  for (const r of rects) {
    const midY = r.top + r.height / 2;
    if (clientY < midY + SAME_NODE_ROW_INSERT_EPS_PX) {
      targetIndex = r.idx;
      break;
    }
    targetIndex = r.idx + 1;
  }
  return targetIndex;
}

interface UseNodeDragDropProps {
    nodeRows: NodeRowData[];
    setNodeRows: (rows: NodeRowData[], options?: NodeRowsCommitOptions) => void;
    data: any;
    rowsContainerRef: React.RefObject<HTMLElement>;
    nodeId: string;
    /** Current flow canvas id — enables drop on Interface INPUT/OUTPUT without removing the row. */
    flowCanvasId?: string;
    /** Called after same-node row reorder commits so the node can remeasure width (DOM order updates after setState). */
    onSameNodeRowsReordered?: () => void;
    /**
     * Pane drop → new node: single structural `moveTaskRowToCanvas` (no `createNodeFromRow` / local row strip).
     * Return true when FlowStore commit succeeded.
     */
    applyCanvasRowExtractStructural?: (args: {
        screenPosition: { x: number; y: number };
        fromFlowId: string;
        toFlowId: string;
        rowId: string;
        operationId: string;
    }) => boolean;
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
    applyCanvasRowExtractStructural,
}: UseNodeDragDropProps) {
    const flowActions = useFlowActionsStrict();

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
    /** Drag preview clone appended to `document.body` — ref avoids re-subscribing mouseup/move on each setState during drag. */
    const dragCloneRef = useRef<HTMLElement | null>(null);
    const [draggedRowData, setDraggedRowData] = useState<NodeRowData | null>(null);
    const [targetNodeId, setTargetNodeId] = useState<string | null>(null);
    const [textOffsetInClone, setTextOffsetInClone] = useState<{ x: number; y: number; nodeOffset?: { x: number; y: number } } | null>(null);

    // Gestione drag start personalizzato
    const handleRowDragStart = useCallback((id: string, index: number, clientX: number, clientY: number, originalElement: HTMLElement) => {
        clearActiveDndOperationId();
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
        dragCloneRef.current = clone;
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
        const cloneEl = dragCloneRef.current;
        if (!isRowDragging || !cloneEl) return;

        mousePositionRef.current = { x: e.clientX, y: e.clientY };
        cloneEl.style.left = e.clientX + 10 + 'px';
        cloneEl.style.top = e.clientY - 10 + 'px';

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
    }, [isRowDragging, nodeId, rowsContainerRef, flowCanvasId]);

    // Gestione rilascio del mouse - VERSIONE SEMPLIFICATA
    const handleMouseUp = useCallback((event?: MouseEvent) => {
        if (!isRowDragging || !draggedRowId || draggedRowIndex === null) return;

        /** Ultimo mousemove può non arrivare prima del mouseup — usa le coordinate reali del rilascio. */
        if (event && typeof event.clientX === 'number' && typeof event.clientY === 'number') {
            mousePositionRef.current = { x: event.clientX, y: event.clientY };
        }

        const operationId = newDndTraceId();
        setActiveDndOperationId(operationId);

        const cleanupRowDragWithoutMutation = () => {
            const cloneEl = dragCloneRef.current;
            if (cloneEl?.parentNode) {
                cloneEl.parentNode.removeChild(cloneEl);
            }
            dragCloneRef.current = null;
            const originalRowComponent = getRowComponent(draggedRowId);
            if (originalRowComponent) {
                originalRowComponent.normal();
            }
            setIsRowDragging(false);
            setDraggedRowId(null);
            setDraggedRowIndex(null);
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

        /**
         * Remove the empty React Flow shell after the last row left this node (cross-node / pane drop).
         *
         * **Must use only `flowActions.deleteNode` (graph filter)** — never `data.onDelete` /
         * `deleteNodeWithLog` here: right after structural commit / DnD, RF `nodes` can still be **stale** and list
         * rows whose tasks were already moved. `deleteNodeWithLog` would then call `taskRepository.deleteTask`
         * for those rows and destroy live tasks on the destination.
         */
        const scheduleRemoveEmptySourceNode = () => {
            queueMicrotask(() => {
                try {
                    flowActions.deleteNode(nodeId);
                } catch (e) {
                    console.error('[useNodeDragDrop] Failed to remove empty source node from graph', e);
                }
            });
        };

        const mx = mousePositionRef.current.x;
        const my = mousePositionRef.current.y;

        const cloneForHit = dragCloneRef.current;
        if (cloneForHit) {
            cloneForHit.style.pointerEvents = 'none';
            cloneForHit.style.visibility = 'hidden';
        }
        let hitRfNodeId: string | null = null;
        try {
            hitRfNodeId = resolveReactFlowNodeIdUnderPoint(mx, my);
        } catch {
            hitRfNodeId = null;
        }
        const rowsRectPre = rowsContainerRef.current?.getBoundingClientRect();
        const insideSourceRowsPre = !!(
            rowsRectPre &&
            mx >= rowsRectPre.left &&
            mx <= rowsRectPre.right &&
            my >= rowsRectPre.top &&
            my <= rowsRectPre.bottom
        );
        const rfShell = getReactFlowNodeShellElement(nodeId);
        const rfRect = rfShell?.getBoundingClientRect();
        const insideSourceRfShellPre = !!(
            rfRect && isPointInsideExpandedRect(mx, my, rfRect, SAME_NODE_DROP_TOLERANCE_PX)
        );
        /**
         * Geometry + hit-test at mouseup — do not OR `targetNodeId === nodeId` here: stale highlight
         * would turn a pane drop into same-node reorder. Do not use stale `targetNodeId` for cross-node
         * when `hitRfNodeId` is null (would steal canvas drops).
         */
        const sameNodeIntentPre =
            hitRfNodeId === nodeId || insideSourceRowsPre || insideSourceRfShellPre;

        /** Only trust elementFromPoint at release — never a stale React highlight from mousemove. */
        const crossTargetId: string | null =
            !sameNodeIntentPre && hitRfNodeId && hitRfNodeId !== nodeId ? hitRfNodeId : null;

        if (crossTargetId) {
            // CROSS-NODE DROP: Sposta la riga a un altro nodo
            const rowDataToMove = draggedRowData || nodeRows.find(row => row.id === draggedRowId);

            if (!rowDataToMove) {
                if (cloneForHit) {
                    cloneForHit.style.pointerEvents = '';
                    cloneForHit.style.visibility = '';
                }
                cleanupRowDragWithoutMutation();
                return;
            }

            try {
                const ev = evaluateSubflowPortalRowDropAtPointer({
                    task: draggedRowTaskRef.current,
                    sourceFlowCanvasId: flowCanvasId,
                    sourceNodeId: nodeId,
                    targetNodeIdAttr: crossTargetId,
                    clientX: mx,
                    clientY: my,
                    resolveFlowCanvasId: resolveFlowCanvasIdAtScreenPoint,
                });

                if (!ev.allowed) {
                    removeNodeHighlight(crossTargetId);
                } else {
                    const insertIdx = computeTargetRowInsertIndexFromDom(crossTargetId, my);
                    const dragCloneHidden = Boolean(cloneForHit);
                    const hit = resolveCrossNodeDropHitTest(mx, my, crossTargetId, {
                        operationId,
                        dragCloneHidden,
                    });
                    const crossNodeDetail = buildCrossNodeRowMoveDetail({
                        fromNodeId: nodeId,
                        toNodeId: crossTargetId,
                        draggedRowId: draggedRowId!,
                        rowData: rowDataToMove,
                        draggedRowIndex: draggedRowIndex,
                        mousePosition: { x: mx, y: my },
                        fromFlowCanvasId: ev.sourceFlowCanvasId,
                        toFlowCanvasId: ev.targetFlowCanvasId,
                        targetRowId: hit.targetRowId,
                        targetRegion: hit.targetRegion,
                        portalRowIdOnTargetNode: hit.portalRowIdOnTargetNode,
                        dndTraceId: operationId,
                        operationId,
                        ...(insertIdx !== undefined ? { targetRowInsertIndex: insertIdx } : {}),
                    }) as Record<string, unknown>;

                    try {
                        const kind = inferDndRowCommandKind({
                            operation: 'move',
                            rowId: draggedRowId!,
                            rowData: rowDataToMove,
                            sourceFlowId: flowCanvasId ?? 'main',
                            sourceNodeId: nodeId,
                            sourceIndex: draggedRowIndex ?? 0,
                            targetFlowId: ev.targetFlowCanvasId,
                            targetNodeId: crossTargetId,
                            targetRowId: hit.targetRowId,
                            targetRegion: hit.targetRegion,
                            ...(insertIdx !== undefined ? { targetRowInsertIndex: insertIdx } : {}),
                        });
                        logDndRouting('cross-node', {
                            commandKind: kind,
                            targetNodeId: crossTargetId,
                            targetRegion: hit.targetRegion,
                            targetRowId: hit.targetRowId,
                        });
                    } catch {
                        /* noop */
                    }
                    const crossNodeEvent = new CustomEvent('crossNodeRowMove', { detail: crossNodeDetail });
                    window.dispatchEvent(crossNodeEvent);

                    const storeHandled =
                        (crossNodeDetail._state as { handled?: boolean } | undefined)?.handled === true;

                    removeNodeHighlight(crossTargetId);

                    /**
                     * Remove the row from the source node only when the structural orchestrator committed
                     * (`handled`). If the drop was a no-op (e.g. cross-flow rejected, or portal drop pending
                     * another handler), leaving the row avoids removing it from the origin when nothing was added
                     * on the destination.
                     */
                    if (storeHandled) {
                        const updatedRows = nodeRows.filter((row) => row.id !== draggedRowId);
                        if (updatedRows.length === 0) {
                            scheduleRemoveEmptySourceNode();
                        }
                    }
                }
            } finally {
                if (cloneForHit) {
                    cloneForHit.style.pointerEvents = '';
                    cloneForHit.style.visibility = '';
                }
            }

        } else if (!sameNodeIntentPre) {
            // Flow Interface / empty pane: semantic binding or new node on canvas (not cross-node / not same-node).
            let handledFlowInterface = false;
            // Drag clone sits on top (fixed, high z-index); hide it so elementsFromPoint hits Interface / canvas below.
            const cloneForIface = dragCloneRef.current;
            if (cloneForIface) {
                cloneForIface.style.pointerEvents = 'none';
                cloneForIface.style.visibility = 'hidden';
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
                const ifaceClone = dragCloneRef.current;
                if (ifaceClone?.parentNode) {
                    ifaceClone.parentNode.removeChild(ifaceClone);
                }
                dragCloneRef.current = null;
                const originalRowComponent = getRowComponent(draggedRowId);
                if (originalRowComponent) {
                    originalRowComponent.normal();
                }
                setIsRowDragging(false);
                setDraggedRowId(null);
                setDraggedRowIndex(null);
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
                cleanupRowDragWithoutMutation();
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
             * Cross-canvas portal or regular pane drop: create a new node on the destination canvas.
             * Subflow-specific guards (recursive nesting) are handled by `ev.allowed` below.
             */
            if (!ev.allowed) {
                cleanupRowDragWithoutMutation();
                return;
            }

            if (isDndOperationInstrumentEnabled()) {
                console.log('[DnD:canvasExtractRow]', {
                    operationId,
                    dndTraceId: operationId,
                    rowId: draggedRowId!,
                    sourceFlowId: sourceFlowFallback,
                    targetFlowId: dropTargetFlowId,
                });
            }

            try {
                const kind = inferDndRowCommandKind(
                    buildDragPayloadCanvasExtract({
                        flowCanvasId: flowCanvasId ?? 'main',
                        sourceNodeId: nodeId,
                        rowId: draggedRowId!,
                        rowData: rowDataToMove,
                        sourceIndex: draggedRowIndex ?? 0,
                        targetFlowCanvasId: dropTargetFlowId,
                    })
                );
                logDndRouting('canvas→newNode', {
                    commandKind: kind,
                    targetFlowCanvasId: dropTargetFlowId,
                });
            } catch {
                /* noop */
            }

            const structuralOk =
                typeof applyCanvasRowExtractStructural === 'function' &&
                applyCanvasRowExtractStructural({
                    screenPosition: { x: cloneScreenX, y: cloneScreenY },
                    fromFlowId: sourceFlowFallback,
                    toFlowId: dropTargetFlowId,
                    rowId: draggedRowId!,
                    operationId,
                });

            if (structuralOk) {
                if (nodeRows.length === 1) {
                    scheduleRemoveEmptySourceNode();
                }
            }

        } else if (sameNodeIntentPre) {
            // SAME-NODE DROP: Internal reordering
            if (cloneForHit) {
                cloneForHit.style.pointerEvents = '';
                cloneForHit.style.visibility = '';
            }
            const targetIndex = computeSameNodeReorderTargetIndex(rowsContainerRef.current, my, draggedRowIndex!);

            const hasMovedIndex = targetIndex !== draggedRowIndex;

            // Solo indice calcolato dalla hit-area delle righe: niente soglia verticale sul mouse.
            // Una soglia (es. 30px dal centro riga originale) bloccava riordini validi tra righe adiacenti
            // (il puntatore restava vicino al centro della riga di partenza pur cambiando slot).
            if (hasMovedIndex) {
                try {
                    const kind = inferDndRowCommandKind(
                        buildDragPayloadSameNodeReorder({
                            flowCanvasId: flowCanvasId ?? 'main',
                            nodeId,
                            rowId: draggedRowId!,
                            rowData: nodeRows[draggedRowIndex]!,
                            sourceIndex: draggedRowIndex,
                            targetRowInsertIndex: targetIndex,
                        })
                    );
                    logDndRouting('same-node-reorder', { commandKind: kind, targetIndex });
                } catch {
                    /* noop */
                }

                const structuralInsert =
                    targetIndex > draggedRowIndex ? targetIndex - 1 : targetIndex;

                const rowPayload = draggedRowData || nodeRows[draggedRowIndex];
                const sameNodeDetail = buildCrossNodeRowMoveDetail({
                    fromNodeId: nodeId,
                    toNodeId: nodeId,
                    draggedRowId: draggedRowId!,
                    rowData: rowPayload!,
                    draggedRowIndex,
                    mousePosition: { ...mousePositionRef.current },
                    fromFlowCanvasId: fcUp,
                    toFlowCanvasId: fcUp,
                    targetRowId: null,
                    targetRegion: 'row',
                    dndTraceId: operationId,
                    operationId,
                    targetRowInsertIndex: structuralInsert,
                }) as Record<string, unknown>;

                window.dispatchEvent(new CustomEvent('crossNodeRowMove', { detail: sameNodeDetail }));

                const reorderHandled =
                    (sameNodeDetail._state as { handled?: boolean } | undefined)?.handled === true;

                if (reorderHandled) {
                    const rid = draggedRowId!;
                    requestAnimationFrame(() => {
                        const rowComponent = getRowComponent(rid);
                        if (rowComponent) {
                            rowComponent.highlight();
                        }
                    });

                    requestAnimationFrame(() => {
                        requestAnimationFrame(() => {
                            onSameNodeRowsReordered?.();
                        });
                    });
                }
            } else {
                // ✅ La riga non è stata spostata - non fare nulla
                // Rimuovi solo l'evidenziazione del nodo
                if (targetNodeId === nodeId || hitRfNodeId === nodeId) {
                    removeNodeHighlight(nodeId);
                }
            }

            // ✅ Pulisci il ref della posizione iniziale
            initialRowPositionRef.current = null;
        }

        // Cleanup (guard: flow-interface branch may have removed the clone already)
        const cloneAtEnd = dragCloneRef.current;
        if (cloneAtEnd?.parentNode) {
            cloneAtEnd.parentNode.removeChild(cloneAtEnd);
        }
        dragCloneRef.current = null;

        // Ripristina lo stato normale della riga originale
        const originalRowComponent = getRowComponent(draggedRowId);
        if (originalRowComponent) {
            originalRowComponent.normal();
        }

        setIsRowDragging(false);
        setDraggedRowId(null);
        setDraggedRowIndex(null);
        setDraggedRowData(null);
        setTargetNodeId(null);
        draggedRowTaskRef.current = undefined;

        document.body.style.cursor = '';
        document.body.style.userSelect = '';
    }, [
        isRowDragging,
        draggedRowId,
        draggedRowIndex,
        nodeRows,
        setNodeRows,
        data,
        rowsContainerRef,
        targetNodeId,
        nodeId,
        draggedRowData,
        getRowComponent,
        flowCanvasId,
        flowActions,
        onSameNodeRowsReordered,
        applyCanvasRowExtractStructural,
    ]);

    // Event listeners
    useEffect(() => {
        if (isRowDragging) {
            window.addEventListener('mousemove', handleMouseMove);
            const onUp = (ev: MouseEvent) => handleMouseUp(ev);
            window.addEventListener('mouseup', onUp);
            return () => {
                window.removeEventListener('mousemove', handleMouseMove);
                window.removeEventListener('mouseup', onUp);
            };
        }
    }, [isRowDragging, handleMouseMove, handleMouseUp]);

    return {
        isRowDragging,
        draggedRowId,
        handleRowDragStart
    };
}

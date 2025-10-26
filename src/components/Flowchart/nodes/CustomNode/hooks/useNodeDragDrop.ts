import { useState, useCallback, useEffect, useRef } from 'react';
import { NodeRowData } from '../../../../../types/project';
import { useRowRegistry } from '../../../rows/NodeRow/hooks/useRowRegistry';

interface UseNodeDragDropProps {
    nodeRows: NodeRowData[];
    setNodeRows: (rows: NodeRowData[]) => void;
    data: any;
    rowsContainerRef: React.RefObject<HTMLElement>;
    nodeId: string; // ID del nodo corrente per identificare il nodo di origine
}

/**
 * Hook per gestire il drag & drop personalizzato delle righe
 * Approccio: Mouse down → Crea immagine che segue il mouse → Mouse up → Inserisci/rimuovi
 */
export function useNodeDragDrop({
    nodeRows,
    setNodeRows,
    data,
    rowsContainerRef,
    nodeId
}: UseNodeDragDropProps) {
    // Registry per accedere ai componenti NodeRow
    const { getRowComponent } = useRowRegistry();

    // Stato per il drag personalizzato
    const [isRowDragging, setIsRowDragging] = useState(false);
    const [draggedRowId, setDraggedRowId] = useState<string | null>(null);
    const [draggedRowIndex, setDraggedRowIndex] = useState<number | null>(null);
    const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 });
    const [dragElement, setDragElement] = useState<HTMLElement | null>(null);
    const [draggedRowData, setDraggedRowData] = useState<NodeRowData | null>(null);
    const [targetNodeId, setTargetNodeId] = useState<string | null>(null);

    // Gestione drag start personalizzato - VERSIONE SEMPLIFICATA
    const handleRowDragStart = useCallback((id: string, index: number, clientX: number, clientY: number, originalElement: HTMLElement) => {
        // 1. Trova il componente NodeRow e fai il fade
        const rowComponent = getRowComponent(id);
        if (rowComponent) {
            rowComponent.fade();
        }

        // 2. Crea clone semplice per il drag visual
        const clone = originalElement.cloneNode(true) as HTMLElement;
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
        document.body.appendChild(clone);

        // 3. Trova i dati della riga
        const rowData = nodeRows.find(row => row.id === id);

        // 4. Aggiorna stato
        setIsRowDragging(true);
        setDraggedRowId(id);
        setDraggedRowIndex(index);
        setMousePosition({ x: clientX, y: clientY });
        setDragElement(clone);
        setDraggedRowData(rowData || null);
        setTargetNodeId(null);

        // 5. Cursor
        document.body.style.cursor = 'grabbing';
        document.body.style.userSelect = 'none';

    }, [getRowComponent, nodeRows]);

    // Gestione movimento del mouse
    const handleMouseMove = useCallback((e: MouseEvent) => {
        if (!isRowDragging || !dragElement) return;

        setMousePosition({ x: e.clientX, y: e.clientY });
        dragElement.style.left = e.clientX + 10 + 'px';
        dragElement.style.top = e.clientY - 10 + 'px';

        // Trova il nodo sotto il mouse per cross-node drag
        const elementUnderMouse = document.elementFromPoint(e.clientX, e.clientY);
        const targetNode = elementUnderMouse?.closest('.react-flow__node');

        if (targetNode) {
            const targetNodeId = targetNode.getAttribute('data-id');
            const isDifferentNode = targetNodeId && targetNodeId !== nodeId;

            if (isDifferentNode) {
                // Evidenzia il nodo di destinazione
                targetNode.style.border = '2px solid #10b981'; // Verde per indicare drop valido
                targetNode.style.borderRadius = '8px';
                setTargetNodeId(targetNodeId);
            } else {
                // Rimuovi evidenziazione se è lo stesso nodo
                targetNode.style.border = '';
                setTargetNodeId(null);
            }
        } else {
            // Rimuovi evidenziazione se non c'è nessun nodo
            document.querySelectorAll('.react-flow__node').forEach(node => {
                node.style.border = '';
            });
            setTargetNodeId(null);
        }
    }, [isRowDragging, dragElement, nodeId]);

    // Gestione rilascio del mouse - VERSIONE SEMPLIFICATA
    const handleMouseUp = useCallback(() => {
        if (!isRowDragging || !draggedRowId || draggedRowIndex === null) return;

        // Drag ended

        // Rimuovi evidenziazione da tutti i nodi
        document.querySelectorAll('.react-flow__node').forEach(node => {
            node.style.border = '';
        });

        if (targetNodeId && targetNodeId !== nodeId) {
            // CROSS-NODE DROP: Sposta la riga a un altro nodo
            const rowDataToMove = draggedRowData || nodeRows.find(row => row.id === draggedRowId);

            if (!rowDataToMove) {
                return;
            }

            // Dispatch evento per cross-node move
            const crossNodeEvent = new CustomEvent('crossNodeRowMove', {
                detail: {
                    fromNodeId: nodeId,
                    toNodeId: targetNodeId,
                    rowId: draggedRowId,
                    rowData: rowDataToMove,
                    originalIndex: draggedRowIndex,
                    mousePosition: { x: mousePosition.x, y: mousePosition.y }
                }
            });

            setTimeout(() => {
                window.dispatchEvent(crossNodeEvent);
            }, 10);

            // Rimuovi la riga dal nodo corrente
            const updatedRows = nodeRows.filter(row => row.id !== draggedRowId);
            setNodeRows(updatedRows);

            if (data.onUpdate) {
                data.onUpdate({ rows: updatedRows });
            }

        } else {
            // SAME-NODE DROP: Riordinamento interno
            const elements = Array.from(rowsContainerRef.current?.querySelectorAll('.node-row-outer') || []) as HTMLElement[];
            const rects = elements.map((el, idx) => ({
                idx: Number(el.dataset.index),
                top: el.getBoundingClientRect().top,
                height: el.getBoundingClientRect().height
            }));

            let targetIndex = draggedRowIndex;
            for (const r of rects) {
                if (mousePosition.y < r.top + r.height / 2) {
                    targetIndex = r.idx;
                    break;
                }
                targetIndex = r.idx + 1;
            }

            // Esegui il riordinamento se necessario
            if (targetIndex !== draggedRowIndex) {
                const updatedRows = [...nodeRows];
                const draggedRow = updatedRows[draggedRowIndex];
                updatedRows.splice(draggedRowIndex, 1);
                updatedRows.splice(targetIndex, 0, draggedRow);

                setNodeRows(updatedRows);

                if (data.onUpdate) {
                    data.onUpdate({ rows: updatedRows });
                }

                // ELEGANTE: Usa il componente per l'evidenziazione
                const rowComponent = getRowComponent(draggedRow.id);
                console.log('🎯 [SameNode] Highlighting row after drop:', {
                    rowId: draggedRow.id,
                    rowComponent: !!rowComponent
                });
                if (rowComponent) {
                    rowComponent.highlight();
                } else {
                    console.warn('🎯 [SameNode] Row component not found in registry:', draggedRow.id);
                }
            }
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

        document.body.style.cursor = '';
        document.body.style.userSelect = '';
    }, [isRowDragging, draggedRowId, draggedRowIndex, mousePosition, nodeRows, setNodeRows, data, dragElement, rowsContainerRef, targetNodeId, nodeId, draggedRowData, getRowComponent]);

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

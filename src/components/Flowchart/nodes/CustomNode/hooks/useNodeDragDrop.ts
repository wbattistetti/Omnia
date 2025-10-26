import { useState, useCallback, useEffect, useRef } from 'react';
import { NodeRowData } from '../../../../../types/project';

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
    // Stato per il drag personalizzato
    const [isRowDragging, setIsRowDragging] = useState(false);
    const [draggedRowId, setDraggedRowId] = useState<string | null>(null);
    const [draggedRowIndex, setDraggedRowIndex] = useState<number | null>(null);
    const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 });
    const [dragElement, setDragElement] = useState<HTMLElement | null>(null);
    const [draggedRowData, setDraggedRowData] = useState<NodeRowData | null>(null);
    const [targetNodeId, setTargetNodeId] = useState<string | null>(null);

    // Gestione drag start personalizzato
    const handleRowDragStart = useCallback((id: string, index: number, clientX: number, clientY: number, originalElement: HTMLElement) => {
        console.log('🎯 [CustomDrag] Starting drag', { id, index, clientX, clientY });

        // Trova l'icona nell'elemento originale
        const iconElement = originalElement.querySelector('.icon, [class*="icon"], svg, .ear-icon, [data-icon], i[class*="icon"]');
        const iconRect = iconElement?.getBoundingClientRect();
        const originalRect = originalElement.getBoundingClientRect();

        // Calcola l'offset dell'icona rispetto all'inizio dell'elemento
        const iconOffset = iconRect ? iconRect.left - originalRect.left : 0;

        console.log('🎯 [CustomDrag] Icon calculation', {
            iconElement: !!iconElement,
            iconOffset,
            iconRect: iconRect ? { left: iconRect.left, width: iconRect.width } : null,
            originalRect: { left: originalRect.left, width: originalRect.width }
        });

        // Crea clone dell'elemento originale
        const clone = originalElement.cloneNode(true) as HTMLElement;

        // Ritaglia precisamente dall'inizio dell'icona
        clone.style.overflow = 'hidden';
        clone.style.width = 'fit-content';
        clone.style.maxWidth = '300px';
        clone.style.marginLeft = `-${iconOffset}px`;
        clone.style.paddingLeft = `${iconOffset}px`;

        // Stili per l'elemento trascinato
        clone.style.position = 'fixed';
        clone.style.pointerEvents = 'none';
        clone.style.zIndex = '9999';
        clone.style.opacity = '0.9';
        clone.style.left = clientX + 10 + 'px';
        clone.style.top = clientY - 10 + 'px';
        clone.style.transform = 'none';
        clone.style.border = '2px solid #3b82f6';
        clone.style.borderRadius = '4px';
        clone.style.backgroundColor = '#e6f3ff'; // Azzurrino pallido
        clone.style.padding = '8px 12px';
        clone.style.boxShadow = '0 4px 12px rgba(0,0,0,0.15)';

        // Aggiungi al DOM
        document.body.appendChild(clone);

        // Trova i dati della riga trascinata
        const rowData = nodeRows.find(row => row.id === id);

        console.log('🎯 [CustomDrag] Row data found', {
            rowId: id,
            rowData: rowData,
            hasRowData: !!rowData
        });

        // Aggiorna stato
        setIsRowDragging(true);
        setDraggedRowId(id);
        setDraggedRowIndex(index);
        setMousePosition({ x: clientX, y: clientY });
        setDragElement(clone);
        setDraggedRowData(rowData || null);
        setTargetNodeId(null);

        // Cursor
        document.body.style.cursor = 'grabbing';
        document.body.style.userSelect = 'none';

    }, []);

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

    // Gestione rilascio del mouse
    const handleMouseUp = useCallback(() => {
        if (!isRowDragging || !draggedRowId || draggedRowIndex === null) return;

        console.log('🎯 [CustomDrag] Ending drag', {
            draggedRowId,
            draggedRowIndex,
            targetNodeId,
            isCrossNode: !!targetNodeId && targetNodeId !== nodeId
        });

        // Rimuovi evidenziazione da tutti i nodi
        document.querySelectorAll('.react-flow__node').forEach(node => {
            node.style.border = '';
        });

        if (targetNodeId && targetNodeId !== nodeId) {
            // CROSS-NODE DROP: Sposta la riga a un altro nodo

            // IMPORTANTE: Salva i dati della riga PRIMA di rimuoverla
            const rowDataToMove = draggedRowData || nodeRows.find(row => row.id === draggedRowId);

            console.log('🎯 [CrossNode] Moving row to different node', {
                from: nodeId,
                to: targetNodeId,
                rowId: draggedRowId,
                rowData: rowDataToMove,
                wasInState: !!draggedRowData,
                foundInNodeRows: !!nodeRows.find(row => row.id === draggedRowId)
            });

            // Verifica che rowData sia valido
            if (!rowDataToMove) {
                console.error('🎯 [CrossNode] ERROR: rowData is null/undefined after all attempts');
                return;
            }

            // Dispatches un evento personalizzato per notificare il cross-node move
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

            // Dispatch con un piccolo delay per assicurarsi che l'evento sia processato
            setTimeout(() => {
                window.dispatchEvent(crossNodeEvent);
                console.log('🎯 [CrossNode] Event dispatched');
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
            }
        }

        // Cleanup
        if (dragElement) {
            document.body.removeChild(dragElement);
        }

        setIsRowDragging(false);
        setDraggedRowId(null);
        setDraggedRowIndex(null);
        setDragElement(null);
        setDraggedRowData(null);
        setTargetNodeId(null);

        document.body.style.cursor = '';
        document.body.style.userSelect = '';
    }, [isRowDragging, draggedRowId, draggedRowIndex, mousePosition, nodeRows, setNodeRows, data, dragElement, rowsContainerRef, targetNodeId, nodeId, draggedRowData]);

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

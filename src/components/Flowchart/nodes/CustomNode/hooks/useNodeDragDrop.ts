import { useState, useCallback, useEffect, useRef } from 'react';
import { NodeRowData } from '../../../../../types/project';

interface UseNodeDragDropProps {
    nodeRows: NodeRowData[];
    setNodeRows: (rows: NodeRowData[]) => void;
    data: any;
    rowsContainerRef: React.RefObject<HTMLElement>;
}

/**
 * Hook per gestire il drag & drop personalizzato delle righe
 * Approccio: Mouse down → Crea immagine che segue il mouse → Mouse up → Inserisci/rimuovi
 */
export function useNodeDragDrop({
    nodeRows,
    setNodeRows,
    data,
    rowsContainerRef
}: UseNodeDragDropProps) {
    // Stato per il drag personalizzato
    const [isRowDragging, setIsRowDragging] = useState(false);
    const [draggedRowId, setDraggedRowId] = useState<string | null>(null);
    const [draggedRowIndex, setDraggedRowIndex] = useState<number | null>(null);
    const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 });
    const [dragElement, setDragElement] = useState<HTMLElement | null>(null);

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

        // Aggiorna stato
        setIsRowDragging(true);
        setDraggedRowId(id);
        setDraggedRowIndex(index);
        setMousePosition({ x: clientX, y: clientY });
        setDragElement(clone);

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
    }, [isRowDragging, dragElement]);

    // Gestione rilascio del mouse
    const handleMouseUp = useCallback(() => {
        if (!isRowDragging || !draggedRowId || draggedRowIndex === null) return;

        console.log('🎯 [CustomDrag] Ending drag', { draggedRowId, draggedRowIndex });

        // Trova la posizione di drop
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

        // Cleanup
        if (dragElement) {
            document.body.removeChild(dragElement);
        }

        setIsRowDragging(false);
        setDraggedRowId(null);
        setDraggedRowIndex(null);
        setDragElement(null);

        document.body.style.cursor = '';
        document.body.style.userSelect = '';
    }, [isRowDragging, draggedRowId, draggedRowIndex, mousePosition, nodeRows, setNodeRows, data, dragElement, rowsContainerRef]);

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

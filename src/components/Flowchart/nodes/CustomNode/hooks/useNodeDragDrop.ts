import { useMemo, useCallback, useEffect, useRef } from 'react';
import { NodeRowData } from '../../../../../types/project';
import { useNodeRowDrag } from '../../../../../hooks/useNodeRowDrag';

interface UseNodeDragDropProps {
    nodeRows: NodeRowData[];
    setNodeRows: (rows: NodeRowData[]) => void;
    data: any;
    rowsContainerRef: React.RefObject<HTMLElement>;
}

/**
 * Hook per gestire la logica di drag & drop delle righe del nodo
 * Centralizza la gestione del trascinamento delle righe e il riordinamento
 */
export function useNodeDragDrop({
    nodeRows,
    setNodeRows,
    data,
    rowsContainerRef
}: UseNodeDragDropProps) {
    // Hook esistente per il drag delle righe
    const drag = useNodeRowDrag(nodeRows);

    // Gestione drag start delle righe
    const handleRowDragStart = useCallback((id: string, index: number, clientX: number, clientY: number, rect: DOMRect) => {
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
    }, [drag]);

    // Gestione movimento globale del mouse durante drag
    const handleGlobalMouseMove = useCallback((event: MouseEvent | PointerEvent) => {
        if (!drag.draggedRowId || !drag.draggedRowInitialRect || drag.draggedRowInitialClientY === null) return;

        drag.setDraggedRowCurrentClientX(event.clientX);
        drag.setDraggedRowCurrentClientY(event.clientY);

        // Determine hovered index using actual DOM positions of this node only
        let newHoveredIndex = drag.draggedRowOriginalIndex || 0;
        const scope = rowsContainerRef.current || document;
        const elements = Array.from(scope.querySelectorAll('.node-row-outer')) as HTMLElement[];
        const rects = elements.map((el) => ({
            idx: Number(el.dataset.index),
            top: el.getBoundingClientRect().top,
            height: el.getBoundingClientRect().height
        }));
        const centerY = event.clientY;
        for (const r of rects) {
            if (centerY < r.top + r.height / 2) {
                newHoveredIndex = r.idx;
                break;
            }
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
    }, [drag, rowsContainerRef]);

    // Gestione rilascio globale del mouse
    const handleGlobalMouseUp = useCallback(() => {
        const hasOriginal = drag.draggedRowOriginalIndex !== null;
        let targetIndex = drag.hoveredRowIndex;

        // Fallback: if no hovered index, infer from total delta in pixels
        if (hasOriginal && (targetIndex === null || targetIndex === undefined)) {
            const scope = rowsContainerRef.current || document;
            const elements = Array.from(scope.querySelectorAll('.node-row-outer')) as HTMLElement[];
            const rects = elements.map((el) => ({
                idx: Number(el.dataset.index),
                top: el.getBoundingClientRect().top,
                height: el.getBoundingClientRect().height
            }));
            const centerY = (drag.draggedRowCurrentClientY ?? drag.draggedRowInitialClientY) as number;
            let inferred = drag.draggedRowOriginalIndex as number;
            for (const r of rects) {
                if (centerY < r.top + r.height / 2) {
                    inferred = r.idx;
                    break;
                }
                inferred = r.idx + 1;
            }
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
    }, [drag, nodeRows, setNodeRows, data, rowsContainerRef, handleGlobalMouseMove]);

    // Cleanup dei listener quando il componente si smonta
    useEffect(() => {
        return () => {
            document.removeEventListener('mousemove', handleGlobalMouseMove);
            document.removeEventListener('mouseup', handleGlobalMouseUp);
        };
    }, [handleGlobalMouseMove, handleGlobalMouseUp]);

    // Trova la riga trascinata per il rendering separato
    const draggedItem: NodeRowData | null = drag.draggedRowId ? nodeRows.find(row => row.id === drag.draggedRowId) ?? null : null;

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

    return {
        // Drag state
        drag,
        draggedItem,
        draggedRowStyle,

        // Functions
        handleRowDragStart,
        handleGlobalMouseMove,
        handleGlobalMouseUp
    };
}

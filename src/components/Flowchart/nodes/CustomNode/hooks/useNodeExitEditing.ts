import { useCallback } from 'react';
import { NodeRowData } from '../../../../../types/project';

interface UseNodeExitEditingProps {
    inAutoAppend: () => boolean;
    nextPointerTargetRef: React.RefObject<EventTarget | null>;
    nodeContainerRef: React.RefObject<HTMLDivElement>;
    handleExitEditing: (rowId?: string) => void;
    validateRows: (rows: NodeRowData[]) => void;
    nodeRows: NodeRowData[];
    editingRowId?: string | null;
}

export function useNodeExitEditing({
    inAutoAppend,
    nextPointerTargetRef,
    nodeContainerRef,
    handleExitEditing,
    validateRows,
    nodeRows,
    editingRowId
}: UseNodeExitEditingProps) {
    const exitEditing = useCallback((nativeEvt?: Event | null) => {
        if (inAutoAppend()) return;

        const nextTarget =
            (nativeEvt as any)?.relatedTarget ||
            (nativeEvt as any)?.target ||
            (nextPointerTargetRef.current as Node | null) ||
            document.activeElement;

        if (nextTarget && nodeContainerRef.current?.contains(nextTarget as Node)) {
            nextPointerTargetRef.current = null;
            return;
        }

        // ✅ Passa editingRowId quando disponibile (per eliminare righe vuote auto-appendate)
        handleExitEditing(editingRowId || undefined);
        validateRows(nodeRows);
    }, [inAutoAppend, nextPointerTargetRef, nodeContainerRef, handleExitEditing, validateRows, nodeRows, editingRowId]);

    return { exitEditing };
}

import { useCallback } from 'react';
import { NodeRowData } from '../../../../../types/project';

interface UseNodeExitEditingProps {
    inAutoAppend: () => boolean;
    nextPointerTargetRef: React.RefObject<EventTarget | null>;
    nodeContainerRef: React.RefObject<HTMLDivElement>;
    handleExitEditing: () => void;
    validateRows: (rows: NodeRowData[]) => void;
    nodeRows: NodeRowData[];
}

export function useNodeExitEditing({
    inAutoAppend,
    nextPointerTargetRef,
    nodeContainerRef,
    handleExitEditing,
    validateRows,
    nodeRows
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

        handleExitEditing();
        validateRows(nodeRows);
    }, [inAutoAppend, nextPointerTargetRef, nodeContainerRef, handleExitEditing, validateRows, nodeRows]);

    return { exitEditing };
}

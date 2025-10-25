import { useState, useCallback } from 'react';
import { NodeRowData } from '../../../../../types/project';
import { IntellisenseItem } from '../../../../Intellisense/IntellisenseTypes';

interface UseNodeIntellisenseProps {
    nodeRows: NodeRowData[];
    setNodeRows: (rows: NodeRowData[]) => void;
    editingRowId: string | null;
    normalizedData: any;
}

/**
 * Hook per gestire la logica di intellisense del nodo
 * Centralizza la gestione del menu intellisense e la selezione degli elementi
 */
export function useNodeIntellisense({
    nodeRows,
    setNodeRows,
    editingRowId,
    normalizedData
}: UseNodeIntellisenseProps) {
    // Stato intellisense
    const [showIntellisense, setShowIntellisense] = useState(false);
    const [intellisensePosition] = useState({ x: 0, y: 0 });

    // Gestione selezione elemento intellisense
    const handleIntellisenseSelectItem = useCallback((item: IntellisenseItem) => {
        if (editingRowId) {
            // ✅ CORREZIONE 6: Mappa esplicitamente i campi ammessi invece di ...item
            const baseRows = nodeRows.map(row =>
                row.id === editingRowId
                    ? {
                        ...row,
                        text: item.name,
                        categoryType: item.categoryType as any,
                        userActs: item.userActs,
                        mode: (item as any)?.mode || 'Message' as const,
                        type: (item as any)?.type || ((item as any)?.mode === 'DataRequest' ? 'DataRequest' : 'Message'),
                        actId: item.actId,
                        factoryId: item.factoryId
                    }
                    : row
            );
            setNodeRows(baseRows);
            normalizedData.onUpdate?.({ rows: baseRows, focusRowId: undefined, isTemporary: normalizedData.isTemporary });
        }
        setShowIntellisense(false);
    }, [editingRowId, nodeRows, setNodeRows, normalizedData]);

    // Gestione apertura/chiusura intellisense
    const openIntellisense = useCallback(() => {
        setShowIntellisense(true);
    }, []);

    const closeIntellisense = useCallback(() => {
        setShowIntellisense(false);
    }, []);

    return {
        // State
        showIntellisense,
        intellisensePosition,

        // Functions
        handleIntellisenseSelectItem,
        openIntellisense,
        closeIntellisense,
        setShowIntellisense
    };
}

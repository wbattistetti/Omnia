import { useMemo } from 'react';
import { NodeRowData } from '../../../../../types/project';

// Helper per ID robusti
function newUid() {
    // fallback se crypto.randomUUID non esiste
    return (typeof crypto !== 'undefined' && 'randomUUID' in crypto)
        ? (crypto as any).randomUUID()
        : `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

// Helper per inizializzazione lazy delle righe
function initRows(nodeId: string, rows?: NodeRowData[], nodeData?: any): NodeRowData[] {
    if (!Array.isArray(rows) || rows.length === 0) {
        // Se c'è un focusRowId specificato, usalo per la prima riga
        const rowId = nodeData?.focusRowId || `${nodeId}-${newUid()}`;
        return [{ id: rowId, text: '', included: true, mode: 'Message' as const }];
    }
    return rows.map(r =>
        r.id?.startsWith(`${nodeId}-`) ? r : { ...r, id: `${nodeId}-${r.id || newUid()}` }
    );
}

/**
 * Hook per gestire l'inizializzazione dei dati del nodo
 * Centralizza la logica di setup iniziale e validazione
 */
export function useNodeInitialization(nodeId: string, data: any) {
    // Inizializzazione delle righe con memoization
    const displayRows = useMemo(() => {
        return initRows(nodeId, data.rows, data);
    }, [nodeId, data.rows, data.focusRowId]);

    // Validazione e normalizzazione dei dati
    const normalizedData = useMemo(() => {
        return {
            ...data,
            rows: displayRows,
            title: data.title || '',
            isTemporary: data.isTemporary || false
        };
    }, [data, displayRows]);

    return {
        displayRows,
        normalizedData,
        // Utility functions
        newUid: () => newUid()
    };
}

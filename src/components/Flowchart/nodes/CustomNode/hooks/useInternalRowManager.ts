import { useState, useCallback, useRef, useEffect } from 'react';
import { NodeRowData, EntityType } from '../../../../../types/project';
// ❌ RIMOSSO: typeToMode - usa TaskType enum direttamente

interface UseInternalRowManagerProps {
    nodeId: string;
    normalizedData: any;
    displayRows: NodeRowData[];
}

/**
 * Hook per gestire le righe del nodo con metodo incapsulato addRow()
 * Versione isolata: tutto gestito internamente, nessuna interferenza esterna
 */
export function useInternalRowManager({ nodeId, normalizedData, displayRows }: UseInternalRowManagerProps) {
    // ✅ Log iniziale per debug
    console.log('🆕 [INTERNAL_ROW_MANAGER][MOUNT] New hook initialized', {
        nodeId,
        initialRowsCount: displayRows.length,
        timestamp: Date.now()
    });

    // ✅ Stato interno completamente isolato
    const [internalRows, setInternalRows] = useState<NodeRowData[]>(() => displayRows);
    const [editingRowId, setEditingRowId] = useState<string | null>(null);
    const [continuousBuilding, setContinuousBuilding] = useState(false);

    // ✅ Flag per bloccare sincronizzazione esterna durante operazioni interne
    const isInternalOperationRef = useRef(false);

    // ✅ Ref per mantenere lo stato sempre aggiornato
    const internalRowsRef = useRef(internalRows);
    const editingRowIdRef = useRef<string | null>(null);
    useEffect(() => {
        internalRowsRef.current = internalRows;
        editingRowIdRef.current = editingRowId;
    }, [internalRows, editingRowId]);

    // Funzione per generare ID righe
    const makeRowId = useCallback(() => {
        return `${nodeId}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    }, [nodeId]);

    // Funzione per calcolare isEmpty
    const computeIsEmpty = useCallback((rows: NodeRowData[]): boolean => {
        return rows.length === 0 || rows.every(r => !r.text || r.text.trim() === '');
    }, []);

    // Funzione per aggiungere una riga vuota
    const appendEmptyRow = useCallback((rows: NodeRowData[]) => {
        const newRowId = makeRowId();
        const newRow: NodeRowData = {
            id: newRowId,
            text: '',
            included: true,
            type: TaskType.SayMessage // ✅ TaskType enum instead of mode
        };
        return { nextRows: [...rows, newRow], newRowId };
    }, [makeRowId]);

    // ✅ Sincronizzazione esterna (BLOCCATA durante operazioni interne)
    useEffect(() => {
        if (isInternalOperationRef.current) {
            console.log('🔒 [INTERNAL_ROW_MANAGER] Skip sync: internal operation in progress', {
                nodeId,
                timestamp: Date.now()
            });
            return; // ← Isolato durante operazioni interne!
        }

        const rowsMatch = internalRows.length === displayRows.length &&
            internalRows.every((row, idx) => {
                const displayRow = displayRows[idx];
                return displayRow && row.id === displayRow.id && row.text === displayRow.text;
            });

        if (!rowsMatch) {
            console.log('🔄 [INTERNAL_ROW_MANAGER] Syncing from external update', {
                nodeId,
                internalRowsCount: internalRows.length,
                displayRowsCount: displayRows.length,
                timestamp: Date.now()
            });
            setInternalRows(displayRows);
        }
    }, [displayRows, nodeId]); // ✅ Rimossa dipendenza internalRows per evitare loop

    // ✅ Metodo addRow() completamente incapsulato
    const addRow = useCallback((
        rowId: string,
        newText: string,
        categoryType?: EntityType,
        meta?: Partial<NodeRowData>
    ) => {
        // 1. Blocca sincronizzazione esterna
        isInternalOperationRef.current = true;

        console.log('🔒 [INTERNAL_ROW_MANAGER][ADD_ROW][START] ⚡ NUOVO HOOK', {
            nodeId,
            rowId,
            newText,
            continuousBuilding,
            timestamp: Date.now()
        });

        // ✅ Usa ref per stato sempre aggiornato (evita stale closure)
        const prev = internalRowsRef.current;
        const idx = prev.findIndex(r => r.id === rowId);
        if (idx === -1) {
            console.warn('⚠️ [INTERNAL_ROW_MANAGER] Row not found', { rowId, prevRowsCount: prev.length });
            isInternalOperationRef.current = false;
            return;
        }

        // 2. Aggiorna riga corrente
        const row = prev[idx];
        const wasEmpty = !(row.text || '').trim();
        const nowFilled = (newText || '').trim().length > 0;
        const isLast = idx === prev.length - 1;

        let updatedRows = prev.map(r => {
            if (r.id !== rowId) return r;
            const incoming: any = meta || {};
            const existingType: any = (r as any).type;
            const finalType: any = (typeof incoming.type !== 'undefined') ? incoming.type : existingType;
            const existingMode: any = (r as any).mode;
            // ✅ mode removed - use type (TaskType enum) only

            return {
                ...r,
                ...incoming,
                type: finalType,
                // ✅ mode removed - use type (TaskType enum) only
                text: newText,
                categoryType: (meta && (meta as any).categoryType) ? (meta as any).categoryType : (categoryType ?? r.categoryType)
            } as any;
        });

        // 3. Auto-append se necessario (solo se continuousBuilding è attivo)
        let newRowId: string | null = null;
        if (continuousBuilding && isLast && wasEmpty && nowFilled) {
            console.log('✅ [INTERNAL_ROW_MANAGER][AUTO_APPEND] Adding new row', {
                nodeId,
                currentRowsCount: updatedRows.length,
                timestamp: Date.now()
            });
            const { nextRows, newRowId: id } = appendEmptyRow(updatedRows);
            updatedRows = nextRows;
            newRowId = id;
        }

        // 4. Aggiorna stato interno (ATOMICO - tutto in un batch)
        // ✅ IMPORTANTE: Set editingRowId IMMEDIATAMENTE insieme a internalRows per evitare race conditions
        if (newRowId) {
            // ✅ Mantieni continuousBuilding attivo (la nuova riga è vuota)
            if (!continuousBuilding) {
                setContinuousBuilding(true);
            }

            // ✅ Set editingRowId IMMEDIATAMENTE (prima di setInternalRows) per sincronizzazione
            setEditingRowId(newRowId);
            console.log('🎯 [INTERNAL_ROW_MANAGER] Set editingRowId immediately', {
                newRowId,
                nodeId,
                timestamp: Date.now()
            });
        }

        // ✅ Set internalRows DOPO editingRowId per garantire che la riga sia nel DOM quando forceEditing diventa true
        setInternalRows(updatedRows);

        // 5. Notifica parent DOPO un delay per evitare race conditions con sync effect
        setTimeout(() => {
            normalizedData.onUpdate?.({
                rows: updatedRows,
                isTemporary: normalizedData.isTemporary
            });

            // 6. Rilascia blocco DOPO che onUpdate è stato chiamato
            setTimeout(() => {
                isInternalOperationRef.current = false;
                console.log('🔓 [INTERNAL_ROW_MANAGER][ADD_ROW][END]', {
                    nodeId,
                    rowId,
                    newRowId,
                    updatedRowsCount: updatedRows.length,
                    timestamp: Date.now()
                });
            }, 50);
        }, 150); // ✅ Delay più lungo per permettere al rendering di stabilizzarsi

        return { updatedRows, newRowId };
    }, [continuousBuilding, normalizedData, nodeId, appendEmptyRow]); // ✅ Rimossa dipendenza internalRows (usa ref)

    // ✅ Gestione eliminazione riga
    const handleDeleteRow = useCallback((rowId: string) => {
        isInternalOperationRef.current = true;
        const currentRows = internalRowsRef.current;
        const updatedRows = currentRows.filter(row => row.id !== rowId);
        setInternalRows(updatedRows);
        normalizedData.onUpdate?.({ rows: updatedRows });
        if (updatedRows.length === 0 && normalizedData.isTemporary) {
            normalizedData.onDelete?.();
        }
        setTimeout(() => {
            isInternalOperationRef.current = false;
        }, 50);
    }, [normalizedData]);

    // ✅ Gestione inserimento riga
    const handleInsertRow = useCallback((idx: number) => {
        isInternalOperationRef.current = true;
        const currentRows = internalRowsRef.current;
        const { nextRows, newRowId } = appendEmptyRow(currentRows);
        const updatedRows = [
            ...nextRows.slice(0, idx),
            ...nextRows.slice(idx)
        ];
        setInternalRows(updatedRows);
        setEditingRowId(newRowId);
        normalizedData.onUpdate?.({ rows: updatedRows });
        setTimeout(() => {
            isInternalOperationRef.current = false;
        }, 50);
    }, [appendEmptyRow, normalizedData]);

    // ✅ Gestione exit editing
    const handleExitEditing = useCallback(() => {
        // Disattiva continuousBuilding quando esci dall'editing
        if (continuousBuilding) {
            setContinuousBuilding(false);
            console.log('🛑 [INTERNAL_ROW_MANAGER] Stopped continuousBuilding', {
                nodeId,
                timestamp: Date.now()
            });
        }
        setEditingRowId(null);
    }, [continuousBuilding, nodeId]);

    // ✅ Gestione setEditingRowId - attiva continuousBuilding se necessario
    const setEditingRowIdWithBuilding = useCallback((rowId: string | null) => {
        if (rowId === null) {
            handleExitEditing();
            return;
        }

        // ✅ Attiva continuousBuilding se stiamo editando l'ultima riga vuota
        const currentRows = internalRowsRef.current;
        const targetRow = currentRows.find(r => r.id === rowId);
        const rowIsEmpty = !targetRow || !targetRow.text || targetRow.text.trim() === '';
        const isLastRow = currentRows.length > 0 && currentRows[currentRows.length - 1].id === rowId;
        const isEmpty = computeIsEmpty(currentRows);

        if (rowIsEmpty && (isLastRow || isEmpty) && !continuousBuilding) {
            setContinuousBuilding(true);
            console.log('🚀 [INTERNAL_ROW_MANAGER] Started continuousBuilding', {
                rowId,
                nodeId,
                isLastRow,
                isEmpty,
                timestamp: Date.now()
            });
        } else if (!rowIsEmpty && continuousBuilding) {
            // Disattiva se clicchiamo su una riga esistente con testo
            setContinuousBuilding(false);
            console.log('🛑 [INTERNAL_ROW_MANAGER] Stopped continuousBuilding: editing existing row', {
                rowId,
                nodeId,
                timestamp: Date.now()
            });
        }

        setEditingRowId(rowId);
    }, [continuousBuilding, computeIsEmpty, handleExitEditing]);

    // ✅ Funzione per validare le righe
    const validateRows = useCallback((rows: NodeRowData[]) => {
        const isValidRow = (row: NodeRowData) => {
            return row && typeof row.id === 'string' && row.id.length > 0;
        };
        const cleaned = rows.filter(isValidRow);
        if (cleaned.length !== rows.length) {
            setInternalRows(cleaned);
            normalizedData.onUpdate?.({ rows: cleaned, isTemporary: normalizedData.isTemporary });
        }
    }, [normalizedData]);

    // ✅ Funzione inAutoAppend (sempre false, non serve più)
    const inAutoAppend = useCallback(() => false, []);

    // ✅ Wrapper per compatibilità con vecchio codice
    const handleUpdateRow = useCallback((
        rowId: string,
        newText: string,
        categoryType?: EntityType,
        meta?: Partial<NodeRowData>
    ) => {
        return addRow(rowId, newText, categoryType, meta);
    }, [addRow]);

    return {
        // State
        nodeRows: internalRows,
        setNodeRows: setInternalRows,
        editingRowId,
        setEditingRowId: setEditingRowIdWithBuilding,
        isEmpty: computeIsEmpty(internalRows),
        setIsEmpty: () => {}, // Non serve più
        isBuilding: continuousBuilding, // Deriva da continuousBuilding
        continuousBuilding, // ✅ Nuovo stato esposto
        // Methods
        handleUpdateRow, // ✅ Wrapper su addRow per compatibilità
        addRow, // ✅ Nuovo metodo incapsulato
        handleDeleteRow,
        handleInsertRow,
        handleExitEditing,
        validateRows,
        computeIsEmpty,
        inAutoAppend,
        // ✅ Nuovi metodi per gestire continuousBuilding
        startContinuousBuilding: () => setContinuousBuilding(true),
        stopContinuousBuilding: () => setContinuousBuilding(false),
    };
}


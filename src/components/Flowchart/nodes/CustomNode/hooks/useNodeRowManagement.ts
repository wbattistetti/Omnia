import { useState, useCallback, useRef, useEffect } from 'react';
import { NodeRowData, EntityType } from '../../../../../types/project';
import { planExternalRowSync } from './nodeRowExternalSync';
import { getTaskIdFromRow } from '../../../../../utils/taskHelpers';
import { variableCreationService } from '../../../../../services/VariableCreationService';
import { taskRepository } from '../../../../../services/TaskRepository';
import { TaskType } from '../../../../../types/taskTypes'; // ✅ Per TaskType enum
import { logNodeRowEdit } from '../../../rows/NodeRow/nodeRowEditDebug';

// ✅ Traccia il contenuto originale quando inizi a editare una riga esistente
interface RowOriginalContent {
    rowId: string;
    originalText: string;
    wasNew: boolean; // true se la riga era nuova (mai riempita) quando ha iniziato l'editing
}

interface UseNodeRowManagementProps {
    nodeId: string;
    normalizedData: any;
    displayRows: NodeRowData[];
}

/**
 * Hook per gestire tutte le operazioni sulle righe del nodo
 * Centralizza la logica di CRUD delle righe e la gestione dello stato isEmpty
 */
export function useNodeRowManagement({ nodeId, normalizedData, displayRows }: UseNodeRowManagementProps) {
    // Stato delle righe
    const [nodeRows, setNodeRows] = useState<NodeRowData[]>(() => displayRows);
    const [editingRowId, setEditingRowId] = useState<string | null>(null);

    // Stato isEmpty per auto-append
    const [isEmpty, setIsEmpty] = useState(() => {
        return displayRows.length === 0 || displayRows.every(r => !r.text || r.text.trim() === '');
    });

    // ✅ Traccia il contenuto originale quando inizi a editare una riga
    const originalContentRef = useRef<RowOriginalContent | null>(null);

    // Guardia per sopprimere exitEditing durante auto-append
    const autoAppendGuard = useRef(0);
    const inAutoAppend = () => autoAppendGuard.current > 0;

    /** Latest rows for sync effect (avoids depending on `nodeRows` and clobbering pending edits). */
    const nodeRowsRef = useRef(nodeRows);
    nodeRowsRef.current = nodeRows;

    const beginAutoAppendGuard = () => {
        autoAppendGuard.current += 1;
        // Rilascio dopo due frame per coprire setState + focus programmato
        requestAnimationFrame(() => requestAnimationFrame(() => { autoAppendGuard.current = Math.max(0, autoAppendGuard.current - 1); }));
    };

    // Funzione per generare ID righe
    const makeRowId = useCallback(() => {
        return `${nodeId}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    }, [nodeId]);

    // Funzione per calcolare isEmpty
    const computeIsEmpty = useCallback((rows: NodeRowData[]): boolean => {
        return rows.length === 0 || rows.every(r => !r.text || r.text.trim() === '');
    }, []);

    /**
     * Keep local row state aligned with store-driven props (`displayRows`).
     * Portal / subflow moves update FlowStore and props while skipping CustomNode's optimistic
     * `crossNodeRowMove` handler (`_state.handled`); without this sync, rows only reappear after remount.
     *
     * Conservative: when structure and ids match and nothing is being edited, do not replace local
     * rows (avoids overwriting keystrokes before the parent re-renders). When the store adds/reorders
     * rows or the user edits one row while siblings refresh, apply `mergeExternalRowsFromStore`
     * (when not editing, store rows are merged with local `text` per row id so props cannot revive stale labels).
     */
    useEffect(() => {
        if (autoAppendGuard.current > 0) {
            return;
        }
        const plan = planExternalRowSync(displayRows, nodeRowsRef.current, editingRowId);
        if (!plan.shouldSync) {
            return;
        }
        setNodeRows(plan.nextRows);
        setIsEmpty(computeIsEmpty(plan.nextRows));
    }, [displayRows, editingRowId, computeIsEmpty]);

    // Funzione per aggiungere una riga vuota
    // ✅ LAZY: Crea solo la riga, SENZA task (il task verrà creato solo quando si apre l'editor)
    const appendEmptyRow = useCallback((rows: NodeRowData[]) => {
        const newRowId = makeRowId();
        // ✅ LAZY: Crea solo la riga, SENZA task (il task verrà creato solo quando si apre l'editor)
        const newRow: NodeRowData = {
            id: newRowId,
            text: '',
            included: true,
            // ✅ NO taskId - il task verrà creato lazy quando si apre l'editor
            // ✅ Dati euristici iniziali: UNDEFINED (verrà aggiornato dall'euristica quando l'utente digita)
            heuristics: {
                type: TaskType.UNDEFINED,
                templateId: null
            } as any,
            isUndefined: true
            // ✅ mode removed - use type (TaskType enum) only
        };
        return { nextRows: [...rows, newRow], newRowId };
    }, [makeRowId]);

    // Funzione per validare le righe
    const validateRows = useCallback((rows: NodeRowData[]) => {
        const isValidRow = (row: NodeRowData) => {
            return row && typeof row.id === 'string' && row.id.length > 0;
        };
        const cleaned = rows.filter(isValidRow);
        if (cleaned.length !== rows.length) {
            setNodeRows(cleaned);
            setIsEmpty(computeIsEmpty(cleaned));
            normalizedData.onUpdate?.({ rows: cleaned, isTemporary: normalizedData.isTemporary });
        }
    }, [normalizedData, computeIsEmpty]);

    // ✅ Salva il contenuto originale quando inizi a editare una riga
    // Deve essere definito prima di essere usato in altri callback
    const saveOriginalContent = useCallback((rowId: string) => {
        const row = nodeRows.find(r => r.id === rowId);
        if (!row) return;

        const originalText = row.text || '';
        const wasNew = !originalText || originalText.trim() === ''; // Riga nuova se vuota

        originalContentRef.current = {
            rowId,
            originalText,
            wasNew
        };
    }, [nodeRows]);

    // Gestione aggiornamento riga
    const handleUpdateRow = useCallback((
        rowId: string,
        newText: string,
        categoryType?: EntityType,
        meta?: Partial<NodeRowData>
    ) => {
        const prev = nodeRows;
        const idx = prev.findIndex(r => r.id === rowId);
        if (idx === -1) {
            return;
        }

        const wasEmpty = !(prev[idx].text || '').trim();
        const nowFilled = (newText || '').trim().length > 0;

        let updatedRows = prev.map(row => {
            if (row.id !== rowId) return row as any;
            const incoming: any = meta || {};
            const existingType: any = (row as any).type;
            const finalType: any = (typeof incoming.type !== 'undefined') ? incoming.type : existingType;
            const existingMode: any = (row as any).mode;
            // ✅ mode removed - use type (TaskType enum) only

            // Preserva flag isUndefined se presente (per nodi undefined con punto interrogativo)
            const preserveIsUndefined = (incoming as any)?.isUndefined !== undefined
                ? (incoming as any).isUndefined
                : (row as any)?.isUndefined;

            if (preserveIsUndefined) {
            }

            const updatedRow = {
                ...row,
                ...incoming,
                type: finalType,
                // ✅ mode removed - use type (TaskType enum) only
                text: newText, // ✅ Questo è il testo che viene salvato
                categoryType:
                    (meta && (meta as any).categoryType)
                        ? (meta as any).categoryType
                        : (categoryType ?? row.categoryType),
                // Preserva flag isUndefined
                isUndefined: preserveIsUndefined,
                // ✅ FIX: Preserva heuristics esplicitamente (contiene type e templateId dall'euristica)
                heuristics: (incoming as any)?.heuristics !== undefined
                    ? (incoming as any).heuristics
                    : ((row as any)?.heuristics || undefined),
                meta: (incoming as any)?.meta !== undefined
                    ? (incoming as any).meta
                    : (row as any)?.meta,
            } as any;

            return updatedRow;
        });

        const isLast = idx === prev.length - 1;

        // ✅ Se una riga nuova viene riempita, aggiorna originalContentRef per marcarla come "non nuova"
        if (nowFilled && originalContentRef.current?.rowId === rowId && originalContentRef.current.wasNew) {
            originalContentRef.current.wasNew = false;
        }

        // ✅ Logica migliorata: auto-append se stai editando l'ultima riga, era vuota e ora è piena
        // Questo permette di continuare l'auto-append anche dopo la prima riga
        // Non serve più verificare isEmpty perché vogliamo continuare finché editiamo l'ultima riga vuota
        // Quando aggiungiamo una nuova riga vuota, quella diventa l'ultima, quindi l'auto-append continua
        const shouldAutoAppend = isLast && wasEmpty && nowFilled;

        if (shouldAutoAppend) {

            // ✅ AVVIA GUARD PRIMA del batch (fondamentale!)
            beginAutoAppendGuard();

            const { nextRows, newRowId } = appendEmptyRow(updatedRows);
            updatedRows = nextRows;
            // ✅ Salva come "nuova" quando inizia l'editing della riga auto-appendata
            saveOriginalContent(newRowId);
            setEditingRowId(newRowId);

            // ✅ Focus robusto dopo il render con requestAnimationFrame
            requestAnimationFrame(() => {
                const textareas = document.querySelectorAll('.node-row-input');
                const newTextarea = textareas[textareas.length - 1] as HTMLTextAreaElement;
                if (newTextarea) {
                    newTextarea.focus();
                    newTextarea.select();
                }
            });
        }

        setNodeRows(updatedRows);

        const finalRow = updatedRows.find(r => r.id === rowId);

        // row.text is the label shown on the flow row; SayMessage body lives in
        // task.parameters (text GUID) + project translations (see sayMessageTaskSync).

        // setIsEmpty viene aggiornato solo quando esci dall'editing (ESC, click fuori, blur esterno)
        normalizedData.onUpdate?.({ rows: updatedRows, isTemporary: normalizedData.isTemporary });

        // ✅ LAZY: NON aggiorniamo/creiamo task qui - solo memorizziamo metadati nella riga
        // ✅ Il task verrà creato solo quando si apre l'editor (cliccando sul gear)
        // ✅ L'euristica 2 viene eseguita in NodeRow.tsx quando l'utente preme Enter
    }, [nodeRows, isEmpty, nodeId, appendEmptyRow, normalizedData, saveOriginalContent]);

    // Gestione eliminazione riga
    const handleDeleteRow = useCallback(async (rowId: string) => {
        // ✅ Find the row being deleted to get its taskId
        const rowToDelete = nodeRows.find(row => row.id === rowId);
        const taskId = rowToDelete?.taskId || getTaskIdFromRow(rowToDelete || { id: rowId } as NodeRowData);

        const updatedRows = nodeRows.filter(row => row.id !== rowId);
        setNodeRows(updatedRows);
        // ✅ Aggiorna isEmpty: se tutte le righe sono vuote dopo la cancellazione, torna isEmpty=true
        setIsEmpty(computeIsEmpty(updatedRows));
        normalizedData.onUpdate?.({ rows: updatedRows });

        // ✅ NEW: Delete task from database when row is deleted
        if (taskId) {
            try {
                let projectId: string | undefined = undefined;
                try {
                    projectId = ((require('../../state/runtime') as any).getCurrentProjectId?.() || undefined);
                } catch {}

                if (projectId) {
                    await taskRepository.deleteTask(taskId, projectId);

                    // ✅ Emit event to close Response Editor if open for this task
                    document.dispatchEvent(new CustomEvent('taskEditor:closeIfOpen', {
                        detail: { taskId }
                    }));
                }
            } catch (e) {
                console.warn('[useNodeRowManagement] Failed to delete task', e);
            }
        }

        // Delete variables when row is deleted
        try {
            let projectId: string | undefined = undefined;
            try {
                projectId = ((require('../../state/runtime') as any).getCurrentProjectId?.() || undefined);
            } catch {}

            if (projectId) {
                variableCreationService.deleteVariablesForInstance(projectId, rowId);
                try {
                    document.dispatchEvent(new CustomEvent('flowchart:variablesUpdated', { bubbles: true }));
                } catch {}
            }
        } catch (e) {
            console.warn('[useNodeRowManagement] Failed to delete variables', e);
        }

        if (updatedRows.length === 0 && normalizedData.isTemporary) {
            normalizedData.onDelete?.();
        }
    }, [nodeRows, computeIsEmpty, normalizedData]);

    // Gestione inserimento riga
    // Migration: Now creates Task in TaskRepository (dual mode)
    const handleInsertRow = useCallback(async (index: number) => {
        // ✅ Verifica se l'ultima riga è vuota (auto-appendata) e la elimina
        const lastRow = nodeRows[nodeRows.length - 1];
        const lastRowIsEmpty = lastRow && (!lastRow.text || lastRow.text.trim() === '');

        let updatedRows = [...nodeRows];
        let adjustedIndex = index;

        // ✅ Se l'ultima riga è vuota, eliminala prima di inserire la nuova
        if (lastRowIsEmpty) {

            // Elimina l'ultima riga vuota
            updatedRows = updatedRows.filter(r => r.id !== lastRow.id);

            // ✅ Aggiusta l'indice di inserimento se necessario
            // Se l'indice era dopo l'ultima riga (o era l'ultima riga), ora è alla fine
            if (index >= nodeRows.length - 1) {
                adjustedIndex = updatedRows.length;
            } else if (index === nodeRows.length - 1) {
                // Se stavi inserendo prima dell'ultima riga vuota, ora inserisci alla fine
                adjustedIndex = updatedRows.length;
            }
            // Se l'indice era prima dell'ultima riga, rimane invariato

            // Delete variables for the replaced empty row
            try {
                let projectId: string | undefined = undefined;
                try {
                    projectId = ((require('../../state/runtime') as any).getCurrentProjectId?.() || undefined);
                } catch {}

                if (projectId) {
                    variableCreationService.deleteVariablesForInstance(projectId, lastRow.id);
                    try {
                        document.dispatchEvent(new CustomEvent('flowchart:variablesUpdated', { bubbles: true }));
                    } catch {}
                }
            } catch (e) {
                console.warn('[useNodeRowManagement] Failed to delete variables', e);
            }
        }

        // Inserisci una riga solo se l'ultima riga è valida (non vuota e con tipo)
        // ✅ Questo controllo ora è dopo l'eliminazione della riga vuota
        const last = updatedRows[updatedRows.length - 1];
        const lastValid = last ? Boolean((last.text || '').trim().length > 0 && (last as any).type) : true; // ✅ type (TaskType enum) only, no mode
        if (!lastValid && updatedRows.length > 0) return;

        const newRowId = makeRowId();
        // ✅ LAZY: Crea solo la riga, SENZA task (il task verrà creato solo quando si apre l'editor)
        const newRow: NodeRowData = {
            id: newRowId,
            text: '',
            included: true,
            // ✅ NO taskId - il task verrà creato lazy quando si apre l'editor
            // ✅ Dati euristici iniziali: UNDEFINED (verrà aggiornato dall'euristica quando l'utente digita)
            heuristics: {
                type: TaskType.UNDEFINED,
                templateId: null
            } as any,
            isUndefined: true
            // ✅ mode removed - use type (TaskType enum) only
        };
        (newRow as any).isNew = true; // Preserve isNew flag

        updatedRows.splice(adjustedIndex, 0, newRow);
        setNodeRows(updatedRows);
        // ✅ Salva come "nuova" quando inizia l'editing della riga inserita
        saveOriginalContent(newRow.id);
        setEditingRowId(newRow.id);
        normalizedData.onUpdate?.({ rows: updatedRows });
    }, [nodeRows, makeRowId, normalizedData, saveOriginalContent]);

    /**
     * Immutable row updates for the whole node (used by semantic draft / meta).
     */
    const updateNodeRows = useCallback(
        (mutate: (rows: NodeRowData[]) => NodeRowData[]) => {
            const nextRows = mutate(nodeRows.map((r) => ({ ...r })));
            setNodeRows(nextRows);
            setIsEmpty(computeIsEmpty(nextRows));
            normalizedData.onUpdate?.({
                rows: nextRows,
                isTemporary: normalizedData.isTemporary,
            });
        },
        [nodeRows, normalizedData, computeIsEmpty]
    );

    // Gestione exit editing
    const handleExitEditing = useCallback((rowIdToCheck?: string | null) => {
        if (inAutoAppend()) {
            return;
        }

        if (!rowIdToCheck) {
            // Se non c'è rowId, esci semplicemente dall'editing
            setEditingRowId(null);
            setIsEmpty(computeIsEmpty(nodeRows));
            originalContentRef.current = null;
            return;
        }

        const rowToCheck = nodeRows.find(r => r.id === rowIdToCheck);
        if (!rowToCheck) {
            setEditingRowId(null);
            setIsEmpty(computeIsEmpty(nodeRows));
            originalContentRef.current = null;
            return;
        }

        const currentText = rowToCheck.text || '';
        const isEmpty = !currentText || currentText.trim() === '';
        const originalContent = originalContentRef.current;

        logNodeRowEdit('canvas.handleExitEditing', {
            rowId: rowIdToCheck,
            textLength: currentText.length,
            isEmpty,
            wasNew: Boolean(originalContent?.wasNew),
        });

        // ✅ CASO 1: Riga NUOVA (mai riempita)
        if (originalContent?.wasNew) {
            if (isEmpty) {
                // Riga nuova vuota + blur = ESC → ELIMINA
                handleDeleteRow(rowIdToCheck);
                originalContentRef.current = null;
                return;
            } else {
                // Riga nuova con contenuto + blur = ENTER → CONFERMA
                // La riga è già stata aggiornata da handleUpdateRow, quindi basta uscire
                setEditingRowId(null);
                setIsEmpty(computeIsEmpty(nodeRows));
                originalContentRef.current = null;
                return;
            }
        }

        // Live label edits are committed on each keystroke (NodeRow → handleUpdateRow); no implicit rollback.
        setEditingRowId(null);
        setIsEmpty(computeIsEmpty(nodeRows));
        originalContentRef.current = null;
    }, [nodeRows, computeIsEmpty, inAutoAppend, handleDeleteRow, normalizedData]);

    // ✅ Wrapper per setEditingRowId che salva il contenuto originale
    const setEditingRowIdWithOriginal = useCallback((rowId: string | null) => {
        if (rowId) {
            // Salva il contenuto originale quando inizi a editare
            saveOriginalContent(rowId);
        } else {
            // Pulisci il contenuto originale quando esci dall'editing
            originalContentRef.current = null;
        }
        setEditingRowId(rowId);
    }, [saveOriginalContent]);

    return {
        // State
        nodeRows,
        setNodeRows,
        editingRowId,
        setEditingRowId: setEditingRowIdWithOriginal,
        isEmpty,
        setIsEmpty,

        // Functions
        handleUpdateRow,
        handleDeleteRow,
        handleInsertRow,
        handleExitEditing,
        updateNodeRows,
        validateRows,
        computeIsEmpty,
        makeRowId,

        // Utilities
        inAutoAppend,
        beginAutoAppendGuard
    };
}

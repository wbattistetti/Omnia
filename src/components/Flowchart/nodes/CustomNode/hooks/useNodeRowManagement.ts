import { useState, useCallback, useRef, useEffect } from 'react';
import { NodeRowData, EntityType } from '../../../../../types/project';
import { deriveSyncedNodeRows, rowListsShallowEqual } from './nodeRowExternalSync';
import { makePendingLocalRowId } from '../utils/localRowIds';
import { getTaskIdFromRow } from '../../../../../utils/taskHelpers';
import { variableCreationService } from '../../../../../services/VariableCreationService';
import { taskRepository } from '../../../../../services/TaskRepository';
import { TaskType } from '../../../../../types/taskTypes'; // ✅ Per TaskType enum
import { logNodeRowEdit } from '../../../rows/NodeRow/nodeRowEditDebug';
import { warnLocalGraphMutation } from '@domain/flowGraph';

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

/** Options for {@link useNodeRowManagement}'s row commit (FlowStore / parent notification). */
export type NodeRowsCommitOptions = {
    /** When false, only updates local row state (store already committed elsewhere). Default true. */
    notifyParent?: boolean;
    /** Extra fields merged into `normalizedData.onUpdate` with `rows`. */
    patch?: Record<string, unknown>;
};

/**
 * Hook per gestire tutte le operazioni sulle righe del nodo.
 *
 * Verità strutturale: `displayRows` (props / FlowStore). Righe locali sono derivate con
 * {@link deriveSyncedNodeRows}: overlay di testo, id in attesa di hydrate dopo `onUpdate`, riga in edit.
 */
export function useNodeRowManagement({ nodeId, normalizedData, displayRows }: UseNodeRowManagementProps) {
    // Stato delle righe
    const [nodeRows, setNodeRowsInternal] = useState<NodeRowData[]>(() => displayRows);
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

    /** Authoritative props snapshot — ids newly committed via parent get tracked until props catch up. */
    const displayRowsRef = useRef(displayRows);
    displayRowsRef.current = displayRows;

    /** Row ids introduced in optimistic commits not yet reflected in `displayRows`. */
    const pendingHydrationIdsRef = useRef<Set<string>>(new Set());

    /** Row ids removed locally before `displayRows` props drop them (stale props must not revive rows). */
    const pendingStructuralRemovalIdsRef = useRef<Set<string>>(new Set());

    const beginAutoAppendGuard = () => {
        autoAppendGuard.current += 1;
        // Rilascio dopo due frame per coprire setState + focus programmato
        requestAnimationFrame(() => requestAnimationFrame(() => { autoAppendGuard.current = Math.max(0, autoAppendGuard.current - 1); }));
    };

    // Funzione per generare ID righe
    const makeRowId = useCallback(() => makePendingLocalRowId(nodeId), [nodeId]);

    // Funzione per calcolare isEmpty
    const computeIsEmpty = useCallback((rows: NodeRowData[]): boolean => {
        return rows.length === 0 || rows.every(r => !r.text || r.text.trim() === '');
    }, []);

    /**
     * Commit structural row changes upward and record new row ids until props hydrate.
     */
    const commitRowsToParent = useCallback(
        (nextRows: NodeRowData[], options?: NodeRowsCommitOptions) => {
            const prevDisp = displayRowsRef.current;
            const prevDispIds = new Set(prevDisp.map((r) => r.id));
            const nextIds = new Set(nextRows.map((r) => r.id));

            for (const r of nextRows) {
                if (!prevDispIds.has(r.id)) {
                    pendingHydrationIdsRef.current.add(r.id);
                }
            }
            for (const id of prevDispIds) {
                if (!nextIds.has(id)) {
                    pendingHydrationIdsRef.current.delete(id);
                    pendingStructuralRemovalIdsRef.current.add(id);
                }
            }

            setNodeRowsInternal(nextRows);
            setIsEmpty(computeIsEmpty(nextRows));

            if (options?.notifyParent !== false) {
                const dispIds = [...displayRowsRef.current.map((r) => r.id)].sort().join('\u0001');
                const committedIds = [...nextRows.map((r) => r.id)].sort().join('\u0001');
                if (dispIds !== committedIds) {
                    warnLocalGraphMutation('useNodeRowManagement:commitRowsToParent', {
                        nodeId,
                        rowCount: nextRows.length,
                        structuralRowIdChange: true,
                    });
                }
                normalizedData.onUpdate?.({
                    rows: nextRows,
                    isTemporary: normalizedData.isTemporary,
                    ...(options?.patch ?? {}),
                });
            }
        },
        [normalizedData, computeIsEmpty]
    );

    /** Hydration: clear pending-add once props include the id; clear pending-removal once props omit the id. */
    useEffect(() => {
        const dispIds = new Set(displayRows.map((r) => r.id));
        pendingHydrationIdsRef.current.forEach((id) => {
            if (dispIds.has(id)) {
                pendingHydrationIdsRef.current.delete(id);
            }
        });
        pendingStructuralRemovalIdsRef.current.forEach((id) => {
            if (!dispIds.has(id)) {
                pendingStructuralRemovalIdsRef.current.delete(id);
            }
        });
    }, [displayRows]);

    /**
     * Pull structural updates from props (`displayRows`) without lazy-id heuristics:
     * derive uses explicit pending ids + editing overlay only.
     */
    useEffect(() => {
        if (autoAppendGuard.current > 0) {
            return;
        }
        const next = deriveSyncedNodeRows({
            displayRows,
            previousLocal: nodeRowsRef.current,
            editingRowId,
            pendingHydrationIds: pendingHydrationIdsRef.current,
            pendingStructuralRemovalIds: pendingStructuralRemovalIdsRef.current,
        });
        if (!rowListsShallowEqual(nodeRowsRef.current, next)) {
            setNodeRowsInternal(next);
            setIsEmpty(computeIsEmpty(next));
        }
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
            commitRowsToParent(cleaned);
        }
    }, [commitRowsToParent]);

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

        // ✅ Se una riga nuova viene riempita, aggiorna originalContentRef per marcarla come "non nuova"
        if (nowFilled && originalContentRef.current?.rowId === rowId && originalContentRef.current.wasNew) {
            originalContentRef.current.wasNew = false;
        }

        commitRowsToParent(updatedRows);

        // row.text is the label shown on the flow row; SayMessage body lives in
        // task.parameters (text GUID) + project translations (see sayMessageTaskSync).

        // setIsEmpty viene aggiornato solo quando esci dall'editing (ESC, click fuori, blur esterno)

        // ✅ LAZY: NON aggiorniamo/creiamo task qui - solo memorizziamo metadati nella riga
        // ✅ Il task verrà creato solo quando si apre l'editor (cliccando sul gear)
        // ✅ L'euristica 2 viene eseguita in NodeRow.tsx quando l'utente preme Enter
    }, [nodeRows, commitRowsToParent]);

    // Gestione eliminazione riga
    const handleDeleteRow = useCallback(async (rowId: string) => {
        // ✅ Find the row being deleted to get its taskId
        const rowToDelete = nodeRows.find(row => row.id === rowId);
        const taskId = rowToDelete?.taskId || getTaskIdFromRow(rowToDelete || { id: rowId } as NodeRowData);

        const updatedRows = nodeRows.filter(row => row.id !== rowId);
        pendingHydrationIdsRef.current.delete(rowId);
        commitRowsToParent(updatedRows);

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
    }, [nodeRows, commitRowsToParent, normalizedData]);

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
        saveOriginalContent(newRow.id);
        setEditingRowId(newRow.id);
        commitRowsToParent(updatedRows);
    }, [nodeRows, makeRowId, commitRowsToParent, saveOriginalContent]);

    /**
     * Immutable row updates for the whole node (used by semantic draft / meta).
     */
    const updateNodeRows = useCallback(
        (mutate: (rows: NodeRowData[]) => NodeRowData[]) => {
            const nextRows = mutate(nodeRows.map((r) => ({ ...r })));
            commitRowsToParent(nextRows);
        },
        [nodeRows, commitRowsToParent]
    );

    /**
     * Dopo commit (Enter o blur), se l'ultima riga ha testo non vuoto aggiunge una riga vuota finale.
     * Non sposta il focus: evita il bug del primo carattere che appendeva e rubava il focus durante la digitazione.
     */
    const appendTrailingEmptyRowIfLastFilled = useCallback(
        (editedRowId: string): boolean => {
            const rows = nodeRowsRef.current;
            const idx = rows.findIndex((r) => r.id === editedRowId);
            if (idx === -1 || idx !== rows.length - 1) {
                return false;
            }
            const text = (rows[idx].text || '').trim();
            if (!text) {
                return false;
            }
            beginAutoAppendGuard();
            const { nextRows } = appendEmptyRow(rows);
            commitRowsToParent(nextRows);
            return true;
        },
        [appendEmptyRow, commitRowsToParent]
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
                originalContentRef.current = null;
                const appended = appendTrailingEmptyRowIfLastFilled(rowIdToCheck);
                if (!appended) {
                    setIsEmpty(computeIsEmpty(nodeRows));
                }
                return;
            }
        }

        // Live label edits are committed on each keystroke (NodeRow → handleUpdateRow); no implicit rollback.
        setEditingRowId(null);
        originalContentRef.current = null;
        const appended = appendTrailingEmptyRowIfLastFilled(rowIdToCheck);
        if (!appended) {
            setIsEmpty(computeIsEmpty(nodeRows));
        }
    }, [
        nodeRows,
        computeIsEmpty,
        inAutoAppend,
        handleDeleteRow,
        appendTrailingEmptyRowIfLastFilled,
    ]);

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
        /** Commits rows to parent + tracks hydration ids (replaces raw duplicate state). */
        setNodeRows: commitRowsToParent,
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

        commitRowsToParent,

        // Utilities
        inAutoAppend,
        beginAutoAppendGuard
    };
}

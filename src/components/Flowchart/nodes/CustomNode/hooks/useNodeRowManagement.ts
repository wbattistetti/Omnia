import { useState, useCallback, useRef, useEffect } from 'react';
import { NodeRowData, EntityType } from '../../../../../types/project';
import { rowListsShallowEqual } from './nodeRowExternalSync';
import { makePendingLocalRowId } from '../utils/localRowIds';
import { dedupeNodeRowsById, dedupeNodeRowsByIdWithDevLog } from '../utils/dedupeNodeRows';
import { getTaskIdFromRow } from '../../../../../utils/taskHelpers';
import { variableCreationService } from '../../../../../services/VariableCreationService';
import { taskRepository } from '../../../../../services/TaskRepository';
import { TaskType } from '../../../../../types/taskTypes'; // ✅ Per TaskType enum
import { resolveTaskType } from '@components/Flowchart/utils/taskVisuals';
import { logNodeRowEdit } from '../../../rows/NodeRow/nodeRowEditDebug';
import { useFlowActionsStrict } from '../../../../../context/FlowActionsContext';

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
    /** Commits row snapshots via workspace machine (`updateFlowGraph`). Required — no legacy `onUpdate`. */
    commitNodeRowsToWorkspace: (params: {
        nextRows: NodeRowData[];
        patch?: Record<string, unknown>;
    }) => void;
}

/** Options for {@link useNodeRowManagement}'s row commit to the workspace slice. */
export type NodeRowsCommitOptions = {
    /** When false, only updates local row state (store already committed elsewhere). Default true. */
    notifyParent?: boolean;
    /** Extra fields merged into node `data` alongside `rows` when committing to the store. */
    patch?: Record<string, unknown>;
};

/**
 * Hook per gestire tutte le operazioni sulle righe del nodo.
 *
 * Verità strutturale: `displayRows` (props / FlowStore). Con viewer‑only rows: props mirror store;
 * solo la riga in edit può divergire temporaneamente.
 */
export function useNodeRowManagement({
    nodeId,
    normalizedData,
    displayRows,
    commitNodeRowsToWorkspace,
}: UseNodeRowManagementProps) {
    const flowActions = useFlowActionsStrict();

    // Stato delle righe
    const [nodeRows, setNodeRowsInternal] = useState<NodeRowData[]>(() =>
        dedupeNodeRowsById(displayRows),
    );
    const [editingRowId, setEditingRowId] = useState<string | null>(null);

    // Stato isEmpty per auto-append
    const [isEmpty, setIsEmpty] = useState(() => {
        const rows = dedupeNodeRowsById(displayRows);
        return rows.length === 0 || rows.every(r => !r.text || r.text.trim() === '');
    });

    // ✅ Traccia il contenuto originale quando inizi a editare una riga
    const originalContentRef = useRef<RowOriginalContent | null>(null);

    // Guardia per sopprimere exitEditing durante auto-append
    const autoAppendGuard = useRef(0);
    const inAutoAppend = () => autoAppendGuard.current > 0;

    /** Latest rows for sync effect (avoids depending on `nodeRows` and clobbering pending edits). */
    const nodeRowsRef = useRef(nodeRows);
    nodeRowsRef.current = nodeRows;

    /** Authoritative props snapshot */
    const displayRowsRef = useRef(displayRows);
    displayRowsRef.current = displayRows;

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
     * Commit row snapshot to the workspace slice (`updateFlowGraph`). No legacy parent `onUpdate`.
     */
    const commitRowsToWorkspace = useCallback(
        (nextRows: NodeRowData[], options?: NodeRowsCommitOptions) => {
            const normalizedRows = dedupeNodeRowsByIdWithDevLog(nextRows, 'commitRowsToWorkspace', nodeId);

            setNodeRowsInternal(normalizedRows);
            setIsEmpty(computeIsEmpty(normalizedRows));

            if (options?.notifyParent === false) {
                return;
            }
            commitNodeRowsToWorkspace({
                nextRows: normalizedRows,
                patch: {
                    isTemporary: normalizedData.isTemporary,
                    ...(options?.patch ?? {}),
                },
            });
        },
        [normalizedData, computeIsEmpty, nodeId, commitNodeRowsToWorkspace]
    );

    /**
     * Pull structural updates from props (`displayRows`) without lazy-id heuristics:
     * derive uses explicit pending ids + editing overlay only.
     */
    useEffect(() => {
        if (autoAppendGuard.current > 0) {
            return;
        }
        const authoritativeRows = dedupeNodeRowsByIdWithDevLog(displayRows, 'props sync', nodeId);
        const localRow =
            editingRowId != null ? nodeRowsRef.current.find((r) => r.id === editingRowId) : undefined;
        const authHasEditing =
            editingRowId != null && authoritativeRows.some((r) => r.id === editingRowId);

        /**
         * Se abbiamo appena inserito/commitato una riga, lo snapshot da parent può arrivare un tick dopo.
         * Il vecchio merge (`map` solo sugli id in `authoritativeRows`) **droppava** righe presenti solo in locale,
         * causando flicker (nodo lungo → corto) e perdita di `forceEditing`/focus.
         */
        if (editingRowId != null && localRow && !authHasEditing) {
            return;
        }

        const next =
            editingRowId != null && localRow && authHasEditing
                ? authoritativeRows.map((r) => (r.id === editingRowId ? localRow : r))
                : authoritativeRows;
        if (!rowListsShallowEqual(nodeRowsRef.current, next)) {
            setNodeRowsInternal(next);
            setIsEmpty(computeIsEmpty(next));
        }
    }, [displayRows, editingRowId, computeIsEmpty, nodeId]);

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
            commitRowsToWorkspace(cleaned);
        }
    }, [commitRowsToWorkspace]);

    // ✅ Salva il contenuto originale quando inizi a editare una riga (anche riga appena creata, non ancora in `nodeRows`)
    const saveOriginalContentFromRow = useCallback((row: NodeRowData) => {
        const originalText = row.text || '';
        const wasNew = !originalText || originalText.trim() === '';
        originalContentRef.current = {
            rowId: row.id,
            originalText,
            wasNew
        };
    }, []);

    const saveOriginalContent = useCallback(
        (rowId: string) => {
            const row = nodeRows.find((r) => r.id === rowId);
            if (!row) return;
            saveOriginalContentFromRow(row);
        },
        [nodeRows, saveOriginalContentFromRow]
    );

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

        commitRowsToWorkspace(updatedRows);

        // row.text is the label shown on the flow row; SayMessage body lives in
        // task.parameters (text GUID) + project translations (see sayMessageTaskSync).

        // setIsEmpty viene aggiornato solo quando esci dall'editing (ESC, click fuori, blur esterno)

        // ✅ LAZY: NON aggiorniamo/creiamo task qui - solo memorizziamo metadati nella riga
        // ✅ Il task verrà creato solo quando si apre l'editor (cliccando sul gear)
        // ✅ L'euristica 2 viene eseguita in NodeRow.tsx quando l'utente preme Enter
    }, [nodeRows, commitRowsToWorkspace]);

    // Gestione eliminazione riga
    const handleDeleteRow = useCallback(async (rowId: string) => {
        // ✅ Find the row being deleted to get its taskId
        const rowToDelete = nodeRows.find(row => row.id === rowId);
        const taskId = rowToDelete?.taskId || getTaskIdFromRow(rowToDelete || { id: rowId } as NodeRowData);

        const updatedRows = nodeRows.filter(row => row.id !== rowId);
        commitRowsToWorkspace(updatedRows);

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
            flowActions.deleteNode(nodeId);
        }
    }, [nodeRows, commitRowsToWorkspace, normalizedData, flowActions, nodeId]);

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

        // Inserisci una riga solo se l'ultima riga è valida (testo non vuoto e tipo risolto).
        // Usa resolveTaskType (heuristics.type, task repo, legacy row.type) — non `(row as any).type`.
        const last = updatedRows[updatedRows.length - 1];
        const lastHasText = Boolean(last && (last.text || '').trim().length > 0);
        const lastResolvedType = last ? resolveTaskType(last) : TaskType.UNDEFINED;
        const lastHasConcreteType = lastResolvedType !== TaskType.UNDEFINED;
        const lastValid = !last || (lastHasText && lastHasConcreteType);
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
        saveOriginalContentFromRow(newRow);
        setEditingRowId(newRow.id);
        commitRowsToWorkspace(updatedRows);
    }, [nodeRows, makeRowId, commitRowsToWorkspace, saveOriginalContentFromRow]);

    /**
     * Immutable row updates for the whole node (used by semantic draft / meta).
     */
    const updateNodeRows = useCallback(
        (mutate: (rows: NodeRowData[]) => NodeRowData[]) => {
            const nextRows = mutate(nodeRows.map((r) => ({ ...r })));
            commitRowsToWorkspace(nextRows);
        },
        [nodeRows, commitRowsToWorkspace]
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
            commitRowsToWorkspace(nextRows);
            return true;
        },
        [appendEmptyRow, commitRowsToWorkspace]
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
        /** Commits rows to the FlowStore slice (replaces raw duplicate state). */
        setNodeRows: commitRowsToWorkspace,
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

        commitRowsToWorkspace,

        // Utilities
        inAutoAppend,
        beginAutoAppendGuard
    };
}

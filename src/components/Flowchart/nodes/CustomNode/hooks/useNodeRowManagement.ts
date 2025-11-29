import { useState, useCallback, useRef } from 'react';
import { NodeRowData, EntityType } from '../../../../../types/project';
import { typeToMode } from '../../../../../utils/normalizers';
import { createRowWithTask, getTaskIdFromRow, updateRowData } from '../../../../../utils/taskHelpers';
import { flowchartVariablesService } from '../../../../../services/FlowchartVariablesService';
import { taskRepository } from '../../../../../services/TaskRepository';

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

    // Funzione per aggiungere una riga vuota
    // Migration: Now creates Task in TaskRepository (dual mode)
    const appendEmptyRow = useCallback((rows: NodeRowData[]) => {
        const newRowId = makeRowId();
        console.log('[appendEmptyRow] 🔍 Creating new row with task', {
            newRowId,
            tasksInMemoryBefore: taskRepository.getAllTasks().length
        });
        // Create row with Task (dual mode: Task + InstanceRepository)
        const newRow = createRowWithTask(newRowId, 'Message', '');
        console.log('[appendEmptyRow] ✅ Row created', {
            rowId: newRow.id,
            rowTaskId: newRow.taskId,
            rowHasTaskId: !!newRow.taskId,
            tasksInMemoryAfter: taskRepository.getAllTasks().length,
            taskExistsInRepo: !!taskRepository.getTask(newRow.id)
        });
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

        console.log('💾 [SAVE_ORIGINAL] Salvato contenuto originale', {
            rowId,
            originalText,
            wasNew,
            timestamp: Date.now()
        });
    }, [nodeRows]);

    // Gestione aggiornamento riga
    const handleUpdateRow = useCallback((
        rowId: string,
        newText: string,
        categoryType?: EntityType,
        meta?: Partial<NodeRowData>
    ) => {
        console.log('🎯 [HANDLE_UPDATE_ROW][START]', {
            rowId,
            newText,
            newTextLength: newText?.length,
            categoryType,
            meta,
            metaKeys: meta ? Object.keys(meta) : [],
            currentRowsCount: nodeRows.length,
            timestamp: Date.now()
        });

        const prev = nodeRows;
        const idx = prev.findIndex(r => r.id === rowId);
        if (idx === -1) {
            console.log('🎯 [HANDLE_UPDATE_ROW][ROW_NOT_FOUND]', { rowId, prevRowsCount: prev.length });
            return;
        }

        const wasEmpty = !(prev[idx].text || '').trim();
        const nowFilled = (newText || '').trim().length > 0;

        console.log('🎯 [HANDLE_UPDATE_ROW][BEFORE_UPDATE]', {
            rowId,
            idx,
            oldText: prev[idx].text,
            newText,
            wasEmpty,
            nowFilled,
            timestamp: Date.now()
        });

        let updatedRows = prev.map(row => {
            if (row.id !== rowId) return row as any;
            const incoming: any = meta || {};
            const existingType: any = (row as any).type;
            const finalType: any = (typeof incoming.type !== 'undefined') ? incoming.type : existingType;
            const existingMode: any = (row as any).mode;
            const finalMode: any = (typeof incoming.mode !== 'undefined') ? incoming.mode : (existingMode || (finalType ? typeToMode(finalType as any) : undefined));

            console.log('[🔍 CUSTOM_NODE] handleUpdateRow', {
                rowId,
                incomingInstanceId: incoming.instanceId,
                existingInstanceId: (row as any).instanceId,
                hasMeta: !!meta,
                metaKeys: meta ? Object.keys(meta) : [],
                timestamp: Date.now()
            });

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
                mode: finalMode,
                text: newText, // ✅ Questo è il testo che viene salvato
                categoryType:
                    (meta && (meta as any).categoryType)
                        ? (meta as any).categoryType
                        : (categoryType ?? row.categoryType),
                // Preserva flag isUndefined
                isUndefined: preserveIsUndefined
            } as any;

            console.log('🎯 [HANDLE_UPDATE_ROW][ROW_UPDATED]', {
                rowId,
                oldText: row.text,
                newText: updatedRow.text,
                textsMatch: updatedRow.text === newText,
                timestamp: Date.now()
            });

            return updatedRow;
        });

        const isLast = idx === prev.length - 1;

        // ✅ Se una riga nuova viene riempita, aggiorna originalContentRef per marcarla come "non nuova"
        if (nowFilled && originalContentRef.current?.rowId === rowId && originalContentRef.current.wasNew) {
            originalContentRef.current.wasNew = false;
            console.log('✅ [HANDLE_UPDATE_ROW] Riga nuova riempita, marcata come esistente', {
                rowId,
                timestamp: Date.now()
            });
        }

        // ✅ Logica migliorata: auto-append se stai editando l'ultima riga, era vuota e ora è piena
        // Questo permette di continuare l'auto-append anche dopo la prima riga
        // Non serve più verificare isEmpty perché vogliamo continuare finché editiamo l'ultima riga vuota
        // Quando aggiungiamo una nuova riga vuota, quella diventa l'ultima, quindi l'auto-append continua
        const shouldAutoAppend = isLast && wasEmpty && nowFilled;

        console.log('🔍 [AUTO_APPEND] Checking conditions', {
            nodeId,
            rowId,
            isLast,
            wasEmpty,
            nowFilled,
            isEmpty,
            shouldAutoAppend,
            timestamp: Date.now()
        });

        if (shouldAutoAppend) {
            console.log('✅ [AUTO_APPEND] Adding new row', {
                nodeId,
                currentRowsCount: updatedRows.length,
                isEmpty,
                timestamp: Date.now()
            });

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
                    console.log('✅ [AUTO_APPEND] Focus impostato sulla nuova riga');
                    newTextarea.focus();
                    newTextarea.select();
                } else {
                    console.warn('⚠️ [AUTO_APPEND] Textarea non trovato');
                }
            });
        }

        console.log('🎯 [HANDLE_UPDATE_ROW][BEFORE_SET_NODE_ROWS]', {
            rowId,
            updatedRowsCount: updatedRows.length,
            targetRowText: updatedRows.find(r => r.id === rowId)?.text,
            newText,
            timestamp: Date.now()
        });

        setNodeRows(updatedRows);

        console.log('🎯 [HANDLE_UPDATE_ROW][AFTER_SET_NODE_ROWS]', {
            rowId,
            timestamp: Date.now()
        });

        const finalRow = updatedRows.find(r => r.id === rowId);

        // Migration: row.text is the task name/label (not the message content)
        // task.value.text contains the actual message content (saved in instance)
        // When row.text is updated, it's updating the task name, not the message content
        // The message content is updated separately when editing the task in ResponseEditor

        console.log('🎯 [HANDLE_UPDATE_ROW][CALLING_ON_UPDATE]', {
            rowId,
            finalRowText: finalRow?.text,
            newText,
            textsMatch: finalRow?.text === newText,
            hasOnUpdate: !!normalizedData.onUpdate,
            timestamp: Date.now()
        });

        // ❌ RIMOSSO - isEmpty si aggiorna SOLO in exitEditing() per mantenere auto-append continuo
        // setIsEmpty viene aggiornato solo quando esci dall'editing (ESC, click fuori, blur esterno)
        normalizedData.onUpdate?.({ rows: updatedRows, isTemporary: normalizedData.isTemporary });

        console.log('🎯 [HANDLE_UPDATE_ROW][AFTER_ON_UPDATE]', {
            rowId,
            timestamp: Date.now()
        });
    }, [nodeRows, isEmpty, nodeId, appendEmptyRow, normalizedData, saveOriginalContent]);

    // Gestione eliminazione riga
    const handleDeleteRow = useCallback(async (rowId: string) => {
        const updatedRows = nodeRows.filter(row => row.id !== rowId);
        setNodeRows(updatedRows);
        // ✅ Aggiorna isEmpty: se tutte le righe sono vuote dopo la cancellazione, torna isEmpty=true
        setIsEmpty(computeIsEmpty(updatedRows));
        normalizedData.onUpdate?.({ rows: updatedRows });

        // ✅ NEW: Delete variables when row is deleted
        try {
            let projectId: string | undefined = undefined;
            try {
                projectId = ((require('../../state/runtime') as any).getCurrentProjectId?.() || undefined);
            } catch {}

            if (projectId) {
                await flowchartVariablesService.init(projectId);
                await flowchartVariablesService.deleteMappingsByRowId(rowId);

                // Emit event to refresh ConditionEditor variables
                try {
                    document.dispatchEvent(new CustomEvent('flowchart:variablesUpdated', {
                        bubbles: true
                    }));
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
            console.log('🗑️ [INSERT_ROW] Eliminando riga vuota auto-appendata prima di inserire nuova riga', {
                lastRowId: lastRow.id,
                insertIndex: index,
                timestamp: Date.now()
            });

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

            // ✅ Elimina anche le variabili associate alla riga eliminata
            try {
                let projectId: string | undefined = undefined;
                try {
                    projectId = ((require('../../state/runtime') as any).getCurrentProjectId?.() || undefined);
                } catch {}

                if (projectId) {
                    await flowchartVariablesService.init(projectId);
                    await flowchartVariablesService.deleteMappingsByRowId(lastRow.id);

                    // Emit event to refresh ConditionEditor variables
                    try {
                        document.dispatchEvent(new CustomEvent('flowchart:variablesUpdated', {
                            bubbles: true
                        }));
                    } catch {}
                }
            } catch (e) {
                console.warn('[useNodeRowManagement] Failed to delete variables', e);
            }
        }

        // Inserisci una riga solo se l'ultima riga è valida (non vuota e con tipo)
        // ✅ Questo controllo ora è dopo l'eliminazione della riga vuota
        const last = updatedRows[updatedRows.length - 1];
        const lastValid = last ? Boolean((last.text || '').trim().length > 0 && ((last as any).type || (last as any).mode)) : true;
        if (!lastValid && updatedRows.length > 0) return;

        const newRowId = makeRowId();
        // Create row with Task (dual mode: Task + InstanceRepository)
        const newRow = createRowWithTask(newRowId, 'Message', '');
        (newRow as any).isNew = true; // Preserve isNew flag

        updatedRows.splice(adjustedIndex, 0, newRow);
        setNodeRows(updatedRows);
        // ✅ Salva come "nuova" quando inizia l'editing della riga inserita
        saveOriginalContent(newRow.id);
        setEditingRowId(newRow.id);
        normalizedData.onUpdate?.({ rows: updatedRows });
    }, [nodeRows, makeRowId, normalizedData, saveOriginalContent]);

    // Gestione exit editing
    const handleExitEditing = useCallback((rowIdToCheck?: string | null) => {
        if (inAutoAppend()) {
            console.log('🔍 [EXIT_EDITING] Soppresso durante auto-append');
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

        // ✅ CASO 1: Riga NUOVA (mai riempita)
        if (originalContent?.wasNew) {
            if (isEmpty) {
                // Riga nuova vuota + blur = ESC → ELIMINA
                console.log('🗑️ [EXIT_EDITING] Riga nuova vuota → ESC → Eliminata', {
                    rowId: rowIdToCheck,
                    timestamp: Date.now()
                });
                handleDeleteRow(rowIdToCheck);
                originalContentRef.current = null;
                return;
            } else {
                // Riga nuova con contenuto + blur = ENTER → CONFERMA
                console.log('✅ [EXIT_EDITING] Riga nuova con contenuto → ENTER → Confermata', {
                    rowId: rowIdToCheck,
                    content: currentText,
                    timestamp: Date.now()
                });
                // La riga è già stata aggiornata da handleUpdateRow, quindi basta uscire
                setEditingRowId(null);
                setIsEmpty(computeIsEmpty(nodeRows));
                originalContentRef.current = null;
                return;
            }
        }

        // ✅ CASO 2: Riga ESISTENTE (già riempita)
        // Blur = ESC → RIPRISTINA contenuto originale
        if (originalContent && originalContent.originalText !== currentText) {
            console.log('↩️ [EXIT_EDITING] Riga esistente modificata → ESC → Ripristina originale', {
                rowId: rowIdToCheck,
                originalText: originalContent.originalText,
                currentText: currentText,
                timestamp: Date.now()
            });

            // Ripristina il contenuto originale
            setNodeRows(prev => prev.map(r =>
                r.id === rowIdToCheck
                    ? { ...r, text: originalContent.originalText }
                    : r
            ));

            // Aggiorna anche il parent
            const updatedRows = nodeRows.map(r =>
                r.id === rowIdToCheck
                    ? { ...r, text: originalContent.originalText }
                    : r
            );
            normalizedData.onUpdate?.({ rows: updatedRows });
        }

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
        validateRows,
        computeIsEmpty,
        makeRowId,

        // Utilities
        inAutoAppend,
        beginAutoAppendGuard
    };
}

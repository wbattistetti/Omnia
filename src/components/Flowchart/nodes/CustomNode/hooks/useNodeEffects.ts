import { useEffect, useRef } from 'react';
import { NodeRowData } from '../../../../../types/project';

interface UseNodeEffectsProps {
    // State
    showPermanentHeader: boolean;
    hasTitle: boolean;
    isHoveredNode: boolean;
    isEditingNode: boolean;
    selected: boolean;
    id: string;
    nodeRows: NodeRowData[];
    editingRowId: string | null;
    normalizedData: any;
    isEmpty: boolean;
    inAutoAppend: () => boolean;
    computeIsEmpty: (rows: NodeRowData[]) => boolean;

    // Setters
    setIsHoverHeader: (hovered: boolean) => void;
    setIsHoveredNode: (hovered: boolean) => void;
    setNodeRows: (rows: NodeRowData[]) => void;
    setIsEmpty: (empty: boolean) => void;
    setEditingRowId: (id: string | null) => void;

    // Refs
    rootRef: React.RefObject<HTMLDivElement>;
    nodeContainerRef: React.RefObject<HTMLDivElement>;

    // Functions
    exitEditing: () => void;
}

/**
 * Hook per gestire tutti gli useEffect del nodo
 * Centralizza la logica di effetti collaterali e lifecycle
 */
export function useNodeEffects({
    showPermanentHeader,
    hasTitle,
    isHoveredNode,
    isEditingNode,
    selected,
    id,
    nodeRows,
    editingRowId,
    normalizedData,
    isEmpty,
    inAutoAppend,
    computeIsEmpty,
    setIsHoverHeader,
    setIsHoveredNode,
    setNodeRows,
    setIsEmpty,
    setEditingRowId,
    rootRef,
    nodeContainerRef,
    exitEditing
}: UseNodeEffectsProps) {

    // Keep latest rows in a ref to update safely from DOM events
    const latestRowsRef = useRef<NodeRowData[]>(nodeRows);
    useEffect(() => { latestRowsRef.current = nodeRows; }, [nodeRows]);

    // Se l'header viene nascosto, azzera sempre lo stato hover header
    useEffect(() => {
        if (!showPermanentHeader) setIsHoverHeader(false);
    }, [showPermanentHeader, setIsHoverHeader]);

    // Calcola area estesa per toolbar nodo (include nodo + toolbar + padding)
    useEffect(() => {
        const shouldShowToolbar = (isHoveredNode || selected) && !isEditingNode;

        if (shouldShowToolbar && rootRef.current) {
            const updateRect = () => {
                if (!rootRef.current) return;
                const nodeRect = rootRef.current.getBoundingClientRect();
                // Toolbar sopra nodo: marginBottom 8px, altezza ~18-20px
                const toolbarHeight = 20;
                const toolbarMargin = 8;
                const padding = 8; // padding extra per hover area

                const extendedRect = new DOMRect(
                    nodeRect.left - padding,
                    nodeRect.top - toolbarHeight - toolbarMargin - padding,
                    nodeRect.width + (padding * 2),
                    nodeRect.height + toolbarHeight + toolbarMargin + (padding * 2)
                );

                // setNodeBufferRect removed - no longer needed
            };

            updateRect();
            window.addEventListener('resize', updateRect);
            window.addEventListener('scroll', updateRect, true);

            return () => {
                window.removeEventListener('resize', updateRect);
                window.removeEventListener('scroll', updateRect, true);
            };
        }
    }, [isHoveredNode, selected, isEditingNode, rootRef]);

    // Nascondi header su click canvas se il titolo è vuoto
    useEffect(() => {
        const hideOnCanvasClick = () => {
            if (!hasTitle) {
                setIsHoveredNode(false);
            }
        };
        window.addEventListener('flow:canvas:click', hideOnCanvasClick as any);
        return () => window.removeEventListener('flow:canvas:click', hideOnCanvasClick as any);
    }, [hasTitle, id, setIsHoveredNode]);

    // Fallback per relatedTarget null (focus programmatico) - pointerdown copre mouse+touch+pen
    const nextPointerTargetRef = useRef<EventTarget | null>(null);
    useEffect(() => {
        const onPointerDown = (e: PointerEvent) => {
            nextPointerTargetRef.current = e.target;
        };
        window.addEventListener("pointerdown", onPointerDown, { capture: true, passive: true });
        return () => window.removeEventListener("pointerdown", onPointerDown, { capture: true } as any);
    }, []);

    // Effetto per mantenere isEmpty allineato alle righe (fuori dalla finestra auto-append)
    const prevComputedIsEmptyRef = useRef<boolean | null>(null);
    useEffect(() => {
        if (inAutoAppend()) return; // evita transizioni spurie durante auto-append

        const next = computeIsEmpty(nodeRows);
        // Only update if the computed value actually changed to prevent infinite loops
        if (prevComputedIsEmptyRef.current === null || next !== prevComputedIsEmptyRef.current) {
            prevComputedIsEmptyRef.current = next;
            setIsEmpty(next);
        }
    }, [nodeRows, inAutoAppend, computeIsEmpty, setIsEmpty]);

    // Focus per nodi nuovi (semplificato) - NON per nodi hidden!
    useEffect(() => {
        // SKIP auto-focus solo se il nodo è hidden (per edge temporanei)
        // PERMETTI auto-focus se isTemporary ma non hidden (nodi creati con doppio click)
        if (normalizedData.hidden) {
            return;
        }

        // Se abbiamo focusRowId (nodo nuovo) e non c'è editingRowId, impostalo
        if (normalizedData.focusRowId && !editingRowId && nodeRows.length > 0) {
            const firstRow = nodeRows[0];
            if (firstRow && firstRow.text.trim() === '') {
                setEditingRowId(firstRow.id);
                // Focus programmato dopo il render
                requestAnimationFrame(() => {
                    const textareas = document.querySelectorAll('.node-row-input');
                    const firstTextarea = textareas[0] as HTMLTextAreaElement;
                    if (firstTextarea) {
                        firstTextarea.focus();
                        firstTextarea.select();
                    }
                });
            }
        }
    }, [normalizedData.focusRowId, normalizedData.hidden, editingRowId, nodeRows, setEditingRowId]);

    // Listen for global message text updates coming from NonInteractive editor
    useEffect(() => {
        const handler = (e: any) => {
            const d = (e && e.detail) || {};
            if (!d || !d.instanceId) return;
            // IMPORTANT: row.id IS the instanceId, so we must match on row.id, not row.instanceId
            const next = (latestRowsRef.current || []).map(r => {
                const rowId = r?.id || (r as any)?.instanceId;
                if (rowId === d.instanceId) {
                    return { ...r, message: { ...(r as any)?.message, text: d.text } };
                }
                return r;
            });
            setNodeRows(next);
            // Schedule parent update outside render/setState to avoid warnings
            try {
                Promise.resolve().then(() => normalizedData.onUpdate?.({ rows: next }));
            } catch { }
        };
        document.addEventListener('rowMessage:update', handler as any);
        return () => document.removeEventListener('rowMessage:update', handler as any);
    }, [setNodeRows, normalizedData]);

    // Canvas click: exit editing e elimina righe vuote
    useEffect(() => {
        const onCanvasClick = () => {
            // Elimina tutte le righe vuote
            const emptyRows = nodeRows.filter(row => !row.text || row.text.trim() === '');
            if (emptyRows.length > 0) {
                const cleanedRows = nodeRows.filter(row => row.text && row.text.trim().length > 0);
                setNodeRows(cleanedRows);
                setIsEmpty(computeIsEmpty(cleanedRows));
                normalizedData.onUpdate?.({ rows: cleanedRows });
            }

            // Esci dall'editing e stabilizza il nodo se è temporaneo
            exitEditing();
        };

        window.addEventListener('flow:canvas:click', onCanvasClick as any);
        return () => window.removeEventListener('flow:canvas:click', onCanvasClick as any);
    }, [editingRowId, id, nodeRows, normalizedData, exitEditing, setNodeRows, setIsEmpty, computeIsEmpty]);

    return {
        nextPointerTargetRef,
        latestRowsRef
    };
}

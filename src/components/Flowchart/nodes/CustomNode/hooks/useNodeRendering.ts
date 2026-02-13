import { useMemo } from 'react';
import { NodeRowData } from '../../../../../types/project';
import { useDynamicFontSizes } from '../../../../../hooks/useDynamicFontSizes';

interface UseNodeRenderingProps {
    nodeRows: NodeRowData[];
    normalizedData: any;
    isHoveredNode: boolean;
    selected: boolean;
    isEditingNode: boolean;
    showPermanentHeader: boolean;
    showDragHeader: boolean;
    isDragging: boolean;
    isToolbarDrag: boolean;
    editingRowId: string | null;
    showIntellisense: boolean;
    intellisensePosition: { x: number; y: number };
    handleIntellisenseSelectItem: (item: any) => void;
    closeIntellisense: () => void;
    handleRowDragStart: (id: string, index: number, clientX: number, clientY: number, originalElement: HTMLElement) => void;
    handleUpdateRow: (rowId: string, newText: string, categoryType?: any, meta?: Partial<NodeRowData>) => void;
    handleDeleteRow: (rowId: string) => void;
    handleInsertRow: (index: number) => void;
    handleExitEditing: () => void;
    setIsEditingNode: (editing: boolean) => void;
    handleDeleteNode: () => void;
    setIsHoveredNode: (hovered: boolean) => void;
    setIsHoverHeader: (hovered: boolean) => void;
    id: string;
    nodeWidth?: number | null;
    isEmpty?: boolean;
    onWidthChange?: (width: number) => void;
}

/**
 * Hook per gestire la logica di rendering del nodo
 * Centralizza i calcoli per stili, props e rendering condizionale
 */
export function useNodeRendering({
    nodeRows,
    normalizedData,
    isHoveredNode,
    selected,
    isEditingNode,
    showPermanentHeader,
    showDragHeader,
    isDragging,
    isToolbarDrag,
    editingRowId,
    showIntellisense,
    intellisensePosition,
    handleIntellisenseSelectItem,
    closeIntellisense,
    handleRowDragStart,
    handleUpdateRow,
    handleDeleteRow,
    handleInsertRow,
    handleExitEditing,
    setIsEditingNode,
    handleDeleteNode,
    setIsHoveredNode,
    setIsHoverHeader,
    id,
    nodeWidth = null,
    isEmpty = false,
    onWidthChange
}: UseNodeRenderingProps) {
    const fontSizes = useDynamicFontSizes();

    // Calcola le righe visibili
    const visibleRows = useMemo(() => {
        return ((normalizedData as any)?.hideUncheckedRows === true)
            ? nodeRows.filter(r => r.included !== false)
            : nodeRows;
    }, [nodeRows, normalizedData]);

    // Props per NodeRowList
    const nodeRowListProps = useMemo(() => ({
        rows: visibleRows,
        editingRowId,
        handleInsertRow: handleInsertRow,
        onUpdate: (row: any, newText: string) => {
          // Estrai tutti i campi importanti dalla row per preservarli (incluso isUndefined e heuristics)
          const meta = {
            included: (row as any).included,
            type: (row as any).type,
            mode: (row as any).mode,
            isUndefined: (row as any).isUndefined, // ✅ Preserva flag isUndefined
            factoryId: (row as any).factoryId,
            // ❌ RIMOSSO: instanceId (row.id === task.id ALWAYS, non serve duplicato)
            // ❌ RIMOSSO: taskId (row.id === task.id ALWAYS, non serve duplicato)
            // ✅ FIX: Preserva row.heuristics esplicitamente (contiene type e templateId dall'euristica)
            heuristics: (row as any).heuristics || undefined
          };
          return handleUpdateRow(row.id, newText, row.categoryType, meta);
        },
        onUpdateWithCategory: (row: any, newText: string, categoryType: any, meta: any) => {
          // Merge meta passato con campi importanti dalla row
          const mergedMeta = {
            included: (row as any).included,
            isUndefined: (row as any).isUndefined, // ✅ Preserva flag isUndefined
            // ✅ FIX: Preserva row.heuristics se non è già presente nel meta passato
            heuristics: (meta && (meta as any).heuristics !== undefined) ? (meta as any).heuristics : ((row as any).heuristics || undefined),
            ...(meta || {})
          };
          return handleUpdateRow(row.id, newText, categoryType, mergedMeta);
        },
        onDelete: (row: any) => handleDeleteRow(row.id),
        onDragStart: handleRowDragStart,
        onWidthChange: onWidthChange
    }), [
        visibleRows,
        editingRowId,
        handleUpdateRow,
        handleDeleteRow,
        handleInsertRow,
        handleRowDragStart,
        onWidthChange
    ]);

    // Props per NodeDragHeader (toolbar permanente)
    const permanentToolbarProps = useMemo(() => ({
        onEditTitle: () => setIsEditingNode(true),
        onDelete: handleDeleteNode,
        compact: true,
        showDragHandle: false,
        fullWidth: true,
        isToolbarDrag,
        onDragStart: () => {
            console.log('🎯 [CustomNode] onDragStart from Move button', {
                isDragging,
                isToolbarDrag
            });
            // Questi setter verranno passati dal componente padre
        }
    }), [setIsEditingNode, handleDeleteNode, isToolbarDrag, isDragging]);

    // Props per NodeDragHeader (header drag)
    const dragHeaderProps = useMemo(() => ({
        onEditTitle: () => setIsEditingNode(true),
        onDelete: handleDeleteNode,
        compact: true,
        showDragHandle: false,
        fullWidth: true,
        isToolbarDrag,
        onDragStart: () => {
            console.log('🎯 [CustomNode] onDragStart from Move button', {
                isDragging,
                isToolbarDrag
            });
            // Questi setter verranno passati dal componente padre
        }
    }), [setIsEditingNode, handleDeleteNode, isToolbarDrag, isDragging]);

    // Props per IntellisenseMenu
    const intellisenseProps = useMemo(() => ({
        isOpen: showIntellisense,
        query: editingRowId ? nodeRows.find(row => row.id === editingRowId)?.text || '' : '',
        position: intellisensePosition,
        referenceElement: null,
        onSelect: handleIntellisenseSelectItem,
        onClose: () => {
            console.log("🎯 [CustomNode] ROW INTELLISENSE CLOSED", { nodeId: id });
            closeIntellisense();
        },
        filterCategoryTypes: ['taskTemplates', 'userActs', 'backendActions']
    }), [
        showIntellisense,
        editingRowId,
        nodeRows,
        intellisensePosition,
        handleIntellisenseSelectItem,
        closeIntellisense,
        id
    ]);

    // Calcola larghezza iniziale per 20 caratteri se nodo è vuoto
    const calculateInitialWidth = () => {
        // Se il nodo ha già una larghezza misurata, usala
        if (nodeWidth !== null) {
            return nodeWidth;
        }

        // Se il nodo è vuoto, calcola larghezza per 25 caratteri basata sul font size
        if (isEmpty) {
            const fontSizeNum = parseFloat(fontSizes.nodeRow) || 14;
            const charWidth = fontSizeNum * 0.6; // Approssimazione larghezza carattere (monospace-like)
            const textWidth = 25 * charWidth; // 25 caratteri
            const padding = 40; // Padding laterale (sinistra + destra)
            const minWidth = Math.ceil(textWidth + padding);

            return Math.max(minWidth, 140); // Almeno 140px come minimo assoluto
        }

        // Default: 140px se nodo non è vuoto e non ha larghezza misurata
        return 140;
    };

    // Stili dinamici per il nodo
    const nodeStyles = useMemo(() => {
        const initialWidth = calculateInitialWidth();
        return {
            opacity: normalizedData.hidden ? 0 : 1,
            minWidth: nodeWidth ? `${nodeWidth}px` : `${initialWidth}px`,
            width: nodeWidth ? `${nodeWidth}px` : 'fit-content',
            position: 'relative' as const,
            zIndex: 1,
            flexShrink: 0
        };
    }, [normalizedData.hidden, nodeWidth, isEmpty, fontSizes.nodeRow]);

    // Stili per la toolbar
    const toolbarStyles = useMemo(() => ({
        opacity: isDragging ? 0 : 1,
        transition: 'opacity 0.2s ease',
        marginBottom: 0
    }), [isDragging]);

    // Stili per l'header drag
    const dragHeaderStyles = useMemo(() => ({
        position: 'absolute' as const,
        top: -20,
        left: 0,
        width: '100%', // FISSO: Estende la toolbar per tutta la larghezza del nodo
        height: 20,
        zIndex: 1000,
        pointerEvents: showDragHeader ? 'auto' as const : 'none' as const,
        opacity: showDragHeader ? 1 : 0,
        userSelect: 'none' as const,
        transition: 'opacity 0.2s ease'
    }), [showDragHeader]);

    return {
        visibleRows,
        nodeRowListProps,
        permanentToolbarProps,
        dragHeaderProps,
        intellisenseProps,
        nodeStyles,
        toolbarStyles,
        dragHeaderStyles
    };
}

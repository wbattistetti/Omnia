import { useMemo } from 'react';
import { NodeRowData } from '../../../../../types/project';

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
    id
}: UseNodeRenderingProps) {

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
        onUpdate: (row: any, newText: string) => handleUpdateRow(row.id, newText, row.categoryType, { included: (row as any).included }),
        onUpdateWithCategory: (row: any, newText: string, categoryType: any, meta: any) => handleUpdateRow(row.id, newText, categoryType, { included: (row as any).included, ...(meta || {}) }),
        onDelete: (row: any) => handleDeleteRow(row.id),
        onDragStart: handleRowDragStart
    }), [
        visibleRows,
        editingRowId,
        handleUpdateRow,
        handleDeleteRow,
        handleInsertRow,
        handleRowDragStart
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
        filterCategoryTypes: ['agentActs', 'userActs', 'backendActions']
    }), [
        showIntellisense,
        editingRowId,
        nodeRows,
        intellisensePosition,
        handleIntellisenseSelectItem,
        closeIntellisense,
        id
    ]);

    // Stili dinamici per il nodo
    const nodeStyles = useMemo(() => ({
        opacity: normalizedData.hidden ? 0 : 1,
        minWidth: 140,
        width: 'fit-content',
        position: 'relative' as const,
        zIndex: 1
    }), [normalizedData.hidden]);

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
        right: 0,
        height: 20,
        zIndex: 1000,
        pointerEvents: showDragHeader ? 'auto' as const : 'none' as const,
        opacity: showDragHeader ? 1 : 0,
        userSelect: 'none' as const,
        transition: 'opacity 0.2s ease',
        width: '100%'
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

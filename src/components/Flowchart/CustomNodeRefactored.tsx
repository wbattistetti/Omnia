import React, { useState, useRef, useEffect, useMemo } from 'react';
import { NodeProps } from 'reactflow';
import { NodeHeader } from './NodeHeader';
import { NodeRow } from './NodeRow';
import { NodeHandles } from './NodeHandles';
import { IntellisenseMenu } from '../Intellisense/IntellisenseMenu';
import { IntellisenseItem } from '../Intellisense/IntellisenseTypes';
import { NodeRowData, EntityType } from '../../types/project';
import { PlusCircle, Edit3, Trash2 } from 'lucide-react';
import { useNodeRowDrag } from '../../hooks/useNodeRowDrag';
import { NodeRowList } from './NodeRowList';

// Import our specialized hooks
import { useFocusManager } from '../../hooks/useFocusManager';
import { useRowManager } from '../../hooks/useRowManager';
import { useNodeManager } from '../../hooks/useNodeManager';
import { useIntellisenseManager } from '../../hooks/useIntellisenseManager';

/**
 * Dati custom per un nodo del flowchart
 * @property title - titolo del nodo
 * @property rows - array di righe (azioni/step)
 * @property isTemporary - true se nodo temporaneo
 * @property onDelete - callback per eliminare il nodo
 * @property onUpdate - callback per aggiornare i dati del nodo
 */
export interface CustomNodeData {
  title: string;
  rows: NodeRowData[];
  isTemporary?: boolean;
  onDelete?: () => void;
  onUpdate?: (updates: any) => void;
  onPlayNode?: (nodeId: string) => void; // nuova prop opzionale
  hidden?: boolean; // render invisibile finché non riposizionato
  focusRowId?: string; // row da mettere in edit al mount
  hideUncheckedRows?: boolean; // nasconde le righe non incluse
  onCreateAgentAct?: (name: string, onRowUpdate?: (item: any) => void, scope?: 'global' | 'industry', categoryName?: string) => void;
  onCreateBackendCall?: (name: string, onRowUpdate?: (item: any) => void, scope?: 'global' | 'industry', categoryName?: string) => void;
  onCreateTask?: (name: string, onRowUpdate?: (item: any) => void, scope?: 'global' | 'industry', categoryName?: string) => void;
}

export const CustomNodeRefactored: React.FC<NodeProps<CustomNodeData>> = ({ 
  id: _ignoredId, 
  data, 
  isConnectable, selected
}) => {
  // Initialize specialized hooks
  const isNewAndEmpty = !data.rows || data.rows.length === 0;
  const initialRows = isNewAndEmpty ? [{ id: '1', text: '', included: true, mode: 'Message' as const }] : (data.rows || []);
  
  const { focusState, focusActions, focusEvents } = useFocusManager(data.focusRowId || (isNewAndEmpty ? '1' : null), isNewAndEmpty);
  const { rowState, rowActions, rowEvents } = useRowManager(initialRows);
  const { nodeState, nodeActions, nodeEvents } = useNodeManager(data.title || 'New Node', false, false, data.hidden || false, data.hideUncheckedRows || false);
  const { intellisenseState, intellisenseActions, intellisenseEvents } = useIntellisenseManager();

  // Local state for UI interactions
  const [isEditingNode, setIsEditingNode] = useState(false);
  const [hasAddedNewRow, setHasAddedNewRow] = useState(false);
  const [hoveredInserter, setHoveredInserter] = useState<number | null>(null);

  // Refs
  const rowsContainerRef = useRef<HTMLDivElement | null>(null);

  // Drag and drop
  const drag = useNodeRowDrag(rowState.rows);

  // Sync local state with hooks
  useEffect(() => {
    if (data.onUpdate) {
      data.onUpdate({ 
        title: nodeState.title,
        rows: rowState.rows,
        hidden: nodeState.hidden,
        hideUncheckedRows: nodeState.hideUncheckedRows
      });
    }
  }, [nodeState.title, rowState.rows, nodeState.hidden, nodeState.hideUncheckedRows, data]);

  // Sync data.hidden with nodeState.hidden
  useEffect(() => {
    if (data.hidden !== undefined && data.hidden !== nodeState.hidden) {
      console.log('🔄 [CustomNode] Syncing hidden state:', { from: nodeState.hidden, to: data.hidden });
      nodeActions.setHidden(data.hidden);
    }
  }, [data.hidden, nodeState.hidden, nodeActions]);

  // Handle node deletion
  const handleDeleteNode = () => {
    if (data.onDelete) {
      data.onDelete();
    }
  };

  // Handle row updates with focus management
  const handleUpdateRow = (rowId: string, newText: string, categoryType?: EntityType, meta?: Partial<NodeRowData>) => {
    const newRowId = rowActions.updateRow(rowId, newText, categoryType, meta);
    if (newRowId) {
      focusActions.setFocus(newRowId);
    }
  };

  // Handle row deletion
  const handleDeleteRow = (rowId: string) => {
    rowActions.deleteRow(rowId);
    
    // If no rows left, delete the entire node
    if (rowState.rows.length <= 1 && typeof data.onDelete === 'function') {
      data.onDelete();
    }
  };

  // Handle adding new rows
  const handleAddRow = (text: string) => {
    const newRowId = rowActions.createRow(text);
    focusActions.setFocus(newRowId);
  };

  // Handle intellisense selection
  const handleIntellisenseSelectItem = (item: IntellisenseItem) => {
    if (focusState.activeRowId) {
      // Apply selection to the current row
      const baseRows = rowState.rows.map(row =>
        row.id === focusState.activeRowId ? { 
          ...row, 
          ...item, 
          id: row.id, 
          categoryType: item.categoryType as any, 
          userActs: item.userActs, 
          mode: item.mode || 'Message' as const, 
          actId: item.actId, 
          factoryId: item.factoryId 
        } : row
      );
      
      // Always add a new empty row after adding a label
      const newRowId = rowActions.createRow('');
      focusActions.setFocus(newRowId);
    }
    intellisenseActions.closeIntellisense();
  };

  // Handle title updates
  const handleTitleUpdate = (newTitle: string) => {
    nodeActions.setTitle(newTitle);
  };

  // Handle row insertion
  const handleInsertRow = (index: number) => {
    const newRowId = rowActions.createRow('', index);
    focusActions.setFocus(newRowId);
  };

  // Handle keyboard events
  const handleKeyDown = (e: React.KeyboardEvent) => {
    // Let focus manager handle Enter key
    focusEvents.onKeyDown(e, focusState.activeRowId || '', () => {
      const newRowId = rowActions.createRow('');
      return newRowId;
    });
  };

  // Handle canvas click
  const handleCanvasClick = () => {
    const deleteEmptyNode = () => {
      if (data.onDelete) {
        data.onDelete();
      }
    };
    nodeEvents.onCanvasClick(rowState.rows, focusState.activeRowId, deleteEmptyNode);
    focusEvents.onCanvasClick(deleteEmptyNode);
  };

  // Handle intellisense show
  const handleShowIntellisense = (event: React.KeyboardEvent, rowId: string) => {
    if (event.key === 'Enter') {
      const rect = event.currentTarget.getBoundingClientRect();
      intellisenseActions.openIntellisense('', { x: rect.left, y: rect.bottom + 5 });
      focusActions.setFocus(rowId);
    }
  };

  // Drag and drop handlers (keeping existing logic)
  const handleRowDragStart = (id: string, index: number, clientX: number, clientY: number, rect: DOMRect) => {
    drag.setDraggedRowId(id);
    drag.setDraggedRowOriginalIndex(index);
    drag.setDraggedRowInitialClientX(clientX);
    drag.setDraggedRowInitialClientY(clientY);
    drag.setDraggedRowInitialRect(rect);
    drag.setDraggedRowCurrentClientX(clientX);
    drag.setDraggedRowCurrentClientY(clientY);
    drag.setHoveredRowIndex(index);
    drag.setVisualSnapOffset({ x: 0, y: 0 });

    document.body.style.cursor = 'grabbing';
    document.body.style.userSelect = 'none';

    window.addEventListener('pointermove', handleGlobalMouseMove as any, { capture: true });
    window.addEventListener('pointerup', handleGlobalMouseUp as any, { capture: true });
    window.addEventListener('mousemove', handleGlobalMouseMove as any, { capture: true });
    window.addEventListener('mouseup', handleGlobalMouseUp as any, { capture: true });
  };

  const handleMoveRow = (fromIndex: number, toIndex: number) => {
    rowActions.moveRow(fromIndex, toIndex);
  };

  const handleDropRow = () => {
    if (data.onUpdate) data.onUpdate({ rows: rowState.rows });
  };

  // Global mouse handlers (keeping existing logic)
  const handleGlobalMouseMove = (event: MouseEvent | PointerEvent) => {
    if (!drag.draggedRowId || !drag.draggedRowInitialRect || drag.draggedRowInitialClientY === null) return;

    drag.setDraggedRowCurrentClientX(event.clientX);
    drag.setDraggedRowCurrentClientY(event.clientY);

    // Calculate hovered index
    let newHoveredIndex = drag.draggedRowOriginalIndex || 0;
    const scope = rowsContainerRef.current || document;
    const elements = Array.from(scope.querySelectorAll('.node-row-outer')) as HTMLElement[];
    const rects = elements.map((el, idx) => ({ idx: Number(el.dataset.index), top: el.getBoundingClientRect().top, height: el.getBoundingClientRect().height }));
    const centerY = event.clientY;
    for (const r of rects) {
      if (centerY < r.top + r.height / 2) { newHoveredIndex = r.idx; break; }
      newHoveredIndex = r.idx + 1;
    }

    if (newHoveredIndex !== drag.hoveredRowIndex) {
      drag.setHoveredRowIndex(newHoveredIndex);
      
      const rowHeight = 40;
      const targetY = drag.draggedRowInitialRect.top + (newHoveredIndex * rowHeight);
      const currentMouseBasedY = drag.draggedRowInitialRect.top + (event.clientY - drag.draggedRowInitialClientY);
      const snapOffsetY = targetY - currentMouseBasedY;
      
      drag.setVisualSnapOffset({ x: 0, y: snapOffsetY });
    }
  };

  const handleGlobalMouseUp = () => {
    const hasOriginal = drag.draggedRowOriginalIndex !== null;
    let targetIndex = drag.hoveredRowIndex;
    
    if (hasOriginal && (targetIndex === null || targetIndex === undefined)) {
      const scope = rowsContainerRef.current || document;
      const elements = Array.from(scope.querySelectorAll('.node-row-outer')) as HTMLElement[];
      const rects = elements.map((el, idx) => ({ idx: Number(el.dataset.index), top: el.getBoundingClientRect().top, height: el.getBoundingClientRect().height }));
      const centerY = (drag.draggedRowCurrentClientY ?? drag.draggedRowInitialClientY) as number;
      let inferred = drag.draggedRowOriginalIndex as number;
      for (const r of rects) { if (centerY < r.top + r.height / 2) { inferred = r.idx; break; } inferred = r.idx + 1; }
      targetIndex = Math.max(0, Math.min(rowState.rows.length - 1, inferred));
    }
    
    if (hasOriginal && targetIndex !== null && (drag.draggedRowOriginalIndex as number) !== targetIndex) {
      rowActions.moveRow(drag.draggedRowOriginalIndex as number, targetIndex as number);
    }

    // Reset drag state
    drag.setDraggedRowId(null);
    drag.setDraggedRowOriginalIndex(null);
    drag.setDraggedRowInitialClientX(null);
    drag.setDraggedRowInitialClientY(null);
    drag.setDraggedRowInitialRect(null);
    drag.setDraggedRowCurrentClientX(null);
    drag.setDraggedRowCurrentClientY(null);
    drag.setHoveredRowIndex(null);
    drag.setVisualSnapOffset({ x: 0, y: 0 });

    document.body.style.cursor = '';
    document.body.style.userSelect = '';

    window.removeEventListener('pointermove', handleGlobalMouseMove as any);
    window.removeEventListener('pointerup', handleGlobalMouseUp as any);
    window.removeEventListener('mousemove', handleGlobalMouseMove as any);
    window.removeEventListener('mouseup', handleGlobalMouseUp as any);
  };

  // Cleanup
  useEffect(() => {
    return () => {
      document.removeEventListener('mousemove', handleGlobalMouseMove);
      document.removeEventListener('mouseup', handleGlobalMouseUp);
    };
  }, []);

  // Canvas click listener - DISABLED to prevent conflict with FlowEditor
  // useEffect(() => {
  //   const onCanvasClick = () => {
  //     handleCanvasClick();
  //   };
  //   window.addEventListener('flow:canvas:click', onCanvasClick as any);
  //   return () => window.removeEventListener('flow:canvas:click', onCanvasClick as any);
  // }, [rowState.rows, focusState.activeRowId, data]);

  // Display rows for rendering
  const displayRows = useMemo(() => rowState.rows, [rowState.rows]);

  // Find dragged item
  const draggedItem = drag.draggedRowId ? rowState.rows.find(row => row.id === drag.draggedRowId) : null;

  // Calculate dragged row style
  const draggedRowStyle = useMemo(() => {
    if (!draggedItem || !drag.draggedRowInitialRect || drag.draggedRowInitialClientX === null || 
        drag.draggedRowInitialClientY === null || drag.draggedRowCurrentClientX === null || 
        drag.draggedRowCurrentClientY === null) {
      return {};
    }

    return {
      top: drag.draggedRowInitialRect.top + (drag.draggedRowCurrentClientY - drag.draggedRowInitialClientY) + drag.visualSnapOffset.y,
      left: drag.draggedRowInitialRect.left + (drag.draggedRowCurrentClientX - drag.draggedRowInitialClientX) + drag.visualSnapOffset.x,
      width: drag.draggedRowInitialRect.width
    };
  }, [draggedItem, drag.draggedRowInitialRect, drag.draggedRowInitialClientX, drag.draggedRowInitialClientY, 
      drag.draggedRowCurrentClientX, drag.draggedRowCurrentClientY, drag.visualSnapOffset]);

  // If temporary node, render only handles
  if (data.isTemporary) {
    return (
      <div className="w-1 h-1 opacity-0">
        <NodeHandles isConnectable={isConnectable} />
      </div>
    );
  }

  return (
    <div
      className={`bg-white border-black rounded-lg shadow-xl min-h-[40px] relative ${selected ? 'border-2' : 'border'}`}
      style={{ opacity: nodeState.hidden ? 0 : 1, minWidth: 140, width: 'fit-content' }}
      tabIndex={-1}
      onMouseDownCapture={(e) => {
        if (!focusState.activeRowId) return;
        const t = e.target as HTMLElement;
        const isAnchor = t?.classList?.contains('rigid-anchor') || !!t?.closest?.('.rigid-anchor');
        const isInput = t?.classList?.contains('node-row-input') || !!t?.closest?.('.node-row-input');
        if (isInput && !isAnchor) { e.stopPropagation(); }
      }}
      onMouseUpCapture={(e) => {
        if (!focusState.activeRowId) return;
        const t = e.target as HTMLElement;
        const isInput = t?.classList?.contains('node-row-input') || !!t?.closest?.('.node-row-input');
        if (isInput) { e.stopPropagation(); }
      }}
      onFocusCapture={(e) => { /* no-op: lasciamo passare focus per drag header */ }}
    >
      <div
        className="relative"
        onClickCapture={(e) => {
          if ((e as any).type === 'flow:node:delete') {
            e.preventDefault();
            e.stopPropagation();
            handleDeleteNode();
          }
        }}
      >
        <NodeHeader
          title={nodeState.title}
          onDelete={handleDeleteNode}
          onToggleEdit={() => setIsEditingNode(!isEditingNode)}
          onTitleUpdate={handleTitleUpdate}
          isEditing={isEditingNode}
          hasUnchecked={rowState.rows.some(r => r.included === false)}
          hideUnchecked={nodeState.hideUncheckedRows}
          onToggleHideUnchecked={() => nodeActions.setHideUncheckedRows(!nodeState.hideUncheckedRows)}
        />
      </div>
      <div className="px-1.5" style={{ paddingTop: 0, paddingBottom: 0 }} ref={rowsContainerRef}>
        <NodeRowList
          rows={nodeState.hideUncheckedRows ? displayRows.filter(r => r.included !== false) : displayRows}
          editingRowId={focusState.activeRowId}
          key={`rows-${focusState.activeRowId}`}
          hoveredInserter={hoveredInserter}
          setHoveredInserter={setHoveredInserter}
          handleInsertRow={handleInsertRow}
          nodeTitle={nodeState.title}
          onUpdate={(row, newText) => handleUpdateRow(row.id, newText, row.categoryType, { included: (row as any).included })}
          onUpdateWithCategory={(row, newText, categoryType) => handleUpdateRow(row.id, newText, categoryType as EntityType, { included: (row as any).included })}
          onDelete={(row) => handleDeleteRow(row.id)}
          onKeyDown={handleKeyDown}
          onDragStart={handleRowDragStart}
          canDelete={(row) => rowState.rows.length > 1}
          totalRows={rowState.rows.length}
          onCreateAgentAct={data.onCreateAgentAct}
          onCreateBackendCall={data.onCreateBackendCall}
          onCreateTask={data.onCreateTask}
          hoveredRowIndex={drag.hoveredRowIndex}
          draggedRowId={drag.draggedRowId}
          draggedRowOriginalIndex={drag.draggedRowOriginalIndex}
          draggedItem={draggedItem ?? null}
          draggedRowStyle={draggedRowStyle}
          onEditingEnd={() => focusActions.clearFocus()}
        />
      </div>
      <NodeHandles isConnectable={isConnectable} />
      
      {/* Intellisense Menu */}
      {intellisenseState.isOpen && (
        <IntellisenseMenu
          isOpen={intellisenseState.isOpen}
          query={intellisenseState.query}
          position={intellisenseState.position}
          referenceElement={null}
          onSelect={handleIntellisenseSelectItem}
          onClose={() => intellisenseActions.closeIntellisense()}
          filterCategoryTypes={['agentActs', 'userActs', 'backendActions']}
        />
      )}
    </div>
  );
};

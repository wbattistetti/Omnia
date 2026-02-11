import React from 'react';
import { NodeRowData } from '../../../../types/project';
import { NodeRow } from '../NodeRow/NodeRow';
import { RowInserter } from './RowInserter';

interface NodeRowListProps {
  rows: NodeRowData[];
  editingRowId: string | null;
  hoveredInserter: number | null;
  setHoveredInserter: (idx: number | null) => void;
  handleInsertRow: (idx: number) => void;
  nodeTitle: string;
  hideUnchecked?: boolean; // Hide rows with included=false
  onUpdate: (row: NodeRowData, newText: string) => void;
  onUpdateWithCategory: (row: NodeRowData, newText: string, categoryType?: string, meta?: any) => void;
  onDelete: (row: NodeRowData) => void;
  onKeyDown: (e: React.KeyboardEvent) => void;
  onDragStart: (id: string, index: number, clientX: number, clientY: number, originalElement: HTMLElement) => void;
  canDelete: (row: NodeRowData) => boolean;
  totalRows: number;
  hoveredRowIndex: number | null;
  draggedRowId: string | null;
  draggedRowOriginalIndex: number | null;
  draggedItem: NodeRowData | null;
  draggedRowStyle: React.CSSProperties;
  onEditingEnd?: (rowId?: string) => void;
  onCreateFactoryTask?: (name: string, onRowUpdate?: (item: any) => void) => void; // ✅ RINOMINATO: onCreateAgentAct → onCreateFactoryTask
  onCreateBackendCall?: (name: string, onRowUpdate?: (item: any) => void) => void;
  onCreateTask?: (name: string, onRowUpdate?: (item: any) => void) => void;
  getProjectId?: () => string | null;
  onWidthChange?: (width: number) => void;
}

export const NodeRowList: React.FC<NodeRowListProps> = ({
  rows,
  editingRowId,
  hoveredInserter,
  setHoveredInserter,
  handleInsertRow,
  nodeTitle,
  hideUnchecked = false,
  onUpdate,
  onUpdateWithCategory,
  onDelete,
  onKeyDown,
  onDragStart,
  canDelete,
  totalRows,
  hoveredRowIndex,
  draggedRowId,
  draggedRowOriginalIndex,
  draggedItem,
  draggedRowStyle,
  onEditingEnd,
  onCreateFactoryTask, // ✅ RINOMINATO: onCreateAgentAct → onCreateFactoryTask
  onCreateBackendCall,
  onCreateTask,
  getProjectId,
  onWidthChange
}) => {

  // Filter rows based on hideUnchecked setting
  const visibleRows = hideUnchecked
    ? rows.filter(row => row.included !== false)
    : rows;

  // Hide any visible inserter only if hovering over the row that is currently being edited
  // Allow dividers to show when hovering over other rows, even if one row is in editing mode
  React.useEffect(() => {
    if (editingRowId !== null && hoveredInserter !== null) {
      // Find which row index corresponds to the editing row
      const editingRowIndex = visibleRows.findIndex(r => r.id === editingRowId);
      // Only hide inserter if hovering near the row that is being edited
      // Allow dividers to show between other rows
      if (editingRowIndex !== -1 && (hoveredInserter === editingRowIndex || hoveredInserter === editingRowIndex + 1)) {
        setHoveredInserter(null);
      }
    }
  }, [editingRowId, hoveredInserter, visibleRows]);

  return (
    <>
      {visibleRows.map((row, idx) => (
        <React.Fragment key={row.id}>
          {/* Inserter sopra la label */}
          <RowInserter
            visible={(hoveredInserter === idx) && (editingRowId === null || visibleRows[idx]?.id !== editingRowId)}
            onInsert={() => handleInsertRow(idx)}
            onMouseEnter={() => {
              setHoveredInserter(idx);
            }}
            onMouseLeave={() => {
              setHoveredInserter(null);
            }}
            index={idx}
          />
          <NodeRow
            row={row}
            nodeTitle={nodeTitle}
            nodeCanvasPosition={undefined}
            onUpdate={onUpdate}
            onUpdateWithCategory={onUpdateWithCategory}
            onDelete={onDelete}
            onKeyDown={onKeyDown}
            onDragStart={onDragStart}
            onMoveRow={(from, to) => {
              const boundedTo = Math.max(0, Math.min(totalRows - 1, to));
              if (from !== boundedTo) {
                // Implementa il riordinamento immediato
                const newRows = [...rows];
                const [movedRow] = newRows.splice(from, 1);
                newRows.splice(boundedTo, 0, movedRow);

                // Aggiorna le righe tramite callback
                if (onUpdate) {
                  // Chiama onUpdate per ogni riga per aggiornare l'ordine
                  newRows.forEach((row, index) => {
                    onUpdate(row, row.text);
                  });
                }
              }
            }}
            onDropRow={() => {
              // Il drop è gestito dal sistema di drag & drop globale
            }}
            index={idx}
            canDelete={true}
            totalRows={totalRows}
            isHoveredTarget={Boolean(hoveredRowIndex === idx)}
            isBeingDragged={draggedRowId === row.id}
            isPlaceholder={Boolean(row.isPlaceholder)}
            forceEditing={editingRowId === row.id}
            onEditingEnd={() => onEditingEnd?.(row.id)}
            onMouseEnter={(type, i) => {
              if (type === 'top') setHoveredInserter(i);
              else if (type === 'bottom') setHoveredInserter(i + 1);
            }}
            onMouseLeave={() => setHoveredInserter(null)}
            onCreateFactoryTask={onCreateFactoryTask} // ✅ RINOMINATO: onCreateAgentAct → onCreateFactoryTask
            onCreateBackendCall={onCreateBackendCall}
            onCreateTask={onCreateTask}
            getProjectId={getProjectId}
            onWidthChange={onWidthChange}
          />
        </React.Fragment>
      ))}
      {/* Inserter dopo l'ultima riga */}
      <RowInserter
        visible={(hoveredInserter === rows.length) && (editingRowId === null || visibleRows.length === 0 || visibleRows[visibleRows.length - 1]?.id !== editingRowId)}
        onInsert={() => handleInsertRow(rows.length)}
        onMouseEnter={() => {
          setHoveredInserter(rows.length);
        }}
        onMouseLeave={() => {
          setHoveredInserter(null);
        }}
        index={rows.length}
      />
      {/* Drag & Drop personalizzato - da implementare */}
    </>
  );
};
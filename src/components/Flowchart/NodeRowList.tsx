import React from 'react';
import { NodeRowData } from '../../types/project';
import { NodeRow } from './NodeRow';
import { RowInserter } from './RowInserter';

interface NodeRowListProps {
  rows: NodeRowData[];
  editingRowId: string | null;
  hoveredInserter: number | null;
  setHoveredInserter: (idx: number | null) => void;
  handleInsertRow: (idx: number) => void;
  nodeTitle: string;
  onUpdate: (row: NodeRowData, newText: string) => void;
  onUpdateWithCategory: (row: NodeRowData, newText: string, categoryType?: string) => void;
  onDelete: (row: NodeRowData) => void;
  onKeyDown: (e: React.KeyboardEvent) => void;
  onDragStart: (id: string, index: number, clientX: number, clientY: number, rect: DOMRect) => void;
  canDelete: (row: NodeRowData) => boolean;
  totalRows: number;
  hoveredRowIndex: number | null;
  draggedRowId: string | null;
  draggedRowOriginalIndex: number | null;
  draggedItem: NodeRowData | null;
  draggedRowStyle: React.CSSProperties;
  onEditingEnd?: () => void;
}

export const NodeRowList: React.FC<NodeRowListProps> = ({
  rows,
  editingRowId,
  hoveredInserter,
  setHoveredInserter,
  handleInsertRow,
  nodeTitle,
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
  onEditingEnd
}) => {
  return (
    <>
      {rows.map((row, idx) => (
        <React.Fragment key={row.id}>
          <RowInserter
            visible={hoveredInserter === idx && editingRowId === null}
            onInsert={() => handleInsertRow(idx)}
            onMouseEnter={() => setHoveredInserter(idx)}
            onMouseLeave={() => setHoveredInserter(null)}
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
            index={idx}
            canDelete={canDelete(row)}
            totalRows={totalRows}
            isHoveredTarget={Boolean(hoveredRowIndex === idx)}
            isBeingDragged={false}
            isPlaceholder={Boolean(row.isPlaceholder)}
            forceEditing={editingRowId === row.id}
            onEditingEnd={onEditingEnd}
          />
        </React.Fragment>
      ))}
      {/* Inserter dopo l'ultima riga */}
      <RowInserter
        visible={hoveredInserter === rows.length && editingRowId === null}
        onInsert={() => handleInsertRow(rows.length)}
        onMouseEnter={() => setHoveredInserter(rows.length)}
        onMouseLeave={() => setHoveredInserter(null)}
      />
      {/* Renderizza la riga trascinata separatamente */}
      {draggedItem && (
        <NodeRow
          key={`dragged-${draggedItem.id}`}
          row={draggedItem}
          nodeTitle={nodeTitle}
          nodeCanvasPosition={undefined}
          onUpdate={onUpdate}
          onUpdateWithCategory={onUpdateWithCategory}
          onDelete={onDelete}
          onKeyDown={onKeyDown}
          onDragStart={onDragStart}
          index={draggedRowOriginalIndex || 0}
          canDelete={rows.length > 1}
          totalRows={rows.length}
          isBeingDragged={true}
          style={draggedRowStyle}
          forceEditing={false}
        />
      )}
    </>
  );
}; 
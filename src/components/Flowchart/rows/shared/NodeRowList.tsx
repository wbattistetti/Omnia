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
  onUpdate: (row: NodeRowData, newText: string) => void;
  onUpdateWithCategory: (row: NodeRowData, newText: string, categoryType?: string, meta?: any) => void;
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
  onCreateAgentAct?: (name: string, onRowUpdate?: (item: any) => void) => void;
  onCreateBackendCall?: (name: string, onRowUpdate?: (item: any) => void) => void;
  onCreateTask?: (name: string, onRowUpdate?: (item: any) => void) => void;
  getProjectId?: () => string | null;
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
  onEditingEnd,
  onCreateAgentAct,
  onCreateBackendCall,
  onCreateTask,
  getProjectId
}) => {

  // Hide any visible inserter as soon as a textbox appears (editing mode)
  React.useEffect(() => {
    if (editingRowId !== null && hoveredInserter !== null) {
      try { if (localStorage.getItem('debug.inserter') === '1') console.log('[Inserter][autoHide:onEdit]', { editingRowId, hoveredInserter }); } catch { }
      setHoveredInserter(null);
    }
  }, [editingRowId]);
  return (
    <>
      {rows.map((row, idx) => (
        <React.Fragment key={row.id}>
          {/* Inserter sopra la label */}
          <RowInserter
            visible={(hoveredInserter === idx) && (editingRowId === null)}
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
              try { console.log('[RowDnD][moveImmediate]', { from, to }); } catch { }
              const boundedTo = Math.max(0, Math.min(totalRows - 1, to));
              if (from !== boundedTo) {
                // Implementa il riordinamento immediato
                const newRows = [...rows];
                const [movedRow] = newRows.splice(from, 1);
                newRows.splice(boundedTo, 0, movedRow);

                // Aggiorna le righe tramite callback
                if (onUpdate) {
                  // Notifica il parent del cambio
                  console.log('[RowDnD][moveImmediate] Rows reordered', { from, to: boundedTo, newRows });
                  // Chiama onUpdate per ogni riga per aggiornare l'ordine
                  newRows.forEach((row, index) => {
                    onUpdate(row, row.text);
                  });
                }
              }
            }}
            onDropRow={() => {
              console.log('[RowDnD][dropRow] Drop completed');
              // Il drop è gestito dal sistema di drag & drop globale
            }}
            index={idx}
            canDelete={true}
            totalRows={totalRows}
            isHoveredTarget={Boolean(hoveredRowIndex === idx)}
            isBeingDragged={draggedRowId === row.id}
            isPlaceholder={Boolean(row.isPlaceholder)}
            forceEditing={editingRowId === row.id}
            onEditingEnd={onEditingEnd}
            onMouseEnter={(type, i) => {
              if (type === 'top') setHoveredInserter(i);
              else if (type === 'bottom') setHoveredInserter(i + 1);
            }}
            onMouseLeave={() => setHoveredInserter(null)}
            onCreateAgentAct={onCreateAgentAct}
            onCreateBackendCall={onCreateBackendCall}
            onCreateTask={onCreateTask}
            getProjectId={getProjectId}
          />
        </React.Fragment>
      ))}
      {/* Inserter dopo l'ultima riga */}
      <RowInserter
        visible={(hoveredInserter === rows.length) && (editingRowId === null)}
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
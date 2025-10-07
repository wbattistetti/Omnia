import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Handle, Position } from 'reactflow';
import { NodeRowList } from './NodeRowList';
import { NodeHeader } from './NodeHeader';
import { NodeHandles } from './NodeHandles';
import { useNodeRowDrag } from '../../hooks/useNodeRowDrag';
import { EntityType } from '../../types/EntityType';
import { NodeRowData } from '../../types/NodeRowData';
import { CustomNodeData } from '../../types/CustomNodeData';

interface NodeProps {
  data: CustomNodeData;
  selected: boolean;
}

export const CustomNode: React.FC<NodeProps> = ({ data, selected }) => {
  const [nodeRows, setNodeRows] = useState<NodeRowData[]>(data.rows || []);
  const [editingRowId, setEditingRowId] = useState<string | null>(null);
  const nodeRef = useRef<HTMLDivElement>(null);

  // Aggiorna nodeRows quando data.rows cambia
  useEffect(() => {
    setNodeRows(data.rows || []);
  }, [data.rows]);

  // Focus automatico per nuovi nodi
  useEffect(() => {
    if (data.focusRowId && !editingRowId && nodeRows.length > 0) {
      const targetRow = nodeRows.find(row => row.id === data.focusRowId);
      if (targetRow && !targetRow.text?.trim()) {
        setEditingRowId(data.focusRowId);
      }
    }
  }, [data.focusRowId, editingRowId, nodeRows]);

  const makeRowId = useCallback(() => {
    return `row_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }, []);

  // ✅ NUOVO: Metodo per aggiungere una riga vuota
  const appendEmptyRow = useCallback(() => {
    const newRowId = makeRowId();
    const newRows = [...nodeRows, {
      id: newRowId,
      text: '',
      included: true,
      mode: 'Message' as const
    } as any];
    setNodeRows(newRows);
    setEditingRowId(newRowId);
    data.onUpdate?.({ rows: newRows });
  }, [nodeRows, makeRowId, data]);

  const handleUpdateRow = (
    rowId: string,
    newText: string,
    categoryType?: EntityType,
    meta?: Partial<NodeRowData>
  ) => {
    const prev = nodeRows;
    const idx = prev.findIndex(r => r.id === rowId);
    if (idx === -1) return;

    const wasEmpty = !(prev[idx].text || '').trim();
    const nowFilled = (newText || '').trim().length > 0;

    const updatedRows = prev.map(row =>
      row.id === rowId
        ? {
            ...row,
            ...(meta || {}),
            text: newText,
            categoryType:
              (meta && (meta as any).categoryType)
                ? (meta as any).categoryType
                : (categoryType ?? row.categoryType)
          }
        : row
    );

    const isLast = idx === prev.length - 1;
    const hasTrailingEmpty =
      updatedRows.length > 0 && !(updatedRows[updatedRows.length - 1].text || '').trim();

    setNodeRows(updatedRows);

    // ✅ MODIFICA: Auto-append SOLO per nodi temporanei usando il nuovo metodo
    if (data.isTemporary && isLast && wasEmpty && nowFilled && !hasTrailingEmpty) {
      appendEmptyRow();
    }

    // ✅ MODIFICA: Stabilizzazione del nodo temporaneo
    if (data.isTemporary && updatedRows.some(r => (r.text || '').trim().length > 0)) {
      data.onUpdate?.({ rows: updatedRows, isTemporary: false, hidden: false });
    } else {
      data.onUpdate?.({ rows: updatedRows });
    }
  };

  const handleDeleteRow = (rowId: string) => {
    const updatedRows = nodeRows.filter(row => row.id !== rowId);
    setNodeRows(updatedRows);
    data.onUpdate?.({ rows: updatedRows });
  };

  const handleInsertRow = (afterRowId: string) => {
    const newRowId = makeRowId();
    const afterIndex = nodeRows.findIndex(row => row.id === afterRowId);
    const newRows = [...nodeRows];
    newRows.splice(afterIndex + 1, 0, {
      id: newRowId,
      text: '',
      included: true,
      mode: 'Message' as const
    } as any);
    setNodeRows(newRows);
    setEditingRowId(newRowId);
    data.onUpdate?.({ rows: newRows });
  };

  const exitEditing = useCallback(() => {
    setEditingRowId(null);
  }, []);

  const handleKeyDown = useCallback((event: React.KeyboardEvent) => {
    if (event.key === 'Escape') {
      exitEditing();
    }
  }, [exitEditing]);

  const { dragRef, isDragging } = useNodeRowDrag(data);

  if (data.hidden) {
    return null;
  }

  return (
    <div
      ref={nodeRef}
      className={`bg-white border-2 rounded-lg shadow-lg min-w-[280px] max-w-[400px] ${
        selected ? 'border-blue-500' : 'border-gray-200'
      } ${isDragging ? 'opacity-50' : ''}`}
      onKeyDown={handleKeyDown}
    >
      <NodeHeader
        title={data.title || 'Untitled Node'}
        onDelete={data.onDelete}
        onPlay={data.onPlayNode}
      />
      
      <NodeHandles />
      
      <div className="p-3">
        <NodeRowList
          rows={nodeRows}
          editingRowId={editingRowId}
          onUpdateRow={handleUpdateRow}
          onDeleteRow={handleDeleteRow}
          onInsertRow={handleInsertRow}
          onSetEditingRow={setEditingRowId}
          onCreateAgentAct={data.onCreateAgentAct}
          onCreateBackendCall={data.onCreateBackendCall}
          onCreateTask={data.onCreateTask}
        />
      </div>
      
      <div ref={dragRef} className="absolute inset-0 pointer-events-none" />
    </div>
  );
};

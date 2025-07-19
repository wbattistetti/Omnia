import React, { useState, useRef, useEffect, useMemo } from 'react';
import { NodeProps } from 'reactflow';
import { NodeHeader } from './NodeHeader';
import { NodeRow } from './NodeRow';
import { NodeHandles } from './NodeHandles';
import { IntellisenseMenu } from '../Intellisense/IntellisenseMenu';
import { IntellisenseItem } from '../Intellisense/IntellisenseTypes';
import { NodeRowData, EntityType } from '../../types/project';
import { PlusCircle, Edit3, Trash2 } from 'lucide-react';
import { RowInserter } from './RowInserter';
import { useNodeRowDrag } from '../../hooks/useNodeRowDrag';
import { NodeRowList } from './NodeRowList';

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
}

export const CustomNode: React.FC<NodeProps<CustomNodeData>> = ({ 
  id, 
  data, 
  isConnectable, selected
}) => {
  const [isEditingNode, setIsEditingNode] = useState(false);
  const [nodeTitle, setNodeTitle] = useState(data.title || 'New Node');
  // Se il nodo è nuovo e vuoto, crea subito una row vuota e metti in editing
  const isNewAndEmpty = !data.rows || data.rows.length === 0;
  const initialRowId = isNewAndEmpty ? '1' : (data.rows && data.rows[0]?.id);
  const [nodeRows, setNodeRows] = useState<NodeRowData[]>(
    isNewAndEmpty ? [{ id: '1', text: '' }] : (data.rows || [])
  );
  const [showIntellisense, setShowIntellisense] = useState(false);
  const [intellisensePosition, setIntellisensePosition] = useState({ x: 0, y: 0 });
  const [editingRowId, setEditingRowId] = useState<string | null>(isNewAndEmpty ? '1' : null);
  // Wrapper per setEditingRowId con log
  const setEditingRowIdWithLog = (val: string | null) => {
    setEditingRowId(val);
  };
  // Rimuovi tutti i console.log relativi a editingRowId, prima riga, ecc.

  // Stati per il drag-and-drop
  const drag = useNodeRowDrag(nodeRows);

  // Stato per tracciare se la nuova row è stata aggiunta in questa sessione di editing
  const [hasAddedNewRow, setHasAddedNewRow] = useState(false);

  // Riferimenti DOM per le righe
  const rowRefs = useRef(new Map<string, HTMLDivElement>());

  // Stato per gestire l'inserter hover
  const [hoveredInserter, setHoveredInserter] = useState<number | null>(null);

  // Inizio stato per overlay azioni
  const [showActions, setShowActions] = useState(false);

  const handleDeleteNode = () => {
    if (data.onDelete) {
      data.onDelete();
    }
  };

  const handleUpdateRow = (rowId: string, newText: string, categoryType?: EntityType) => {
    const updatedRows = nodeRows.map(row => 
      row.id === rowId ? { ...row, text: newText, categoryType } : row
    );
    setNodeRows(updatedRows);
    if (typeof data.onUpdate === 'function') {
      data.onUpdate({ rows: updatedRows });
    }
  };

  const handleDeleteRow = (rowId: string) => {
    const updatedRows = nodeRows.filter(row => row.id !== rowId);
    setNodeRows(updatedRows);
    
    if (data.onUpdate) {
      data.onUpdate({ rows: updatedRows });
    }
  };

  const handleAddRow = (text: string) => {
    const newRow: NodeRowData = {
      id: (nodeRows.length + 1).toString(),
      text: text
    };
    const updatedRows = [...nodeRows, newRow];
    setNodeRows(updatedRows);
    setEditingRowIdWithLog(newRow.id); // Forza subito l'editing sulla nuova row
    if (data.onUpdate) {
      data.onUpdate({ rows: updatedRows });
    }
  };

  const handleShowIntellisense = (event: React.KeyboardEvent, rowId: string) => {
    if (event.key === 'Enter') {
      const rect = event.currentTarget.getBoundingClientRect();
      setIntellisensePosition({
        x: rect.left,
        y: rect.bottom + 5
      });
      setEditingRowIdWithLog(rowId);
      setShowIntellisense(true);
    }
  };

  const handleIntellisenseSelect = (selectedText: string) => {
    if (editingRowId) {
      handleUpdateRow(editingRowId, selectedText);
    }
    setShowIntellisense(false);
    setEditingRowIdWithLog(null);
  };

  const handleIntellisenseSelectItem = (item: IntellisenseItem) => {
    if (editingRowId) {
      const updatedRows = nodeRows.map(row =>
        row.id === editingRowId
          ? { ...row, ...item, id: row.id }
          : row
      );
      setNodeRows(updatedRows);
      if (data.onUpdate) {
        data.onUpdate({ rows: updatedRows });
      }
    }
    setShowIntellisense(false);
    setEditingRowIdWithLog(null);
  };

  const handleTitleUpdate = (newTitle: string) => {
    setNodeTitle(newTitle);
    if (data.onUpdate) {
      data.onUpdate({ title: newTitle });
    }
  };

  // Funzione per inserire una riga in una posizione specifica
  const handleInsertRow = (index: number) => {
    const newRow: NodeRowData = {
      id: (nodeRows.length + 1).toString(),
      text: '',
      isNew: true
    };
    const updatedRows = [...nodeRows];
    updatedRows.splice(index, 0, newRow);
    setNodeRows(updatedRows);
    setEditingRowIdWithLog(newRow.id);
    if (data.onUpdate) {
      data.onUpdate({ rows: updatedRows });
    }
  };

  // Gestione del drag-and-drop
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

    document.addEventListener('mousemove', handleGlobalMouseMove);
    document.addEventListener('mouseup', handleGlobalMouseUp);
  };

  const handleGlobalMouseMove = (event: MouseEvent) => {
    if (!drag.draggedRowId || !drag.draggedRowInitialRect || drag.draggedRowInitialClientY === null) return;

    drag.setDraggedRowCurrentClientX(event.clientX);
    drag.setDraggedRowCurrentClientY(event.clientY);

    drag.setDraggedRowCurrentClientX(event.clientX);
    drag.setDraggedRowCurrentClientY(event.clientY);

    // Calcola la posizione attuale della riga trascinata (senza snap)
    const currentDraggedY = drag.draggedRowInitialRect.top + (event.clientY - drag.draggedRowInitialClientY);

    // Determina il nuovo indice di hover basandosi sulla posizione delle altre righe
    let newHoveredIndex = drag.draggedRowOriginalIndex || 0;
    const rowHeight = 40; // Altezza approssimativa di una riga + margini

    for (let i = 0; i < nodeRows.length; i++) {
      if (i === drag.draggedRowOriginalIndex) continue;
      
      const adjustedIndex = i > (drag.draggedRowOriginalIndex || 0) ? i - 1 : i;
      const rowY = drag.draggedRowInitialRect.top + (adjustedIndex * rowHeight);
      
      if (currentDraggedY < rowY + rowHeight / 2) {
        newHoveredIndex = i;
        break;
      }
      newHoveredIndex = i + 1;
    }

    if (newHoveredIndex !== drag.hoveredRowIndex) {
      drag.setHoveredRowIndex(newHoveredIndex);
      
      // Calcola lo snap offset per far "seguire" il mouse allo scatto
      const targetY = drag.draggedRowInitialRect.top + (newHoveredIndex * rowHeight);
      const currentMouseBasedY = drag.draggedRowInitialRect.top + (event.clientY - drag.draggedRowInitialClientY);
      const snapOffsetY = targetY - currentMouseBasedY;
      
      drag.setVisualSnapOffset({ x: 0, y: snapOffsetY });
    }
  };

  const handleGlobalMouseUp = () => {
    if (drag.draggedRowOriginalIndex !== null && drag.hoveredRowIndex !== null && drag.draggedRowOriginalIndex !== drag.hoveredRowIndex) {
      const updatedRows = [...nodeRows];
      const draggedRow = updatedRows[drag.draggedRowOriginalIndex];
      updatedRows.splice(drag.draggedRowOriginalIndex, 1);
      updatedRows.splice(drag.hoveredRowIndex, 0, draggedRow);
      
      setNodeRows(updatedRows);
      if (data.onUpdate) {
        data.onUpdate({ rows: updatedRows });
      }
    }

    // Reset stati
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

    document.removeEventListener('mousemove', handleGlobalMouseMove);
    document.removeEventListener('mouseup', handleGlobalMouseUp);
  };

  // Cleanup dei listener quando il componente si smonta
  useEffect(() => {
    return () => {
      document.removeEventListener('mousemove', handleGlobalMouseMove);
      document.removeEventListener('mouseup', handleGlobalMouseUp);
    };
  }, []);

  // Quando si entra in modalità editing, aggiungi una nuova row vuota se non già aggiunta
  useEffect(() => {
    if (isEditingNode && !hasAddedNewRow) {
      const newRowId = (nodeRows.length + 1).toString();
      const newRow = { id: newRowId, text: '' };
      setNodeRows([...nodeRows, newRow]);
      setEditingRowIdWithLog(newRowId);
      setHasAddedNewRow(true);
    } else if (!isEditingNode && hasAddedNewRow) {
      // Se si esce dall'editing e la nuova row è vuota, rimuovila
      const lastRow = nodeRows[nodeRows.length - 1];
      if (lastRow && lastRow.text === '') {
        setNodeRows(nodeRows.slice(0, -1));
      }
      setHasAddedNewRow(false);
      setEditingRowIdWithLog(null);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isEditingNode]);

  // Crea l'array di visualizzazione per il feedback visivo
  const displayRows = useMemo(() => {
    if (!drag.draggedRowId || drag.draggedRowOriginalIndex === null || drag.hoveredRowIndex === null) {
      return nodeRows;
    }

    const rows = [...nodeRows];
    const draggedRow = rows[drag.draggedRowOriginalIndex];
    rows.splice(drag.draggedRowOriginalIndex, 1);
    rows.splice(drag.hoveredRowIndex, 0, { id: 'placeholder', text: '', isPlaceholder: true } as NodeRowData);
    
    return rows;
  }, [nodeRows, drag.draggedRowId, drag.draggedRowOriginalIndex, drag.hoveredRowIndex]);

  // Trova la riga trascinata per il rendering separato
  const draggedItem = drag.draggedRowId ? nodeRows.find(row => row.id === drag.draggedRowId) : null;

  // Calcola lo stile per la riga trascinata
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

  // Se è un nodo temporaneo, renderizza solo gli handles
  if (data.isTemporary) {
    return (
      <div className="w-1 h-1 opacity-0">
        <NodeHandles isConnectable={isConnectable} />
      </div>
    );
  }

  // LOG SOLO PER SELECTED
  console.log('[DEBUG][CustomNode] selected:', selected);

  return (
    <>
      <div className={`bg-white border-black rounded-lg shadow-xl w-70 min-h-[40px] relative ${selected ? 'border-2' : 'border'}`}>
        <div className="relative" onMouseEnter={() => setShowActions(true)} onMouseLeave={() => setShowActions(false)}>
          {/* Toolbar overlay sopra il nodo, allineata a destra, staccata di 2px */}
          {showActions && (
            <div
              className="absolute right-2 flex gap-2 items-center z-20 bg-white border border-gray-300 rounded-lg shadow px-1.5 py-0.5"
              style={{ pointerEvents: 'auto', top: '-32px' }}
            >
              <button
                onClick={() => setIsEditingNode(true)}
                className="p-0 text-slate-500 hover:text-green-500 transition-colors bg-transparent border-none shadow-none"
                title="Modifica titolo"
                style={{ background: 'none', padding: 0, margin: 0 }}
              >
                <Edit3 className="w-3 h-3" style={{ width: 12, height: 12 }} />
              </button>
              <button
                onClick={handleDeleteNode}
                className="p-0 text-red-500 hover:text-red-700 transition-colors bg-transparent border-none shadow-none"
                title="Elimina nodo"
                style={{ background: 'none', padding: 0, margin: 0 }}
              >
                <Trash2 className="w-3 h-3" style={{ width: 12, height: 12 }} />
              </button>
              <button
                onClick={() => data.onPlayNode && data.onPlayNode(id)}
                className="p-0 text-blue-500 hover:text-blue-700 transition-colors bg-transparent border-none shadow-none"
                title="Simula nodo"
                style={{ background: 'none', fontSize: '12px', padding: 0, margin: 0 }}
              >
                ▶️
              </button>
            </div>
          )}
          {/* Buffer invisibile tra titolo e toolbar per tolleranza mouse */}
          {showActions && (
            <div
              className="absolute right-2 z-10"
              style={{ top: '-8px', height: '8px', width: '120px', pointerEvents: 'auto' }}
            />
          )}
          <NodeHeader
            title={nodeTitle}
            onDelete={handleDeleteNode}
            onToggleEdit={() => setIsEditingNode(!isEditingNode)}
            onTitleUpdate={handleTitleUpdate}
            isEditing={isEditingNode}
          />
        </div>
        
        <div className="px-1.5" style={{ paddingTop: 0, paddingBottom: 0 }}>
          <NodeRowList
            rows={displayRows}
            editingRowId={editingRowId}
            hoveredInserter={hoveredInserter}
            setHoveredInserter={setHoveredInserter}
            handleInsertRow={handleInsertRow}
            nodeTitle={nodeTitle}
            onUpdate={(row, newText) => handleUpdateRow(row.id, newText, row.categoryType)}
            onUpdateWithCategory={(row, newText, categoryType) => handleUpdateRow(row.id, newText, categoryType as EntityType)}
            onDelete={(row) => handleDeleteRow(row.id)}
            onKeyDown={(e) => {/* logica keydown se serve */}}
            onDragStart={handleRowDragStart}
            canDelete={(row) => nodeRows.length > 1}
            totalRows={nodeRows.length}
            hoveredRowIndex={drag.hoveredRowIndex}
            draggedRowId={drag.draggedRowId}
            draggedRowOriginalIndex={drag.draggedRowOriginalIndex}
            draggedItem={draggedItem ?? null}
            draggedRowStyle={draggedRowStyle}
            onEditingEnd={() => setEditingRowIdWithLog(null)}
          />
          
          {/* Renderizza la riga trascinata separatamente */}
          {draggedItem && (
            <NodeRow
              key={`dragged-${draggedItem.id}`}
              row={draggedItem}
              nodeTitle={nodeTitle}
              onUpdate={() => {}}
              onUpdateWithCategory={() => {}}
              onDelete={() => {}}
              index={drag.draggedRowOriginalIndex || 0}
              canDelete={nodeRows.length > 1}
              totalRows={nodeRows.length}
              isBeingDragged={true}
              style={draggedRowStyle}
              onEditingEnd={() => setEditingRowIdWithLog(null)}
            />
          )}

        </div>
        
        <NodeHandles isConnectable={isConnectable} />
      </div>

      {/* Mock Intellisense Menu */}
      {showIntellisense && (
        <IntellisenseMenu
          isOpen={showIntellisense}
          query={editingRowId ? nodeRows.find(row => row.id === editingRowId)?.text || '' : ''}
          position={intellisensePosition}
          referenceElement={null}
          onSelect={handleIntellisenseSelectItem}
          onClose={() => setShowIntellisense(false)}
          filterCategoryTypes={['agentActs', 'userActs', 'backendActions']}
        />
      )}
    </>
  );
};
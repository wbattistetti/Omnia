import React, { useState, useRef, useEffect, useMemo } from 'react';
import { NodeProps } from 'reactflow';
import { NodeHeader } from './NodeHeader';
import { NodeRow } from './NodeRow';
import { NodeHandles } from './NodeHandles';
import { IntellisenseMenu } from '../Intellisense/IntellisenseMenu';
import { IntellisenseItem } from '../Intellisense/IntellisenseTypes';
import { NodeRowData, EntityType } from '../../types/project';
import { PlusCircle } from 'lucide-react';
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
}

export const CustomNode: React.FC<NodeProps<CustomNodeData>> = ({ 
  id, 
  data, 
  isConnectable 
}) => {
  const [isEditingNode, setIsEditingNode] = useState(false);
  const [nodeTitle, setNodeTitle] = useState(data.title || 'New Node');
  const [nodeRows, setNodeRows] = useState<NodeRowData[]>(data.rows || [{ id: '1', text: 'Default Row' }]);
  const [showIntellisense, setShowIntellisense] = useState(false);
  const [intellisensePosition, setIntellisensePosition] = useState({ x: 0, y: 0 });
  const [editingRowId, setEditingRowId] = useState<string | null>(null);

  // Stati per il drag-and-drop
  const drag = useNodeRowDrag(nodeRows);

  // Stato per tracciare se la nuova row è stata aggiunta in questa sessione di editing
  const [hasAddedNewRow, setHasAddedNewRow] = useState(false);

  // Riferimenti DOM per le righe
  const rowRefs = useRef(new Map<string, HTMLDivElement>());

  // Stato per gestire l'inserter hover
  const [hoveredInserter, setHoveredInserter] = useState<number | null>(null);

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
    
    if (data.onUpdate) {
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
    setEditingRowId(newRow.id); // Forza subito l'editing sulla nuova row
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
      setEditingRowId(rowId);
      setShowIntellisense(true);
    }
  };

  const handleIntellisenseSelect = (selectedText: string) => {
    if (editingRowId) {
      handleUpdateRow(editingRowId, selectedText);
    }
    setShowIntellisense(false);
    setEditingRowId(null);
  };

  const handleIntellisenseSelectItem = (item: IntellisenseItem) => {
    if (editingRowId) {
      // Aggiorna la riga anche con userActs, bgColor, textColor se presenti
      setNodeRows(prevRows => prevRows.map(row =>
        row.id === editingRowId
          ? { ...row, text: item.name, categoryType: item.categoryType, userActs: item.userActs, bgColor: item.bgColor, textColor: item.textColor }
          : row
      ));
      if (data.onUpdate) {
        data.onUpdate({
          rows: nodeRows.map(row =>
            row.id === editingRowId
              ? { ...row, text: item.name, categoryType: item.categoryType, userActs: item.userActs, bgColor: item.bgColor, textColor: item.textColor }
              : row
          )
        });
      }
    }
    setShowIntellisense(false);
    setEditingRowId(null);
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
    setEditingRowId(newRow.id);
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
      setEditingRowId(newRowId);
      setHasAddedNewRow(true);
    } else if (!isEditingNode && hasAddedNewRow) {
      // Se si esce dall'editing e la nuova row è vuota, rimuovila
      const lastRow = nodeRows[nodeRows.length - 1];
      if (lastRow && lastRow.text === '') {
        setNodeRows(nodeRows.slice(0, -1));
      }
      setHasAddedNewRow(false);
      setEditingRowId(null);
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

  return (
    <>
      <div className="bg-white border border-black rounded-lg shadow-xl w-70 min-h-[40px] relative">
        <NodeHeader
          title={nodeTitle}
          onDelete={handleDeleteNode}
          onToggleEdit={() => {
            // Attiva solo l'editing del titolo
            // Non aggiunge più una row
            // Puoi anche rinominare la prop in onEditTitle se vuoi chiarezza
            // Qui lasciamo la compatibilità
            // Se vuoi, puoi anche passare direttamente handleTitleEdit
            // Ma lasciamo la logica qui per ora
            // setIsEditingNode(!isEditingNode); // RIMOSSO: non serve più
          }}
          onTitleUpdate={handleTitleUpdate}
          isEditing={isEditingNode}
        />
        
        <div className="px-1.5" style={{ paddingTop: 0, paddingBottom: 0 }}>
          <NodeRowList
            rows={displayRows}
            editingRowId={editingRowId}
            hoveredInserter={hoveredInserter}
            setHoveredInserter={setHoveredInserter}
            handleInsertRow={handleInsertRow}
            nodeTitle={nodeTitle}
            onUpdate={handleUpdateRow}
            onUpdateWithCategory={(row, newText, categoryType) => handleUpdateRow(row.id, newText, categoryType)}
            onDelete={(row) => handleDeleteRow(row.id)}
            onKeyDown={(e) => {/* logica keydown se serve */}}
            onDragStart={handleRowDragStart}
            canDelete={(row) => nodeRows.length > 1}
            totalRows={nodeRows.length}
            hoveredRowIndex={drag.hoveredRowIndex}
            draggedRowId={drag.draggedRowId}
            draggedRowOriginalIndex={drag.draggedRowOriginalIndex}
            draggedItem={draggedItem}
            draggedRowStyle={draggedRowStyle}
          />
          
          {/* Renderizza la riga trascinata separatamente */}
          {draggedItem && (
            <NodeRow
              key={`dragged-${draggedItem.id}`}
              id={draggedItem.id}
              text={draggedItem.text}
              categoryType={draggedItem.categoryType}
              onUpdate={(row, newText) => {}} // Non permettere modifiche durante il trascinamento
              onUpdateWithCategory={(row, newText, categoryType) => {}} // Non permettere modifiche durante il trascinamento
              onDelete={(row) => {}} // Non permettere cancellazione durante il trascinamento
              index={drag.draggedRowOriginalIndex || 0}
              canDelete={nodeRows.length > 1}
              totalRows={nodeRows.length}
              isBeingDragged={true}
              style={draggedRowStyle}
              userActs={draggedItem.userActs}
              bgColor={draggedItem.bgColor}
              textColor={draggedItem.textColor}
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
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
  const [draggedRowId, setDraggedRowId] = useState<string | null>(null);
  const [draggedRowOriginalIndex, setDraggedRowOriginalIndex] = useState<number | null>(null);
  const [draggedRowInitialClientX, setDraggedRowInitialClientX] = useState<number | null>(null);
  const [draggedRowInitialClientY, setDraggedRowInitialClientY] = useState<number | null>(null);
  const [draggedRowInitialRect, setDraggedRowInitialRect] = useState<DOMRect | null>(null);
  const [draggedRowCurrentClientX, setDraggedRowCurrentClientX] = useState<number | null>(null);
  const [draggedRowCurrentClientY, setDraggedRowCurrentClientY] = useState<number | null>(null);
  const [hoveredRowIndex, setHoveredRowIndex] = useState<number | null>(null);
  const [visualSnapOffset, setVisualSnapOffset] = useState({ x: 0, y: 0 });

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
    setDraggedRowId(id);
    setDraggedRowOriginalIndex(index);
    setDraggedRowInitialClientX(clientX);
    setDraggedRowInitialClientY(clientY);
    setDraggedRowInitialRect(rect);
    setDraggedRowCurrentClientX(clientX);
    setDraggedRowCurrentClientY(clientY);
    setHoveredRowIndex(index);
    setVisualSnapOffset({ x: 0, y: 0 });

    document.body.style.cursor = 'grabbing';
    document.body.style.userSelect = 'none';

    document.addEventListener('mousemove', handleGlobalMouseMove);
    document.addEventListener('mouseup', handleGlobalMouseUp);
  };

  const handleGlobalMouseMove = (event: MouseEvent) => {
    if (!draggedRowId || !draggedRowInitialRect || draggedRowInitialClientY === null) return;

    setDraggedRowCurrentClientX(event.clientX);
    setDraggedRowCurrentClientY(event.clientY);

    setDraggedRowCurrentClientX(event.clientX);
    setDraggedRowCurrentClientY(event.clientY);

    // Calcola la posizione attuale della riga trascinata (senza snap)
    const currentDraggedY = draggedRowInitialRect.top + (event.clientY - draggedRowInitialClientY);

    // Determina il nuovo indice di hover basandosi sulla posizione delle altre righe
    let newHoveredIndex = draggedRowOriginalIndex || 0;
    const rowHeight = 40; // Altezza approssimativa di una riga + margini

    for (let i = 0; i < nodeRows.length; i++) {
      if (i === draggedRowOriginalIndex) continue;
      
      const adjustedIndex = i > (draggedRowOriginalIndex || 0) ? i - 1 : i;
      const rowY = draggedRowInitialRect.top + (adjustedIndex * rowHeight);
      
      if (currentDraggedY < rowY + rowHeight / 2) {
        newHoveredIndex = i;
        break;
      }
      newHoveredIndex = i + 1;
    }

    if (newHoveredIndex !== hoveredRowIndex) {
      setHoveredRowIndex(newHoveredIndex);
      
      // Calcola lo snap offset per far "seguire" il mouse allo scatto
      const targetY = draggedRowInitialRect.top + (newHoveredIndex * rowHeight);
      const currentMouseBasedY = draggedRowInitialRect.top + (event.clientY - draggedRowInitialClientY);
      const snapOffsetY = targetY - currentMouseBasedY;
      
      setVisualSnapOffset({ x: 0, y: snapOffsetY });
    }
  };

  const handleGlobalMouseUp = () => {
    if (draggedRowOriginalIndex !== null && hoveredRowIndex !== null && draggedRowOriginalIndex !== hoveredRowIndex) {
      const updatedRows = [...nodeRows];
      const draggedRow = updatedRows[draggedRowOriginalIndex];
      updatedRows.splice(draggedRowOriginalIndex, 1);
      updatedRows.splice(hoveredRowIndex, 0, draggedRow);
      
      setNodeRows(updatedRows);
      if (data.onUpdate) {
        data.onUpdate({ rows: updatedRows });
      }
    }

    // Reset stati
    setDraggedRowId(null);
    setDraggedRowOriginalIndex(null);
    setDraggedRowInitialClientX(null);
    setDraggedRowInitialClientY(null);
    setDraggedRowInitialRect(null);
    setDraggedRowCurrentClientX(null);
    setDraggedRowCurrentClientY(null);
    setHoveredRowIndex(null);
    setVisualSnapOffset({ x: 0, y: 0 });

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
    if (!draggedRowId || draggedRowOriginalIndex === null || hoveredRowIndex === null) {
      return nodeRows;
    }

    const rows = [...nodeRows];
    const draggedRow = rows[draggedRowOriginalIndex];
    rows.splice(draggedRowOriginalIndex, 1);
    rows.splice(hoveredRowIndex, 0, { id: 'placeholder', text: '', isPlaceholder: true } as NodeRowData);
    
    return rows;
  }, [nodeRows, draggedRowId, draggedRowOriginalIndex, hoveredRowIndex]);

  // Trova la riga trascinata per il rendering separato
  const draggedItem = draggedRowId ? nodeRows.find(row => row.id === draggedRowId) : null;

  // Calcola lo stile per la riga trascinata
  const draggedRowStyle = useMemo(() => {
    if (!draggedItem || !draggedRowInitialRect || draggedRowInitialClientX === null || 
        draggedRowInitialClientY === null || draggedRowCurrentClientX === null || 
        draggedRowCurrentClientY === null) {
      return {};
    }

    return {
      top: draggedRowInitialRect.top + (draggedRowCurrentClientY - draggedRowInitialClientY) + visualSnapOffset.y,
      left: draggedRowInitialRect.left + (draggedRowCurrentClientX - draggedRowInitialClientX) + visualSnapOffset.x,
      width: draggedRowInitialRect.width
    };
  }, [draggedItem, draggedRowInitialRect, draggedRowInitialClientX, draggedRowInitialClientY, 
      draggedRowCurrentClientX, draggedRowCurrentClientY, visualSnapOffset]);

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
          {displayRows.map((row, idx) => {
            const isPlaceholder = 'isPlaceholder' in row && row.isPlaceholder;
            const isHoveredTarget = false; // Puoi aggiungere logica se serve
            return (
              <React.Fragment key={row.id}>
                {/* Inserter tra le righe: sempre presente, + solo su hover e se nessuna label è in editing */}
                <RowInserter
                  visible={hoveredInserter === idx && editingRowId === null}
                  onInsert={() => handleInsertRow(idx)}
                  onMouseEnter={() => setHoveredInserter(idx)}
                  onMouseLeave={() => setHoveredInserter(null)}
                />
              <NodeRow
                key={row.id}
                ref={(el) => {
                  if (el && !isPlaceholder) {
                    rowRefs.current.set(row.id, el);
                  }
                }}
                row={row}
                nodeTitle={nodeTitle}
                nodeCanvasPosition={undefined}
                onUpdate={(row, newText) => {
                  if (row.isNew) {
                    if (newText.trim() === '') {
                      setNodeRows(prev => prev.filter(r => r.id !== row.id));
                    } else {
                      setNodeRows(prev => prev.map(r => r.id === row.id ? { ...r, text: newText, isNew: undefined } : r));
                      handleUpdateRow(row.id, newText);
                    }
                  } else {
                    handleUpdateRow(row.id, newText);
                  }
                  setEditingRowId(null);
                  setHasAddedNewRow(false);
                }}
                onUpdateWithCategory={(row, newText, categoryType) => {
                  if (row.isNew) {
                    if (newText.trim() === '') {
                      setNodeRows(prev => prev.filter(r => r.id !== row.id));
                    } else {
                      setNodeRows(prev => prev.map(r => r.id === row.id ? { ...r, text: newText, isNew: undefined } : r));
                      handleUpdateRow(row.id, newText, categoryType as EntityType || undefined);
                    }
                  } else {
                    handleUpdateRow(row.id, newText, categoryType as EntityType || undefined);
                  }
                  setEditingRowId(null);
                  setHasAddedNewRow(false);
                }}
                onDelete={(row) => handleDeleteRow(row.id)}
                onKeyDown={(e) => {
                  if (e.key === 'Escape' && editingRowId === row.id && row.isNew) {
                    setNodeRows(prev => prev.filter(r => r.id !== row.id));
                    setEditingRowId(null);
                    setHasAddedNewRow(false);
                  } else if (e.key === 'Escape' && editingRowId === row.id) {
                    setEditingRowId(null);
                    setHasAddedNewRow(false);
                  }
                }}
                onDragStart={handleRowDragStart}
                index={idx}
                canDelete={nodeRows.length > 1}
                totalRows={nodeRows.length}
                isHoveredTarget={Boolean(isHoveredTarget)}
                isBeingDragged={false}
                isPlaceholder={Boolean(isPlaceholder)}
                forceEditing={editingRowId === row.id}
                onMouseEnter={undefined}
                onMouseLeave={undefined}
                onMouseMove={undefined}
                userActs={row.userActs}
                bgColor={row.bgColor}
                textColor={row.textColor}
              />
              </React.Fragment>
            );
          })}
          {/* Inserter dopo l'ultima riga: sempre presente, + solo su hover e se nessuna label è in editing */}
          <RowInserter
            visible={hoveredInserter === displayRows.length && editingRowId === null}
            onInsert={() => handleInsertRow(displayRows.length)}
            onMouseEnter={() => setHoveredInserter(displayRows.length)}
            onMouseLeave={() => setHoveredInserter(null)}
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
              index={draggedRowOriginalIndex || 0}
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
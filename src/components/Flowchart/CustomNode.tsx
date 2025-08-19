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
  hidden?: boolean; // render invisibile finché non riposizionato
  focusRowId?: string; // row da mettere in edit al mount
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
  const [editingBump, setEditingBump] = useState(0);
  // Wrapper per setEditingRowId con log
  const setEditingRowIdWithLog = (val: string | null) => {
    try { console.log('[Focus][CustomNode] setEditingRowId', { nodeId: id, val }); } catch {}
    setEditingRowId(val);
    // Bump per forzare un micro re-render della lista dopo focusRow
    setEditingBump(prev => (prev + 1) % 1000);
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
    // Se non rimangono righe, cancella l'intero nodo (ESC su unica textbox vuota)
    if (updatedRows.length === 0 && typeof data.onDelete === 'function') {
      data.onDelete();
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

  // Se il nodo è nuovo/creato ora, entra in editing della prima riga
  // Ritardo di 1 frame per evitare che il recenter rubi il focus
  useEffect(() => {
    const setAfterFrame = (val: string) => {
      try {
        requestAnimationFrame(() => requestAnimationFrame(() => setTimeout(() => setEditingRowIdWithLog(val), 0)));
      } catch {
        setTimeout(() => setEditingRowIdWithLog(val), 0);
      }
    };
    if (data.focusRowId) setAfterFrame(data.focusRowId);
    else if (isNewAndEmpty) setAfterFrame('1');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
    <div
      className={`bg-white border-black rounded-lg shadow-xl w-70 min-h-[40px] relative ${selected ? 'border-2' : 'border'}`}
      style={{ opacity: data.hidden ? 0 : 1 }}
      tabIndex={-1}
      onMouseDownCapture={(e) => {
        if (!editingRowId) return;
        const t = e.target as HTMLElement;
        const isAnchor = t?.classList?.contains('rigid-anchor') || !!t?.closest?.('.rigid-anchor');
        const isInput = t?.classList?.contains('node-row-input') || !!t?.closest?.('.node-row-input');
        // Blocca solo interazioni sull'input riga; consenti header e ancora (drag)
        if (isInput && !isAnchor) { try { console.log('[Drag][block] input mousedown'); } catch {} e.stopPropagation(); e.preventDefault(); }
      }}
      onMouseUpCapture={(e) => {
        if (!editingRowId) return;
        const t = e.target as HTMLElement;
        const isInput = t?.classList?.contains('node-row-input') || !!t?.closest?.('.node-row-input');
        if (isInput) { e.stopPropagation(); e.preventDefault(); }
      }}
      onFocusCapture={(e) => { /* no-op: lasciamo passare focus per drag header */ }}
    >
      <div className="relative" onMouseEnter={() => setShowActions(true)} onMouseLeave={() => setShowActions(false)}>
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
          // bump per riallineare focus dopo recenter
          key={`rows-${editingBump}`}
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
    </div>
  );
};
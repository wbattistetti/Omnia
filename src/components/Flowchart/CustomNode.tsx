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

export const CustomNode: React.FC<NodeProps<CustomNodeData>> = ({ 
  id: _ignoredId, 
  data, 
  isConnectable, selected
}) => {
  const [isEditingNode, setIsEditingNode] = useState(false);
  const [nodeTitle, setNodeTitle] = useState(data.title || 'New Node');
  // Se il nodo è nuovo e vuoto, crea subito una row vuota e metti in editing
  const isNewAndEmpty = !data.rows || data.rows.length === 0;
  // const initialRowId = isNewAndEmpty ? '1' : (data.rows && data.rows[0]?.id);
  const [nodeRows, setNodeRows] = useState<NodeRowData[]>(
    isNewAndEmpty ? [{ id: '1', text: '', included: true, mode: 'Message' as const }] : (data.rows || [])
  );
  const [showIntellisense, setShowIntellisense] = useState(false);
  const [intellisensePosition, setIntellisensePosition] = useState({ x: 0, y: 0 });
  const [editingRowId, setEditingRowId] = useState<string | null>(isNewAndEmpty ? '1' : null);
  const [editingBump, setEditingBump] = useState(0);
  // Wrapper per setEditingRowId con log
  const setEditingRowIdWithLog = (val: string | null) => {
    let changed = false;
    setEditingRowId(prev => {
      changed = prev !== val;
      return changed ? val : prev;
    });
    if (changed) {
      setEditingBump(prev => (prev + 1) % 1000);
    }
  };
  // Rimuovi tutti i console.log relativi a editingRowId, prima riga, ecc.

  // Stati per il drag-and-drop
  const drag = useNodeRowDrag(nodeRows);

  // Stato per tracciare se la nuova row è stata aggiunta in questa sessione di editing
  const [hasAddedNewRow, setHasAddedNewRow] = useState(false);

  // Riferimenti DOM per le righe
  // const rowRefs = useRef(new Map<string, HTMLDivElement>());

  // Stato per gestire l'inserter hover
  const [hoveredInserter, setHoveredInserter] = useState<number | null>(null);

  // Inizio stato per overlay azioni
  // const [showActions, setShowActions] = useState(false);

  const handleDeleteNode = () => {
    if (data.onDelete) {
      data.onDelete();
    }
  };

  // Ref al contenitore delle righe per calcoli DnD locali
  const rowsContainerRef = useRef<HTMLDivElement | null>(null);

  const handleUpdateRow = (rowId: string, newText: string, categoryType?: EntityType, meta?: Partial<NodeRowData>) => {
    const prev = nodeRows;
    const targetIndex = prev.findIndex(r => r.id === rowId);
    const wasEmpty = targetIndex >= 0 ? !(prev[targetIndex].text || '').trim() : false;
    const nowFilled = (newText || '').trim().length > 0;

    let updatedRows = prev.map(row => 
      row.id === rowId ? { ...row, ...(meta || {}), text: newText, categoryType: (meta && (meta as any).categoryType) ? (meta as any).categoryType : categoryType } : row
    );

    // If user just filled the bottom-most row, append a new empty row and focus it
    const isBottomRow = targetIndex === prev.length - 1;
    if (isBottomRow && wasEmpty && nowFilled) {
      const newRowId = (prev.length + 1).toString();
      const extraRow: NodeRowData = { id: newRowId, text: '', included: true } as any;
      updatedRows = [...updatedRows, extraRow];
      setEditingRowIdWithLog(newRowId);
    }

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
      text: text,
      included: true,
      mode: 'Message' as const
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

  // const handleIntellisenseSelect = (selectedText: string) => {
  //   if (editingRowId) {
  //     handleUpdateRow(editingRowId, selectedText);
  //   }
  //   setShowIntellisense(false);
  //   setEditingRowIdWithLog(null);
  // };

  const handleIntellisenseSelectItem = (item: IntellisenseItem) => {
    if (editingRowId) {
      // Apply selection to the current row
      const baseRows = nodeRows.map(row =>
        row.id === editingRowId ? { ...row, ...item, id: row.id, categoryType: item.categoryType as any, userActs: item.userActs, mode: item.mode || 'Message' as const, actId: item.actId, factoryId: item.factoryId } : row
      );
      
      // Solo se il nodo era inizialmente vuoto, aggiungi una nuova riga vuota
      if (isNewAndEmpty) {
        const newRowId = (baseRows.length + 1).toString();
        const nextRows = [...baseRows, { id: newRowId, text: '', included: true, mode: 'Message' as const } as any];
        setNodeRows(nextRows);
        setEditingRowIdWithLog(newRowId);
        if (data.onUpdate) data.onUpdate({ rows: nextRows });
      } else {
        // Se il nodo non era vuoto, solo aggiorna la riga corrente e chiudi editing
        setNodeRows(baseRows);
        setEditingRowIdWithLog(null);
        if (data.onUpdate) data.onUpdate({ rows: baseRows });
      }
    }
    setShowIntellisense(false);
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
      isNew: true,
      included: true,
      mode: 'Message' as const
    };
    const updatedRows = [...nodeRows];
    updatedRows.splice(index, 0, newRow);
    // If this is the very first row being added, also append a second empty row to help building
    if (nodeRows.length === 0) {
      const secondRow: NodeRowData = {
        id: (parseInt(newRow.id, 10) + 1).toString(),
        text: '',
        included: true,
        mode: 'Message' as const
      } as any;
      updatedRows.splice(index + 1, 0, secondRow);
    }
    setNodeRows(updatedRows);
    setEditingRowIdWithLog(newRow.id);
    if (data.onUpdate) {
      data.onUpdate({ rows: updatedRows });
    }
  };

  // Gestione del drag-and-drop
  // Legacy drag start (kept temporarily). Prefer onMoveRow/onDropRow below.
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

    try { console.log('[RowDnD][start]', { id, index, clientX, clientY, rect: { top: rect.top, left: rect.left, w: rect.width, h: rect.height } }); } catch {}

    window.addEventListener('pointermove', handleGlobalMouseMove as any, { capture: true });
    window.addEventListener('pointerup', handleGlobalMouseUp as any, { capture: true });
    window.addEventListener('mousemove', handleGlobalMouseMove as any, { capture: true });
    window.addEventListener('mouseup', handleGlobalMouseUp as any, { capture: true });
  };

  // React-DnD-like simple move API used by NodeRow when dragging label
  const handleMoveRow = (fromIndex: number, toIndex: number) => {
    if (fromIndex === toIndex || fromIndex < 0 || toIndex < 0 || fromIndex >= nodeRows.length || toIndex >= nodeRows.length) return;
    const updated = [...nodeRows];
    const [row] = updated.splice(fromIndex, 1);
    updated.splice(toIndex, 0, row);
    setNodeRows(updated);
  };

  const handleDropRow = () => {
    if (data.onUpdate) data.onUpdate({ rows: nodeRows });
  };

  const handleGlobalMouseMove = (event: MouseEvent | PointerEvent) => {
    if (!drag.draggedRowId || !drag.draggedRowInitialRect || drag.draggedRowInitialClientY === null) return;

    drag.setDraggedRowCurrentClientX(event.clientX);
    drag.setDraggedRowCurrentClientY(event.clientY);

    drag.setDraggedRowCurrentClientX(event.clientX);
    drag.setDraggedRowCurrentClientY(event.clientY);

    // Calcola la posizione attuale della riga trascinata (senza snap)
    const currentDraggedY = drag.draggedRowInitialRect.top + (event.clientY - drag.draggedRowInitialClientY);

    // Determina il nuovo indice di hover basandosi sulla posizione delle altre righe
    // Determine hovered index using actual DOM positions of this node only
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
      
      // Calcola lo snap offset per far "seguire" il mouse allo scatto
      const rowHeight = 40; // Altezza approssimativa di una riga
      const targetY = drag.draggedRowInitialRect.top + (newHoveredIndex * rowHeight);
      const currentMouseBasedY = drag.draggedRowInitialRect.top + (event.clientY - drag.draggedRowInitialClientY);
      const snapOffsetY = targetY - currentMouseBasedY;
      
      drag.setVisualSnapOffset({ x: 0, y: snapOffsetY });
      try { console.log('[RowDnD][hover]', { draggedId: drag.draggedRowId, from: drag.draggedRowOriginalIndex, to: newHoveredIndex }); } catch {}
    }
  };

  const handleGlobalMouseUp = () => {
    const hasOriginal = drag.draggedRowOriginalIndex !== null;
    let targetIndex = drag.hoveredRowIndex;
    // Fallback: if no hovered index, infer from total delta in pixels
    if (hasOriginal && (targetIndex === null || targetIndex === undefined)) {
      const scope = rowsContainerRef.current || document;
      const elements = Array.from(scope.querySelectorAll('.node-row-outer')) as HTMLElement[];
      const rects = elements.map((el, idx) => ({ idx: Number(el.dataset.index), top: el.getBoundingClientRect().top, height: el.getBoundingClientRect().height }));
      const centerY = (drag.draggedRowCurrentClientY ?? drag.draggedRowInitialClientY) as number;
      let inferred = drag.draggedRowOriginalIndex as number;
      for (const r of rects) { if (centerY < r.top + r.height / 2) { inferred = r.idx; break; } inferred = r.idx + 1; }
      targetIndex = Math.max(0, Math.min(nodeRows.length - 1, inferred));
    }
    if (hasOriginal && targetIndex !== null && (drag.draggedRowOriginalIndex as number) !== targetIndex) {
      const updatedRows = [...nodeRows];
      const draggedRow = updatedRows[drag.draggedRowOriginalIndex as number];
      updatedRows.splice(drag.draggedRowOriginalIndex as number, 1);
      updatedRows.splice(targetIndex as number, 0, draggedRow);
      try { console.log('[RowDnD][drop]', { id: drag.draggedRowId, from: drag.draggedRowOriginalIndex, to: targetIndex, order: updatedRows.map(r => r.id) }); } catch {}
      setNodeRows(updatedRows);
      if (data.onUpdate) data.onUpdate({ rows: updatedRows });
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

    window.removeEventListener('pointermove', handleGlobalMouseMove as any);
    window.removeEventListener('pointerup', handleGlobalMouseUp as any);
    window.removeEventListener('mousemove', handleGlobalMouseMove as any);
    window.removeEventListener('mouseup', handleGlobalMouseUp as any);
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
      const newRow = { id: newRowId, text: '', mode: 'Message' as const };
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

  // Canvas click: if there is a newly added empty row being edited, cancel and remove it
  useEffect(() => {
    const onCanvasClick = () => {
      if (!editingRowId) return;
      const row = nodeRows.find(r => r.id === editingRowId);
      if (row && String(row.text || '').trim().length === 0) {
        // remove the empty row being edited
        const updated = nodeRows.filter(r => r.id !== editingRowId);
        setNodeRows(updated);
        setEditingRowIdWithLog(null);
        if (data.onUpdate) data.onUpdate({ rows: updated });
      }
    };
    window.addEventListener('flow:canvas:click', onCanvasClick as any);
    return () => window.removeEventListener('flow:canvas:click', onCanvasClick as any);
  }, [editingRowId, nodeRows, data]);

  // Crea l'array di visualizzazione per il feedback visivo
  const displayRows = useMemo(() => nodeRows, [nodeRows]);

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

  // Do NOT auto-append an extra row at mount; start with a single textarea only.

  return (
    <div
      className={`bg-white border-black rounded-lg shadow-xl min-h-[40px] relative ${selected ? 'border-2' : 'border'}`}
      style={{ opacity: data.hidden ? 0 : 1, minWidth: 140, width: 'fit-content' }}
      tabIndex={-1}
      onMouseDownCapture={(e) => {
        if (!editingRowId) return;
        const t = e.target as HTMLElement;
        const isAnchor = t?.classList?.contains('rigid-anchor') || !!t?.closest?.('.rigid-anchor');
        const isInput = t?.classList?.contains('node-row-input') || !!t?.closest?.('.node-row-input');
        // Blocca solo interazioni sull'input riga; consenti header e ancora (drag)
        if (isInput && !isAnchor) { e.stopPropagation(); }
      }}
      onMouseUpCapture={(e) => {
        if (!editingRowId) return;
        const t = e.target as HTMLElement;
        const isInput = t?.classList?.contains('node-row-input') || !!t?.closest?.('.node-row-input');
        if (isInput) { e.stopPropagation(); }
      }}
      onFocusCapture={(e) => { /* no-op: lasciamo passare focus per drag header */ }}
    >
      <div
        className="relative"
        onClickCapture={(e) => {
          // intercetta evento custom delete dall'header
          if ((e as any).type === 'flow:node:delete') {
            e.preventDefault();
            e.stopPropagation();
            handleDeleteNode();
          }
        }}
      >
        <NodeHeader
          title={nodeTitle}
          onDelete={handleDeleteNode}
          onToggleEdit={() => setIsEditingNode(!isEditingNode)}
          onTitleUpdate={handleTitleUpdate}
          isEditing={isEditingNode}
          hasUnchecked={nodeRows.some(r => r.included === false)}
          hideUnchecked={(data as any)?.hideUncheckedRows === true}
          onToggleHideUnchecked={() => {
            if (typeof data.onUpdate === 'function') {
              data.onUpdate({ hideUncheckedRows: !(data as any)?.hideUncheckedRows });
            }
          }}
        />
      </div>
      <div className="px-1.5" style={{ paddingTop: 0, paddingBottom: 0 }} ref={rowsContainerRef}>
        <NodeRowList
          rows={((data as any)?.hideUncheckedRows === true) ? displayRows.filter(r => r.included !== false) : displayRows}
          editingRowId={editingRowId}
          // bump per riallineare focus dopo recenter
          key={`rows-${editingBump}`}
          hoveredInserter={hoveredInserter}
          setHoveredInserter={setHoveredInserter}
          handleInsertRow={handleInsertRow}
          nodeTitle={nodeTitle}
          onUpdate={(row, newText) => handleUpdateRow(row.id, newText, row.categoryType, { included: (row as any).included })}
          onUpdateWithCategory={(row, newText, categoryType) => handleUpdateRow(row.id, newText, categoryType as EntityType, { included: (row as any).included })}
          onDelete={(row) => handleDeleteRow(row.id)}
          onKeyDown={(e) => {/* logica keydown se serve */}}
          onDragStart={handleRowDragStart}
          canDelete={(row) => nodeRows.length > 1}
          totalRows={nodeRows.length}
          onCreateAgentAct={data.onCreateAgentAct}
          onCreateBackendCall={data.onCreateBackendCall}
          onCreateTask={data.onCreateTask}
          hoveredRowIndex={drag.hoveredRowIndex}
          draggedRowId={drag.draggedRowId}
          draggedRowOriginalIndex={drag.draggedRowOriginalIndex}
          draggedItem={draggedItem ?? null}
          draggedRowStyle={draggedRowStyle}
          onEditingEnd={() => setEditingRowIdWithLog(null)}
        />
        {/* Renderizza la riga trascinata separatamente */}
        {/* Do not render an extra floating NodeRow; use ghost element only to avoid layout shift */}
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
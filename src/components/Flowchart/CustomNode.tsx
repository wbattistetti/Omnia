import React, { useState, useRef, useEffect, useMemo } from 'react';
import { NodeProps } from 'reactflow';
import { NodeHeader } from './NodeHeader';
import { NodeHandles } from './NodeHandles';
import { IntellisenseMenu } from '../Intellisense/IntellisenseMenu';
import { IntellisenseItem } from '../Intellisense/IntellisenseTypes';
import { NodeRowData, EntityType } from '../../types/project';
import { useNodeRowDrag } from '../../hooks/useNodeRowDrag';
import { NodeRowList } from './NodeRowList';

// Helper per ID robusti
function newUid() {
  // fallback se crypto.randomUUID non esiste
  return (typeof crypto !== 'undefined' && 'randomUUID' in crypto)
    ? (crypto as any).randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

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
  id,
  data, 
  isConnectable, selected
}) => {
  const [isEditingNode, setIsEditingNode] = useState(false);
  const [nodeTitle, setNodeTitle] = useState(data.title || 'New Node');

  const isNewNode = !Array.isArray(data.rows) || data.rows.length === 0;

  const makeRowId = React.useCallback(() => `${id}-${newUid()}`, [id]);

  const initialRows = useMemo<NodeRowData[]>(() => {
    if (isNewNode) {
      return [{ id: makeRowId(), text: '', included: true, mode: 'Message' as const }];
    }
    return (data.rows || []).map(r =>
      r.id?.startsWith(`${id}-`) ? r : { ...r, id: `${id}-${r.id || newUid()}` }
    );
  }, [isNewNode, data.rows, id, makeRowId]);

  const [nodeRows, setNodeRows] = useState<NodeRowData[]>(initialRows);
  const [showIntellisense, setShowIntellisense] = useState(false);
  const [intellisensePosition, setIntellisensePosition] = useState({ x: 0, y: 0 });
  // Focus locale, scoped per nodo (rowId prefissato da `${id}-`)
  const [editingRowId, setEditingRowId] = useState<string | null>(() => {
    if (data.focusRowId) {
      return data.focusRowId.startsWith(`${id}-`) ? data.focusRowId : `${id}-${data.focusRowId}`;
    }
    return isNewNode ? initialRows[0].id : null;
  });

  // Debug log per diagnosticare il problema
  console.log('🎯 [CustomNode] Debug:', {
    id,
    isNewNode,
    initialRows: initialRows.map(r => ({ id: r.id, text: r.text })),
    editingRowId,
    focusRowId: data.focusRowId
  });

  // Forza il focus per i nodi nuovi se non è già impostato
  useEffect(() => {
    if (isNewNode && initialRows.length > 0 && !editingRowId) {
      console.log('🎯 [CustomNode] Forcing focus for new node:', initialRows[0].id);
      setEditingRowId(initialRows[0].id);
    }
  }, [isNewNode, initialRows, editingRowId]);

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
      prev.length > 0 && !(prev[prev.length - 1].text || '').trim();

    if (isLast && wasEmpty && nowFilled && !hasTrailingEmpty) {
      const newRowId = makeRowId();
      updatedRows.push({
        id: newRowId,
        text: '',
        included: true,
        mode: 'Message' as const
      } as any);
      setEditingRowId(newRowId);
    }

    setNodeRows(updatedRows);
    data.onUpdate?.({ rows: updatedRows });
  };

  const handleDeleteRow = (rowId: string) => {
    const updatedRows = nodeRows.filter(row => row.id !== rowId);
    setNodeRows(updatedRows);
    data.onUpdate?.({ rows: updatedRows });

    if (updatedRows.length === 0 && data.isTemporary) {
      data.onDelete?.();
    }
  };

  const handleAddRow = (text: string) => {
    const newRow: NodeRowData = {
      id: makeRowId(),
      text,
      included: true,
      mode: 'Message' as const
    };
    const updatedRows = [...nodeRows, newRow];
    setNodeRows(updatedRows);
    setEditingRowId(newRow.id);
    data.onUpdate?.({ rows: updatedRows });
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
      if (isNewNode) {
        const newRowId = (baseRows.length + 1).toString();
        const nextRows = [...baseRows, { id: newRowId, text: '', included: true, mode: 'Message' as const } as any];
        setNodeRows(nextRows);
        setEditingRowId(newRowId);
        if (data.onUpdate) data.onUpdate({ rows: nextRows });
      } else {
        // Se il nodo non era vuoto, solo aggiorna la riga corrente e chiudi editing
        setNodeRows(baseRows);
        setEditingRowId(null);
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
      id: makeRowId(),
      text: '',
      isNew: true,
      included: true,
      mode: 'Message' as const
    };
    const updatedRows = [...nodeRows];
    updatedRows.splice(index, 0, newRow);
    setNodeRows(updatedRows);
    setEditingRowId(newRow.id);
    data.onUpdate?.({ rows: updatedRows });
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

    // Log rimosso

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
      // Log rimosso
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
      // Log rimosso
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

  useEffect(() => {
    if (isEditingNode && !hasAddedNewRow) {
      const newRowId = makeRowId();
      const newRow = { id: newRowId, text: '', mode: 'Message' as const } as any;
      setNodeRows(prev => [...prev, newRow]);
      setEditingRowId(newRowId);
      setHasAddedNewRow(true);
    } else if (!isEditingNode && hasAddedNewRow) {
      setNodeRows(prev => {
        const last = prev[prev.length - 1];
        return last && last.text === '' ? prev.slice(0, -1) : prev;
      });
      setHasAddedNewRow(false);
      setEditingRowId(null);
    }
  }, [isEditingNode, hasAddedNewRow, makeRowId]);


  // Click sul canvas: agisci solo se il focus è di questo nodo
  useEffect(() => {
    const onCanvasClick = () => {
      if (!editingRowId) return;
      // Garantisce che il focus appartenga a QUESTO nodo
      if (!editingRowId.startsWith(`${id}-`)) return;

      const row = nodeRows.find(r => r.id === editingRowId);
      if (row && String(row.text || '').trim().length === 0) {
        const updated = nodeRows.filter(r => r.id !== editingRowId);
        setNodeRows(updated);
        setEditingRowId(null);
        data.onUpdate?.({ rows: updated });
      }
    };

    window.addEventListener('flow:canvas:click', onCanvasClick as any);
    return () => window.removeEventListener('flow:canvas:click', onCanvasClick as any);
  }, [editingRowId, nodeRows, id, data]);

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
          hoveredInserter={hoveredInserter}
          setHoveredInserter={setHoveredInserter}
          handleInsertRow={handleInsertRow}
          nodeTitle={nodeTitle}
          onUpdate={(row, newText) => handleUpdateRow(row.id, newText, row.categoryType, { included: (row as any).included })}
          onUpdateWithCategory={(row, newText, categoryType) => handleUpdateRow(row.id, newText, categoryType as EntityType, { included: (row as any).included })}
          onDelete={(row) => handleDeleteRow(row.id)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              const newRowId = makeRowId();
              const newRow: NodeRowData = { id: newRowId, text: '', included: true, mode: 'Message' as const } as any;
              const updatedRows = [...nodeRows, newRow];
              setNodeRows(updatedRows);
              setEditingRowId(newRowId);
              data.onUpdate?.({ rows: updatedRows });
            }
            if (e.key === 'Escape') {
              setEditingRowId(null);
            }
          }}
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
          onEditingEnd={() => setEditingRowId(null)}
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
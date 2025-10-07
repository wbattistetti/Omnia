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

// Helper per inizializzazione lazy delle righe
function initRows(nodeId: string, rows?: NodeRowData[]): NodeRowData[] {
  if (!Array.isArray(rows) || rows.length === 0) {
    return [{ id: `${nodeId}-${newUid()}`, text: '', included: true, mode: 'Message' as const }];
  }
  return rows.map(r =>
    r.id?.startsWith(`${nodeId}-`) ? r : { ...r, id: `${nodeId}-${r.id || newUid()}` }
  );
}

// Helper per inizializzazione lazy del focus
function initFocus(nodeId: string, rows: NodeRowData[], focusRowId?: string | null) {
  // Se c'è un focusRowId specifico, cerca la riga corrispondente
  if (focusRowId) {
    const target = focusRowId.startsWith(`${nodeId}-`) ? focusRowId : `${nodeId}-${focusRowId}`;
    const found = rows.find(r => r.id === target);
    if (found) return found.id;
  }
  
  // Se non trova la riga specifica ma c'è un focusRowId, usa la prima riga disponibile
  if (focusRowId && rows.length > 0) {
    return rows[0].id;
  }
  
  // Se nodo nuovo (una sola riga vuota) → prima riga
  if (rows.length === 1 && rows[0].text.trim() === '') {
    return rows[0].id;
  }
  
  return null;
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
  isConnectable, 
  selected
}) => {
  const [isEditingNode, setIsEditingNode] = useState(false);
  const [nodeTitle, setNodeTitle] = useState(data.title || 'New Node');
  const [showIntellisense, setShowIntellisense] = useState(false);
  const [intellisensePosition] = useState({ x: 0, y: 0 });

  const makeRowId = React.useCallback(() => `${id}-${newUid()}`, [id]);

  // ✅ NUOVO: helper puro che NON fa setState né onUpdate
  const appendEmptyRow = React.useCallback(
    (current: NodeRowData[]) => {
      const newRowId = makeRowId();
      const next = [
        ...current,
        { id: newRowId, text: '', included: true, mode: 'Message' as const } as NodeRowData,
      ];
      return { nextRows: next, newRowId };
    },
    [makeRowId]
  );

  // ✅ CORREZIONE 1: Lazy state initialization con ID stabili
  const [nodeRows, setNodeRows] = useState<NodeRowData[]>(() => {
    return initRows(id, data.rows);
  });
  const [editingRowId, setEditingRowId] = useState<string | null>(null);

  // ✅ CORREZIONE 2: Evita isNewNode stale - usa stato corrente invece di flag globale

  // Funzione semplice per uscire dall'editing
  const exitEditing = () => {
    setEditingRowId(null);
    // ✅ RIMOSSO: Non stabilizzare automaticamente il nodo qui
    // La stabilizzazione avverrà solo quando si esce completamente dal nodo
  };


  // ✅ PATCH 1: Focus per nodi nuovi (semplificato)
  useEffect(() => {
    // Se abbiamo focusRowId (nodo nuovo) e non c'è editingRowId, impostalo
    if (data.focusRowId && !editingRowId && nodeRows.length > 0) {
      const firstRow = nodeRows[0];
      if (firstRow && firstRow.text.trim() === '') {
        console.log('🎯 [PATCH1] Impostando focus per nodo nuovo:', firstRow.id);
        setEditingRowId(firstRow.id);
      }
    }
  }, [data.focusRowId, editingRowId, nodeRows.length]);

  // Stati per il drag-and-drop
  const drag = useNodeRowDrag(nodeRows);

  // ✅ PATCH 2: Rimossa variabile hasAddedNewRow non più necessaria

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
  // ✅ CORREZIONE 4: Ref per il container root del nodo
  const rootRef = useRef<HTMLDivElement>(null);

  const handleUpdateRow = (
    rowId: string,
    newText: string,
    categoryType?: EntityType,
    meta?: Partial<NodeRowData>
  ) => {
    console.log('🔍 [AutoAppend] handleUpdateRow called with:', { 
      rowId, 
      newText: newText.substring(0, 20) + '...', 
      isTemporary: data.isTemporary 
    });
    
    const prev = nodeRows;
    const idx = prev.findIndex(r => r.id === rowId);
    if (idx === -1) return;

    const wasEmpty = !(prev[idx].text || '').trim();
    const nowFilled = (newText || '').trim().length > 0;

    let updatedRows = prev.map(row =>
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
// ✅ MODIFICA: Auto-append SOLO per nodi temporanei (fino a quando non esci dal nodo)
    // ✅ 

    const shouldAutoAppend = data.isTemporary && isLast && wasEmpty && nowFilled;
    
    console.log('🔍 [AutoAppend] Debug:', {
      isTemporary: data.isTemporary,
      isLast,
      wasEmpty,
      nowFilled,
      shouldAppend: shouldAutoAppend
    });
    
    if (shouldAutoAppend) {
      console.log('✅ [AutoAppend] Appending new row!');
      const { nextRows, newRowId } = appendEmptyRow(updatedRows);
      updatedRows = nextRows;
      setEditingRowId(newRowId);
    }

    setNodeRows(updatedRows);

    console.log('🔍 [AutoAppend] handleUpdateRow calling onUpdate with:', { 
      rows: updatedRows.length, 
      isTemporary: data.isTemporary 
    });
    data.onUpdate?.({ rows: updatedRows, isTemporary: data.isTemporary });
  };

  const handleDeleteRow = (rowId: string) => {
    const updatedRows = nodeRows.filter(row => row.id !== rowId);
    setNodeRows(updatedRows);
    data.onUpdate?.({ rows: updatedRows });

    if (updatedRows.length === 0 && data.isTemporary) {
      data.onDelete?.();
    }
  };

  // Funzioni rimosse - non più utilizzate

  // const handleIntellisenseSelect = (selectedText: string) => {
  //   if (editingRowId) {
  //     handleUpdateRow(editingRowId, selectedText);
  //   }
  //   setShowIntellisense(false);
  //   setEditingRowIdWithLog(null);
  // };

  const handleIntellisenseSelectItem = (item: IntellisenseItem) => {
    if (editingRowId) {
      // ✅ CORREZIONE 6: Mappa esplicitamente i campi ammessi invece di ...item
      const baseRows = nodeRows.map(row =>
        row.id === editingRowId 
          ? { 
              ...row, 
              text: item.name,
              categoryType: item.categoryType as any, 
              userActs: item.userActs, 
              mode: item.mode || 'Message' as const, 
              actId: item.actId, 
              factoryId: item.factoryId 
            } 
          : row
      );
      
      // ✅ CORREZIONE: Dopo aver aggiunto un atto, esci sempre dall'editing
      setNodeRows(baseRows);
      // Rimuovi focusRowId per evitare che il focus si riattivi
      console.log('🔍 [Intellisense] Before onUpdate:', { isTemporary: data.isTemporary });
      data.onUpdate?.({ rows: baseRows, focusRowId: undefined, isTemporary: data.isTemporary });
      console.log('🔍 [Intellisense] After onUpdate');
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
  // Funzioni drag-and-drop rimosse - gestite dal hook useNodeRowDrag

  const handleGlobalMouseMove = (event: MouseEvent | PointerEvent) => {
    if (!drag.draggedRowId || !drag.draggedRowInitialRect || drag.draggedRowInitialClientY === null) return;

    drag.setDraggedRowCurrentClientX(event.clientX);
    drag.setDraggedRowCurrentClientY(event.clientY);

    drag.setDraggedRowCurrentClientX(event.clientX);
    drag.setDraggedRowCurrentClientY(event.clientY);

    // Calcola la posizione attuale della riga trascinata (senza snap)
    // const currentDraggedY = drag.draggedRowInitialRect.top + (event.clientY - drag.draggedRowInitialClientY);

    // Determina il nuovo indice di hover basandosi sulla posizione delle altre righe
    // Determine hovered index using actual DOM positions of this node only
    let newHoveredIndex = drag.draggedRowOriginalIndex || 0;
    const scope = rowsContainerRef.current || document;
    const elements = Array.from(scope.querySelectorAll('.node-row-outer')) as HTMLElement[];
    const rects = elements.map((el) => ({ idx: Number(el.dataset.index), top: el.getBoundingClientRect().top, height: el.getBoundingClientRect().height }));
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
      const rects = elements.map((el) => ({ idx: Number(el.dataset.index), top: el.getBoundingClientRect().top, height: el.getBoundingClientRect().height }));
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

  // ✅ PATCH 2: Rimosso useEffect problematico che generava loop di instabilità
  // La gestione delle righe vuote è ora gestita direttamente in handleUpdateRow


  // ✅ PATCH 3: Canvas click semplificato - solo exit editing, niente cancellazione automatica
  useEffect(() => {
    const onCanvasClick = (ev: any) => {
      console.log('🖱️ [CanvasClick] Evento ricevuto:', { 
        editingRowId, 
        nodeId: id, 
        isTemporary: data.isTemporary,
        hasEditingRow: editingRowId?.startsWith(`${id}-`)
      });
      
      // Se il nodo è temporaneo, fai sempre la pulizia (anche senza riga in editing)
      if (!data.isTemporary) {
        console.log('🖱️ [CanvasClick] Nodo non temporaneo, esco');
        return;
      }

      // Ignora click dentro al nodo (solo se c'è una riga in editing)
      if (editingRowId?.startsWith(`${id}-`) && ev?.target && rootRef.current && rootRef.current.contains(ev.target as Node)) {
        console.log('🖱️ [CanvasClick] Click dentro al nodo con riga in editing, ignoro');
        return;
      }

      console.log('🖱️ [CanvasClick] Click fuori dal nodo, procedo con cleanup');
      
      // Esci dall'editing e stabilizza il nodo se è temporaneo
      exitEditing();
      if (data.isTemporary) {
        console.log('🧹 [Cleanup] Rimuovendo righe non stabilizzate...');
        console.log('🧹 [Cleanup] Righe attuali:', nodeRows.map(r => ({ id: r.id, text: r.text, isEmpty: !r.text || r.text.trim().length === 0 })));
        
        // Filtra via tutte le righe vuote/non stabilizzate
        const stabilizedRows = nodeRows.filter(row => 
          row.text && row.text.trim().length > 0
        );
        
        console.log('🧹 [Cleanup] Righe prima:', nodeRows.length, 'dopo:', stabilizedRows.length);
        console.log('🧹 [Cleanup] Righe stabilizzate:', stabilizedRows.map(r => ({ id: r.id, text: r.text })));
        
        // Se ci sono righe stabilizzate, aggiorna il nodo
        if (stabilizedRows.length > 0) {
          setNodeRows(stabilizedRows);
          data.onUpdate?.({ rows: stabilizedRows, isTemporary: false, hidden: false });
        } else {
          // Se non ci sono righe stabilizzate, cancella tutto il nodo
          console.log('🧹 [Cleanup] Nessuna riga stabilizzata, cancellando nodo');
          data.onDelete?.();
        }
      }
    };

    window.addEventListener('flow:canvas:click', onCanvasClick as any);
    return () => window.removeEventListener('flow:canvas:click', onCanvasClick as any);
  }, [editingRowId, id]);

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

  // ✅ RIMOSSO: I nodi temporanei ora sono visibili e funzionanti

  // Do NOT auto-append an extra row at mount; start with a single textarea only.

  return (
    <div
      ref={rootRef}
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
      onFocusCapture={() => { /* no-op: lasciamo passare focus per drag header */ }}
    >
      <div
        className="relative"
        onClickCapture={() => {
          // intercetta evento custom delete dall'header
          // if ((e as any).type === 'flow:node:delete') {
          //   e.preventDefault();
          //   e.stopPropagation();
          //   handleDeleteNode();
          // }
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
            // ✅ CORREZIONE 3: Enter con guard per trailing empty
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              const trailingEmpty = nodeRows.length > 0 && nodeRows[nodeRows.length - 1].text.trim() === '';
              if (trailingEmpty) return; // già pronta
              const newRowId = makeRowId();
              const newRow: NodeRowData = { id: newRowId, text: '', included: true, mode: 'Message' as const };
              const updatedRows = [...nodeRows, newRow];
              setNodeRows(updatedRows);
              setEditingRowId(newRowId);
              data.onUpdate?.({ rows: updatedRows });
            } else if (e.key === 'Escape') {
              const singleEmpty = nodeRows.length === 1 && nodeRows[0].text.trim() === '';
              singleEmpty ? data.onDelete?.() : exitEditing();
            }
          }}
          onDragStart={handleRowDragStart}
          canDelete={() => nodeRows.length > 1}
          totalRows={nodeRows.length}
          onCreateAgentAct={data.onCreateAgentAct}
          onCreateBackendCall={data.onCreateBackendCall}
          onCreateTask={data.onCreateTask}
          hoveredRowIndex={drag.hoveredRowIndex}
          draggedRowId={drag.draggedRowId}
          draggedRowOriginalIndex={drag.draggedRowOriginalIndex}
          draggedItem={draggedItem ?? null}
          draggedRowStyle={draggedRowStyle}
          onEditingEnd={exitEditing}
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
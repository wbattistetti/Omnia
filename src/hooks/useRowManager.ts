import { useState, useCallback } from 'react';
import { NodeRowData, EntityType } from '../types/project';

export interface RowState {
  rows: NodeRowData[];
  editingRowId: string | null;
}

export interface RowActions {
  createRow: (text?: string, atIndex?: number) => string;
  updateRow: (rowId: string, newText: string, categoryType?: EntityType, meta?: Partial<NodeRowData>) => void;
  deleteRow: (rowId: string) => void;
  moveRow: (fromIndex: number, toIndex: number) => void;
  setEditingRow: (rowId: string | null) => void;
  addRowAfterFill: (rowId: string, newText: string) => string | null;
}

export interface RowEvents {
  onRowUpdate: (rowId: string, newText: string, categoryType?: EntityType, meta?: Partial<NodeRowData>) => void;
  onRowDelete: (rowId: string) => void;
  onRowMove: (fromIndex: number, toIndex: number) => void;
}

export interface UseRowManagerReturn {
  rowState: RowState;
  rowActions: RowActions;
  rowEvents: RowEvents;
}

/**
 * Hook specializzato per la gestione delle righe nei nodi
 * Gestisce: creazione, aggiornamento, eliminazione, spostamento righe
 */
export const useRowManager = (
  initialRows: NodeRowData[] = [],
  initialEditingRowId: string | null = null
): UseRowManagerReturn => {
  const [rows, setRows] = useState<NodeRowData[]>(initialRows);
  const [editingRowId, setEditingRowId] = useState<string | null>(initialEditingRowId);

  const generateRowId = useCallback(() => {
    return (rows.length + 1).toString();
  }, [rows.length]);

  // Definiamo le funzioni individuali prima di creare l'oggetto rowActions
  const createRow = useCallback((text: string = '', atIndex?: number) => {
    const newRowId = generateRowId();
    const newRow: NodeRowData = {
      id: newRowId,
      text,
      included: true,
      mode: 'Message' as const
    };

    setRows(prevRows => {
      if (atIndex !== undefined) {
        const updated = [...prevRows];
        updated.splice(atIndex, 0, newRow);
        return updated;
      }
      return [...prevRows, newRow];
    });

    console.log('📝 [RowManager] Created row:', newRowId, { text, atIndex });
    return newRowId;
  }, [generateRowId]);

  const updateRow = useCallback((rowId: string, newText: string, categoryType?: EntityType, meta?: Partial<NodeRowData>) => {
    setRows(prevRows => 
      prevRows.map(row => 
        row.id === rowId 
          ? { 
              ...row, 
              ...(meta || {}), 
              text: newText, 
              categoryType: (meta && (meta as any).categoryType) ? (meta as any).categoryType : categoryType 
            } 
          : row
      )
    );
    console.log('📝 [RowManager] Updated row:', rowId, { newText, categoryType });
  }, []);

  const deleteRow = useCallback((rowId: string) => {
    setRows(prevRows => prevRows.filter(row => row.id !== rowId));
    console.log('📝 [RowManager] Deleted row:', rowId);
  }, []);

  const moveRow = useCallback((fromIndex: number, toIndex: number) => {
    if (fromIndex === toIndex || fromIndex < 0 || toIndex < 0 || fromIndex >= rows.length || toIndex >= rows.length) {
      return;
    }
    
    setRows(prevRows => {
      const updated = [...prevRows];
      const [row] = updated.splice(fromIndex, 1);
      updated.splice(toIndex, 0, row);
      return updated;
    });
    console.log('📝 [RowManager] Moved row:', { fromIndex, toIndex });
  }, [rows.length]);

  const setEditingRow = useCallback((rowId: string | null) => {
    setEditingRowId(rowId);
    console.log('📝 [RowManager] Set editing row:', rowId);
  }, []);

  const addRowAfterFill = useCallback((rowId: string, newText: string) => {
    const targetIndex = rows.findIndex(r => r.id === rowId);
    const wasEmpty = targetIndex >= 0 ? !(rows[targetIndex].text || '').trim() : false;
    const nowFilled = (newText || '').trim().length > 0;
    const isBottomRow = targetIndex === rows.length - 1;

    if (isBottomRow && wasEmpty && nowFilled) {
      const newRowId = createRow('', rows.length);
      console.log('📝 [RowManager] Added new row after fill:', newRowId);
      return newRowId;
    }
    return null;
  }, [rows, createRow]);

  // Ora creiamo l'oggetto rowActions con le funzioni già definite
  const rowActions: RowActions = {
    createRow,
    updateRow,
    deleteRow,
    moveRow,
    setEditingRow,
    addRowAfterFill
  };

  const rowEvents: RowEvents = {
    onRowUpdate: useCallback((rowId: string, newText: string, categoryType?: EntityType, meta?: Partial<NodeRowData>) => {
      updateRow(rowId, newText, categoryType, meta);
    }, [updateRow]),

    onRowDelete: useCallback((rowId: string) => {
      deleteRow(rowId);
    }, [deleteRow]),

    onRowMove: useCallback((fromIndex: number, toIndex: number) => {
      moveRow(fromIndex, toIndex);
    }, [moveRow])
  };

  const rowState: RowState = {
    rows,
    editingRowId
  };

  return {
    rowState,
    rowActions,
    rowEvents
  };
};

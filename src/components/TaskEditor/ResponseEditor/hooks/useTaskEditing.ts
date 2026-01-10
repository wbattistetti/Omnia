import { useState, useCallback } from 'react';

/**
 * Hook per gestire lo stato di editing delle task
 */
export function useTaskEditing() {
  const [editingRows, setEditingRows] = useState<Set<number>>(new Set());

  const handleEditingChange = useCallback((taskIdx: number) => (isEditing: boolean) => {
    setEditingRows(prev => {
      const next = new Set(prev);
      if (isEditing) {
        next.add(taskIdx);
      } else {
        next.delete(taskIdx);
      }
      return next;
    });
  }, []);

  const isEditing = useCallback((taskIdx: number) => {
    return editingRows.has(taskIdx);
  }, [editingRows]);

  return { handleEditingChange, isEditing };
}

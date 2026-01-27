import React, { useState, useCallback } from 'react';

/**
 * Hook for managing cell notes
 * Notes are stored with key format: "rowIndex-columnType"
 *
 * ✅ ENTERPRISE-READY: All functions are memoized with useCallback
 * to ensure stable references and prevent unnecessary re-renders
 */
export function useNotes() {
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [editingNote, setEditingNote] = useState<string | null>(null);
  const [hoveredCell, setHoveredCell] = useState<string | null>(null);

  const getCellKey = useCallback((rowIndex: number, column: string): string => {
    return `${rowIndex}-${column}`;
  }, []);

  const getNote = useCallback((rowIndex: number, column: string): string => {
    const key = getCellKey(rowIndex, column);
    return notes[key] || '';
  }, [notes, getCellKey]);

  const hasNote = useCallback((rowIndex: number, column: string): boolean => {
    const key = getCellKey(rowIndex, column);
    return !!notes[key];
  }, [notes, getCellKey]);

  const addNote = useCallback((rowIndex: number, column: string, text: string) => {
    const key = getCellKey(rowIndex, column);
    setNotes(prev => ({ ...prev, [key]: text }));
  }, [getCellKey]);

  const deleteNote = useCallback((rowIndex: number, column: string) => {
    const key = getCellKey(rowIndex, column);
    setNotes(prev => {
      const newNotes = { ...prev };
      delete newNotes[key];
      return newNotes;
    });
  }, [getCellKey]);

  const startEditing = useCallback((rowIndex: number, column: string) => {
    const key = getCellKey(rowIndex, column);
    setEditingNote(key);
  }, [getCellKey]);

  const stopEditing = useCallback(() => {
    setEditingNote(null);
  }, []);

  const isEditing = useCallback((rowIndex: number, column: string): boolean => {
    const key = getCellKey(rowIndex, column);
    return editingNote === key;
  }, [editingNote, getCellKey]);

  const setHovered = useCallback((rowIndex: number | null, column: string | null) => {
    if (rowIndex === null || column === null) {
      setHoveredCell(null);
    } else {
      setHoveredCell(getCellKey(rowIndex, column));
    }
  }, [getCellKey]);

  const isHovered = useCallback((rowIndex: number, column: string): boolean => {
    const key = getCellKey(rowIndex, column);
    return hoveredCell === key;
  }, [hoveredCell, getCellKey]);

  // ✅ DEBUG: Log when editingNote changes (only when it actually changes, not on every render)
  React.useEffect(() => {
    console.log('[NOTE] useNotes - editingNote STATE CHANGED:', editingNote);
  }, [editingNote]);

  return {
    notes,
    editingNote, // ✅ NEW: Expose editingNote directly for prop passing
    getNote,
    hasNote,
    addNote,
    deleteNote,
    startEditing,
    stopEditing,
    isEditing,
    setHovered,
    isHovered,
  };
}


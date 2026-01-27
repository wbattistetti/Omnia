import React, { useState } from 'react';

/**
 * Hook for managing cell notes
 * Notes are stored with key format: "rowIndex-columnType"
 */
export function useNotes() {
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [editingNote, setEditingNote] = useState<string | null>(null);
  const [hoveredCell, setHoveredCell] = useState<string | null>(null);

  const getCellKey = (rowIndex: number, column: string): string => {
    return `${rowIndex}-${column}`;
  };

  const getNote = (rowIndex: number, column: string): string => {
    const key = getCellKey(rowIndex, column);
    return notes[key] || '';
  };

  const hasNote = (rowIndex: number, column: string): boolean => {
    const key = getCellKey(rowIndex, column);
    return !!notes[key];
  };

  const addNote = (rowIndex: number, column: string, text: string) => {
    const key = getCellKey(rowIndex, column);
    setNotes(prev => ({ ...prev, [key]: text }));
  };

  const deleteNote = (rowIndex: number, column: string) => {
    const key = getCellKey(rowIndex, column);
    setNotes(prev => {
      const newNotes = { ...prev };
      delete newNotes[key];
      return newNotes;
    });
  };

  const startEditing = (rowIndex: number, column: string) => {
    const key = getCellKey(rowIndex, column);
    setEditingNote(key);
  };

  const stopEditing = () => {
    setEditingNote(null);
  };

  const isEditing = (rowIndex: number, column: string): boolean => {
    const key = getCellKey(rowIndex, column);
    return editingNote === key;
  };

  const setHovered = (rowIndex: number | null, column: string | null) => {
    if (rowIndex === null || column === null) {
      setHoveredCell(null);
    } else {
      setHoveredCell(getCellKey(rowIndex, column));
    }
  };

  const isHovered = (rowIndex: number, column: string): boolean => {
    const key = getCellKey(rowIndex, column);
    return hoveredCell === key;
  };

  return {
    notes,
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


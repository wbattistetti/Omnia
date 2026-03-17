// Please write clean, production-grade TypeScript code.
// Avoid non-ASCII characters, Chinese symbols, or multilingual output.

import { useState, useCallback } from 'react';

/**
 * Hook for managing inline editing state for tree nodes.
 * Reduces duplication across slot, semantic set, semantic value, and linguistic value editing.
 */
export function useInlineEditing<T extends { id: string }>(
  items: T[],
  getValue: (item: T) => string
) {
  const [editingNodeId, setEditingNodeId] = useState<string | null>(null);
  const [editingValue, setEditingValue] = useState<string>('');

  const handleEdit = useCallback((itemId: string) => {
    const item = items.find(i => i.id === itemId);
    if (item) {
      setEditingNodeId(itemId);
      setEditingValue(getValue(item));
    }
  }, [items, getValue]);

  const handleSave = useCallback((itemId: string, newValue: string, onUpdate: (id: string, value: string) => void) => {
    onUpdate(itemId, newValue);
    setEditingNodeId(null);
    setEditingValue('');
  }, []);

  const handleCancel = useCallback(() => {
    setEditingNodeId(null);
    setEditingValue('');
  }, []);

  const handleDelete = useCallback((itemId: string, currentValue: string, onDelete: (id: string) => void) => {
    if (window.confirm(`Delete "${currentValue}"?`)) {
      onDelete(itemId);
    }
  }, []);

  const isEditing = useCallback((itemId: string) => {
    return editingNodeId === itemId;
  }, [editingNodeId]);

  return {
    editingNodeId,
    editingValue,
    handleEdit,
    handleSave,
    handleCancel,
    handleDelete,
    isEditing,
  };
}

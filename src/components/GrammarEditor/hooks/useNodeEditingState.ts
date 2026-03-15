// Please write clean, production-grade TypeScript code.
// Avoid non-ASCII characters, Chinese symbols, or multilingual output.

import { useState, useRef, useLayoutEffect } from 'react';

/**
 * Hook for managing node editing state.
 * Single Responsibility: Editing state management only.
 *
 * A node starts in editing mode automatically if its label is empty (newly created).
 * Subsequent label changes from outside do NOT re-trigger editing to avoid flickering.
 */
export function useNodeEditingState(nodeLabel: string) {
  // Determine initial editing state once: edit if empty on first mount.
  const [isEditing, setIsEditing] = useState(() => nodeLabel === '');
  const [editValue, setEditValue] = useState(nodeLabel);
  const inputRef = useRef<HTMLInputElement>(null);

  // Focus input when entering editing mode.
  useLayoutEffect(() => {
    if (isEditing && inputRef.current) {
      const t = setTimeout(() => {
        inputRef.current?.focus();
        inputRef.current?.select();
      }, 30);
      return () => clearTimeout(t);
    }
  }, [isEditing]);

  const startEditing = () => {
    setEditValue(nodeLabel);
    setIsEditing(true);
  };

  const stopEditing = () => {
    setIsEditing(false);
  };

  const resetValue = () => {
    setEditValue(nodeLabel);
    setIsEditing(false);
  };

  return {
    isEditing,
    editValue,
    setEditValue,
    inputRef,
    startEditing,
    stopEditing,
    resetValue,
  };
}

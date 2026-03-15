// Please write clean, production-grade TypeScript code.
// Avoid non-ASCII characters, Chinese symbols, or multilingual output.

import { useState, useRef, useLayoutEffect } from 'react';

/**
 * Manages local editing state for a grammar node.
 *
 * Focus strategy:
 * - New nodes: focus is handled in creation handlers (useGrammarCanvasEvents, useNodeKeyboardHandlers)
 * - Existing nodes (double-click): useLayoutEffect for immediate focus when entering edit mode
 */
export function useNodeEditingState(nodeLabel: string) {
  const isNew = nodeLabel === '';
  const [isEditing, setIsEditing] = useState(isNew);
  const [editValue, setEditValue] = useState(nodeLabel);
  const inputRef = useRef<HTMLInputElement>(null);

  // Focus when an existing node enters editing mode (e.g. double-click).
  // For new nodes this is NOT needed because autoFocus handles it natively.
  useLayoutEffect(() => {
    if (isEditing && !isNew && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isEditing]);

  const startEditing = () => {
    setEditValue(nodeLabel);
    setIsEditing(true);
  };

  const stopEditing = () => setIsEditing(false);

  const resetValue = () => {
    setEditValue(nodeLabel);
    setIsEditing(false);
  };

  return { isEditing, editValue, setEditValue, inputRef, startEditing, stopEditing, resetValue };
}

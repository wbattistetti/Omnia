// Please write clean, production-grade TypeScript code.
// Avoid non-ASCII characters, Chinese symbols, or multilingual output.

import { useState, useRef, useLayoutEffect } from 'react';

/**
 * Manages local editing state for a grammar node.
 *
 * Focus strategy:
 * - New nodes (label === ''): automatically enter editing mode and focus
 * - Semantic-set nodes store an empty label (caption is the set name in the UI only): do not
 *   treat as "new" or auto-open the caption editor — that avoids focus fights with React Flow.
 * - Existing nodes (double-click): useLayoutEffect for immediate focus when entering edit mode
 */
export function useNodeEditingState(
  nodeLabel: string,
  /** When true, empty label does not mean a brand-new node that must capture caption. */
  skipAutoEditForEmptyLabel = false
) {
  const isNew = nodeLabel === '' && !skipAutoEditForEmptyLabel;
  const [isEditing, setIsEditing] = useState(isNew);
  const [editValue, setEditValue] = useState(nodeLabel);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Sync isEditing when node becomes new (label changes from non-empty to empty)
  useLayoutEffect(() => {
    if (isNew && !isEditing) {
      setIsEditing(true);
    }
  }, [isNew, isEditing, nodeLabel]);

  // Sync editValue when nodeLabel changes (e.g., when node is updated externally)
  useLayoutEffect(() => {
    if (nodeLabel !== editValue && !isEditing) {
      setEditValue(nodeLabel);
    }
  }, [nodeLabel, editValue, isEditing]);

  useLayoutEffect(() => {
    if (isEditing && inputRef.current) {
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

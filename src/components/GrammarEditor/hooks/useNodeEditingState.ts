// Please write clean, production-grade TypeScript code.
// Avoid non-ASCII characters, Chinese symbols, or multilingual output.

import React, { useState, useRef, useLayoutEffect } from 'react';

/**
 * Manages local editing state for a grammar node.
 *
 * Focus strategy:
 * - New nodes (label === ''): automatically enter editing mode and focus
 * - Existing nodes (double-click): useLayoutEffect for immediate focus when entering edit mode
 */
export function useNodeEditingState(nodeLabel: string) {
  const isNew = nodeLabel === '';
  const [isEditing, setIsEditing] = useState(isNew);
  const [editValue, setEditValue] = useState(nodeLabel);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Debug log for new nodes
  React.useEffect(() => {
    if (isNew) {
      console.log('[useNodeEditingState] 🆕 New node detected', {
        nodeLabel,
        isNew,
        isEditing,
        hasRef: !!inputRef.current,
      });
    }
  }, [isNew, nodeLabel, isEditing]);

  // Sync editValue when nodeLabel changes (e.g., when node is updated externally)
  useLayoutEffect(() => {
    if (nodeLabel !== editValue && !isEditing) {
      setEditValue(nodeLabel);
    }
  }, [nodeLabel, editValue, isEditing]);

  // Focus when entering editing mode (both new and existing nodes)
  useLayoutEffect(() => {
    if (isEditing) {
      console.log('[useNodeEditingState] 🎯 Entering editing mode', {
        nodeLabel,
        isEditing,
        hasRef: !!inputRef.current,
      });

      // Use double requestAnimationFrame to ensure DOM is fully ready
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          if (inputRef.current) {
            console.log('[useNodeEditingState] ✅ Focusing input', {
              nodeLabel,
              inputValue: inputRef.current.value,
            });
            inputRef.current.focus();
            inputRef.current.select();
          } else {
            console.warn('[useNodeEditingState] ⚠️ Input ref is null', {
              nodeLabel,
              isEditing,
            });
          }
        });
      });
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

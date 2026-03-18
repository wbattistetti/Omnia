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

      // Use callback ref pattern for more reliable ref access
      const focusInput = () => {
        if (inputRef.current) {
          console.log('[useNodeEditingState] ✅ Focusing input', {
            nodeLabel,
            inputValue: inputRef.current.value,
          });
          inputRef.current.focus();
          inputRef.current.select();
          return true;
        }
        return false;
      };

      // Try immediate focus first
      if (focusInput()) {
        return;
      }

      // If ref not ready, use requestAnimationFrame with retry
      let retryCount = 0;
      const maxRetries = 5;

      const tryFocus = () => {
        if (focusInput()) {
          return;
        }
        retryCount++;
        if (retryCount < maxRetries) {
          requestAnimationFrame(tryFocus);
        } else {
          console.warn('[useNodeEditingState] ⚠️ Input ref not available after retries', {
            nodeLabel,
            isEditing,
            retryCount,
          });
        }
      };

      requestAnimationFrame(() => {
        requestAnimationFrame(tryFocus);
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

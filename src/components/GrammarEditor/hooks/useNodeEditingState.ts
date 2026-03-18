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

  // ✅ CRITICAL: Sync isEditing when node becomes new (label changes from non-empty to empty)
  // useState(isNew) only initializes on first mount, so we need to sync when isNew changes
  useLayoutEffect(() => {
    if (isNew && !isEditing) {
      console.log('[useNodeEditingState] 🔄 Syncing isEditing to true (node became new)', {
        nodeLabel,
        isNew,
        wasEditing: isEditing,
      });
      setIsEditing(true);
    }
  }, [isNew, isEditing, nodeLabel]);

  // Sync editValue when nodeLabel changes (e.g., when node is updated externally)
  useLayoutEffect(() => {
    if (nodeLabel !== editValue && !isEditing) {
      setEditValue(nodeLabel);
    }
  }, [nodeLabel, editValue, isEditing]);

  // Focus when entering editing mode (both new and existing nodes)
  // ✅ DETERMINISTIC: Immediate focus, no retry logic, no fallback
  useLayoutEffect(() => {
    if (isEditing && inputRef.current) {
      console.log('[useNodeEditingState] 🎯 FOCUS useNodeEditingState', {
        nodeLabel,
        isEditing,
        refOk: !!inputRef.current,
        refElement: inputRef.current,
      });

      // ✅ DIAGNOSTIC: Track focus before applying
      const beforeFocus = document.activeElement;
      console.log('[useNodeEditingState] 🔍 BEFORE focus', {
        activeElement: beforeFocus?.tagName,
        activeElementId: beforeFocus?.id,
        activeElementClass: beforeFocus?.className,
      });

      inputRef.current.focus();
      inputRef.current.select();

      // ✅ DIAGNOSTIC: Track focus after applying
      const afterFocus = document.activeElement;
      console.log('[useNodeEditingState] 🔍 AFTER focus', {
        activeElement: afterFocus?.tagName,
        activeElementId: afterFocus?.id,
        activeElementClass: afterFocus?.className,
        isTextarea: afterFocus === inputRef.current,
      });

      // ✅ DIAGNOSTIC: Monitor focus loss
      const checkFocus = () => {
        if (document.activeElement !== inputRef.current && isEditing) {
          console.error('[useNodeEditingState] ❌ FOCUS STOLEN', {
            expected: 'textarea',
            actual: document.activeElement?.tagName,
            actualId: document.activeElement?.id,
            actualClass: document.activeElement?.className,
            stack: new Error().stack,
          });
        }
      };

      // Check immediately and after short delays to catch focus theft
      setTimeout(checkFocus, 0);
      setTimeout(checkFocus, 10);
      setTimeout(checkFocus, 50);
      setTimeout(checkFocus, 100);
    } else if (isEditing && !inputRef.current) {
      console.log('[useNodeEditingState] ❌ FOCUS FAILED - ref is null', {
        nodeLabel,
        isEditing,
        refOk: false,
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

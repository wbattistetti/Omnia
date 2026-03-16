// Please write clean, production-grade TypeScript code.
// Avoid non-ASCII characters, Chinese symbols, or multilingual output.

import { useState, useCallback } from 'react';
import type { TreeState } from '../../types/slotEditorTypes';

/**
 * Hook for managing tree state (expand/collapse, selection)
 * Single Responsibility: Tree UI state management
 */
export function useSlotTree() {
  const [state, setState] = useState<TreeState>({
    expanded: new Set<string>(['semantic-sets-section', 'slots-section']),
    selected: null,
  });

  const toggleExpanded = useCallback((id: string) => {
    setState((prev) => {
      const newExpanded = new Set(prev.expanded);
      if (newExpanded.has(id)) {
        newExpanded.delete(id);
      } else {
        newExpanded.add(id);
      }
      return { ...prev, expanded: newExpanded };
    });
  }, []);

  const setSelected = useCallback((id: string | null) => {
    setState((prev) => ({ ...prev, selected: id }));
  }, []);

  const expandAll = useCallback((ids: string[]) => {
    setState((prev) => ({
      ...prev,
      expanded: new Set(ids),
    }));
  }, []);

  const collapseAll = useCallback(() => {
    setState((prev) => ({
      ...prev,
      expanded: new Set(),
    }));
  }, []);

  const isExpanded = useCallback((id: string) => {
    return state.expanded.has(id);
  }, [state.expanded]);

  return {
    expanded: state.expanded,
    selected: state.selected,
    toggleExpanded,
    setSelected,
    expandAll,
    collapseAll,
    isExpanded,
  };
}

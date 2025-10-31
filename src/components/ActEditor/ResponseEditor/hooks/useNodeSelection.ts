import { useState, useCallback, useRef } from 'react';

/**
 * Hook for managing node selection state in ResponseEditor.
 * Handles main data, sub-data, and root/aggregate selection.
 *
 * @param initialMainIndex - Initial main data index (default: 0)
 * @returns Selection state and handlers
 */
export function useNodeSelection(initialMainIndex = 0) {
  const [selectedMainIndex, setSelectedMainIndex] = useState(initialMainIndex);
  const [selectedSubIndex, setSelectedSubIndex] = useState<number | undefined>(undefined);
  const [selectedRoot, setSelectedRoot] = useState<boolean>(false);
  const sidebarRef = useRef<HTMLDivElement>(null);

  const handleSelectMain = useCallback((idx: number) => {
    setSelectedMainIndex(idx);
    setSelectedSubIndex(undefined);
    setSelectedRoot(false);
    setTimeout(() => { sidebarRef.current?.focus(); }, 0);
  }, []);

  const handleSelectSub = useCallback((subIdx: number | undefined) => {
    // subIdx is relative to the currently selected main
    setSelectedRoot(false);
    setSelectedSubIndex(subIdx);
    setTimeout(() => { sidebarRef.current?.focus(); }, 0);
  }, []);

  const handleSelectAggregator = useCallback(() => {
    setSelectedRoot(true);
    setSelectedMainIndex(0);
    setSelectedSubIndex(undefined);
    setTimeout(() => { sidebarRef.current?.focus(); }, 0);
  }, []);

  const resetSelection = useCallback(() => {
    setSelectedMainIndex(0);
    setSelectedSubIndex(undefined);
    setSelectedRoot(false);
    setTimeout(() => { sidebarRef.current?.focus(); }, 0);
  }, []);

  return {
    selectedMainIndex,
    selectedSubIndex,
    selectedRoot,
    sidebarRef,
    // Setters (keep for backward compatibility)
    setSelectedMainIndex,
    setSelectedSubIndex,
    setSelectedRoot,
    // Handlers
    handleSelectMain,
    handleSelectSub,
    handleSelectAggregator,
    resetSelection,
  };
}


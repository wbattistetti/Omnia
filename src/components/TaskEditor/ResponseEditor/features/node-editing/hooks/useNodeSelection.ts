import { useState, useCallback, useRef } from 'react';
import type { SelectPathOptions } from '@responseEditor/features/node-editing/selectPathTypes';

/**
 * Hook for managing node selection state in ResponseEditor.
 * Selection is stored as a stable path of indices; legacy main/sub indices are derived for compatibility.
 *
 * @param initialMainIndex - Initial main data index (default: 0)
 */
export function useNodeSelection(initialMainIndex = 0) {
  const [selectedPath, setSelectedPath] = useState<number[]>([initialMainIndex]);
  const [selectedRoot, setSelectedRoot] = useState<boolean>(false);
  const sidebarRef = useRef<HTMLDivElement>(null);

  const selectedMainIndex = selectedRoot ? 0 : (selectedPath[0] ?? 0);
  const selectedSubIndex = selectedRoot
    ? undefined
    : (selectedPath.length > 1 ? selectedPath[1] : undefined);

  const handleSelectMain = useCallback((idx: number) => {
    setSelectedRoot(false);
    setSelectedPath([idx]);
    setTimeout(() => { sidebarRef.current?.focus(); }, 0);
  }, []);

  const handleSelectSub = useCallback((subIdx: number | undefined, mainIdx?: number) => {
    setSelectedRoot(false);
    setSelectedPath((prev) => {
      const main = mainIdx !== undefined ? mainIdx : (prev[0] ?? 0);
      if (subIdx === undefined) {
        return [main];
      }
      return [main, subIdx];
    });
    setTimeout(() => { sidebarRef.current?.focus(); }, 0);
  }, []);

  const handleSelectByPath = useCallback((path: number[], options?: SelectPathOptions) => {
    setSelectedRoot(false);
    setSelectedPath(path.length ? path : [0]);
    const focusSidebar = options?.focusSidebar !== false;
    if (focusSidebar) {
      setTimeout(() => {
        sidebarRef.current?.focus();
      }, 0);
    }
  }, []);

  const handleSelectAggregator = useCallback(() => {
    setSelectedRoot(true);
    setSelectedPath([0]);
    setTimeout(() => { sidebarRef.current?.focus(); }, 0);
  }, []);

  const resetSelection = useCallback(() => {
    setSelectedRoot(false);
    setSelectedPath([0]);
    setTimeout(() => { sidebarRef.current?.focus(); }, 0);
  }, []);

  return {
    selectedPath,
    selectedMainIndex,
    selectedSubIndex,
    selectedRoot,
    sidebarRef,
    setSelectedPath,
    setSelectedMainIndex: (idx: number) => setSelectedPath([idx]),
    setSelectedSubIndex: (sub: number | undefined) => {
      setSelectedPath((prev) => {
        const m = prev[0] ?? 0;
        return sub === undefined ? [m] : [m, sub];
      });
    },
    setSelectedRoot,
    handleSelectMain,
    handleSelectSub,
    handleSelectByPath,
    handleSelectAggregator,
    resetSelection,
  };
}

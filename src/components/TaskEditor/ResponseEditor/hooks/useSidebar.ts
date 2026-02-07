// Please write clean, production-grade TypeScript code.
// Avoid non-ASCII characters, Chinese symbols, or multilingual output.

/**
 * useSidebar - Composite Hook
 *
 * Orchestrates all sidebar-related functionality:
 * - Drag handling (useSidebarDrag)
 * - Resize handling (useSidebarResize)
 * - Cleanup (useSidebarCleanup)
 * - Business logic handlers (useSidebarHandlers)
 *
 * ✅ FASE 2.1: Consolidated from 4 separate hooks into 1 composite hook
 * This reduces complexity and improves maintainability.
 */

import { useEffect, useCallback } from 'react';
import { getMainNodes, getSubNodes } from '@responseEditor/core/domain';
import { getSubNodesStrict } from '@responseEditor/core/domain/nodeStrict';
import type { TaskTree } from '@types/taskTypes';

export interface UseSidebarParams {
  // Drag/Resize state
  isDraggingSidebar: boolean;
  setIsDraggingSidebar: React.Dispatch<React.SetStateAction<boolean>>;
  sidebarStartWidthRef: React.MutableRefObject<number>;
  sidebarStartXRef: React.MutableRefObject<number>;
  setSidebarManualWidth: React.Dispatch<React.SetStateAction<number | null>>;
  sidebarRef: React.RefObject<HTMLDivElement>;

  // Business logic
  taskTree: TaskTree | null | undefined;
  replaceSelectedTaskTree: (taskTree: TaskTree) => void;
}

export interface UseSidebarResult {
  // Resize handler
  handleSidebarResizeStart: (e: React.MouseEvent) => void;

  // Business logic handlers
  onChangeSubRequired: (mIdx: number, sIdx: number, required: boolean) => void;
  onReorderSub: (mIdx: number, fromIdx: number, toIdx: number) => void;
  onAddMain: (label: string) => void;
  onRenameMain: (mIdx: number, label: string) => void;
  onDeleteMain: (mIdx: number) => void;
  onAddSub: (mIdx: number, label: string) => void;
  onRenameSub: (mIdx: number, sIdx: number, label: string) => void;
  onDeleteSub: (mIdx: number, sIdx: number) => void;
}

/**
 * Composite hook that orchestrates all sidebar functionality.
 * Consolidates useSidebarDrag, useSidebarResize, useSidebarCleanup, and useSidebarHandlers.
 */
export function useSidebar(params: UseSidebarParams): UseSidebarResult {
  const {
    isDraggingSidebar,
    setIsDraggingSidebar,
    sidebarStartWidthRef,
    sidebarStartXRef,
    setSidebarManualWidth,
    sidebarRef,
    taskTree,
    replaceSelectedTaskTree,
  } = params;

  // ============================================
  // Cleanup (from useSidebarCleanup)
  // ============================================
  useEffect(() => {
    try {
      localStorage.removeItem('responseEditor.sidebarWidth');
    } catch { }
  }, []);

  // ============================================
  // Drag handling (from useSidebarDrag)
  // ============================================
  useEffect(() => {
    if (!isDraggingSidebar) {
      return;
    }

    const handleMove = (e: MouseEvent) => {
      const deltaX = e.clientX - sidebarStartXRef.current;
      const MIN_WIDTH = 160;
      const MAX_WIDTH = 1000;
      const calculatedWidth = sidebarStartWidthRef.current + deltaX;
      const newWidth = Math.max(MIN_WIDTH, Math.min(MAX_WIDTH, calculatedWidth));

      setSidebarManualWidth(newWidth);
    };

    const handleUp = () => {
      setIsDraggingSidebar(false);
    };

    window.addEventListener('mousemove', handleMove);
    window.addEventListener('mouseup', handleUp);

    return () => {
      window.removeEventListener('mousemove', handleMove);
      window.removeEventListener('mouseup', handleUp);
    };
  }, [isDraggingSidebar, sidebarStartWidthRef, sidebarStartXRef, setSidebarManualWidth, setIsDraggingSidebar]);

  // ============================================
  // Resize handler (from useSidebarResize)
  // ============================================
  const handleSidebarResizeStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation(); // CRITICAL: prevent other handlers from interfering

    const sidebarEl = sidebarRef?.current;
    if (!sidebarEl) {
      return;
    }

    const rect = sidebarEl.getBoundingClientRect();
    sidebarStartWidthRef.current = rect.width;
    sidebarStartXRef.current = e.clientX;

    setIsDraggingSidebar(true);
  }, [sidebarRef, sidebarStartWidthRef, sidebarStartXRef, setIsDraggingSidebar]);

  // ============================================
  // Business logic handlers (from useSidebarHandlers)
  // ============================================
  const onChangeSubRequired = useCallback((mIdx: number, sIdx: number, required: boolean) => {
    if (!taskTree) return;
    const next = JSON.parse(JSON.stringify(taskTree));
    const mains = getMainNodes(next);
    const main = mains[mIdx];
    if (!main) return;
    // After validation strict, use subNodes (not subTasks)
    const subList = [...getSubNodesStrict(main)];
    if (sIdx < 0 || sIdx >= subList.length) return;
    subList[sIdx] = { ...subList[sIdx], required };
    main.subNodes = subList;
    mains[mIdx] = main;
    next.nodes = mains;
    try {
      const subs = getSubNodes(main) || [];
      const target = subs[sIdx];
      if (localStorage.getItem('debug.responseEditor') === '1') {
        console.log('[DDT][subRequiredToggle][persist]', { main: main?.label, label: target?.label, required });
      }
    } catch { }
    try { replaceSelectedTaskTree(next); } catch { }
  }, [taskTree, replaceSelectedTaskTree]);

  const onReorderSub = useCallback((mIdx: number, fromIdx: number, toIdx: number) => {
    if (!taskTree) return;
    const next = JSON.parse(JSON.stringify(taskTree));
    const mains = getMainNodes(next);
    const main = mains[mIdx];
    if (!main) return;
    // After validation strict, use subNodes (not subTasks)
    const subList = [...getSubNodesStrict(main)];
    if (fromIdx < 0 || fromIdx >= subList.length || toIdx < 0 || toIdx >= subList.length) return;
    const [moved] = subList.splice(fromIdx, 1);
    subList.splice(toIdx, 0, moved);
    main.subNodes = subList;
    mains[mIdx] = main;
    next.nodes = mains;
    try {
      if (localStorage.getItem('debug.responseEditor') === '1') {
        console.log('[DDT][subReorder][persist]', { main: main?.label, fromIdx, toIdx });
      }
    } catch { }
    try { replaceSelectedTaskTree(next); } catch { }
  }, [taskTree, replaceSelectedTaskTree]);

  const onAddMain = useCallback((label: string) => {
    if (!taskTree) return;
    const next = JSON.parse(JSON.stringify(taskTree));
    const mains = getMainNodes(next);
    mains.push({ label, subNodes: [] });
    next.nodes = mains;
    try { replaceSelectedTaskTree(next); } catch { }
  }, [taskTree, replaceSelectedTaskTree]);

  const onRenameMain = useCallback((mIdx: number, label: string) => {
    if (!taskTree) return;
    const next = JSON.parse(JSON.stringify(taskTree));
    const mains = getMainNodes(next);
    if (!mains[mIdx]) return;
    mains[mIdx].label = label;
    next.nodes = mains;
    try { replaceSelectedTaskTree(next); } catch { }
  }, [taskTree, replaceSelectedTaskTree]);

  const onDeleteMain = useCallback((mIdx: number) => {
    if (!taskTree) return;
    const next = JSON.parse(JSON.stringify(taskTree));
    const mains = getMainNodes(next);
    if (mIdx < 0 || mIdx >= mains.length) return;
    mains.splice(mIdx, 1);
    next.nodes = mains;
    try { replaceSelectedTaskTree(next); } catch { }
  }, [taskTree, replaceSelectedTaskTree]);

  const onAddSub = useCallback((mIdx: number, label: string) => {
    if (!taskTree) return;
    const next = JSON.parse(JSON.stringify(taskTree));
    const mains = getMainNodes(next);
    const main = mains[mIdx];
    if (!main) return;
    // After validation strict, use subNodes (not subTasks)
    const list = [...getSubNodesStrict(main)];
    list.push({ label, required: true });
    main.subNodes = list;
    mains[mIdx] = main;
    next.nodes = mains;
    try { replaceSelectedTaskTree(next); } catch { }
  }, [taskTree, replaceSelectedTaskTree]);

  const onRenameSub = useCallback((mIdx: number, sIdx: number, label: string) => {
    if (!taskTree) return;
    const next = JSON.parse(JSON.stringify(taskTree));
    const mains = getMainNodes(next);
    const main = mains[mIdx];
    if (!main) return;
    // After validation strict, use subNodes (not subTasks)
    const list = [...getSubNodesStrict(main)];
    if (sIdx < 0 || sIdx >= list.length) return;
    list[sIdx] = { ...(list[sIdx] || {}), label };
    main.subNodes = list;
    mains[mIdx] = main;
    next.nodes = mains;
    try { replaceSelectedTaskTree(next); } catch { }
  }, [taskTree, replaceSelectedTaskTree]);

  const onDeleteSub = useCallback((mIdx: number, sIdx: number) => {
    if (!taskTree) return;
    const next = JSON.parse(JSON.stringify(taskTree));
    const mains = getMainNodes(next);
    const main = mains[mIdx];
    if (!main) return;
    // After validation strict, use subNodes (not subTasks)
    const list = [...getSubNodesStrict(main)];
    if (sIdx < 0 || sIdx >= list.length) return;
    list.splice(sIdx, 1);
    main.subNodes = list;
    mains[mIdx] = main;
    next.nodes = mains;
    try { replaceSelectedTaskTree(next); } catch { }
  }, [taskTree, replaceSelectedTaskTree]);

  return {
    handleSidebarResizeStart,
    onChangeSubRequired,
    onReorderSub,
    onAddMain,
    onRenameMain,
    onDeleteMain,
    onAddSub,
    onRenameSub,
    onDeleteSub,
  };
}

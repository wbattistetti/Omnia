/**
 * useSidebarHandlers
 *
 * Custom hook that provides all handlers for Sidebar operations.
 * Extracted from index.tsx to improve maintainability and separation of concerns.
 */

import { useCallback } from 'react';
import { getMainNodes, getSubNodes } from '@responseEditor/core/domain';
import type { TaskTree } from '@types/taskTypes';

export interface UseSidebarHandlersProps {
  taskTree: TaskTree | null | undefined;
  replaceSelectedTaskTree: (taskTree: TaskTree) => void;
}

export interface UseSidebarHandlersResult {
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
 * Hook that provides all Sidebar handlers
 */
export function useSidebarHandlers({
  taskTree,
  replaceSelectedTaskTree,
}: UseSidebarHandlersProps): UseSidebarHandlersResult {
  const onChangeSubRequired = useCallback((mIdx: number, sIdx: number, required: boolean) => {
    if (!taskTree) return;
    const next = JSON.parse(JSON.stringify(taskTree));
    const mains = getMainNodes(next);
    const main = mains[mIdx];
    if (!main) return;
    const subList = Array.isArray(main.subTasks) ? main.subTasks : [];
    if (sIdx < 0 || sIdx >= subList.length) return;
    subList[sIdx] = { ...subList[sIdx], required };
    main.subTasks = subList;
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
    const subList = Array.isArray(main.subTasks) ? main.subTasks : [];
    if (fromIdx < 0 || fromIdx >= subList.length || toIdx < 0 || toIdx >= subList.length) return;
    const [moved] = subList.splice(fromIdx, 1);
    subList.splice(toIdx, 0, moved);
    main.subTasks = subList;
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
    mains.push({ label, subTasks: [] });
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
    const list = Array.isArray(main.subTasks) ? main.subTasks : [];
    list.push({ label, required: true });
    main.subTasks = list;
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
    const list = Array.isArray(main.subTasks) ? main.subTasks : [];
    if (sIdx < 0 || sIdx >= list.length) return;
    list[sIdx] = { ...(list[sIdx] || {}), label };
    main.subTasks = list;
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
    const list = Array.isArray(main.subTasks) ? main.subTasks : [];
    if (sIdx < 0 || sIdx >= list.length) return;
    list.splice(sIdx, 1);
    main.subTasks = list;
    mains[mIdx] = main;
    next.nodes = mains;
    try { replaceSelectedTaskTree(next); } catch { }
  }, [taskTree, replaceSelectedTaskTree]);

  return {
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

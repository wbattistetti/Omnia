// Please write clean, production-grade TypeScript code.
// Avoid non-ASCII characters, Chinese symbols, or multilingual output.

import { useCallback } from 'react';
import { getdataList, getSubDataList } from '../../../ddtSelectors';
import { useTaskTreeFromStore } from '../../../core/state';
import type { TaskTree } from '../../../../types/taskTypes';

export interface UseNodeFinderParams {
  // ✅ FASE 3: Parametri opzionali rimossi - store è single source of truth
  handleSelectMain: (idx: number) => void;
  handleSelectSub: (idx: number | undefined, mainIdx?: number) => void;
}

/**
 * Hook that provides findAndSelectNodeById function for finding and selecting nodes by ID.
 *
 * ✅ FASE 3: Completamente migrato a Zustand store (single source of truth)
 * - Usa taskTreeFromStore come unica fonte
 * - Rimossi completamente taskTreeRef e taskTree prop
 */
export function useNodeFinder(params: UseNodeFinderParams) {
  const { handleSelectMain, handleSelectSub } = params;

  // ✅ FASE 2.3: Use Zustand store as SINGLE source of truth
  const taskTreeFromStore = useTaskTreeFromStore();

  const findAndSelectNodeById = useCallback((nodeId: string) => {
    // ✅ FASE 2.3: Usa solo store - no fallback chain
    const currentTaskTree = taskTreeFromStore;
    const mains = getdataList(currentTaskTree);
    for (let mIdx = 0; mIdx < mains.length; mIdx++) {
      const main = mains[mIdx];
      const mainNodeId = main.id || main.templateId || main._id;
      if (mainNodeId === nodeId) {
        handleSelectMain(mIdx);
        handleSelectSub(undefined);
        return;
      }
      const subs = getSubDataList(main) || [];
      for (let sIdx = 0; sIdx < subs.length; sIdx++) {
        const sub = subs[sIdx];
        const subNodeId = sub.id || sub.templateId || sub._id;
        if (subNodeId === nodeId) {
          handleSelectMain(mIdx);
          handleSelectSub(sIdx, mIdx);
          return;
        }
      }
    }
  }, [taskTreeFromStore, handleSelectMain, handleSelectSub]);

  return findAndSelectNodeById;
}

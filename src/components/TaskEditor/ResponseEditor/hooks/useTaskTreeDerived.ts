// Please write clean, production-grade TypeScript code.
// Avoid non-ASCII characters, Chinese symbols, or multilingual output.

import { useMemo } from 'react';
import { getMainNodes } from '@responseEditor/core/domain';
import { useTaskTreeFromStore, useTaskTreeVersion } from '@responseEditor/core/state';
import type { TaskTree } from '@types/taskTypes';

export interface UseTaskTreeDerivedParams {
  // ✅ FASE 3: Parametri opzionali rimossi - store è single source of truth
  isTaskTreeLoading?: boolean;
}

export interface UseTaskTreeDerivedResult {
  mainList: any[];
  isAggregatedAtomic: boolean;
  introduction: any;
}

/**
 * Hook that provides derived values from TaskTree (mainList, isAggregatedAtomic, introduction).
 *
 * ✅ FASE 3: Completamente migrato a Zustand store (single source of truth)
 * - Usa taskTreeFromStore come unica fonte
 * - Usa taskTreeVersion dallo store
 * - Rimossi completamente taskTreeRef e taskTree prop
 */
export function useTaskTreeDerived(params: UseTaskTreeDerivedParams = {}): UseTaskTreeDerivedResult {
  const {
    isTaskTreeLoading,
  } = params;

  // Stabilizza isTaskTreeLoading per evitare problemi con dipendenze undefined
  const stableIsTaskTreeLoading = isTaskTreeLoading ?? false;

  // ✅ FASE 2.3: Use Zustand store as SINGLE source of truth
  const taskTreeFromStore = useTaskTreeFromStore();
  const taskTreeVersion = useTaskTreeVersion();

  // ✅ CRITICAL: taskTreeVersion is PRIMARY dependency to force re-render
  // This ensures mainList recalculates when store changes, even if nodes.length === 0
  // ✅ CRITICAL: Don't include taskTreeFromStore in deps - it changes reference on every store update
  // Use taskTreeVersion as the only trigger (stable, increments only when needed)
  const mainList = useMemo(() => {
    // ✅ FASE 3: Usa solo store - no fallback chain
    const list = getMainNodes(taskTreeFromStore);
    return list;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [taskTreeVersion, stableIsTaskTreeLoading]); // ✅ taskTreeVersion ONLY - primary trigger

  // Aggregated view: show a group header when there are multiple mains
  const isAggregatedAtomic = useMemo(() => (
    Array.isArray(mainList) && mainList.length > 1
  ), [mainList]);

  // Serializza introduction per confronto stabile (evita problemi con oggetti)
  // Usa sempre stringa (non null) per evitare problemi con React
  const stableIntroductionKey = taskTreeFromStore?.introduction
    ? JSON.stringify(taskTreeFromStore.introduction)
    : '';

  const introduction = useMemo(() => {
    // ✅ FASE 2.3: Usa solo store - no fallback chain
    return taskTreeFromStore?.introduction ?? null;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [taskTreeVersion, stableIntroductionKey]); // ✅ taskTreeVersion ONLY - primary trigger

  return {
    mainList,
    isAggregatedAtomic,
    introduction,
  };
}

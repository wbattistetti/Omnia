// Please write clean, production-grade TypeScript code.
// Avoid non-ASCII characters, Chinese symbols, or multilingual output.

import { useMemo } from 'react';
import { getdataList } from '../ddtSelectors';
import type { TaskTree } from '../../../../types/taskTypes';

export interface UseTaskTreeDerivedParams {
  taskTree: TaskTree | null | undefined;
  taskTreeRef: React.MutableRefObject<TaskTree | null | undefined>;
  taskTreeVersion: number;
  isTaskTreeLoading?: boolean;
}

export interface UseTaskTreeDerivedResult {
  mainList: any[];
  isAggregatedAtomic: boolean;
  introduction: any;
}

/**
 * Hook that provides derived values from TaskTree (mainList, isAggregatedAtomic, introduction).
 */
export function useTaskTreeDerived(params: UseTaskTreeDerivedParams): UseTaskTreeDerivedResult {
  const {
    taskTree,
    taskTreeRef,
    taskTreeVersion,
    isTaskTreeLoading,
  } = params;

  // Stabilizza isTaskTreeLoading per evitare problemi con dipendenze undefined
  const stableIsTaskTreeLoading = isTaskTreeLoading ?? false;

  // Usa taskTreeRef.current per mainList (contiene già le modifiche)
  // Forza re-render quando taskTreeRef cambia usando uno stato trigger
  const mainList = useMemo(() => {
    // ARCHITETTURA ESPERTO: Usa taskTree prop se disponibile, altrimenti taskTreeRef.current
    // Questo garantisce che mainList sia aggiornato quando DDTHostAdapter carica il TaskTree
    const currentTaskTree = taskTree ?? taskTreeRef.current;
    const list = getdataList(currentTaskTree);
    return list;
  }, [taskTree?.label ?? '', taskTree?.nodes?.length ?? 0, taskTreeVersion ?? 0, stableIsTaskTreeLoading]); // Usa valori primitivi sempre definiti

  // Aggregated view: show a group header when there are multiple mains
  const isAggregatedAtomic = useMemo(() => (
    Array.isArray(mainList) && mainList.length > 1
  ), [mainList]);

  // Stabilizza i valori primitivi per evitare problemi con array di dipendenze
  const stableTaskTreeVersion = taskTreeVersion ?? 0;
  // Serializza introduction per confronto stabile (evita problemi con oggetti)
  // Usa sempre stringa (non null) per evitare problemi con React
  const stableIntroductionKey = taskTree?.introduction ? JSON.stringify(taskTree.introduction) : '';

  const introduction = useMemo(() => {
    return taskTreeRef.current?.introduction ?? null;
  }, [stableTaskTreeVersion, stableIntroductionKey]); // Usa chiave serializzata sempre stringa

  return {
    mainList,
    isAggregatedAtomic,
    introduction,
  };
}

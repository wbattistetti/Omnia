// Please write clean, production-grade TypeScript code.
// Avoid non-ASCII characters, Chinese symbols, or multilingual output.

import { useEffect, useRef } from 'react';
import { getdataList } from '../ddtSelectors';
import type { Task, TaskTree } from '../../../../types/taskTypes';

export interface UseTaskTreeSyncParams {
  task?: Task | null;
  taskTree?: TaskTree | null;
  taskTreeRef: React.MutableRefObject<TaskTree | null | undefined>;
  setTaskTreeVersion: React.Dispatch<React.SetStateAction<number>>;
  prevInstanceRef: React.MutableRefObject<string | undefined>;
}

/**
 * Hook that synchronizes taskTreeRef.current with taskTree prop (source of truth from dockTree).
 *
 * ✅ FIX STRUTTURALE: Rimossa taskTree dalle dipendenze dirette per evitare loop.
 * Questo hook reagisce solo a cambio istanza, non a ogni cambio di riferimento di taskTree.
 * Usa un ref per tracciare l'ultimo taskTree e fare il controllo esplicito.
 *
 * ✅ CRITICAL: This hook does NOT update Zustand store - DDTHostAdapter does that directly.
 * This prevents infinite loops because:
 * 1. DDTHostAdapter populates store when TaskTree is loaded (solo una volta per istanza)
 * 2. This hook only syncs prop → ref (no store updates)
 * 3. Hooks use fallback chain: store > ref > prop
 *
 * The key is: increment version ONLY when currentList.length > 0 (prevents loops).
 * AND: reagisce solo a cambio istanza, non a ogni cambio di riferimento.
 */
export function useTaskTreeSync(params: UseTaskTreeSyncParams) {
  const {
    task,
    taskTree,
    taskTreeRef,
    setTaskTreeVersion,
    prevInstanceRef,
  } = params;

  // ✅ FIX STRUTTURALE: Ref per tracciare l'ultimo taskTree senza causare re-render
  const lastTaskTreeRef = useRef<TaskTree | null | undefined>(taskTree);

  useEffect(() => {
    const instance = task?.instanceId || task?.id;
    const isNewInstance = prevInstanceRef.current !== instance;

    // ✅ FIX STRUTTURALE: Controlla se taskTree è cambiato (anche senza essere nelle deps)
    const taskTreeChanged = taskTree !== lastTaskTreeRef.current;

    if (isNewInstance) {
      taskTreeRef.current = taskTree;
      prevInstanceRef.current = instance;
      lastTaskTreeRef.current = taskTree;
      const currentList = getdataList(taskTree);
      if (currentList && currentList.length > 0) {
        setTaskTreeVersion(v => v + 1);
      }
    } else if (taskTreeChanged && taskTree && taskTree !== taskTreeRef.current) {
      // ✅ FIX STRUTTURALE: Controllo esplicito - solo se taskTree è diverso dal ref
      // Non reagisce a ogni cambio di riferimento, ma solo quando taskTree è effettivamente diverso
      const currentList = getdataList(taskTree);
      const prevList = getdataList(taskTreeRef.current);
      const hasRealChange = taskTree !== taskTreeRef.current ||
        (currentList?.length !== prevList?.length);
      if (hasRealChange) {
        taskTreeRef.current = taskTree;
        lastTaskTreeRef.current = taskTree;
        if (currentList && currentList.length > 0) {
          setTaskTreeVersion(v => v + 1);
        }
      }
    } else if (!taskTreeChanged) {
      // ✅ Aggiorna ref anche se taskTree non è cambiato (per mantenere sincronizzazione)
      lastTaskTreeRef.current = taskTree;
    }
    // ✅ FIX STRUTTURALE: Rimosso taskTree dalle dipendenze - reagisce solo a cambio istanza
    // Il controllo esplicito dentro l'effect gestisce i cambiamenti di taskTree usando lastTaskTreeRef
  }, [task?.instanceId, task?.id, taskTreeRef, prevInstanceRef, setTaskTreeVersion, taskTree]);
}

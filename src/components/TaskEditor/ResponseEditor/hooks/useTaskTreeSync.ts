// Please write clean, production-grade TypeScript code.
// Avoid non-ASCII characters, Chinese symbols, or multilingual output.

import { useEffect } from 'react';
import { getdataList } from '../ddtSelectors';
import { useTaskTreeStore } from '../core/state';
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
 * ✅ FASE 2.2: Also updates Zustand store when taskTree changes.
 */
export function useTaskTreeSync(params: UseTaskTreeSyncParams) {
  const {
    task,
    taskTree,
    taskTreeRef,
    setTaskTreeVersion,
    prevInstanceRef,
  } = params;
  
  // ✅ FASE 2.2: Use Zustand store to update when taskTree changes
  const { setTaskTree, incrementVersion } = useTaskTreeStore();

  useEffect(() => {
    const instance = task?.instanceId || task?.id;
    const isNewInstance = prevInstanceRef.current !== instance;

    if (isNewInstance) {
      // ✅ FASE 2.2: Update both ref (for backward compatibility) and store
      taskTreeRef.current = taskTree;
      if (taskTree) {
        setTaskTree(taskTree);
      }
      prevInstanceRef.current = instance;
      const currentList = getdataList(taskTree);
      if (currentList && currentList.length > 0) {
        incrementVersion();
        setTaskTreeVersion(v => v + 1); // Keep for backward compatibility
      }
    } else if (taskTree && taskTree !== taskTreeRef.current) {
      const currentList = getdataList(taskTree);
      const prevList = getdataList(taskTreeRef.current);
      const taskTreeChanged = taskTree !== taskTreeRef.current ||
        (currentList?.length !== prevList?.length);
      if (taskTreeChanged) {
        // ✅ FASE 2.2: Update both ref (for backward compatibility) and store
        taskTreeRef.current = taskTree;
        setTaskTree(taskTree);
        if (currentList && currentList.length > 0) {
          incrementVersion();
          setTaskTreeVersion(v => v + 1); // Keep for backward compatibility
        }
      }
    }
  }, [taskTree, task?.instanceId, task?.id, taskTreeRef, prevInstanceRef, setTaskTreeVersion, setTaskTree, incrementVersion]);
}

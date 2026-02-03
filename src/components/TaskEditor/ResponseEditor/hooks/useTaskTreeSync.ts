// Please write clean, production-grade TypeScript code.
// Avoid non-ASCII characters, Chinese symbols, or multilingual output.

import { useEffect } from 'react';
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
 */
export function useTaskTreeSync(params: UseTaskTreeSyncParams) {
  const {
    task,
    taskTree,
    taskTreeRef,
    setTaskTreeVersion,
    prevInstanceRef,
  } = params;

  useEffect(() => {
    const instance = task?.instanceId || task?.id;
    const isNewInstance = prevInstanceRef.current !== instance;

    if (isNewInstance) {
      taskTreeRef.current = taskTree;
      prevInstanceRef.current = instance;
      const currentList = getdataList(taskTree);
      if (currentList && currentList.length > 0) {
        setTaskTreeVersion(v => v + 1);
      }
    } else if (taskTree && taskTree !== taskTreeRef.current) {
      const currentList = getdataList(taskTree);
      const prevList = getdataList(taskTreeRef.current);
      const taskTreeChanged = taskTree !== taskTreeRef.current ||
        (currentList?.length !== prevList?.length);
      if (taskTreeChanged) {
        taskTreeRef.current = taskTree;
        if (currentList && currentList.length > 0) {
          setTaskTreeVersion(v => v + 1);
        }
      }
    }
  }, [taskTree, task?.instanceId, task?.id, taskTreeRef, prevInstanceRef, setTaskTreeVersion]);
}

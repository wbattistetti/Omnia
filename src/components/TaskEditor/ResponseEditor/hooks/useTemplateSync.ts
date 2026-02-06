// Please write clean, production-grade TypeScript code.
// Avoid non-ASCII characters, Chinese symbols, or multilingual output.

import { useEffect } from 'react';
import { checkAndApplyTemplateSync } from '../modules/ResponseEditor/persistence/ResponseEditorPersistence';
import { useTaskTreeStore } from '../core/state';
import type { Task, TaskTree } from '../../../../types/taskTypes';

export interface UseTemplateSyncParams {
  task?: Task | null;
  taskTree?: TaskTree | null;
  taskTreeRef: React.MutableRefObject<TaskTree | null | undefined>;
  currentProjectId: string | null;
  prevInstanceRef: React.MutableRefObject<string | undefined>;
  replaceSelectedTaskTree: (taskTree: TaskTree) => void;
}

/**
 * Hook that checks for template sync when task is opened.
 */
export function useTemplateSync(params: UseTemplateSyncParams) {
  const {
    task,
    taskTree,
    taskTreeRef,
    currentProjectId,
    prevInstanceRef,
    replaceSelectedTaskTree,
  } = params;
  
  // ✅ FASE 2.2: Use Zustand store to update both ref and store
  const { setTaskTree } = useTaskTreeStore();

  useEffect(() => {
    const checkTemplateSync = async () => {
      if (!taskTree || !task?.templateId) return;

      const syncApplied = await checkAndApplyTemplateSync(taskTree, task, currentProjectId);
      if (syncApplied) {
        const syncedTaskTree = { ...taskTree };
        // ✅ FASE 2.2: Update both ref (for backward compatibility) and store
        taskTreeRef.current = syncedTaskTree;
        setTaskTree(syncedTaskTree);
        replaceSelectedTaskTree(syncedTaskTree);
      }
    };

    if (taskTree && task?.templateId && prevInstanceRef.current === (task?.instanceId || task?.id)) {
      checkTemplateSync();
    }
  }, [taskTree, task?.templateId, task?.instanceId, task?.id, replaceSelectedTaskTree, currentProjectId, taskTreeRef, prevInstanceRef, setTaskTree]);
}

// Please write clean, production-grade TypeScript code.
// Avoid non-ASCII characters, Chinese symbols, or multilingual output.

import { useEffect } from 'react';
import { checkAndApplyTemplateSync } from '@responseEditor/features/persistence/ResponseEditorPersistence';
import { useTaskTreeStore, useTaskTreeFromStore } from '@responseEditor/core/state';
import type { Task, TaskTree } from '@types/taskTypes';

export interface UseTemplateSyncParams {
  task?: Task | null;
  taskTree?: TaskTree | null;
  // ✅ FASE 3: taskTreeRef rimosso - store è single source of truth
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
    currentProjectId,
    prevInstanceRef,
    replaceSelectedTaskTree,
  } = params;

  // ✅ FASE 2.3: Use Zustand store as SINGLE source of truth
  const { setTaskTree } = useTaskTreeStore();
  const taskTreeFromStore = useTaskTreeFromStore();

  useEffect(() => {
    const checkTemplateSync = async () => {
      // ✅ FASE 2.3: Usa store invece di taskTree prop
      const currentTaskTree = taskTreeFromStore || taskTree;
      if (!currentTaskTree || !task?.templateId) return;

      const syncApplied = await checkAndApplyTemplateSync(currentTaskTree, task, currentProjectId);
      if (syncApplied) {
        const syncedTaskTree = { ...currentTaskTree };
        // ✅ FASE 2.3: Update only store (single source of truth)
        setTaskTree(syncedTaskTree);
        replaceSelectedTaskTree(syncedTaskTree);
      }
    };

    if (taskTreeFromStore && task?.templateId && prevInstanceRef.current === (task?.instanceId || task?.id)) {
      checkTemplateSync();
    }
  }, [taskTreeFromStore, task?.templateId, task?.instanceId, task?.id, replaceSelectedTaskTree, currentProjectId, prevInstanceRef, setTaskTree]);
}

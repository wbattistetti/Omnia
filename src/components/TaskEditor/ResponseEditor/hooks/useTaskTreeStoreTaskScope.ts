/**
 * Keeps Zustand taskTree store aligned with the currently open task instance.
 * Invalidates on task id change so the UI never shows another task's structure;
 * hydrates from props when the parent passes a pre-built TaskTree (e.g. dock tab).
 */

import { useEffect } from 'react';
import { useTaskTreeStore } from '@responseEditor/core/state';
import type { Task, TaskTree } from '@types/taskTypes';
import type { TaskWizardMode } from '@taskEditor/EditorHost/types';

/**
 * Only invalidate the global task tree store when the **task id actually changes**,
 * not on every remount of the editor (e.g. layout reflow / panel drag). Clearing on
 * each mount wiped in-memory edits and re-triggered pending wizard state.
 */
let lastTaskTreeScopeTaskId: string | undefined;

/** Test helper: module-level scope must reset between Vitest cases. */
export function __resetLastTaskTreeScopeTaskIdForTests(): void {
  lastTaskTreeScopeTaskId = undefined;
}

export interface UseTaskTreeStoreTaskScopeParams {
  task?: Task | null;
  taskTree?: TaskTree | null;
  isTaskTreeLoading?: boolean;
  taskWizardMode?: TaskWizardMode;
}

export function useTaskTreeStoreTaskScope(params: UseTaskTreeStoreTaskScopeParams): void {
  const { task, taskTree, isTaskTreeLoading, taskWizardMode } = params;
  const setTaskTree = useTaskTreeStore((s) => s.setTaskTree);

  useEffect(() => {
    const id = task?.id;
    if (!id) {
      return;
    }
    if (lastTaskTreeScopeTaskId === id) {
      return;
    }
    lastTaskTreeScopeTaskId = id;
    setTaskTree(null);
  }, [task?.id, setTaskTree]);

  useEffect(() => {
    const id = task?.id;
    if (!id) {
      return;
    }
    if (isTaskTreeLoading) {
      return;
    }
    if ((task as { needsTaskBuilder?: boolean })?.needsTaskBuilder === true) {
      return;
    }
    if (taskWizardMode === 'adaptation' || taskWizardMode === 'full') {
      return;
    }
    if (!taskTree) {
      return;
    }
    const current = useTaskTreeStore.getState().taskTree;
    if (current != null) {
      return;
    }
    setTaskTree(taskTree);
  }, [task?.id, taskTree, isTaskTreeLoading, taskWizardMode, task, setTaskTree]);
}

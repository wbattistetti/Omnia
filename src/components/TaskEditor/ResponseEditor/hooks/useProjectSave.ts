// Please write clean, production-grade TypeScript code.
// Avoid non-ASCII characters, Chinese symbols, or multilingual output.

import { useEffect } from 'react';
import { saveTaskOnProjectSave } from '../modules/ResponseEditor/persistence/ResponseEditorPersistence';
import { useTaskTreeFromStore } from '../core/state';
import type { Task, TaskTree } from '../../../../types/taskTypes';

export interface UseProjectSaveParams {
  task?: Task | null;
  taskTreeRef: React.MutableRefObject<TaskTree | null | undefined>;
  currentProjectId: string | null;
}

/**
 * Hook that saves changes when "Salva" is clicked in the project.
 */
export function useProjectSave(params: UseProjectSaveParams) {
  const { task, taskTreeRef, currentProjectId } = params;
  
  // ✅ FASE 2.2: Use Zustand store as primary source
  const taskTreeFromStore = useTaskTreeFromStore();

  useEffect(() => {
    const handleProjectSave = async () => {
      if (task?.id || (task as any)?.instanceId) {
        const key = ((task as any)?.instanceId || task?.id) as string;
        // ✅ FASE 2.2: Use store as primary source, fallback to ref
        const currentTaskTree = taskTreeFromStore ?? taskTreeRef.current;
        await saveTaskOnProjectSave(key, currentTaskTree, task, currentProjectId);
      }
    };

    window.addEventListener('project:save', handleProjectSave);
    return () => {
      window.removeEventListener('project:save', handleProjectSave);
    };
  }, [task?.id, (task as any)?.instanceId, currentProjectId, taskTreeFromStore, taskTreeRef, task]);
}

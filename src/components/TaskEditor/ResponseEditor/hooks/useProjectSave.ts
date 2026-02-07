// Please write clean, production-grade TypeScript code.
// Avoid non-ASCII characters, Chinese symbols, or multilingual output.

import { useEffect } from 'react';
import { saveTaskOnProjectSave } from '../modules/ResponseEditor/persistence/ResponseEditorPersistence';
import { useTaskTreeFromStore } from '../core/state';
import type { Task, TaskTree } from '../../../../types/taskTypes';

export interface UseProjectSaveParams {
  task?: Task | null;
  // ✅ FASE 2.3: Parametri opzionali per backward compatibility temporanea
  taskTreeRef?: React.MutableRefObject<TaskTree | null | undefined>;
  currentProjectId: string | null;
}

/**
 * Hook that saves changes when "Salva" is clicked in the project.
 *
 * ✅ FASE 2.3: Migrato a usare solo Zustand store (single source of truth)
 * - Usa taskTreeFromStore come unica fonte
 * - Rimossi fallback a taskTreeRef
 */
export function useProjectSave(params: UseProjectSaveParams) {
  const { task, currentProjectId } = params;

  // ✅ FASE 2.3: Use Zustand store as SINGLE source of truth
  const taskTreeFromStore = useTaskTreeFromStore();

  useEffect(() => {
    const handleProjectSave = async () => {
      if (task?.id || (task as any)?.instanceId) {
        const key = ((task as any)?.instanceId || task?.id) as string;
        // ✅ FASE 2.3: Usa solo store - no fallback chain
        const currentTaskTree = taskTreeFromStore;
        await saveTaskOnProjectSave(key, currentTaskTree, task, currentProjectId);
      }
    };

    window.addEventListener('project:save', handleProjectSave);
    return () => {
      window.removeEventListener('project:save', handleProjectSave);
    };
  }, [task?.id, (task as any)?.instanceId, currentProjectId, taskTreeFromStore, task]);
}

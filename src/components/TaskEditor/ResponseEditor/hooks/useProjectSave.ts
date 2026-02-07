// Please write clean, production-grade TypeScript code.
// Avoid non-ASCII characters, Chinese symbols, or multilingual output.

import { useEffect } from 'react';
import { saveTaskOnProjectSave } from '@responseEditor/features/persistence/ResponseEditorPersistence';
import { useTaskTreeFromStore } from '@responseEditor/core/state';
import type { Task, TaskTree } from '@types/taskTypes';

export interface UseProjectSaveParams {
  task?: Task | null;
  // ✅ FASE 3: taskTreeRef rimosso - store è single source of truth
  currentProjectId: string | null;
}

/**
 * Hook that saves changes when "Salva" is clicked in the project.
 *
 * ✅ FASE 3: Completamente migrato a Zustand store (single source of truth)
 * - Usa taskTreeFromStore come unica fonte
 * - Rimossi completamente taskTreeRef
 */
export function useProjectSave(params: UseProjectSaveParams) {
  const { task, currentProjectId } = params;

  // ✅ FASE 2.3: Use Zustand store as SINGLE source of truth
  const taskTreeFromStore = useTaskTreeFromStore();

  useEffect(() => {
    const handleProjectSave = async () => {
      // ✅ NO FALLBACKS: Use instanceId as primary, id as fallback (both are valid properties)
      if (task?.id ?? (task as any)?.instanceId) {
        const key = ((task as any)?.instanceId ?? task?.id) as string;
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

// useTaskInstance.ts
// Hook dedicato per caricare il Task completo dal repository
// Centralizza l'accesso al repository e fornisce uno stato reattivo

import React from 'react';
import { taskRepository } from '@services/TaskRepository';
import type { Task } from '@types/taskTypes';

interface UseTaskInstanceResult {
  task: Task | null;
  loading: boolean;
}

/**
 * Hook per caricare il Task completo dal repository
 *
 * @param instanceId - ID dell'istanza del task
 * @returns Task completo e stato di loading
 */
export function useTaskInstance(instanceId?: string): UseTaskInstanceResult {
  const [task, setTask] = React.useState<Task | null>(null);
  const [loading, setLoading] = React.useState(false);

  React.useEffect(() => {
    if (!instanceId) {
      setTask(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    // getTask è sincrono (Map lookup), ma lo wrappiamo in useEffect
    // per garantire che React gestisca correttamente lo stato
    try {
      const fullTask = taskRepository.getTask(instanceId);
      setTask(fullTask);
    } catch (error) {
      console.error('[useTaskInstance] Error loading task:', error);
      setTask(null);
    } finally {
      setLoading(false);
    }
  }, [instanceId]);

  return { task, loading };
}


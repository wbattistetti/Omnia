// Please write clean, production-grade TypeScript code.
// Avoid non-ASCII characters, Chinese symbols, or multilingual output.

import { useEffect } from 'react';

export interface UseEscalationTasksParams {
  setEscalationTasks: React.Dispatch<React.SetStateAction<any[]>>;
}

/**
 * Hook that loads tasks for escalation palette.
 */
export function useEscalationTasks(params: UseEscalationTasksParams) {
  const { setEscalationTasks } = params;

  useEffect(() => {
    fetch('/api/factory/tasks?taskType=Action')
      .then(res => {
        if (!res.ok) {
          console.warn('[ResponseEditor] Failed to load escalation tasks: HTTP', res.status);
          return [];
        }
        return res.json();
      })
      .then(templates => {
        if (!Array.isArray(templates)) {
          console.warn('[ResponseEditor] Invalid response format, expected array, got:', typeof templates, templates);
          setEscalationTasks([]);
          return;
        }

        const tasks = templates.map((template: any) => ({
          id: template.id || template._id,
          label: template.label || '',
          description: template.description || '',
          icon: template.icon || 'Circle',
          color: template.color || 'text-gray-500',
          params: template.structure || template.params || {},
          type: template.type,
          allowedContexts: template.allowedContexts || []
        }));

        setEscalationTasks(tasks);
      })
      .catch(err => {
        console.error('[ResponseEditor] Failed to load escalation tasks', err);
        setEscalationTasks([]);
      });
  }, [setEscalationTasks]);
}

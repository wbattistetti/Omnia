// Please write clean, production-grade TypeScript code.
// Avoid non-ASCII characters, Chinese symbols, or multilingual output.

import { useEffect } from 'react';
import { getNodeIdStrict, getNodeLabelStrict } from '@responseEditor/core/domain/nodeStrict';

export interface UseEscalationTasksParams {
  setEscalationTasks: React.Dispatch<React.SetStateAction<any[]>>;
}

/**
 * Hook that loads tasks for escalation palette.
 * Note: Templates from external API may have legacy structure (_id instead of id),
 * so we use try-catch fallback here. This is the ONLY place where fallback is allowed.
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

        const tasks = templates
          .map((template: any) => {
            // Templates from API might have legacy structure - extract id safely
            let templateId: string;
            try {
              templateId = getNodeIdStrict(template);
            } catch (error) {
              // Fallback for legacy API templates that might have _id
              templateId = template.id || template._id || '';
            }

            let templateLabel: string;
            try {
              templateLabel = getNodeLabelStrict(template);
            } catch (error) {
              // Fallback for legacy API templates
              templateLabel = template.label || template.name || '';
            }

            return {
              id: templateId,
              label: templateLabel,
              description: template.description || '',
              icon: template.icon || 'Circle',
              color: template.color || 'text-gray-500',
              params: template.structure || template.params || {},
              type: template.type,
              allowedContexts: template.allowedContexts || []
            };
          })
          .filter(task => task.id); // Filter out tasks without valid id

        setEscalationTasks(tasks);
      })
      .catch(err => {
        console.error('[ResponseEditor] Failed to load escalation tasks', err);
        setEscalationTasks([]);
      });
  }, [setEscalationTasks]);
}

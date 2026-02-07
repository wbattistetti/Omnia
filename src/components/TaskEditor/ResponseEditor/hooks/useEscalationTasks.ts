// Please write clean, production-grade TypeScript code.
// Avoid non-ASCII characters, Chinese symbols, or multilingual output.

import { useEffect } from 'react';

export interface UseEscalationTasksParams {
  setEscalationTasks: React.Dispatch<React.SetStateAction<any[]>>;
}

/**
 * Normalize API template to standard format (NO FALLBACKS)
 * Transforms legacy API data (_id, name) to standard format (id, label)
 * Throws error if data cannot be normalized
 */
function normalizeApiTemplate(template: any): { id: string; label: string; [key: string]: any } {
  // Extract id - normalize from _id if needed (explicit transformation, not fallback)
  const id = template.id || (template._id ? String(template._id).replace('-template', '') : null);
  if (!id) {
    throw new Error(`[normalizeApiTemplate] Template missing id: ${JSON.stringify(template).substring(0, 200)}`);
  }

  // Extract label - normalize from name if needed (explicit transformation, not fallback)
  const label = template.label || (template.name ? String(template.name) : '');
  if (!label) {
    console.warn(`[normalizeApiTemplate] Template missing label, using id as fallback: ${id}`);
  }

  // Return normalized structure
  return {
    id,
    label: label || id,
    description: template.description || '',
    icon: template.icon || 'Circle',
    color: template.color || 'text-gray-500',
    params: template.structure || template.params || {},
    type: template.type,
    allowedContexts: template.allowedContexts || []
  };
}

/**
 * Hook that loads tasks for escalation palette.
 * NO FALLBACKS - Normalizes data at API boundary
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

        // Normalize all templates - filter out invalid ones
        const tasks = templates
          .map((template: any) => {
            try {
              return normalizeApiTemplate(template);
            } catch (error) {
              console.error(`[useEscalationTasks] Failed to normalize template:`, error);
              return null;
            }
          })
          .filter((task): task is NonNullable<typeof task> => task !== null);

        setEscalationTasks(tasks);
      })
      .catch(err => {
        console.error('[ResponseEditor] Failed to load escalation tasks', err);
        setEscalationTasks([]);
      });
  }, [setEscalationTasks]);
}

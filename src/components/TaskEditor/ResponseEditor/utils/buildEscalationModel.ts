// Utility function to build EscalationModel from node
// Extracted from StepEditor to allow reuse in BehaviourEditor

export type EscalationModel = {
  tasks?: Array<{
    templateId?: string;
    id?: string;  // ✅ Standard: id (GUID univoco)
    text?: string;
    textKey?: string;
    icon?: string;
    label?: string;
    color?: string;
    parameters?: Array<{ parameterId: string; value: string }>
  }>;
};

export function buildEscalationModel(
  node: any,
  stepKey: string,
  translations: Record<string, string>
): EscalationModel[] {
  // ✅ Debug: log what we're reading from the node (only if debug flag is set)
  const shouldDebug = () => {
    try { return localStorage.getItem('debug.buildEscalationModel') === '1'; } catch { return false; }
  };

  if (shouldDebug()) {
    console.log('[DROP_DEBUG][buildEscalationModel] 🔍 Reading node', {
      stepKey,
      nodeLabel: node?.label,
      hasSteps: !!node?.steps,
      stepsType: Array.isArray(node?.steps) ? 'array' : (node?.steps ? 'object' : 'none'),
      stepExists: Array.isArray(node?.steps)
        ? node.steps.some((s: any) => s?.type === stepKey)
        : !!node?.steps?.[stepKey],
      escalationsCount: Array.isArray(node?.steps)
        ? node.steps.find((s: any) => s?.type === stepKey)?.escalations?.length
        : node?.steps?.[stepKey]?.escalations?.length
    });
  }

  // Case A: steps as object { start: { escalations: [...] } }
  if (node?.steps && !Array.isArray(node.steps) && node.steps[stepKey] && Array.isArray(node.steps[stepKey].escalations)) {
    const escs = node.steps[stepKey].escalations as any[];
    if (shouldDebug()) {
      console.log('[DROP_DEBUG][buildEscalationModel] ✅ Case A: steps as object', {
        escalationsCount: escs.length,
        tasksCount: escs.reduce((sum, esc) => sum + (esc.tasks?.length || 0), 0)
      });
    }
    const result = escs.map((esc, escIdx) => {
      const taskRefs = esc.tasks || [];
      const mappedTasks = taskRefs.map((task: any, taskIdx: number) => {
        // ✅ UNIFIED MODEL: Use task.id and task.params
        const textKey = task.params?.text || task.id;
        const hasDirectText = typeof task.text === 'string' && task.text.length > 0;
        const translationValue = typeof textKey === 'string' ? translations[textKey] : undefined;
        const text = hasDirectText
          ? task.text
          : (typeof textKey === 'string' ? (translationValue || textKey) : undefined);

        // ✅ Debug: log each task being processed (only if debug flag is set)
        if (shouldDebug() && escIdx === 0 && taskIdx === 0) {
          console.log('[DROP_DEBUG][buildEscalationModel] 🔍 Processing task', {
            escIdx,
            taskIdx,
            templateId: task.templateId,
            taskId: task.id,
            textKey,
            hasDirectText,
            translationValue: translationValue ? translationValue.substring(0, 50) : undefined,
            text: text ? text.substring(0, 50) : undefined,
            parameters: task.parameters,
            color: task.color,
            label: task.label
          });
        }

        // ✅ Only warn if textKey is a valid GUID but translation is missing
        // Don't warn for temporary taskIds or if task has direct text
        if (textKey && !translationValue && !hasDirectText) {
          const isGuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(textKey);
          // Only warn for valid GUIDs (not temporary taskIds like "task-123...")
          if (isGuid) {
            console.warn('[buildEscalationModel] ❌ Translation NOT FOUND', {
              stepKey,
              nodeLabel: node?.label,
              textKey,
              taskId: task.id,
              templateId: task.templateId,
              hasTaskText: hasDirectText
            });
          }
        }

        // ✅ CRITICAL: NO FALLBACK - type and templateId MUST be present
        if (task?.type === undefined || task?.type === null) {
          throw new Error(`[buildEscalationModel] Task is missing required field 'type'. Task: ${JSON.stringify(task, null, 2)}`);
        }

        if (task?.templateId === undefined) {
          throw new Error(`[buildEscalationModel] Task is missing required field 'templateId' (must be explicitly null for standalone tasks). Task: ${JSON.stringify(task, null, 2)}`);
        }

        return {
          type: task.type,  // ✅ NO FALLBACK - must be present
          templateId: task.templateId,  // ✅ NO FALLBACK - must be present (can be null)
          id: task.id,
          text,
          textKey,
          color: task.color,
          label: task.label
        };
      });

      if (shouldDebug()) {
        console.log('[DROP_DEBUG][buildEscalationModel] ✅ Escalation mapped', {
          escIdx,
          tasksCount: mappedTasks.length,
          tasks: mappedTasks.map(t => ({ templateId: t.templateId, id: t.id, hasText: !!t.text }))
        });
      }

      return { tasks: mappedTasks };
    });

    if (shouldDebug()) {
      console.log('[DROP_DEBUG][buildEscalationModel] ✅ Final result', {
        escalationsCount: result.length,
        totalTasks: result.reduce((sum, esc) => sum + (esc.tasks?.length || 0), 0)
      });
    }

    return result;
  }

  // Case B: steps as array [{ type: 'start', escalations: [...] }, ...]
  if (Array.isArray(node?.steps)) {
    const group = (node.steps as any[]).find((g: any) => (g?.type === stepKey));
    if (group && Array.isArray(group.escalations)) {
      if (shouldDebug()) {
        console.log('[DROP_DEBUG][buildEscalationModel] ✅ Case B: steps as array', {
          escalationsCount: group.escalations.length,
          tasksCount: group.escalations.reduce((sum: number, esc: any) => sum + (esc.tasks?.length || 0), 0)
        });
      }
      return (group.escalations as any[]).map((esc: any) => ({
        tasks: (esc.tasks || []).map((task: any) => {
          // ✅ CRITICAL: NO FALLBACK - type and templateId MUST be present
          if (task?.type === undefined || task?.type === null) {
            throw new Error(`[buildEscalationModel] Task is missing required field 'type'. Task: ${JSON.stringify(task, null, 2)}`);
          }

          if (task?.templateId === undefined) {
            throw new Error(`[buildEscalationModel] Task is missing required field 'templateId' (must be explicitly null for standalone tasks). Task: ${JSON.stringify(task, null, 2)}`);
          }

          const p = Array.isArray(task.parameters) ? task.parameters.find((x: any) => x?.parameterId === 'text') : undefined;
          const textKey = p?.value;
          const text = (typeof task.text === 'string' && task.text.length > 0)
            ? task.text
            : (typeof textKey === 'string' ? (translations[textKey] || textKey) : undefined);

          return {
            type: task.type,  // ✅ NO FALLBACK - must be present
            templateId: task.templateId,  // ✅ NO FALLBACK - must be present (can be null)
            id: task.id,
            text,
            textKey,
            color: task.color,
            label: task.label
          };
        })
      }));
    }
  }

  // Fallback synthetic step from messages
  const msg = node?.messages?.[stepKey];
  if (msg && typeof msg.textKey === 'string') {
    const textKey = msg.textKey;
    const translationValue = translations[textKey];
    const text = translationValue || textKey;
    // ✅ CRITICAL: Synthetic tasks must have type and templateId
    const { TaskType, templateIdToTaskType } = require('../../../../types/taskTypes');
    const templateId = 'sayMessage';
    const taskType = templateIdToTaskType(templateId);
    if (taskType === TaskType.UNDEFINED) {
      throw new Error(`[buildEscalationModel] Cannot determine task type from templateId '${templateId}' for synthetic step.`);
    }
    return [
      {
        tasks: [{
          type: taskType,  // ✅ NO FALLBACK - must be present
          templateId: templateId,  // ✅ NO FALLBACK - must be present
          id: `task-${Date.now()}`,
          parameters: textKey ? [{ parameterId: 'text', value: textKey }] : [],
          text,
          textKey
        }]
      }
    ];
  }

  return [];
}


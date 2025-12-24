// Utility function to build EscalationModel from node
// Extracted from StepEditor to allow reuse in BehaviourEditor

export type EscalationModel = {
  tasks?: Array<{
    templateId?: string;
    taskId?: string;
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
  // Case A: steps as object { start: { escalations: [...] } }
  if (node?.steps && !Array.isArray(node.steps) && node.steps[stepKey] && Array.isArray(node.steps[stepKey].escalations)) {
    const escs = node.steps[stepKey].escalations as any[];
    return escs.map((esc) => {
      const taskRefs = esc.tasks || esc.actions || [];
      return {
        tasks: taskRefs.map((task: any) => {
          const p = Array.isArray(task.parameters) ? task.parameters.find((x: any) => x?.parameterId === 'text') : undefined;
          const textKey = p?.value || task.taskId;
          const hasDirectText = typeof task.text === 'string' && task.text.length > 0;
          const translationValue = typeof textKey === 'string' ? translations[textKey] : undefined;
          const text = hasDirectText
            ? task.text
            : (typeof textKey === 'string' ? (translationValue || textKey) : undefined);

          if (textKey && !translationValue && !hasDirectText) {
            const isGuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(textKey);
            console.warn('[buildEscalationModel] ❌ Translation NOT FOUND', {
              stepKey,
              nodeLabel: node?.label,
              textKey,
              isGuid,
              taskId: task.taskId,
              templateId: task.templateId,
              hasTaskText: hasDirectText
            });
          }

          return { templateId: task.templateId, taskId: task.taskId, text, textKey, color: task.color, label: task.label };
        })
      };
    });
  }

  // Case B: steps as array [{ type: 'start', escalations: [...] }, ...]
  if (Array.isArray(node?.steps)) {
    const group = (node.steps as any[]).find((g: any) => (g?.type === stepKey));
    if (group && Array.isArray(group.escalations)) {
      return (group.escalations as any[]).map((esc: any) => ({
        tasks: (esc.tasks || esc.actions || []).map((task: any) => {
          const p = Array.isArray(task.parameters) ? task.parameters.find((x: any) => x?.parameterId === 'text') : undefined;
          const textKey = p?.value;
          const text = (typeof task.text === 'string' && task.text.length > 0)
            ? task.text
            : (typeof textKey === 'string' ? (translations[textKey] || textKey) : undefined);
          return { templateId: task.templateId, taskId: task.taskId, text, textKey, color: task.color, label: task.label };
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
    return [
      {
        tasks: [{ templateId: 'sayMessage', taskId: `task-${Date.now()}`, parameters: textKey ? [{ parameterId: 'text', value: textKey }] : [], text, textKey }]
      }
    ];
  }

  return [];
}


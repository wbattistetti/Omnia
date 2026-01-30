// Helper function to check if a DDT has messages for ProblemClassification
// ✅ CORRETTO: Legge da task.steps[nodeId] (unica fonte di verità), NON da ddt.steps[nodeId]
// Gli steps vivono solo in task.steps, il DDT contiene solo la struttura

export function hasIntentMessages(ddt: any, task?: any): boolean {
  if (!ddt) {
    return false;
  }

  // ✅ NUOVO MODELLO: Usa nodes[] invece di data[]
  const mainList = Array.isArray(ddt.nodes) ? ddt.nodes : [];
  const firstMain = mainList[0];

  if (!firstMain || !firstMain.id) {
    return false;
  }

  // ✅ CRITICAL: Leggi steps usando templateId come chiave (non id)
  // task.steps[node.templateId] = steps clonati
  const firstMainTemplateId = firstMain.templateId || firstMain.id; // ✅ Fallback a id se templateId non presente
  const steps = (task?.steps && task.steps[firstMainTemplateId]) || {};

  // Required steps for intent classification
  const requiredSteps = ['start', 'noInput', 'noMatch', 'confirmation'];

  // Check if each required step has at least one escalation with a message
  for (const stepKey of requiredSteps) {
    const step = steps[stepKey];
    if (!step) {
      return false;
    }

    const escalations = Array.isArray(step.escalations) ? step.escalations : [];
    if (escalations.length === 0) {
      return false;
    }

    // Check if at least one escalation has a task with a text value
    const hasMessage = escalations.some((esc: any) => {
      const tasks = Array.isArray(esc.tasks) ? esc.tasks : [];
      return tasks.some((task: any) => {
        const params = Array.isArray(task.parameters) ? task.parameters : [];
        return params.some((param: any) => {
          // Can be direct text value or textKey
          return param.value || param.textKey;
        });
      });
    });

    if (!hasMessage) {
      return false;
    }
  }

  return true;
}


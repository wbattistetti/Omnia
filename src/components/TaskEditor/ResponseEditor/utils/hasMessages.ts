// Helper function to check if a DDT has messages for ProblemClassification
// ✅ CORRETTO: Legge da task.steps[nodeId] (unica fonte di verità), NON da ddt.steps[nodeId]
// Gli steps vivono solo in task.steps, il DDT contiene solo la struttura

export function hasIntentMessages(ddt: any, task?: any): boolean {
  if (!ddt) {
    return false;
  }

  // ✅ Verifica che ci sia mainData[0] con id
  const mainList = Array.isArray(ddt.mainData) ? ddt.mainData : [];
  const firstMain = mainList[0];

  if (!firstMain || !firstMain.id) {
    return false;
  }

  // ✅ CORRETTO: Leggi steps da task.steps[nodeId], NON da ddt.steps[nodeId]
  const firstMainId = firstMain.id;
  const steps = (task?.steps && task.steps[firstMainId]) || {};

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


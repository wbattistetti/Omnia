// Helper function to check if a DDT has messages for ProblemClassification
// For ProblemClassification, messages are stored in mainData[0].steps when kind === "intent"

export function hasIntentMessages(ddt: any): boolean {
  if (!ddt) {
    return false;
  }

  // ✅ Leggi kind da mainData[0].kind
  const mainList = Array.isArray(ddt.mainData) ? ddt.mainData : [];
  const firstMain = mainList[0];

  // Verifica che il primo mainData abbia kind === "intent"
  if (!firstMain || firstMain.kind !== 'intent') {
    return false;
  }

  // ✅ Leggi steps da mainData[0].steps
  const steps = firstMain.steps || {};

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


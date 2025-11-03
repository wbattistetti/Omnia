// Helper function to check if a DDT has messages for ProblemClassification
// For ProblemClassification, we need to check if steps (start, noInput, noMatch, confirmation) have escalations with messages

export function hasIntentMessages(ddt: any): boolean {
  if (!ddt) return false;

  // For ProblemClassification, messages should be at root level (no mainData structure)
  // Steps are usually at ddt.steps or ddt.root?.steps
  const steps = ddt.steps || ddt.root?.steps || {};

  // Required steps for intent classification
  const requiredSteps = ['start', 'noInput', 'noMatch', 'confirmation'];

  // Check if each required step has at least one escalation with a message
  for (const stepKey of requiredSteps) {
    const step = steps[stepKey];
    if (!step) return false;

    const escalations = Array.isArray(step.escalations) ? step.escalations : [];
    if (escalations.length === 0) return false;

    // Check if at least one escalation has an action with a text value
    const hasMessage = escalations.some((esc: any) => {
      const actions = Array.isArray(esc.actions) ? esc.actions : [];
      return actions.some((action: any) => {
        const params = Array.isArray(action.parameters) ? action.parameters : [];
        return params.some((param: any) => {
          // Can be direct text value or textKey
          return param.value || param.textKey;
        });
      });
    });

    if (!hasMessage) return false;
  }

  return true;
}


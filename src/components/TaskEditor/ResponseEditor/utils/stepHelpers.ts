/**
 * Estrae le escalations da un node per uno step specifico
 */
export function getEscalationsFromStep(node: any, stepKey: string): any[] {
  if (!node?.steps) return [{ tasks: [] }];

  if (Array.isArray(node.steps)) {
    const step = node.steps.find((s: any) => s?.type === stepKey);
    const esc = step?.escalations || [];
    return esc.length > 0 ? esc : [{ tasks: [] }];
  }

  if (node.steps[stepKey]) {
    const esc = node.steps[stepKey].escalations || [];
    return esc.length > 0 ? esc : [{ tasks: [] }];
  }

  return [{ tasks: [] }];
}

/**
 * Aggiorna le escalations di uno step in un node
 */
export function updateStepEscalations(
  node: any,
  stepKey: string,
  updater: (escalations: any[]) => any[]
): any {
  const next = { ...node };

  if (Array.isArray(node.steps)) {
    const stepIdx = node.steps.findIndex((s: any) => s?.type === stepKey);
    if (stepIdx >= 0) {
      next.steps = [...node.steps];
      const step = next.steps[stepIdx];
      const escalations = updater([...(step.escalations || [])]);
      next.steps[stepIdx] = { ...step, escalations };
    } else {
      // Step non esiste, crealo
      const escalations = updater([]);
      next.steps = [...(node.steps || []), { type: stepKey, escalations }];
    }
  } else {
    next.steps = { ...(node.steps || {}) };
    const escalations = updater([...(next.steps[stepKey]?.escalations || [])]);
    next.steps[stepKey] = { type: stepKey, escalations };
  }

  return next;
}

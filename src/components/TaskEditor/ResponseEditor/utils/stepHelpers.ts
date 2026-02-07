import { v4 as uuidv4 } from 'uuid';

/**
 * Estrae le escalations da un node per uno step specifico
 */
export function getEscalationsFromStep(node: any, stepKey: string): any[] {
  if (!node?.steps) return [{ tasks: [] }];

  if (Array.isArray(node.steps)) {
    // ✅ NUOVO MODELLO: Array MaterializedStep[]
    // Cerca step per type diretto (se presente per retrocompatibilità)
    let step = node.steps.find((s: any) => s?.type === stepKey);

    // Se non trovato, estrai tipo da templateStepId (formato: `${nodeTemplateId}:${stepKey}`)
    if (!step) {
      step = node.steps.find((s: any) => {
        if (!s?.templateStepId) return false;
        // Estrai il tipo step da templateStepId (ultima parte dopo ':')
        const stepType = s.templateStepId.split(':').pop();
        return stepType === stepKey;
      });
    }

    const esc = step?.escalations || [];
    return esc.length > 0 ? esc : [{ tasks: [] }];
  }

  // ✅ RETROCOMPATIBILITÀ: Gestisce formato dictionary legacy
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
    // ✅ NUOVO MODELLO: Array MaterializedStep[]
    // Cerca step per type diretto (se presente per retrocompatibilità)
    let stepIdx = node.steps.findIndex((s: any) => s?.type === stepKey);

    // Se non trovato, estrai tipo da templateStepId (formato: `${nodeTemplateId}:${stepKey}`)
    if (stepIdx < 0) {
      stepIdx = node.steps.findIndex((s: any) => {
        if (!s?.templateStepId) return false;
        // Estrai il tipo step da templateStepId (ultima parte dopo ':')
        const stepType = s.templateStepId.split(':').pop();
        return stepType === stepKey;
      });
    }

    if (stepIdx >= 0) {
      // Step esiste, aggiorna le escalations
      next.steps = [...node.steps];
      const step = next.steps[stepIdx];
      const escalations = updater([...(step.escalations || [])]);
      next.steps[stepIdx] = { ...step, escalations };
    } else {
      // Step non esiste, crealo con struttura MaterializedStep corretta
      const escalations = updater([]);
      // After validation strict, node.id is always present
      // templateId is optional (preferred for lookup, but id works as fallback)
      const nodeTemplateId = node.templateId ?? node.id;
      const templateStepId = `${nodeTemplateId}:${stepKey}`;
      const newStep = {
        id: uuidv4(), // Nuovo GUID per l'istanza
        templateStepId, // Riferimento al template step
        escalations
      };
      // ✅ NO FALLBACKS: node.steps must exist as array after validation
      if (!Array.isArray(node.steps)) {
        throw new Error('[updateStepEscalations] node.steps must be an array in MaterializedStep format. This should have been caught by validation.');
      }
      next.steps = [...node.steps, newStep];
    }
  } else {
    // ✅ RETROCOMPATIBILITÀ: Gestisce formato dictionary legacy
    // ✅ NO FALLBACKS: node.steps must exist as dictionary after validation
    if (!node.steps || typeof node.steps !== 'object' || Array.isArray(node.steps)) {
      throw new Error('[updateStepEscalations] node.steps must be a dictionary. This should have been caught by validation.');
    }
    next.steps = { ...node.steps };
    const escalations = updater([...(next.steps[stepKey]?.escalations || [])]);
    next.steps[stepKey] = { type: stepKey, escalations };
  }

  return next;
}

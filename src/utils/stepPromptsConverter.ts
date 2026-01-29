/**
 * Helper per convertire steps (formato legacy) in steps (formato nuovo)
 *
 * Formato steps (legacy):
 * {
 *   start: ['template.time.start.prompt1', 'template.time.start.prompt2'],
 *   noMatch: ['template.time.noMatch.prompt1'],
 *   noInput: ['template.time.noInput.prompt1'],
 *   ...
 * }
 *
 * Formato steps (nuovo):
 * {
 *   "nodeId": {
 *     start: {
 *       type: 'start',
 *       escalations: [
 *         { tasks: [{ id: 'guid1', type: 1, text: 'guid1' }] },
 *         { tasks: [{ id: 'guid2', type: 1, text: 'guid2' }] }
 *       ]
 *     },
 *     noMatch: { ... },
 *     ...
 *   }
 * }
 */

import { v4 as uuidv4 } from 'uuid';

/**
 * Estrae le chiavi di traduzione da steps (formato nuovo) per un nodo specifico
 *
 * @param steps - Formato nuovo: { "nodeId": { start: {...}, noMatch: {...}, ... } }
 * @param nodeId - ID del nodo da cui estrarre le chiavi
 * @returns Formato legacy compatibile: { start: ['key1', 'key2'], noMatch: ['key3'], ... }
 */
export function extractTranslationKeysFromSteps(
  steps: Record<string, any> | undefined,
  nodeId: string
): Record<string, string[]> | null {
  if (!steps || typeof steps !== 'object') {
    return null;
  }

  const nodeSteps = steps[nodeId];
  if (!nodeSteps || typeof nodeSteps !== 'object') {
    return null;
  }

  const result: Record<string, string[]> = {};
  const stepTypes = ['start', 'noMatch', 'noInput', 'confirmation', 'notConfirmed', 'success', 'introduction'];

  for (const stepType of stepTypes) {
    const step = nodeSteps[stepType];
    if (step && step.escalations && Array.isArray(step.escalations)) {
      const keys: string[] = [];

      for (const escalation of step.escalations) {
        if (escalation.tasks && Array.isArray(escalation.tasks)) {
          for (const task of escalation.tasks) {
            // Estrai la chiave di traduzione dal campo text (può essere una chiave o un GUID)
            if (task.text && typeof task.text === 'string') {
              // Se inizia con 'template.' è una chiave di traduzione, altrimenti è un GUID
              if (task.text.startsWith('template.')) {
                keys.push(task.text);
              }
            }
          }
        }
      }

      if (keys.length > 0) {
        result[stepType] = keys;
      }
    }
  }

  return Object.keys(result).length > 0 ? result : null;
}

/**
 * Converte steps (legacy) in steps (nuovo formato)
 *
 * @param steps - Formato legacy: { start: ['key1', 'key2'], noMatch: ['key3'], ... }
 * @param nodeId - ID del nodo (templateId) da usare come chiave nel formato steps
 * @returns Formato nuovo: { "nodeId": { start: {...}, noMatch: {...}, ... } }
 */
export function convertstepsToSteps(
  steps: any,
  nodeId: string
): Record<string, any> | undefined {
  if (!steps || typeof steps !== 'object') {
    return undefined;
  }

  const steps: Record<string, any> = {};
  const stepTypes = ['start', 'noMatch', 'noInput', 'confirmation', 'notConfirmed', 'success', 'introduction'];

  for (const stepType of stepTypes) {
    const stepsArray = steps[stepType];

    if (Array.isArray(stepsArray) && stepsArray.length > 0) {
      // Crea escalations basate sul numero di chiavi in steps
      const escalations = stepsArray.map((translationKey: string) => {
        // Genera un GUID per ogni escalation
        const taskId = uuidv4();

        return {
          tasks: [{
            id: taskId,
            type: 1, // SayMessage
            text: translationKey // La chiave di traduzione viene risolta a runtime
          }]
        };
      });

      steps[stepType] = {
        type: stepType,
        escalations
      };
    }
  }

  // Se non ci sono steps, ritorna undefined
  if (Object.keys(steps).length === 0) {
    return undefined;
  }

  // Ritorna nel formato steps: { "nodeId": { start: {...}, noMatch: {...}, ... } }
  return {
    [nodeId]: steps
  };
}

/**
 * Converte steps da un template in steps e li unisce con steps esistenti
 *
 * @param template - Template con potenzialmente steps e/o steps
 * @returns Template con steps convertiti (steps rimosso se presente)
 */
export function normalizeTemplateSteps(template: any): any {
  if (!template) {
    return template;
  }

  const nodeId = template.id || template._id;
  if (!nodeId) {
    // Se non c'è nodeId, non possiamo convertire
    return template;
  }

  // Se il template ha già steps nel formato corretto, usali
  if (template.steps && typeof template.steps === 'object') {
    // Verifica se steps è già nel formato corretto (chiavi = nodeId)
    const stepsKeys = Object.keys(template.steps);
    const hasCorrectFormat = stepsKeys.some(key =>
      key === nodeId || /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(key)
    );

    if (hasCorrectFormat) {
      // Steps già nel formato corretto, rimuovi solo steps se presente
      const { steps, ...rest } = template;
      return rest;
    }
  }

  // Se il template ha steps, convertili in steps
  if (template.steps) {
    const convertedSteps = convertstepsToSteps(template.steps, nodeId);

    // Unisci con steps esistenti (se presenti)
    const mergedSteps = {
      ...(template.steps || {}),
      ...(convertedSteps || {})
    };

    // Rimuovi steps e sostituisci con steps convertiti
    const { steps, ...rest } = template;
    return {
      ...rest,
      steps: Object.keys(mergedSteps).length > 0 ? mergedSteps : undefined
    };
  }

  // Se non c'è né steps né steps, ritorna il template così com'è
  return template;
}

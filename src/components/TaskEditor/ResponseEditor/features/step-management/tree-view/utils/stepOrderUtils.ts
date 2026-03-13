/**
 * Calcola la posizione corretta per inserire un nuovo step
 */
export function calculateStepInsertionPosition(
  newStepKey: string,
  existingStepKeys: string[]
): number {
  const order = ['start', 'introduction', 'noInput', 'noMatch', 'confirmation', 'notConfirmed', 'invalid', 'success'];

  const newStepOrder = order.indexOf(newStepKey);
  if (newStepOrder === -1) {
    // Step non ordinato, inserisci alla fine
    return existingStepKeys.length;
  }

  // Trova la posizione corretta basata sull'ordine
  for (let i = 0; i < existingStepKeys.length; i++) {
    const existingOrder = order.indexOf(existingStepKeys[i]);
    if (existingOrder > newStepOrder) {
      return i;
    }
  }

  return existingStepKeys.length;
}

/**
 * Verifica se uno step può essere aggiunto (evita duplicati)
 */
export function canAddStep(stepKey: string, existingStepKeys: string[]): boolean {
  // Start è sempre presente e non può essere duplicato
  if (stepKey === 'start') {
    return false;
  }

  return !existingStepKeys.includes(stepKey);
}

/**
 * Ottiene lista step disponibili per l'aggiunta
 */
export function getAvailableSteps(existingStepKeys: string[]): string[] {
  const allSteps = ['noInput', 'noMatch', 'confirmation', 'invalid', 'notConfirmed'];
  return allSteps.filter(step => canAddStep(step, existingStepKeys));
}

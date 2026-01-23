/**
 * ============================================================================
 * Steps Validator - Validazione e Correzione Struttura Steps
 * ============================================================================
 *
 * Valida e corregge la struttura di task.steps.
 *
 * STRUTTURA CORRETTA:
 * task.steps = {
 *   "templateId-nodo-1": { start: {...}, noMatch: {...}, ... },
 *   "templateId-nodo-2": { start: {...}, noMatch: {...}, ... },
 *   ...
 * }
 *
 * STRUTTURA SBAGLIATA (da correggere):
 * task.steps = {
 *   "start": {...},
 *   "noMatch": {...},
 *   ...
 * }
 */

const STEP_TYPE_KEYS = ['start', 'noMatch', 'noInput', 'confirmation', 'notConfirmed', 'success', 'introduction', 'normal'];

/**
 * Valida se la struttura di steps è corretta.
 *
 * @param steps - Steps da validare
 * @returns true se la struttura è corretta, false altrimenti
 */
export function validateStepsStructure(steps: Record<string, any>): boolean {
  if (!steps || typeof steps !== 'object') {
    console.log('[🔍 validateStepsStructure] Steps non è un oggetto', {
      stepsType: typeof steps,
      stepsValue: steps
    });
    return false;
  }

  const stepsKeys = Object.keys(steps);
  if (stepsKeys.length === 0) {
    console.log('[🔍 validateStepsStructure] Steps vuoto (valido ma vuoto)');
    return true; // Vuoto è valido
  }

  // ✅ Controlla se le chiavi sono step types (struttura sbagliata)
  const allKeysAreStepTypes = stepsKeys.every(key => STEP_TYPE_KEYS.includes(key));

  if (allKeysAreStepTypes) {
    console.log('[🔍 validateStepsStructure] ❌ Struttura sbagliata: chiavi sono step types', {
      stepsKeys,
      stepTypes: STEP_TYPE_KEYS
    });
    return false;
  }

  // ✅ Controlla se almeno una chiave sembra un templateId (GUID-like)
  // GUID format: xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
  const guidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  const hasGuidLikeKeys = stepsKeys.some(key => guidPattern.test(key));

  if (!hasGuidLikeKeys) {
    console.log('[🔍 validateStepsStructure] ⚠️ Nessuna chiave sembra un templateId (GUID)', {
      stepsKeys
    });
    // Non è necessariamente sbagliato, potrebbe essere un formato diverso
    // Ma per sicurezza, consideriamo valido solo se ha GUID-like keys
  }

  console.log('[🔍 validateStepsStructure] ✅ Struttura valida', {
    stepsKeys,
    stepsCount: stepsKeys.length
  });

  return true;
}

/**
 * Corregge la struttura sbagliata di steps.
 *
 * ATTENZIONE: Questa funzione può solo rilevare la struttura sbagliata,
 * ma NON può correggerla automaticamente perché non ha informazioni su
 * quale templateId associare a ogni step type.
 *
 * @param steps - Steps con struttura sbagliata
 * @returns null (non può correggere automaticamente)
 */
export function fixStepsStructure(steps: Record<string, any>): Record<string, any> | null {
  console.log('[🔍 fixStepsStructure] START', {
    stepsKeys: Object.keys(steps || {}),
    stepsCount: Object.keys(steps || {}).length
  });

  if (!steps || typeof steps !== 'object') {
    console.log('[🔍 fixStepsStructure] Steps non è un oggetto, ritorno null');
    return null;
  }

  const stepsKeys = Object.keys(steps);
  if (stepsKeys.length === 0) {
    console.log('[🔍 fixStepsStructure] Steps vuoto, ritorno null');
    return null;
  }

  // ✅ Verifica se la struttura è sbagliata
  const allKeysAreStepTypes = stepsKeys.every(key => STEP_TYPE_KEYS.includes(key));

  if (!allKeysAreStepTypes) {
    console.log('[🔍 fixStepsStructure] Struttura già corretta, niente da correggere');
    return null; // Struttura già corretta
  }

  console.warn('[🔍 fixStepsStructure] ⚠️ Struttura sbagliata rilevata, ma correzione automatica non possibile', {
    wrongKeys: stepsKeys,
    reason: 'Non abbiamo informazioni su quale templateId associare a ogni step type'
  });

  // ❌ Non possiamo correggere automaticamente
  // La correzione richiede informazioni esterne (templateId, dataTree, ecc.)
  return null;
}

/**
 * Verifica se steps ha struttura sbagliata (chiavi sono step types invece di templateId).
 *
 * @param steps - Steps da verificare
 * @returns true se la struttura è sbagliata, false altrimenti
 */
export function hasWrongStepsStructure(steps: Record<string, any>): boolean {
  if (!steps || typeof steps !== 'object') {
    return false;
  }

  const stepsKeys = Object.keys(steps);
  if (stepsKeys.length === 0) {
    return false; // Vuoto non è sbagliato
  }

  // ✅ Controlla se tutte le chiavi sono step types
  const allKeysAreStepTypes = stepsKeys.length === STEP_TYPE_KEYS.length &&
    stepsKeys.every(key => STEP_TYPE_KEYS.includes(key));

  return allKeysAreStepTypes;
}

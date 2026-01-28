/**
 * Task Semantics Helper
 *
 * Deduce la semantica del task dalla struttura data:
 * - Atomic: 1 data, nessun subTasks
 * - CompositeData: 1 data, con subTasks
 * - Collection: N data, nessun subTasks nei data
 *
 * La semantica è dedotta dalla struttura, non da campi espliciti.
 * Questo garantisce coerenza e retrocompatibilità.
 */

/**
 * Deduce la semantica del task dalla struttura data
 *
 * @param ddt - DDT instance o template con data
 * @returns 'Atomic' | 'CompositeData' | 'Collection'
 * @throws Error se la struttura è invalida (es. Collection con subData)
 */
export function getTaskSemantics(ddt: any): 'Atomic' | 'CompositeData' | 'Collection' {
  // Normalizza data a array
  const dataList = Array.isArray(ddt.data)
    ? ddt.data
    : ddt.data
    ? [ddt.data]
    : [];

  // Atomic: 1 data, nessun subTasks
  if (dataList.length === 1 && !dataList[0].subTasks?.length) {
    return 'Atomic';
  }

  // CompositeData: 1 data, con subTasks
  if (dataList.length === 1 && dataList[0].subTasks?.length > 0) {
    return 'CompositeData';
  }

  // Collection: N data, nessun subTasks nei data
  if (dataList.length > 1) {
    // Validazione: Collection non può avere subTasks
    const hasSubData = dataList.some(m => m.subTasks?.length > 0);
    if (hasSubData) {
      throw new Error('Collection cannot have data with subTasks');
    }
    return 'Collection';
  }

  // Default: Atomic
  return 'Atomic';
}

/**
 * Valida la struttura del task secondo le regole semantiche
 *
 * @param ddt - DDT instance o template con data
 * @returns true se valida, false altrimenti
 */
export function validateTaskStructure(ddt: any): { valid: boolean; error?: string } {
  try {
    const semantics = getTaskSemantics(ddt);

    // Validazione: massimo 2 livelli (data → subTasks)
    const dataList = Array.isArray(ddt.data)
      ? ddt.data
      : ddt.data ? [ddt.data] : [];

    for (const main of dataList) {
      if (main.subTasks && Array.isArray(main.subTasks)) {
        for (const sub of main.subTasks) {
          // Verifica che non ci siano sub-subTasks (terzo livello)
          if (sub.subTasks && Array.isArray(sub.subTasks) && sub.subTasks.length > 0) {
            return {
              valid: false,
              error: 'Maximum 2 levels allowed (data → subTasks). Cannot have sub-subTasks.'
            };
          }
        }
      }
    }

    return { valid: true };
  } catch (error: any) {
    return {
      valid: false,
      error: error.message || 'Invalid task structure'
    };
  }
}

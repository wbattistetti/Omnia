/**
 * Task Semantics Helper
 *
 * Deduce la semantica del task dalla struttura data:
 * - Atomic: 1 data, nessun subData
 * - CompositeData: 1 data, con subData
 * - Collection: N data, nessun subData nei data
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

  // Atomic: 1 data, nessun subData
  if (dataList.length === 1 && !dataList[0].subData?.length) {
    return 'Atomic';
  }

  // CompositeData: 1 data, con subData
  if (dataList.length === 1 && dataList[0].subData?.length > 0) {
    return 'CompositeData';
  }

  // Collection: N data, nessun subData nei data
  if (dataList.length > 1) {
    // Validazione: Collection non può avere subData
    const hasSubData = dataList.some(m => m.subData?.length > 0);
    if (hasSubData) {
      throw new Error('Collection cannot have data with subData');
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

    // Validazione: massimo 2 livelli (data → subData)
    const dataList = Array.isArray(ddt.data)
      ? ddt.data
      : ddt.data ? [ddt.data] : [];

    for (const main of dataList) {
      if (main.subData && Array.isArray(main.subData)) {
        for (const sub of main.subData) {
          // Verifica che non ci siano sub-subData (terzo livello)
          if (sub.subData && Array.isArray(sub.subData) && sub.subData.length > 0) {
            return {
              valid: false,
              error: 'Maximum 2 levels allowed (data → subData). Cannot have sub-subData.'
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

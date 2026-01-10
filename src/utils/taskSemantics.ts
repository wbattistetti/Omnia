/**
 * Task Semantics Helper
 *
 * Deduce la semantica del task dalla struttura mainData:
 * - Atomic: 1 mainData, nessun subData
 * - CompositeData: 1 mainData, con subData
 * - Collection: N mainData, nessun subData nei mainData
 *
 * La semantica è dedotta dalla struttura, non da campi espliciti.
 * Questo garantisce coerenza e retrocompatibilità.
 */

/**
 * Deduce la semantica del task dalla struttura mainData
 *
 * @param ddt - DDT instance o template con mainData
 * @returns 'Atomic' | 'CompositeData' | 'Collection'
 * @throws Error se la struttura è invalida (es. Collection con subData)
 */
export function getTaskSemantics(ddt: any): 'Atomic' | 'CompositeData' | 'Collection' {
  // Normalizza mainData a array
  const mainDataList = Array.isArray(ddt.mainData)
    ? ddt.mainData
    : ddt.mainData
    ? [ddt.mainData]
    : [];

  // Atomic: 1 mainData, nessun subData
  if (mainDataList.length === 1 && !mainDataList[0].subData?.length) {
    return 'Atomic';
  }

  // CompositeData: 1 mainData, con subData
  if (mainDataList.length === 1 && mainDataList[0].subData?.length > 0) {
    return 'CompositeData';
  }

  // Collection: N mainData, nessun subData nei mainData
  if (mainDataList.length > 1) {
    // Validazione: Collection non può avere subData
    const hasSubData = mainDataList.some(m => m.subData?.length > 0);
    if (hasSubData) {
      throw new Error('Collection cannot have mainData with subData');
    }
    return 'Collection';
  }

  // Default: Atomic
  return 'Atomic';
}

/**
 * Valida la struttura del task secondo le regole semantiche
 *
 * @param ddt - DDT instance o template con mainData
 * @returns true se valida, false altrimenti
 */
export function validateTaskStructure(ddt: any): { valid: boolean; error?: string } {
  try {
    const semantics = getTaskSemantics(ddt);

    // Validazione: massimo 2 livelli (mainData → subData)
    const mainDataList = Array.isArray(ddt.mainData)
      ? ddt.mainData
      : ddt.mainData ? [ddt.mainData] : [];

    for (const main of mainDataList) {
      if (main.subData && Array.isArray(main.subData)) {
        for (const sub of main.subData) {
          // Verifica che non ci siano sub-subData (terzo livello)
          if (sub.subData && Array.isArray(sub.subData) && sub.subData.length > 0) {
            return {
              valid: false,
              error: 'Maximum 2 levels allowed (mainData → subData). Cannot have sub-subData.'
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

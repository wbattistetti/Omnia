export function isDDTEmpty(ddt?: any): boolean {
  try {
    if (!ddt || typeof ddt !== 'object') return true;
    const mains: any[] = Array.isArray(ddt?.mainData)
      ? ddt.mainData
      : (Array.isArray(ddt?.mains) ? ddt.mains : []);
    // Se esiste la struttura (mainData/mains), non è vuoto
    return mains.length === 0;
  } catch {
    return true;
  }
}

/**
 * Verifica se il DDT ha mainData ma senza steps completi
 * ✅ MODIFICATO: Controlla task.steps a root level (collegato tramite nodeId), non mainData[].stepPrompts
 * Questo indica che la struttura esiste ma i messaggi devono ancora essere generati
 */
export function hasMainDataButNoStepPrompts(ddt?: any): boolean {
  try {
    if (!ddt || typeof ddt !== 'object') return false;
    const mains: any[] = Array.isArray(ddt?.mainData)
      ? ddt.mainData
      : (Array.isArray(ddt?.mains) ? ddt.mains : []);

    if (mains.length === 0) return false;

    // ✅ MODIFICATO: Controlla steps a ROOT LEVEL, non dentro mainData
    // steps è un oggetto con chiavi = nodeId (GUID del mainData/subData)
    if (!ddt.steps || typeof ddt.steps !== 'object') {
      return true; // Non ha steps a root level
    }

    const rootStepsKeys = Object.keys(ddt.steps);
    if (rootStepsKeys.length === 0) {
      return true; // steps è vuoto
    }

    // Verifica se almeno un mainData ha steps corrispondenti
    // (collegati tramite nodeId come chiave)
    return mains.some((main: any) => {
      const mainId = main.id;
      if (!mainId) return true; // Main senza ID non può avere steps

      const mainSteps = ddt.steps[mainId];
      if (!mainSteps || typeof mainSteps !== 'object') {
        return true; // Questo main non ha steps
      }

      const stepKeys = Object.keys(mainSteps);
      if (stepKeys.length === 0) {
        return true; // steps per questo main è vuoto
      }

      // Verifica se almeno uno step ha escalations con tasks
      const hasMessages = stepKeys.some((stepKey: string) => {
        const step = mainSteps[stepKey];
        if (!step || !step.escalations || !Array.isArray(step.escalations)) {
          return false;
        }
        // Verifica se almeno una escalation ha tasks
        return step.escalations.some((esc: any) =>
          esc.tasks && Array.isArray(esc.tasks) && esc.tasks.length > 0
        );
      });

      return !hasMessages;
    });
  } catch {
    return false;
  }
}



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
 * ✅ CORRETTO: Legge da task.steps[nodeId] (unica fonte di verità), NON da ddt.steps[nodeId]
 * Gli steps vivono solo in task.steps, il DDT contiene solo la struttura
 * Questo indica che la struttura esiste ma i messaggi devono ancora essere generati
 */
export function hasMainDataButNoStepPrompts(ddt?: any, task?: any): boolean {
  try {
    if (!ddt || typeof ddt !== 'object') return false;
    const mains: any[] = Array.isArray(ddt?.mainData)
      ? ddt.mainData
      : (Array.isArray(ddt?.mains) ? ddt.mains : []);

    if (mains.length === 0) return false;

    // ✅ CORRETTO: Leggi da task.steps[nodeId], NON da ddt.steps[nodeId]
    // Gli steps vivono solo in task.steps, il DDT contiene solo la struttura
    if (!task?.steps || typeof task.steps !== 'object') {
      return true; // Non ha steps nel task
    }

    // Verifica se almeno un mainData ha steps corrispondenti
    // (collegati tramite nodeId come chiave in task.steps)
    return mains.some((main: any) => {
      const mainId = main.id;
      if (!mainId) return true; // Main senza ID non può avere steps

      // ✅ CORRETTO: Leggi da task.steps[mainId], NON da ddt.steps[mainId]
      const mainSteps = task.steps[mainId];
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



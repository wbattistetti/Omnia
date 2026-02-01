export function isTaskTreeEmpty(taskTree?: any): boolean {
  try {
    if (!taskTree || typeof taskTree !== 'object') return true;
    // ✅ NUOVO: Usa TaskTree.nodes invece di data
    const nodes: any[] = Array.isArray(taskTree?.nodes) ? taskTree.nodes : [];
    // Se esiste la struttura (nodes), non è vuoto
    return nodes.length === 0;
  } catch {
    return true;
  }
}

// ❌ RIMOSSO: isDDTEmpty - Usa isTaskTreeEmpty invece

/**
 * Verifica se il TaskTree ha nodes ma senza steps completi
 * ✅ CRITICAL: Legge da task.steps[node.templateId] (unica fonte di verità), NON da taskTree.steps
 * Gli steps vivono solo in task.steps, il TaskTree contiene solo la struttura
 * ✅ Usa node.templateId come chiave (non node.id) perché task.steps[node.templateId] = steps clonati
 * Questo indica che la struttura esiste ma i messaggi devono ancora essere generati
 */
export function hasdataButNosteps(taskTree?: any, task?: any): boolean {
  try {
    if (!taskTree || typeof taskTree !== 'object') return false;
    // ✅ NUOVO: Usa TaskTree.nodes invece di data
    const mains: any[] = Array.isArray(taskTree?.nodes) ? taskTree.nodes : [];

    if (mains.length === 0) return false;

    // ✅ CRITICAL: Leggi da task.steps (dictionary)
    if (!task?.steps || typeof task.steps !== 'object' || Array.isArray(task.steps)) {
      return true; // Non ha steps nel task o formato legacy
    }

    // Verifica se almeno un data ha steps corrispondenti
    // ✅ CRITICAL: Usa templateId come chiave (non id)
    return mains.some((main: any) => {
      const mainId = main.id;
      if (!main.templateId) {
        const errorMsg = `[hasdataButNosteps] Nodo senza templateId: ${main.label || main.id || 'unknown'}`;
        console.error(errorMsg, { main, mainId });
        throw new Error(errorMsg);
      }
      const mainTemplateId = main.templateId;
      if (!mainTemplateId) {
        console.log('[🔍 hasdataButNosteps] Main senza templateId/id', {
          mainLabel: main.label,
          mainId,
          mainTemplateId
        });
        return true; // Main senza ID/templateId non può avere steps
      }

      // ✅ Lookup diretto: O(1) invece di O(n) filter
      const nodeSteps = task.steps[mainTemplateId] || {};
      const nodeStepTypes = Object.keys(nodeSteps);

      console.log('[🔍 hasdataButNosteps] Verifica steps per main', {
        mainLabel: main.label,
        mainId,
        mainTemplateId,
        taskTemplateIdsCount: Object.keys(task.steps).length,
        nodeStepTypes,
        nodeStepsCount: nodeStepTypes.length
      });

      if (nodeStepTypes.length === 0) {
        console.log('[🔍 hasdataButNosteps] ❌ Main non ha steps', {
          mainLabel: main.label,
          mainTemplateId,
          nodeStepsCount: 0
        });
        return true; // Questo main non ha steps
      }

      // ✅ Verifica se almeno uno step ha escalations con tasks
      const hasMessages = nodeStepTypes.some((stepType: string) => {
        const step = nodeSteps[stepType];
        if (!step || !step.escalations || !Array.isArray(step.escalations)) {
          return false;
        }
        // Verifica se almeno una escalation ha tasks
        return step.escalations.some((esc: any) =>
          esc.tasks && Array.isArray(esc.tasks) && esc.tasks.length > 0
        );
      });

      console.log('[🔍 hasdataButNosteps] Verifica messaggi', {
        mainLabel: main.label,
        mainTemplateId,
        nodeStepTypes,
        hasMessages,
        stepDetails: nodeStepTypes.map((stepType: string) => {
          const step = nodeSteps[stepType];
          const escalationsCount = step?.escalations?.length || 0;
          const tasksCount = step?.escalations?.reduce((acc: number, esc: any) =>
            acc + (esc?.tasks?.length || 0), 0) || 0;
          return {
            stepType,
            escalationsCount,
            tasksCount,
            hasTasks: tasksCount > 0
          };
        })
      });

      return !hasMessages;
    });
  } catch {
    return false;
  }
}



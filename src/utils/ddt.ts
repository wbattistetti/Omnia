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
export function hasdataButNoStepPrompts(taskTree?: any, task?: any): boolean {
  try {
    if (!taskTree || typeof taskTree !== 'object') return false;
    // ✅ NUOVO: Usa TaskTree.nodes invece di data
    const mains: any[] = Array.isArray(taskTree?.nodes) ? taskTree.nodes : [];

    if (mains.length === 0) return false;

    // ✅ CRITICAL: Leggi da task.steps[node.templateId], NON da ddt.steps
    // Gli steps vivono solo in task.steps, il DDT contiene solo la struttura
    if (!task?.steps || typeof task.steps !== 'object') {
      return true; // Non ha steps nel task
    }

    // Verifica se almeno un data ha steps corrispondenti
    // ✅ CRITICAL: Usa templateId come chiave (non id)
    // task.steps[node.templateId] = steps clonati
    return mains.some((main: any) => {
      const mainId = main.id;
      if (!main.templateId) {
        const errorMsg = `[hasdataButNoStepPrompts] Nodo senza templateId: ${main.label || main.id || 'unknown'}`;
        console.error(errorMsg, { main, mainId });
        throw new Error(errorMsg);
      }
      const mainTemplateId = main.templateId;
      if (!mainTemplateId) {
        console.log('[🔍 hasdataButNoStepPrompts] Main senza templateId/id', {
          mainLabel: main.label,
          mainId,
          mainTemplateId
        });
        return true; // Main senza ID/templateId non può avere steps
      }

      // ✅ CRITICAL: Leggi da task.steps[mainTemplateId], NON da task.steps[mainId]
      const mainSteps = task.steps[mainTemplateId];

      const allTaskStepsKeys = Object.keys(task.steps);
      // ✅ CRITICAL: Stampa chiavi come stringhe per debug
      console.log('[🔍 hasdataButNoStepPrompts] 🔑 CHIAVI IN task.steps:', allTaskStepsKeys);
      console.log('[🔍 hasdataButNoStepPrompts] 🔍 CERCHIAMO CHIAVE:', mainTemplateId);

      console.log('[🔍 hasdataButNoStepPrompts] Verifica steps per main', {
        mainLabel: main.label,
        mainId,
        mainTemplateId,
        lookingForKey: mainTemplateId,
        taskStepsKeys: allTaskStepsKeys,
        taskStepsKeysAsStrings: allTaskStepsKeys.join(', '), // ✅ Stringa per vedere tutte le chiavi
        taskStepsCount: allTaskStepsKeys.length,
        keyExists: !!mainSteps,
        keyMatchDetails: {
          exactMatch: mainSteps ? '✅ MATCH' : '❌ NO MATCH',
          allKeys: allTaskStepsKeys,
          keyComparison: allTaskStepsKeys.map(k => ({
            key: k,
            keyFull: k, // ✅ Mostra chiave completa
            matches: k === mainTemplateId,
            keyLength: k.length,
            templateIdLength: mainTemplateId.length,
            keyPreview: k.substring(0, 40) + '...',
            templateIdPreview: mainTemplateId.substring(0, 40) + '...',
            // ✅ Confronto carattere per carattere
            charByChar: k.length === mainTemplateId.length ? Array.from(k).map((char, idx) => ({
              pos: idx,
              keyChar: char,
              templateChar: mainTemplateId[idx],
              matches: char === mainTemplateId[idx],
              keyCode: char.charCodeAt(0),
              templateCode: mainTemplateId[idx]?.charCodeAt(0)
            })).filter(c => !c.matches).slice(0, 5) : 'LENGTH_MISMATCH'
          }))
        }
      });

      if (!mainSteps || typeof mainSteps !== 'object') {
        console.log('[🔍 hasdataButNoStepPrompts] ❌ Main non ha steps', {
          mainLabel: main.label,
          mainTemplateId,
          mainStepsType: typeof mainSteps
        });
        return true; // Questo main non ha steps
      }

      const stepKeys = Object.keys(mainSteps);
      if (stepKeys.length === 0) {
        console.log('[🔍 hasdataButNoStepPrompts] ❌ Main ha steps vuoto', {
          mainLabel: main.label,
          mainTemplateId
        });
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

      console.log('[🔍 hasdataButNoStepPrompts] Verifica messaggi', {
        mainLabel: main.label,
        mainTemplateId,
        stepKeys,
        hasMessages,
        stepDetails: stepKeys.map((sk: string) => {
          const step = mainSteps[sk];
          const escalationsCount = step?.escalations?.length || 0;
          const tasksCount = step?.escalations?.reduce((acc: number, esc: any) =>
            acc + (esc?.tasks?.length || 0), 0) || 0;
          return {
            stepKey: sk,
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



import type { Task, MaterializedStep } from '../types/taskTypes';
import { DialogueTaskService } from '../services/DialogueTaskService';
import { buildTaskTreeNodes, cloneTemplateSteps } from './taskUtils';
import { TaskType } from '../types/taskTypes';
import { taskRepository } from '../services/TaskRepository';
import { extractStartPrompts } from './ddtPromptExtractor';
import { translationKeyFromStoredValue } from './translationKeys';

/**
 * ============================================================================
 * TaskTree Instance Manager - Logica Centralizzata
 * ============================================================================
 *
 * Gestisce il caricamento e l'adattamento del TaskTree per un task esistente.
 *
 * SPECIFICHE:
 * 1. Costruisce taskTree (dereferenziazione ricorsiva)
 * 2. Clona steps dal template
 * 3. Estrae task message dalla PRIMA escalation dello step "start" dei nodi radice
 * 4. Adatta prompt al contesto (solo se non già adattato)
 * 5. Aggiorna traduzioni
 *
 * NON apre la pipeline - serve solo per task esistenti
 */

// ✅ Funzione rimossa: ora usa extractStartPrompts da ddtPromptExtractor.ts

/**
 * Gestisce il caricamento e l'adattamento del TaskTree per un task esistente
 *
 * @param task - Task esistente
 * @param projectId - ID del progetto corrente
 * @returns TaskTree caricato e adattato (se necessario)
 */
export async function loadAndAdaptTaskTreeForExistingTask(
  task: Task,
  projectId: string | null
): Promise<{ taskTree: any; adapted: boolean }> {

  console.log('[🔍 taskTreeManager] START loadAndAdaptTaskTreeForExistingTask', {
    taskId: task.id,
    taskLabel: task.label,
    taskTemplateId: task.templateId,
    hasTaskSteps: !!task.steps,
    taskStepsKeys: task.steps ? Object.keys(task.steps) : [],
    taskStepsCount: task.steps ? Object.keys(task.steps).length : 0
  });

  // ✅ 1. Verifica se ha templateId
  if (!task.templateId || task.templateId === 'UNDEFINED') {
    console.log('[🔍 ddtInstanceManager] Task standalone (no templateId)');
    // ✅ NUOVO MODELLO: Restituisci TaskTree con nodes invece di data
    return {
      taskTree: {
        label: task.label,
        nodes: task.data || [], // ✅ Usa nodes invece di data
        steps: task.steps,
        constraints: task.constraints,
        dataContract: task.dataContract
      },
      adapted: false
    };
  }

  // ✅ 2. Carica template
  const template = DialogueTaskService.getTemplate(task.templateId);
  if (!template) {
    console.warn('[🔍 ddtInstanceManager] ❌ Template non trovato:', task.templateId);
    // ✅ NUOVO MODELLO: Restituisci TaskTree con nodes invece di data
    return {
      taskTree: {
        label: task.label,
        nodes: task.data || [], // ✅ Usa nodes invece di data
        steps: task.steps,
        constraints: task.constraints,
      },
      adapted: false
    };
  }

  console.log('[🔍 ddtInstanceManager] Template caricato', {
    templateId: template.id,
    templateLabel: template.label,
    templateHasSteps: !!template.steps,
    templateStepsKeys: template.steps ? Object.keys(template.steps) : []
  });

  // ✅ CRITICAL: Verifica se task.data esiste ed è completo (fonte di verità in memoria)
  const hasTaskData = task.data && Array.isArray(task.data) && task.data.length > 0;
  const hasTaskSteps = task.steps && Object.keys(task.steps).length > 0;

  // ✅ DEBUG: Log dettagliato del primo node per capire cosa contiene
  const firstNode = task.data?.[0];
  console.log('[🔍 ddtInstanceManager] Task data check', {
    hasTaskData,
    taskDataLength: task.data?.length || 0,
    hasTaskSteps,
    taskStepsKeys: task.steps ? Object.keys(task.steps) : [],
    firstNodeId: firstNode?.id,
    firstNodeTemplateId: firstNode?.templateId,
    firstNodeKeys: firstNode ? Object.keys(firstNode) : [],
    firstNodeHasNlpProfile: !!firstNode?.nlpProfile,
    firstNodeNlpProfileKeys: firstNode?.nlpProfile ? Object.keys(firstNode.nlpProfile) : [],
    firstNodeHasExamples: !!firstNode?.nlpProfile?.examples,
    firstNodeExamplesCount: firstNode?.nlpProfile?.examples?.length || 0,
    firstNodeExamples: firstNode?.nlpProfile?.examples?.slice(0, 3),
    firstNodeHasTestNotes: !!firstNode?.testNotes,
    firstNodeTestNotesCount: firstNode?.testNotes ? Object.keys(firstNode.testNotes).length : 0,
  });

  // ✅ Se task.data esiste ed è completo, usalo direttamente (NON ricostruire dal template)
  if (hasTaskData) {
    console.log('[🔍 ddtInstanceManager] ✅ Using task.data as source of truth (NOT rebuilding from template)', {
      taskDataLength: task.data.length,
      firstNodeId: task.data[0]?.id,
      firstNodeTemplateId: task.data[0]?.templateId,
      firstNodeLabel: task.data[0]?.label,
      firstNodeHasNlpProfile: !!task.data[0]?.nlpProfile,
      firstNodeHasExamples: !!task.data[0]?.nlpProfile?.examples,
      firstNodeExamplesCount: task.data[0]?.nlpProfile?.examples?.length || 0,
      firstNodeHasTestNotes: !!task.data[0]?.testNotes,
      firstNodeTestNotesCount: task.data[0]?.testNotes ? Object.keys(task.data[0].testNotes).length : 0
    });

    // ✅ Usa task.data direttamente (preserva nlpProfile.examples, testNotes, ecc.)
    const enrichedData = task.data.map((node: any) => {
      // ✅ Preserva TUTTI i campi del node (inclusi nlpProfile.examples e testNotes)
      // ✅ CRITICAL: Se node.nlpProfile.examples esiste, usalo (fonte di verità)
      // ✅ NON usare template.examples come fallback se node.nlpProfile.examples non esiste
      // ✅ Questo perché template.examples sono esempi del template, non quelli dell'utente
      const hasNodeNlpProfileExamples = Array.isArray(node.nlpProfile?.examples) && node.nlpProfile.examples.length > 0;

      return {
        ...node, // ✅ Spread completo: preserva tutto
        // ✅ Assicurati che label, constraints, examples siano corretti
        label: node.label || task.label,
        constraints: node.constraints || task.constraints || template.constraints,
        // ✅ CRITICAL: examples a root level viene da node.examples o task.examples o template.examples
        // ✅ Ma nlpProfile.examples è la fonte di verità per examplesList
        examples: node.examples || task.examples || template.examples,
        // ✅ CRITICAL: Preserva nlpProfile con examples se esiste (NON usare template.examples come fallback)
        nlpProfile: {
          ...(node.nlpProfile || {}), // Base nlpProfile (preserva regex, minConfidence, ecc.)
          // ✅ Se node.nlpProfile.examples esiste, usalo; altrimenti undefined (NON template.examples)
          examples: hasNodeNlpProfileExamples ? node.nlpProfile.examples : undefined
        },
        // ✅ Preserva testNotes se esiste
        testNotes: node.testNotes || undefined
      };
    });

    // ✅ DEBUG: Verifica che enrichedData abbia nlpProfile.examples
    console.log('[🔍 ddtInstanceManager] enrichedData dopo preservazione', {
      enrichedDataLength: enrichedData.length,
      firstNodeId: enrichedData[0]?.id,
      firstNodeHasNlpProfile: !!enrichedData[0]?.nlpProfile,
      firstNodeHasExamples: !!enrichedData[0]?.nlpProfile?.examples,
      firstNodeExamplesCount: enrichedData[0]?.nlpProfile?.examples?.length || 0,
      firstNodeHasTestNotes: !!enrichedData[0]?.testNotes,
      firstNodeTestNotesCount: enrichedData[0]?.testNotes ? Object.keys(enrichedData[0].testNotes).length : 0
    });

    // ✅ Usa task.steps se esistono, altrimenti clona dal template
    let finalSteps = hasTaskSteps ? task.steps : null;

    if (!finalSteps) {
      // ✅ Solo se task.steps non esiste, costruisci nodes e clona steps
      const nodes = buildTaskTreeNodes(template);
      const { steps: clonedSteps } = cloneTemplateSteps(template, nodes);
      finalSteps = clonedSteps;
      console.log('[🔍 ddtInstanceManager] Steps clonati dal template (task.steps non esiste)', {
        clonedStepsKeys: Object.keys(clonedSteps),
        clonedStepsCount: Object.keys(clonedSteps).length
      });
    } else {
      console.log('[🔍 ddtInstanceManager] ✅ Using task.steps as source of truth', {
        taskStepsKeys: Object.keys(finalSteps),
        taskStepsCount: Object.keys(finalSteps).length
      });
    }

    // ✅ Verifica se i prompt sono già stati adattati
    const promptsAlreadyAdapted = task.metadata?.promptsAdapted === true;

    // ✅ NUOVO MODELLO: Ritorna TaskTree usando task.data (fonte di verità) con nodes invece di data
    return {
      taskTree: {
        label: task.label ?? template.label,
        nodes: enrichedData, // ✅ Usa nodes invece di data (preserva examples, testNotes, ecc.)
        steps: finalSteps,
        constraints: (task.constraints && task.constraints.length > 0)
          ? task.constraints
          : template.constraints,
        dataContract: task.dataContract ?? template.dataContract,
        templateId: task.templateId
      },
      adapted: promptsAlreadyAdapted
    };
  }

  // ✅ Se task.data NON esiste, ricostruisci dal template (comportamento originale)
  console.log('[🔍 ddtInstanceManager] ⚠️ task.data non esiste, ricostruendo dal template', {
    taskId: task.id,
    templateId: template.id
  });

  // ✅ 3. Costruisci nodes (dereferenziazione ricorsiva)
  const nodes = buildTaskTreeNodes(template);
  console.log('[🔍 ddtInstanceManager] nodes costruito', {
    nodesLength: nodes.length,
    mainNodes: nodes.map((n: TaskTreeNode) => ({
      id: n.id,
      templateId: n.templateId,
      label: n.label,
      subNodesCount: n.subNodes?.length || 0
    }))
  });

  // ✅ 4. Clona steps (usa nodes con templateId corretti)
  const { steps: clonedSteps, guidMapping } = cloneTemplateSteps(template, nodes);
  console.log('[🔍 ddtInstanceManager] Steps clonati', {
    clonedStepsKeys: Object.keys(clonedSteps),
    clonedStepsCount: Object.keys(clonedSteps).length,
    clonedStepsDetails: Object.entries(clonedSteps).map(([key, value]: [string, any]) => ({
      key,
      stepKeys: typeof value === 'object' ? Object.keys(value || {}) : [],
      hasStart: !!value?.start,
      startEscalationsCount: value?.start?.escalations?.length || 0
    }))
  });

  // ✅ 5. Applica override dall'istanza
  // ✅ IMPORTANTE: constraints/examples sono referenziati dal template, NON copiati
  // ✅ Solo se l'istanza ha override espliciti (array non vuoto), usa quelli
  // ✅ CRITICAL: Il dataContract può essere salvato in task.data[0].dataContract (override) o task.dataContract (root)
  // ✅ Cerca prima negli override in task.data, poi a livello root, poi nel template
  const enrichedNodes = nodes.map((templateNode: TaskTreeNode, index: number) => {
    // ✅ Cerca override nel task.data corrispondente (per templateId match)
    const taskDataOverride = task.data && Array.isArray(task.data)
      ? task.data.find((node: any) => node.templateId === templateNode.templateId) || task.data[index]
      : null;

      // ✅ CRITICAL: dataContract è sempre dal template, non più override
      const finalDataContract = templateNode.dataContract;
      const regexPattern = finalDataContract?.parsers?.find((c: any) => c.type === 'regex')?.patterns?.[0];
      console.log('[CONTRACT] LOAD - From template only', {
        nodeId: templateNode.id,
        templateId: templateNode.templateId,
        regexPattern: regexPattern || '(none)'
      });

    // ✅ CRITICAL: Applica nlpProfile.examples da task.data se presente (override a livello nodo)
    const nodeNlpProfile = taskDataOverride?.nlpProfile || {};
    const nodeExamples = nodeNlpProfile.examples;
    const hasNodeExamples = Array.isArray(nodeExamples) && nodeExamples.length > 0;

    // ✅ DEBUG: Log completo del task.data[0] per vedere cosa c'è realmente
    const firstTaskDataNode = task.data?.[0];
    console.log('[EXAMPLES] LOAD - Checking node override', {
      nodeId: templateNode.id,
      templateId: templateNode.templateId,
      hasTaskData: !!task.data,
      taskDataLength: task.data?.length || 0,
      firstTaskDataNodeKeys: firstTaskDataNode ? Object.keys(firstTaskDataNode) : [],
      firstTaskDataNodeId: firstTaskDataNode?.id,
      firstTaskDataNodeTemplateId: firstTaskDataNode?.templateId,
      hasFirstTaskDataNodeNlpProfile: !!firstTaskDataNode?.nlpProfile,
      firstTaskDataNodeNlpProfileKeys: firstTaskDataNode?.nlpProfile ? Object.keys(firstTaskDataNode.nlpProfile) : [],
      firstTaskDataNodeNlpProfileExamples: firstTaskDataNode?.nlpProfile?.examples,
      firstTaskDataNodeNlpProfileExamplesCount: Array.isArray(firstTaskDataNode?.nlpProfile?.examples) ? firstTaskDataNode.nlpProfile.examples.length : 0,
      taskDataKeys: task.data ? task.data.map((n: any) => ({ id: n?.id, templateId: n?.templateId, hasNlpProfile: !!n?.nlpProfile, hasExamples: !!n?.nlpProfile?.examples, nlpProfileKeys: n?.nlpProfile ? Object.keys(n.nlpProfile) : [] })) : [],
      hasTaskDataOverride: !!taskDataOverride,
      taskDataOverrideId: taskDataOverride?.id,
      taskDataOverrideTemplateId: taskDataOverride?.templateId,
      hasNodeNlpProfile: !!taskDataOverride?.nlpProfile,
      nodeNlpProfileKeys: taskDataOverride?.nlpProfile ? Object.keys(taskDataOverride.nlpProfile) : [],
      nodeNlpProfileExamples: taskDataOverride?.nlpProfile?.examples,
      hasNodeExamples,
      nodeExamplesCount: nodeExamples?.length || 0,
      nodeExamples: nodeExamples?.slice(0, 3),
      templateExamplesCount: templateNode.examples?.length || 0,
      hasNodeTestNotes: !!taskDataOverride?.testNotes,
      nodeTestNotesCount: taskDataOverride?.testNotes ? Object.keys(taskDataOverride.testNotes).length : 0,
      nodeTestNotesKeys: taskDataOverride?.testNotes ? Object.keys(taskDataOverride.testNotes).slice(0, 3) : []
    });

    return {
      ...templateNode,
      label: task.label || templateNode.label,
      // ✅ Se task.constraints è array vuoto [], usa templateNode.constraints (referenza)
      constraints: (task.constraints && task.constraints.length > 0)
        ? task.constraints
        : templateNode.constraints,
      // ✅ CRITICAL: Applica nlpProfile completo da task.data se presente
      // ✅ PRIORITY: task.data[].nlpProfile (override) > templateNode.nlpProfile (template)
      // Questo garantisce che examplesList e altre modifiche in memoria siano preservate
      nlpProfile: taskDataOverride?.nlpProfile
        ? {
            ...(templateNode.nlpProfile || {}), // Base dal template
            ...taskDataOverride.nlpProfile      // Override dal task in memoria (fonte di verità)
          }
        : templateNode.nlpProfile,
      // ✅ CRITICAL: Applica testNotes da task.data se presente (override a livello nodo)
      // ✅ PRIORITY: task.data[].testNotes (override) > undefined (template non ha testNotes)
      testNotes: taskDataOverride?.testNotes && typeof taskDataOverride.testNotes === 'object' && Object.keys(taskDataOverride.testNotes).length > 0
        ? taskDataOverride.testNotes
        : undefined,
      // ✅ CRITICAL: dataContract è sempre dal template, non più override
      dataContract: templateNode.dataContract,
      subNodes: templateNode.subNodes || [] // ✅ Usa subNodes invece di subData
    };
  });

  // ✅ 6. Usa steps dall'istanza (se esistono E hanno struttura corretta) o quelli clonati
  // ✅ NUOVO: steps è un array MaterializedStep[], non un dictionary
  const taskStepsArray: MaterializedStep[] = Array.isArray(task.steps) ? task.steps : [];
  const clonedStepsArray: MaterializedStep[] = Array.isArray(clonedSteps) ? clonedSteps : [];

  // ✅ Verifica se task.steps è un array valido
  const hasValidStepsArray = taskStepsArray.length > 0;

  let finalSteps: MaterializedStep[] = hasValidStepsArray
    ? taskStepsArray  // ✅ Usa steps esistenti dal task (se array valido)
    : clonedStepsArray; // ✅ Altrimenti usa steps clonati dal template

  // ✅ CRITICAL: Se task.steps non è un array, correggilo salvando i clonedSteps corretti
  if (!Array.isArray(task.steps) && clonedStepsArray.length > 0) {
    console.warn('[🔍 ddtInstanceManager] ⚠️ Rilevata struttura sbagliata in task.steps (non è array), correggendo con clonedSteps', {
      taskId: task.id,
      taskStepsType: typeof task.steps,
      taskStepsIsArray: Array.isArray(task.steps),
      clonedStepsCount: clonedStepsArray.length
    });
    // ✅ Correggi il task salvando i clonedSteps corretti
    task.steps = clonedStepsArray;  // ✅ Modifica diretta nella cache
    finalSteps = clonedStepsArray; // ✅ Usa clonedSteps come finalSteps
  }

  // ✅ Log ridotto (solo informazioni essenziali)
  console.log('[🔍 ddtInstanceManager] finalSteps determinato', {
    usingTaskSteps: hasValidStepsArray,
    taskStepsIsArray: Array.isArray(task.steps),
    finalStepsCount: finalSteps.length,
    clonedStepsCount: clonedStepsArray.length
  });

  // ✅ 7. Verifica se i prompt sono già stati adattati
  const promptsAlreadyAdapted = task.metadata?.promptsAdapted === true;
  console.log('[🔍 ddtInstanceManager] Verifica adattamento', {
    promptsAlreadyAdapted,
    hasTaskLabel: !!task.label,
    willAdapt: !promptsAlreadyAdapted && !!task.label
  });

  if (!promptsAlreadyAdapted && task.label) {
    // ✅ 8. Adatta prompt al contesto
    try {
      // ✅ Rimossa import di adaptStartPromptsToContext - ora usiamo AdaptPromptToContext da ddtPromptAdapter.ts
      const { getCurrentProjectLocale } = await import('./categoryPresets');
      const { getTemplateTranslations, saveProjectTranslations } = await import('../services/ProjectDataService');

      // ✅ 8.1. Carica traduzioni esistenti
      const allGuids = new Set<string>();
      Object.values(finalSteps).forEach((nodeSteps: any) => {
        const startStep = nodeSteps?.start || nodeSteps?.normal;
        if (startStep?.escalations?.[0]?.tasks) {
          startStep.escalations[0].tasks.forEach((task: any) => {
            const raw = task.parameters?.find((p: any) => p.parameterId === 'text')?.value;
            const key =
              typeof raw === 'string' ? translationKeyFromStoredValue(raw) : null;
            if (key) allGuids.add(key);
          });
        }
      });

      const projectTranslations: Record<string, string> = {};
      if (allGuids.size > 0) {
        const guidArray = Array.from(allGuids);
        console.log('[🔍 ddtInstanceManager] Requesting translations for GUIDs:', {
          count: guidArray.length,
          guids: guidArray
        });
        const translations = await getTemplateTranslations(guidArray);
        const projectLocale = getCurrentProjectLocale() || 'it-IT';
        for (const guid of allGuids) {
          const trans = translations[guid];
          if (trans) {
            const text = typeof trans === 'object'
              ? (trans[projectLocale] || trans.en || trans.it || trans.pt || '')
              : String(trans);
            if (text) projectTranslations[guid] = text;
          }
        }
      }

      // ✅ 8.2. Adatta prompt al contesto usando la nuova funzione centralizzata
      // ✅ Usa AdaptTaskTreePromptToContext che gestisce tutto: estrazione, chiamata API, salvataggio
      const { AdaptTaskTreePromptToContext } = await import('./taskTreePromptAdapter');

      try {
        await AdaptTaskTreePromptToContext(task, task.label || '', false); // false = solo nodi radice

        console.log('[🔍 ddtInstanceManager] ✅ Prompts adattati', {
          taskId: task.id,
          taskLabel: task.label
        });

        return {
          taskTree: {
            label: task.label ?? template.label,
            nodes: enrichedNodes, // ✅ Usa nodes invece di data
            steps: finalSteps,
            // ✅ Se task.constraints è array vuoto [], usa template (referenza)
            constraints: (task.constraints && task.constraints.length > 0)
              ? task.constraints
              : template.constraints,
            // ✅ Se task.examples è array vuoto [], usa template (referenza)
            examples: (task.examples && task.examples.length > 0)
              ? task.examples
              : template.examples,
            // ✅ dataContract è oggetto, quindi ?? va bene (undefined è nullish)
            dataContract: task.dataContract ?? template.dataContract,
            templateId: task.templateId
          },
          adapted: true
        };
      } catch (adaptErr) {
        console.error('[🔍 ddtInstanceManager] ❌ Errore durante adattamento prompt', adaptErr);
        // Continua senza adattamento - i prompt originali sono comunque validi
      }
    } catch (err) {
      console.error('[🔍 ddtInstanceManager] ❌ Errore adattamento prompt', err);
      // Continua senza adattamento
    }
  }

  // ✅ 9. Ritorna TaskTree (con o senza adattamento)
  const result = {
    taskTree: {
      label: task.label ?? template.label,
      nodes: enrichedNodes, // ✅ Usa nodes invece di data
      steps: finalSteps,
      // ✅ Se task.constraints è array vuoto [], usa template (referenza)
      constraints: (task.constraints && task.constraints.length > 0)
        ? task.constraints
        : template.constraints,
      // ✅ Se task.examples è array vuoto [], usa template (referenza)
      examples: (task.examples && task.examples.length > 0)
        ? task.examples
        : template.examples,
      // ✅ dataContract è oggetto, quindi ?? va bene (undefined è nullish)
      dataContract: task.dataContract ?? template.dataContract,
      templateId: task.templateId
    },
    adapted: promptsAlreadyAdapted
  };

  // ✅ Log ridotto (solo informazioni essenziali)
  console.log('[🔍 taskTreeManager] ✅ COMPLETE', {
    taskId: task.id,
    taskTreeLabel: result.taskTree.label,
    taskTreeStepsCount: Array.isArray(result.taskTree.steps) ? result.taskTree.steps.length : Object.keys(result.taskTree.steps || {}).length,
    adapted: result.adapted
  });

  return result;
}

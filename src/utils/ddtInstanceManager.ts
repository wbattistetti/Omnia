import type { Task } from '../types/taskTypes';
import { DialogueTaskService } from '../services/DialogueTaskService';
import { buildDataTree, cloneTemplateSteps } from './taskUtils';
import { TaskType } from '../types/taskTypes';
import { taskRepository } from '../services/TaskRepository';
import { extractStartPrompts } from './ddtPromptExtractor';

/**
 * ============================================================================
 * DDT Instance Manager - Logica Centralizzata
 * ============================================================================
 *
 * Gestisce il caricamento e l'adattamento del DDT per un task esistente.
 *
 * SPECIFICHE:
 * 1. Costruisce dataTree (dereferenziazione ricorsiva)
 * 2. Clona steps dal template
 * 3. Estrae task message dalla PRIMA escalation dello step "start" dei nodi radice
 * 4. Adatta prompt al contesto (solo se non già adattato)
 * 5. Aggiorna traduzioni
 *
 * NON apre la pipeline - serve solo per task esistenti
 */

// ✅ Funzione rimossa: ora usa extractStartPrompts da ddtPromptExtractor.ts

/**
 * Gestisce il caricamento e l'adattamento del DDT per un task esistente
 *
 * @param task - Task esistente
 * @param projectId - ID del progetto corrente
 * @returns DDT caricato e adattato (se necessario)
 */
export async function loadAndAdaptDDTForExistingTask(
  task: Task,
  projectId: string | null
): Promise<{ ddt: any; adapted: boolean }> {

  console.log('[🔍 ddtInstanceManager] START loadAndAdaptDDTForExistingTask', {
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
    return {
      ddt: {
        label: task.label,
        data: task.data || [],
        steps: task.steps,
        constraints: task.constraints,
        examples: task.examples,
        nlpContract: task.nlpContract
      },
      adapted: false
    };
  }

  // ✅ 2. Carica template
  const template = DialogueTaskService.getTemplate(task.templateId);
  if (!template) {
    console.warn('[🔍 ddtInstanceManager] ❌ Template non trovato:', task.templateId);
    return {
      ddt: {
        label: task.label,
        data: task.data || [],
        steps: task.steps,
        constraints: task.constraints,
        examples: task.examples
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

  // ✅ 3. Costruisci dataTree (dereferenziazione ricorsiva)
  const dataTree = buildDataTree(template);
  console.log('[🔍 ddtInstanceManager] dataTree costruito', {
    dataTreeLength: dataTree.length,
    mainNodes: dataTree.map((n: any) => ({
      id: n.id,
      templateId: n.templateId,
      label: n.label,
      subDataCount: n.subData?.length || 0
    }))
  });

  // ✅ 4. Clona steps (usa dataTree con templateId corretti)
  const { steps: clonedSteps, guidMapping } = cloneTemplateSteps(template, dataTree);
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
  const enrichedData = dataTree.map((templateNode: any) => ({
    ...templateNode,
    label: task.label || templateNode.label,
    constraints: task.constraints || templateNode.constraints,
    examples: task.examples || templateNode.examples,
    nlpContract: task.nlpContract || templateNode.nlpContract,
    subData: templateNode.subData || []
  }));

  console.log('[🔍 ddtInstanceManager] enrichedData creato', {
    enrichedDataLength: enrichedData.length,
    mainNodesWithTemplateId: enrichedData.map((n: any) => ({
      id: n.id,
      templateId: n.templateId,
      label: n.label
    }))
  });

  // ✅ 6. Usa steps dall'istanza (se esistono E hanno struttura corretta) o quelli clonati
  // ✅ CRITICAL: Verifica che task.steps abbia la struttura corretta (chiavi = templateId, non step types)
  const taskStepsKeys = task.steps ? Object.keys(task.steps) : [];
  const stepTypeKeys = ['start', 'noMatch', 'noInput', 'confirmation', 'notConfirmed', 'success'];
  const hasWrongStructure = taskStepsKeys.length === stepTypeKeys.length &&
    taskStepsKeys.every(key => stepTypeKeys.includes(key));

  let finalSteps = (task.steps && Object.keys(task.steps).length > 0 && !hasWrongStructure)
    ? task.steps  // ✅ Usa steps esistenti dal task (solo se struttura corretta)
    : clonedSteps; // ✅ Altrimenti usa steps clonati dal template

  // ✅ CRITICAL: Se la struttura è sbagliata, correggila salvando i clonedSteps corretti
  if (hasWrongStructure && Object.keys(clonedSteps).length > 0) {
    console.warn('[🔍 ddtInstanceManager] ⚠️ Rilevata struttura sbagliata in task.steps, correggendo con clonedSteps', {
      taskId: task.id,
      wrongKeys: taskStepsKeys,
      correctKeys: Object.keys(clonedSteps)
    });
    // ✅ Correggi il task salvando i clonedSteps corretti
    // ✅ taskRepository è già importato in cima al file
    const { getCurrentProjectId } = await import('../state/runtime');
    const projectId = getCurrentProjectId();
    taskRepository.updateTask(task.id, { steps: clonedSteps }, projectId || undefined);
    finalSteps = clonedSteps; // ✅ Usa clonedSteps come finalSteps
  }

  // ✅ AGGIUNTO: Definisci finalStepsKeys e clonedStepsKeys PRIMA di usarle
  const finalStepsKeys = finalSteps ? Object.keys(finalSteps) : [];
  const clonedStepsKeys = Object.keys(clonedSteps);

  // ✅ Log ridotto (solo informazioni essenziali)
  console.log('[🔍 ddtInstanceManager] finalSteps determinato', {
    usingTaskSteps: task.steps && Object.keys(task.steps).length > 0 && !hasWrongStructure,
    hasWrongStructure: hasWrongStructure,
    finalStepsKeys: finalStepsKeys,
    finalStepsKeysAsStrings: finalStepsKeys.join(', '), // ✅ Stringa per vedere tutte le chiavi
    finalStepsCount: finalStepsKeys.length,
    taskStepsKeys: taskStepsKeys,
    taskStepsKeysAsStrings: taskStepsKeys.join(', '), // ✅ Stringa per vedere tutte le chiavi
    clonedStepsKeys: clonedStepsKeys,
    clonedStepsKeysAsStrings: clonedStepsKeys.join(', ') // ✅ Stringa per vedere tutte le chiavi
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
            const textGuid = task.parameters?.find((p: any) => p.parameterId === 'text')?.value ||
                            task.taskId ||
                            task.id;
            if (textGuid) allGuids.add(textGuid);
          });
        }
      });

      const projectTranslations: Record<string, string> = {};
      if (allGuids.size > 0) {
        const translations = await getTemplateTranslations(Array.from(allGuids));
        const projectLocale = getCurrentProjectLocale() || 'it';
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
      // ✅ Usa AdaptPromptToContext che gestisce tutto: estrazione, chiamata API, salvataggio
      const { AdaptPromptToContext } = await import('./ddtPromptAdapter');

      try {
        await AdaptPromptToContext(task, task.label || '', false); // false = solo nodi radice

        console.log('[🔍 ddtInstanceManager] ✅ Prompts adattati', {
          taskId: task.id,
          taskLabel: task.label
        });

        return {
          ddt: {
            label: task.label ?? template.label,
            data: enrichedData,
            steps: finalSteps,
            constraints: task.constraints ?? template.constraints,
            examples: task.examples ?? template.examples,
            nlpContract: task.nlpContract ?? template.nlpContract,
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

  // ✅ 9. Ritorna DDT (con o senza adattamento)
  const result = {
    ddt: {
      label: task.label ?? template.label,
      data: enrichedData,
      steps: finalSteps,
      constraints: task.constraints ?? template.constraints,
      examples: task.examples ?? template.examples,
      nlpContract: task.nlpContract ?? template.nlpContract,
      templateId: task.templateId
    },
    adapted: promptsAlreadyAdapted
  };

  // ✅ Log ridotto (solo informazioni essenziali)
  console.log('[🔍 ddtInstanceManager] ✅ COMPLETE', {
    taskId: task.id,
    ddtLabel: result.ddt.label,
    ddtStepsCount: Object.keys(result.ddt.steps || {}).length,
    adapted: result.adapted
  });

  return result;
}

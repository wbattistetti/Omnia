import type { Task } from '../types/taskTypes';
import { DialogueTaskService } from '../services/DialogueTaskService';
import { cloneTemplateSteps } from './taskUtils';

/**
 * ============================================================================
 * DDT Steps Cloner - Clonazione Steps da Template
 * ============================================================================
 *
 * Clona tutti gli steps da tutti i template referenziati nell'albero dati
 * e li aggiunge direttamente a task.steps (modifica in-place).
 *
 * REGOLE:
 * - Modifica task.steps in-place (non ritorna nulla)
 * - Usa templateId come chiave per task.steps
 * - Supporta profondità arbitraria (ricorsivo)
 * - Usa SEMPRE templateId (nessun fallback)
 */

/**
 * Clona tutti gli steps da tutti i template referenziati nell'albero dati.
 * Modifica task.steps in-place popolando con gli steps clonati.
 *
 * @param dataTree - Albero dati completo (con templateId per ogni nodo)
 * @param task - Task a cui aggiungere gli steps clonati
 * @throws Error se dataTree è vuoto o se un nodo non ha templateId
 */
export function CloneSteps(dataTree: any[], task: Task): void {
  console.log('[🔍 CloneSteps] START', {
    taskId: task.id,
    taskLabel: task.label,
    dataTreeLength: dataTree.length,
    hasExistingSteps: !!task.steps,
    existingStepsKeys: task.steps ? Object.keys(task.steps) : []
  });

  // ✅ Validazione input
  if (!dataTree || !Array.isArray(dataTree) || dataTree.length === 0) {
    const errorMsg = '[CloneSteps] dataTree è obbligatorio e deve essere un array non vuoto';
    console.error(errorMsg, { taskId: task.id });
    throw new Error(errorMsg);
  }

  if (!task) {
    const errorMsg = '[CloneSteps] task è obbligatorio';
    console.error(errorMsg);
    throw new Error(errorMsg);
  }

  // ✅ Inizializza task.steps se non esiste
  if (!task.steps) {
    task.steps = {};
    console.log('[🔍 CloneSteps] Inizializzato task.steps vuoto');
  }

  // ✅ Carica template principale dal task.templateId
  if (!task.templateId) {
    const errorMsg = `[CloneSteps] Task senza templateId: ${task.id}`;
    console.error(errorMsg, { taskId: task.id });
    throw new Error(errorMsg);
  }

  const mainTemplate = DialogueTaskService.getTemplate(task.templateId);
  if (!mainTemplate) {
    const errorMsg = `[CloneSteps] Template non trovato: ${task.templateId}`;
    console.error(errorMsg, { taskId: task.id, templateId: task.templateId });
    throw new Error(errorMsg);
  }

  console.log('[🔍 CloneSteps] Template principale caricato', {
    templateId: mainTemplate.id || mainTemplate._id,
    templateLabel: mainTemplate.label || mainTemplate.name
  });

  // ✅ Clona steps usando cloneTemplateSteps (che gestisce ricorsione)
  const { steps: clonedSteps, guidMapping } = cloneTemplateSteps(mainTemplate, dataTree);

  console.log('[🔍 CloneSteps] Steps clonati da cloneTemplateSteps', {
    clonedStepsKeys: Object.keys(clonedSteps),
    clonedStepsCount: Object.keys(clonedSteps).length,
    guidMappingSize: guidMapping.size
  });

  // ✅ Aggiungi gli steps clonati a task.steps (modifica in-place)
  for (const [nodeTemplateId, nodeSteps] of Object.entries(clonedSteps)) {
    if (!nodeTemplateId) {
      console.warn('[🔍 CloneSteps] ⚠️ Chiave vuota negli steps clonati, skip', {
        nodeStepsKeys: Object.keys(nodeSteps || {})
      });
      continue;
    }

    task.steps[nodeTemplateId] = nodeSteps;
    console.log('[🔍 CloneSteps] Steps aggiunti a task.steps', {
      nodeTemplateId,
      stepTypes: Object.keys(nodeSteps || {})
    });
  }

  console.log('[🔍 CloneSteps] COMPLETE', {
    taskId: task.id,
    finalStepsKeys: Object.keys(task.steps),
    finalStepsCount: Object.keys(task.steps).length,
    guidMappingSize: guidMapping.size
  });
}

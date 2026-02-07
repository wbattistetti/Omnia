// templateMatcher.ts
// Service per ricerca template locale (ultimo tentativo prima di AI)
// ⚠️ NOTA: Chiamato SOLO se task.templateId NON esiste

import { TaskType } from '@types/taskTypes';
import TaskTemplateMatcherService from '@services/TaskTemplateMatcherService';
import { buildTemplateMatchResult, type TemplateMatchResult } from '@responseEditor/hooks/helpers/templateBuilders';

/**
 * Cerca un template Task usando il matcher service
 *
 * ⚠️ IMPORTANTE: Questa funzione NON dovrebbe essere chiamata se task.templateId esiste!
 * È solo per casi in cui l'euristica in NodeRow non ha trovato template.
 *
 * @param label - Label della riga di nodo
 * @param taskType - Tipo di task corrente
 * @returns TemplateMatchResult se trovato, null altrimenti
 */
export async function findLocalTemplate(
  label: string,
  taskType: TaskType
): Promise<TemplateMatchResult | null> {
  try {
    // ✅ Usa findTaskTemplate() (nuovo metodo) o findDDTTemplate() (deprecato, per compatibilità)
    const match = await TaskTemplateMatcherService.findTaskTemplate(label, taskType);
    if (!match) {
      return null;
    }
    return await buildTemplateMatchResult(match.template);
  } catch (error) {
    console.error('[templateMatcher] Errore in findLocalTemplate:', error);
    return null;
  }
}



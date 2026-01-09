// templateMatcher.ts
// Service per ricerca template locale (ultimo tentativo prima di AI)
// ⚠️ NOTA: Chiamato SOLO se task.templateId NON esiste

import { TaskType } from '../../../../../types/taskTypes';
import DDTTemplateMatcherService from '../../../../../services/DDTTemplateMatcherService';
import { buildTemplateMatchResult, type TemplateMatchResult } from './templateBuilders';

/**
 * Cerca un template DDT usando il matcher service
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
    const match = await DDTTemplateMatcherService.findDDTTemplate(label, taskType);
    if (!match) {
      return null;
    }
    return await buildTemplateMatchResult(match.template);
  } catch (error) {
    console.error('[templateMatcher] Errore in findLocalTemplate:', error);
    return null;
  }
}



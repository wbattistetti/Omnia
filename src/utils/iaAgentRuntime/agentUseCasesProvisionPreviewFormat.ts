/**
 * Formatta gli use case AI Agent per il modal anteprima payload ConvAI (solo lettura / debug).
 */

import { parseAgentUseCasesJson, type AIAgentUseCase } from '@types/aiAgentUseCases';
import type { Task } from '@types/taskTypes';

/**
 * Testo leggibile dei dialoghi use case per il modal «Solo Examples».
 * Ordine: sort_order crescente, poi label.
 */
export function formatAgentUseCasesForProvisionModal(useCases: readonly AIAgentUseCase[]): string {
  if (!useCases.length) return '';
  const sorted = [...useCases].sort((a, b) => {
    if (a.sort_order !== b.sort_order) return a.sort_order - b.sort_order;
    return (a.label ?? '').localeCompare(b.label ?? '', undefined, { sensitivity: 'base' });
  });
  const blocks: string[] = [];
  for (const uc of sorted) {
    const title = uc.label?.trim() || uc.id;
    const lines: string[] = [`• ${title}`];
    if (uc.payoff?.trim()) {
      lines.push(`  ${uc.payoff.trim()}`);
    }
    lines.push('');
    let anyContent = false;
    for (const t of uc.dialogue) {
      const c = (t.content ?? '').trim();
      if (!c) continue;
      anyContent = true;
      const roleLabel = t.role === 'user' ? 'Utente' : 'Assistente';
      lines.push(`${roleLabel}: ${c}`);
    }
    if (!anyContent) {
      lines.push('(nessun turno con testo)');
    }
    blocks.push(lines.join('\n'));
  }
  return blocks.join('\n\n');
}

/** Da task persistito: dialoghi use case per anteprima (undefined se assenti). */
export function buildUseCaseDialoguesPreviewFromTask(task: Task | null | undefined): string | undefined {
  if (!task) return undefined;
  const text = formatAgentUseCasesForProvisionModal(parseAgentUseCasesJson(task.agentUseCasesJson));
  return text.length > 0 ? text : undefined;
}

const USE_CASE_BLOCK_HEADING =
  'Scenari use case (dal composer del task; few-shot per tono e struttura):';

/**
 * Accoda ai corpi della sezione strutturata «Examples» il testo derivato da agentUseCasesJson.
 * Usato in compile ConvAI così gli esempi di dialogo finiscono nel prompt ElevenLabs.
 */
export function mergeUseCaseExamplesIntoExamplesBody(
  baseExamples: string,
  task: Pick<Task, 'agentUseCasesJson'> | null | undefined
): string {
  const ucBlock = formatAgentUseCasesForProvisionModal(parseAgentUseCasesJson(task?.agentUseCasesJson));
  if (!ucBlock.trim()) {
    return baseExamples;
  }
  const base = baseExamples.trim();
  if (!base) {
    return [USE_CASE_BLOCK_HEADING, '', ucBlock].join('\n');
  }
  return [base, '', '---', '', USE_CASE_BLOCK_HEADING, '', ucBlock].join('\n');
}

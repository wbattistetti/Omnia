/**
 * Validazione esito categorizzazione use case (post-LLM) e messaggi designer.
 */

import type { AIAgentUseCase, AIAgentUseCaseCategory } from '@types/aiAgentUseCases';
import { getValidUseCaseCategoryId } from './useCaseCategories';

/** Verifica che categorie e assegnazioni siano utilizzabili in lista wizard. */
export function validateCategorizationResult(
  useCases: readonly AIAgentUseCase[],
  categories: readonly AIAgentUseCaseCategory[]
): void {
  if (categories.length === 0) {
    throw new Error('Nessuna categoria valida nella risposta.');
  }
  const assigned = useCases.filter((u) => getValidUseCaseCategoryId(u, categories) !== null).length;
  if (assigned === 0) {
    throw new Error(
      `Nessun use case assegnato a una categoria (${useCases.length} in elenco).`
    );
  }
}

/** Banner quando la categorizzazione fallisce ma gli scenari sono stati generati. */
export function formatCategorizationFailureBanner(
  useCaseCount: number,
  err: unknown
): string {
  const detail =
    err instanceof Error
      ? err.message.trim()
      : typeof err === 'string'
        ? err.trim()
        : 'errore sconosciuto';
  return `Generati ${useCaseCount} scenari. Categorizzazione non applicata (${detail}). Puoi riordinare manualmente sotto le intestazioni.`;
}

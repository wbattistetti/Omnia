/**
 * Shared helpers for primary use case assistant message (composer + response editor).
 */

import { ensureUseCasePhrases } from '@domain/useCaseBundle/migrateUseCase';
import type { AIAgentUseCase } from '@types/aiAgentUseCases';

export function isPrimaryPhraseParametricEnabled(uc: AIAgentUseCase): boolean {
  return Boolean(ensureUseCasePhrases(uc).phrases?.[0]?.parametric?.enabled);
}

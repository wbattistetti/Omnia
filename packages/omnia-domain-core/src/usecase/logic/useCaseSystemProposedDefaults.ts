/**
 * Default per use case proposti dal sistema (bundle IA, create singolo): esclusi finché
 * il designer non abilita la checkbox in lista.
 */

import type { AIAgentUseCase } from '@types/aiAgentUseCases';

export function applySystemProposedUseCaseDefaults(uc: AIAgentUseCase): AIAgentUseCase {
  return {
    ...uc,
    included_in_conversations: false,
  };
}

export function applySystemProposedUseCaseDefaultsBatch(
  useCases: readonly AIAgentUseCase[]
): AIAgentUseCase[] {
  return useCases.map(applySystemProposedUseCaseDefaults);
}

/**
 * Rimuove i turni assistente dalla lista use case (passo 1 wizard: messaggi generati in seguito).
 */

import type { AIAgentUseCase } from '@types/aiAgentUseCases';

export function stripAssistantTurnsFromUseCase(uc: AIAgentUseCase): AIAgentUseCase {
  return {
    ...uc,
    dialogue: uc.dialogue.filter((t) => t.role !== 'assistant'),
  };
}

export function stripAssistantTurnsFromUseCases(
  ucs: readonly AIAgentUseCase[]
): AIAgentUseCase[] {
  return ucs.map(stripAssistantTurnsFromUseCase);
}

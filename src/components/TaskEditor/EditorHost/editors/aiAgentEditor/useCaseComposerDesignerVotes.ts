/**
 * Toggle pollice su/giù per campo designer su un use case (stesso comportamento della UI composer).
 */

import type { AIAgentUseCase } from '@types/aiAgentUseCases';

export type DesignerVoteField = 'label' | 'payoff' | 'agentMessage';

/**
 * Applica il toggle pollice: secondo clic sullo stesso valore rimuove il voto.
 */
/**
 * Pollice su su etichetta, scenario e messaggio per ogni use case (conferma wizard «senza modifiche»).
 */
export function applyAllDesignerVotesUp(prev: readonly AIAgentUseCase[]): AIAgentUseCase[] {
  return prev.map((u) => ({
    ...u,
    designer_label_vote: 'up',
    designer_payoff_vote: 'up',
    designer_agent_message_vote: 'up',
  }));
}

export function applyDesignerFieldVoteToggle(
  prev: readonly AIAgentUseCase[],
  useCaseId: string,
  field: DesignerVoteField,
  choice: 'up' | 'down'
): AIAgentUseCase[] {
  return prev.map((u) => {
    if (u.id !== useCaseId) return u;
    if (field === 'label') {
      const cur = u.designer_label_vote;
      return { ...u, designer_label_vote: cur === choice ? undefined : choice };
    }
    if (field === 'payoff') {
      const cur = u.designer_payoff_vote;
      return { ...u, designer_payoff_vote: cur === choice ? undefined : choice };
    }
    const cur = u.designer_agent_message_vote;
    return { ...u, designer_agent_message_vote: cur === choice ? undefined : choice };
  });
}

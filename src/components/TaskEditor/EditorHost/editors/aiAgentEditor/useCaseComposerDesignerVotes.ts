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

/**
 * Applica il voto di validazione dell'header use case.
 *
 * A differenza del voto generico sul campo `label`, questo voto governa anche
 * l'inclusione nella generazione conversazioni:
 * - rosso (`down`) => use case escluso (`included_in_conversations=false`);
 * - verde (`up`) o voto rimosso => torna al default incluso (`true`).
 *
 * Manteniamo qui la regola per evitare che UI diverse applichino solo metà
 * dell'invariante (colore rosso senza esclusione).
 */
export function applyUseCaseHeaderVoteToggle(
  prev: readonly AIAgentUseCase[],
  useCaseId: string,
  choice: 'up' | 'down'
): AIAgentUseCase[] {
  return prev.map((u) => {
    if (u.id !== useCaseId) return u;
    const nextVote = u.designer_label_vote === choice ? undefined : choice;
    return {
      ...u,
      designer_label_vote: nextVote,
      included_in_conversations: nextVote === 'down' ? false : true,
    };
  });
}

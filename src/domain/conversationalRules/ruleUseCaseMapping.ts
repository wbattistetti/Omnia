/**
 * Maps conversational rules to {@link AIAgentUseCase} for reuse of `AIAgentUseCaseComposer`.
 */

import type { AIAgentUseCase } from '@types/aiAgentUseCases';
import type { ConversationalRule } from './types';

/** Present a rule in the use-case composer (flat root list). */
export function conversationalRuleToUseCase(rule: ConversationalRule): AIAgentUseCase {
  const turnId = `asst-${rule.id}`;
  return {
    id: rule.id,
    label: rule.label,
    parent_id: null,
    sort_order: rule.sort_order,
    refinement_prompt: '',
    payoff: rule.scenario,
    dialogue: [
      {
        turn_id: turnId,
        role: 'assistant',
        content: rule.exampleMessage,
        editable: true,
      },
    ],
    notes: { behavior: '', tone: '' },
    bubble_notes: {},
    included_in_conversations: rule.enabled !== false,
  };
}

export function conversationalRulesToUseCases(
  rules: readonly ConversationalRule[]
): AIAgentUseCase[] {
  return [...rules]
    .sort((a, b) => a.sort_order - b.sort_order || a.label.localeCompare(b.label, 'it'))
    .map(conversationalRuleToUseCase);
}

function readAssistantMessage(useCase: AIAgentUseCase): string {
  const turn = useCase.dialogue.find((t) => t.role === 'assistant');
  return typeof turn?.content === 'string' ? turn.content : '';
}

/** Persist composer edits back onto the rule record (full snapshot on task). */
export function useCaseToConversationalRule(
  useCase: AIAgentUseCase,
  previous: ConversationalRule | undefined
): ConversationalRule {
  return {
    id: useCase.id,
    libraryRuleId: previous?.libraryRuleId ?? null,
    label: useCase.label,
    scenario: typeof useCase.payoff === 'string' ? useCase.payoff : '',
    exampleMessage: readAssistantMessage(useCase),
    sort_order: useCase.sort_order,
    enabled: useCase.included_in_conversations !== false,
  };
}

export function useCasesToConversationalRules(
  useCases: readonly AIAgentUseCase[],
  previousById: ReadonlyMap<string, ConversationalRule>
): ConversationalRule[] {
  return useCases.map((uc) => useCaseToConversationalRule(uc, previousById.get(uc.id)));
}

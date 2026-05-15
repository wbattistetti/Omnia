import { describe, expect, it } from 'vitest';
import {
  isUseCaseIncludedInConversations,
  parseAgentUseCasesJson,
  type AIAgentUseCase,
} from '../aiAgentUseCases';

function makeUseCase(overrides: Partial<AIAgentUseCase> = {}): AIAgentUseCase {
  return {
    id: 'uc-1',
    label: 'L',
    parent_id: null,
    sort_order: 0,
    refinement_prompt: '',
    dialogue: [],
    notes: { behavior: '', tone: '' },
    bubble_notes: {},
    ...overrides,
  };
}

describe('isUseCaseIncludedInConversations', () => {
  /**
   * Default behavior: a use case without the flag is treated as included. Garantisce
   * backward-compat per i task storici (pre-feature) e per la pipeline AI che non setta
   * mai esplicitamente il flag a `true` quando crea un nuovo use case.
   */
  it('returns true when included_in_conversations is undefined (backward-compat)', () => {
    expect(isUseCaseIncludedInConversations(makeUseCase())).toBe(true);
  });

  it('returns true when included_in_conversations === true', () => {
    expect(
      isUseCaseIncludedInConversations(makeUseCase({ included_in_conversations: true }))
    ).toBe(true);
  });

  it('returns false ONLY when included_in_conversations === false (explicit opt-out)', () => {
    expect(
      isUseCaseIncludedInConversations(makeUseCase({ included_in_conversations: false }))
    ).toBe(false);
  });
});

describe('parseAgentUseCasesJson — parent_id', () => {
  it('normalizza parent_id stringa vuota o solo spazi a null', () => {
    const raw = JSON.stringify([
      {
        id: 'a',
        label: 'A',
        parent_id: '   ',
        sort_order: 0,
        dialogue: [],
        notes: {},
      },
    ]);
    const list = parseAgentUseCasesJson(raw);
    expect(list).toHaveLength(1);
    expect(list[0].parent_id).toBeNull();
  });
});

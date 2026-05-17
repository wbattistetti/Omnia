/**
 * Toggle pollice designer: stesso comportamento della UI (toggle off sul secondo stesso voto).
 */

import { describe, expect, it } from 'vitest';
import type { AIAgentUseCase } from '@types/aiAgentUseCases';
import {
  applyAllDesignerVotesUp,
  applyDesignerFieldVoteToggle,
  applyUseCaseHeaderVoteToggle,
  applyUseCaseValidatedOnMessageCommit,
} from '../useCaseComposerDesignerVotes';

function minimalUseCase(id: string): AIAgentUseCase {
  return {
    id,
    label: 'L',
    parent_id: null,
    sort_order: 0,
    refinement_prompt: '',
    payoff: '',
    dialogue: [{ turn_id: 't1', role: 'assistant', content: 'x' }],
    notes: { behavior: '', tone: '' },
    bubble_notes: {},
  };
}

describe('applyAllDesignerVotesUp', () => {
  it('sets all three votes up for every use case', () => {
    const prev = [minimalUseCase('a'), minimalUseCase('b')];
    const next = applyAllDesignerVotesUp(prev);
    for (const u of next) {
      expect(u.designer_label_vote).toBe('up');
      expect(u.designer_payoff_vote).toBe('up');
      expect(u.designer_agent_message_vote).toBe('up');
    }
  });
});

describe('applyDesignerFieldVoteToggle', () => {
  it('sets vote when absent', () => {
    const prev = [minimalUseCase('a')];
    const next = applyDesignerFieldVoteToggle(prev, 'a', 'label', 'up');
    expect(next[0].designer_label_vote).toBe('up');
    expect(next[0].designer_payoff_vote).toBeUndefined();
  });

  it('clears vote when same choice clicked', () => {
    const prev: AIAgentUseCase[] = [
      { ...minimalUseCase('a'), designer_label_vote: 'up' },
    ];
    const next = applyDesignerFieldVoteToggle(prev, 'a', 'label', 'up');
    expect(next[0].designer_label_vote).toBeUndefined();
  });

  it('switches agentMessage vote', () => {
    const prev = [minimalUseCase('b')];
    const down = applyDesignerFieldVoteToggle(prev, 'b', 'agentMessage', 'down');
    expect(down[0].designer_agent_message_vote).toBe('down');
    const up = applyDesignerFieldVoteToggle(down, 'b', 'agentMessage', 'up');
    expect(up[0].designer_agent_message_vote).toBe('up');
  });

  it('leaves other use cases untouched', () => {
    const prev = [minimalUseCase('x'), minimalUseCase('y')];
    const next = applyDesignerFieldVoteToggle(prev, 'y', 'payoff', 'down');
    expect(next[0].designer_payoff_vote).toBeUndefined();
    expect(next[1].designer_payoff_vote).toBe('down');
  });
});

describe('applyUseCaseValidatedOnMessageCommit', () => {
  it('sets green votes and includes use case in conversations', () => {
    const prev = {
      ...minimalUseCase('a'),
      included_in_conversations: false,
      designer_label_vote: undefined,
    };
    const next = applyUseCaseValidatedOnMessageCommit(prev);
    expect(next.designer_edit_confirmed).toBe(true);
    expect(next.designer_label_vote).toBe('up');
    expect(next.designer_agent_message_vote).toBe('up');
    expect(next.included_in_conversations).toBe(true);
  });
});

describe('applyUseCaseHeaderVoteToggle', () => {
  it('marks a red header vote as excluded from conversations', () => {
    const prev = [{ ...minimalUseCase('a'), included_in_conversations: true }];
    const next = applyUseCaseHeaderVoteToggle(prev, 'a', 'down');
    expect(next[0].designer_label_vote).toBe('down');
    expect(next[0].included_in_conversations).toBe(false);
  });

  it('marks a green header vote as included by default', () => {
    const prev = [{ ...minimalUseCase('a'), included_in_conversations: false }];
    const next = applyUseCaseHeaderVoteToggle(prev, 'a', 'up');
    expect(next[0].designer_label_vote).toBe('up');
    expect(next[0].included_in_conversations).toBe(true);
  });

  it('clearing a red header vote returns the use case to the included default', () => {
    const prev = [
      {
        ...minimalUseCase('a'),
        designer_label_vote: 'down' as const,
        included_in_conversations: false,
      },
    ];
    const next = applyUseCaseHeaderVoteToggle(prev, 'a', 'down');
    expect(next[0].designer_label_vote).toBeUndefined();
    expect(next[0].included_in_conversations).toBe(true);
  });
});

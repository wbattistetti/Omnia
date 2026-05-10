import { describe, expect, it } from 'vitest';
import { stripAssistantTurnsFromUseCases } from '../stripAssistantTurnsFromUseCases';
import type { AIAgentUseCase } from '@types/aiAgentUseCases';

describe('stripAssistantTurnsFromUseCases', () => {
  it('removes assistant turns, keeps user turns', () => {
    const ucs: AIAgentUseCase[] = [
      {
        id: 'a',
        label: 'L',
        parent_id: null,
        sort_order: 0,
        refinement_prompt: '',
        style_id: 'x',
        payoff: 'p',
        dialogue: [
          { turn_id: 'u1', role: 'user', content: 'hi', editable: true },
          { turn_id: 'a1', role: 'assistant', content: 'bye', editable: true },
        ],
        notes: { behavior: '', tone: '' },
        bubble_notes: {},
      },
    ];
    const next = stripAssistantTurnsFromUseCases(ucs);
    expect(next[0].dialogue).toHaveLength(1);
    expect(next[0].dialogue[0].role).toBe('user');
  });
});

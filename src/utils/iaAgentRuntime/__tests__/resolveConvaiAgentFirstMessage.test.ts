import { describe, expect, it } from 'vitest';
import type { AIAgentUseCase } from '@types/aiAgentUseCases';
import { resolveConvaiAgentFirstMessage } from '../resolveConvaiAgentFirstMessage';

function makeStartUseCase(): AIAgentUseCase {
  return {
    id: 'uc-start',
    label: 'Apertura',
    parent_id: null,
    sort_order: 0,
    refinement_prompt: '',
    payoff: 'Start',
    dialogue: [
      {
        turn_id: 't1',
        role: 'assistant',
        content: 'Che visita desidera prenotare?',
        editable: true,
      },
    ],
    notes: { behavior: '', tone: '' },
    bubble_notes: {},
  };
}

describe('resolveConvaiAgentFirstMessage', () => {
  it('returns empty first_message for kb_deterministic deploy', () => {
    expect(
      resolveConvaiAgentFirstMessage({
        agentConvaiDeployMode: 'kb_deterministic',
        startUseCaseId: 'uc-start',
        useCases: [makeStartUseCase()],
      })
    ).toBe('');
  });

  it('keeps Start UC message in legacy deploy', () => {
    expect(
      resolveConvaiAgentFirstMessage({
        agentConvaiDeployMode: 'legacy',
        startUseCaseId: 'uc-start',
        useCases: [makeStartUseCase()],
      })
    ).toContain('Che visita desidera prenotare');
  });
});

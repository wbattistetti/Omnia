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
  it('returns empty first_message for kb_deterministic without explicit opener', () => {
    expect(
      resolveConvaiAgentFirstMessage({
        agentConvaiDeployMode: 'kb_deterministic',
      })
    ).toBe('');
  });

  it('ignores start UC and start prompt in kb_deterministic (bootstrap via omnia_dialog_step)', () => {
    expect(
      resolveConvaiAgentFirstMessage({
        agentConvaiDeployMode: 'kb_deterministic',
        startUseCaseId: 'uc-start',
        useCases: [makeStartUseCase()],
      })
    ).toBe('');
    expect(
      resolveConvaiAgentFirstMessage({
        agentConvaiDeployMode: 'kb_deterministic',
        agentStartPromptJson: JSON.stringify({ schemaVersion: 1, text: 'Salve.' }),
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

import { describe, expect, it } from 'vitest';
import type { AIAgentUseCase } from '@types/aiAgentUseCases';
import {
  resolveAgentOpeningMessage,
  resolveExplicitAgentOpeningMessage,
} from '../resolveAgentOpeningMessage';

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

describe('resolveAgentOpeningMessage', () => {
  it('prefers agentStartPromptJson over start UC (legacy deploy)', () => {
    expect(
      resolveAgentOpeningMessage({
        agentConvaiDeployMode: 'legacy',
        agentStartPromptJson: JSON.stringify({ schemaVersion: 1, text: 'Benvenuto.' }),
        startUseCaseId: 'uc-start',
        useCases: [makeStartUseCase()],
      })
    ).toBe('Benvenuto.');
  });

  it('uses natural start UC text (legacy deploy)', () => {
    expect(
      resolveAgentOpeningMessage({
        agentConvaiDeployMode: 'legacy',
        startUseCaseId: 'uc-start',
        useCases: [makeStartUseCase()],
      })
    ).toContain('Che visita desidera prenotare');
  });

  it('returns empty for kb_det even with start prompt or start UC (bootstrap via tool)', () => {
    expect(
      resolveAgentOpeningMessage({
        agentConvaiDeployMode: 'kb_deterministic',
        agentStartPromptJson: JSON.stringify({ schemaVersion: 1, text: 'Salve, sono il bot.' }),
      })
    ).toBe('');
    expect(
      resolveAgentOpeningMessage({
        agentConvaiDeployMode: 'kb_deterministic',
        startUseCaseId: 'uc-start',
        useCases: [makeStartUseCase()],
      })
    ).toBe('');
  });

  it('returns empty for kb_det without explicit opener', () => {
    expect(
      resolveAgentOpeningMessage({
        agentConvaiDeployMode: 'kb_deterministic',
      })
    ).toBe('');
  });

  it('resolveExplicitAgentOpeningMessage ignores default fallback', () => {
    expect(resolveExplicitAgentOpeningMessage({})).toBe('');
  });
});

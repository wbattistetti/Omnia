import { describe, expect, it } from 'vitest';
import type { AIAgentUseCase } from '@types/aiAgentUseCases';
import {
  getScenarioDescrittivoText,
  getScenarioDisplayText,
  getScenarioLlmText,
  withScenarioDescrittivo,
} from '../scenarioText';

function uc(partial: Partial<AIAgentUseCase> & Pick<AIAgentUseCase, 'id'>): AIAgentUseCase {
  return {
    id: partial.id,
    label: partial.label ?? 'Test',
    parent_id: partial.parent_id ?? null,
    sort_order: partial.sort_order ?? 0,
    refinement_prompt: '',
    dialogue: [],
    notes: { behavior: '', tone: '' },
    bubble_notes: {},
    ...partial,
  };
}

describe('scenarioText', () => {
  it('reads descrittivo from scenario object', () => {
    const item = uc({
      id: 'a',
      scenario: { descrittivo: 'Narrativa umana.', llm: 'UC: ingresso' },
      payoff: 'Narrativa umana.',
    });
    expect(getScenarioDescrittivoText(item)).toBe('Narrativa umana.');
    expect(getScenarioLlmText(item)).toBe('UC: ingresso');
  });

  it('falls back to payoff when scenario missing', () => {
    const item = uc({ id: 'b', payoff: 'Solo payoff legacy.' });
    expect(getScenarioDescrittivoText(item)).toBe('Solo payoff legacy.');
    expect(getScenarioLlmText(item)).toBe('Solo payoff legacy.');
  });

  it('display toggles llm vs descrittivo', () => {
    const item = uc({
      id: 'c',
      scenario: { descrittivo: 'Lungo.', llm: 'Breve.' },
      payoff: 'Lungo.',
    });
    expect(getScenarioDisplayText(item, false)).toBe('Lungo.');
    expect(getScenarioDisplayText(item, true)).toBe('Breve.');
  });

  it('withScenarioDescrittivo updates payoff and keeps llm', () => {
    const item = uc({
      id: 'd',
      scenario: { descrittivo: 'Vecchio', llm: 'slot: ingresso' },
      payoff: 'Vecchio',
    });
    const next = withScenarioDescrittivo(item, 'Nuovo testo');
    expect(next.payoff).toBe('Nuovo testo');
    expect(next.scenario?.descrittivo).toBe('Nuovo testo');
    expect(next.scenario?.llm).toBe('slot: ingresso');
  });
});

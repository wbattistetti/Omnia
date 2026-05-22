import { describe, expect, it } from 'vitest';
import type { AIAgentUseCase } from '@types/aiAgentUseCases';
import {
  getScenarioDescrittivoText,
  getScenarioLlmText,
  getScenarioText,
  normalizeScenarioOnUseCase,
  withScenarioText,
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

describe('scenarioText unified', () => {
  it('prefers llm as canonical text', () => {
    const item = uc({
      id: 'a',
      scenario: { descrittivo: 'Narrativa lunga.', llm: 'UC: ingresso' },
      payoff: 'Narrativa lunga.',
    });
    expect(getScenarioText(item)).toBe('UC: ingresso');
    expect(getScenarioLlmText(item)).toBe('UC: ingresso');
    expect(getScenarioDescrittivoText(item)).toBe('UC: ingresso');
  });

  it('migrates legacy payoff-only to unified text', () => {
    const item = uc({ id: 'b', payoff: 'Solo payoff legacy.' });
    expect(getScenarioText(item)).toBe('Solo payoff legacy.');
  });

  it('withScenarioText syncs llm, descrittivo and payoff', () => {
    const item = uc({
      id: 'd',
      scenario: { descrittivo: 'Vecchio', llm: 'slot: ingresso' },
      payoff: 'Vecchio',
    });
    const next = withScenarioText(item, 'Nuovo testo');
    expect(next.payoff).toBe('Nuovo testo');
    expect(next.scenario?.descrittivo).toBe('Nuovo testo');
    expect(next.scenario?.llm).toBe('Nuovo testo');
  });

  it('normalizeScenarioOnUseCase mirrors single text', () => {
    const item = uc({
      id: 'e',
      scenario: { descrittivo: 'Solo descrittivo', llm: '' },
      payoff: '',
    });
    const next = normalizeScenarioOnUseCase(item);
    expect(next.scenario?.llm).toBe('Solo descrittivo');
    expect(next.payoff).toBe('Solo descrittivo');
  });
});

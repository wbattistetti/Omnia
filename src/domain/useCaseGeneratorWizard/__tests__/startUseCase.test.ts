import { describe, expect, it } from 'vitest';
import {
  buildStartUseCaseRuleSection,
  buildStartTurnRuleOneOverrideIt,
  buildElevenLabsStartPhaseAppend,
  resolveStartUseCase,
  resolveStartUseCaseSpeechText,
} from '../startUseCase';
import type { AIAgentUseCase } from '@types/aiAgentUseCases';

function makeUseCase(overrides: Partial<AIAgentUseCase> = {}): AIAgentUseCase {
  return {
    id: 'uc-1',
    label: 'Saluto cliente',
    parent_id: null,
    sort_order: 0,
    refinement_prompt: '',
    payoff: 'Saluto',
    dialogue: [
      {
        turn_id: 't1',
        role: 'assistant',
        content: 'Buongiorno, sono il suo assistente.',
        editable: true,
      },
    ],
    notes: { behavior: '', tone: '' },
    bubble_notes: {},
    ...overrides,
  };
}

describe('startUseCase', () => {
  it('resolveStartUseCase returns null for blank id', () => {
    expect(resolveStartUseCase([makeUseCase()], '')).toBeNull();
  });

  it('resolveStartUseCase ignores excluded use cases', () => {
    const uc = makeUseCase({ id: 'uc-x', included_in_conversations: false });
    expect(resolveStartUseCase([uc], 'uc-x')).toBeNull();
  });

  it('buildStartUseCaseRuleSection is empty without start id', () => {
    expect(buildStartUseCaseRuleSection([makeUseCase()], null)).toBe('');
  });

  it('buildStartUseCaseRuleSection includes catalog number and label', () => {
    const section = buildStartUseCaseRuleSection([makeUseCase()], 'uc-1');
    expect(section).toContain('Regola di Start');
    expect(section).toContain('FASE START');
    expect(section).toContain('Use Case 1 «Saluto cliente»');
    expect(section).toContain('frase statica');
    expect(section).toContain('Buongiorno');
  });

  it('buildStartTurnRuleOneOverrideIt prioritizes turn 0', () => {
    const meta = {
      useCaseId: 'uc-1',
      catalogNumber: '1',
      label: 'Saluto cliente',
      scenario: 'Saluto',
      speechTemplate: 'Buongiorno.',
    };
    const rule = buildStartTurnRuleOneOverrideIt(meta);
    expect(rule).toContain('Turno 0');
    expect(rule).toContain('FASE START');
    expect(rule).toContain('Use Case 1');
  });

  it('buildElevenLabsStartPhaseAppend is empty when immediate start', () => {
    expect(
      buildElevenLabsStartPhaseAppend(
        {
          useCaseId: 'uc-1',
          catalogNumber: '1',
          label: 'Saluto',
          scenario: '',
          speechTemplate: 'Ciao.',
        },
        { agentImmediateStart: true }
      )
    ).toBe('');
  });

  it('resolveStartUseCaseSpeechText returns assistant phrase', () => {
    expect(resolveStartUseCaseSpeechText([makeUseCase()], 'uc-1')).toContain('Buongiorno');
  });
});

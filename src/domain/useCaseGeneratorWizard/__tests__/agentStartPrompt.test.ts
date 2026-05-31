import { describe, expect, it } from 'vitest';
import {
  START_AGENT_SCENARIO_ID,
  buildAgentPromptCatalogExport,
  buildStartAgentPromptSection,
  emptyAgentStartPromptConfig,
  isStartAgentUseCase,
  parseAgentStartPromptJson,
  resolveAgentStartPromptSpeechText,
  serializeAgentStartPromptConfig,
} from '../agentStartPrompt';
import type { AIAgentUseCase } from '@types/aiAgentUseCases';

function makeUseCase(id: string): AIAgentUseCase {
  return {
    id,
    label: id,
    parent_id: null,
    sort_order: 0,
    refinement_prompt: '',
    payoff: 'payoff',
    dialogue: [{ turn_id: 't1', role: 'assistant', content: 'Ciao.', editable: true }],
    notes: { behavior: '', tone: '' },
    bubble_notes: {},
  };
}

describe('agentStartPrompt', () => {
  it('parseAgentStartPromptJson returns empty config for blank input', () => {
    expect(parseAgentStartPromptJson('')).toEqual(emptyAgentStartPromptConfig());
  });

  it('parseAgentStartPromptJson reads JSON with variants', () => {
    const raw = JSON.stringify({
      schemaVersion: 1,
      text: 'Salve.',
      variants: [{ id: 'v1', when: 'mattina', text: 'Buongiorno.' }],
    });
    const cfg = parseAgentStartPromptJson(raw);
    expect(cfg.text).toBe('Salve.');
    expect(cfg.variants).toHaveLength(1);
    expect(cfg.variants![0].text).toBe('Buongiorno.');
  });

  it('serializeAgentStartPromptConfig omits empty payload', () => {
    expect(serializeAgentStartPromptConfig(emptyAgentStartPromptConfig())).toBe('');
  });

  it('resolveAgentStartPromptSpeechText joins main and variants', () => {
    const speech = resolveAgentStartPromptSpeechText({
      schemaVersion: 1,
      text: 'Ciao.',
      variants: [{ id: 'v1', when: 'sera', text: 'Buonasera.' }],
    });
    expect(speech).toContain('Ciao.');
    expect(speech).toContain('WHEN sera: Buonasera.');
  });

  it('buildStartAgentPromptSection is empty when speech is blank', () => {
    expect(buildStartAgentPromptSection(emptyAgentStartPromptConfig())).toBe('');
  });

  it('buildStartAgentPromptSection includes startAgent header when configured', () => {
    const section = buildStartAgentPromptSection({ schemaVersion: 1, text: 'Benvenuto.' });
    expect(section).toContain('startAgent');
    expect(section).toContain('Benvenuto.');
  });

  it('isStartAgentUseCase matches scenario id', () => {
    expect(isStartAgentUseCase({ id: START_AGENT_SCENARIO_ID })).toBe(true);
    expect(isStartAgentUseCase({ id: 'uc-booking' })).toBe(false);
  });

  it('buildAgentPromptCatalogExport excludes startAgent from useCases', () => {
    const exported = buildAgentPromptCatalogExport(
      [makeUseCase('uc-1'), makeUseCase(START_AGENT_SCENARIO_ID)],
      { startUseCaseId: 'uc-1' }
    );
    expect(exported.startUseCaseId).toBe('uc-1');
    expect(exported.useCases.map((u) => u.useCaseId)).toEqual(['uc-1']);
  });
});

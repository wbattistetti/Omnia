/**
 * Proiezione token di stile nel JSON conversazionale.
 */

import { describe, expect, it } from 'vitest';
import type { AIAgentUseCase } from '@types/aiAgentUseCases';
import { ensureUseCasePhrases } from '../migrateUseCase';
import {
  STYLE_RULE_LLM_TEXT,
  buildUseCaseStyleTokenJsonFields,
  projectScenarioLlmText,
  useCaseHasStyleTokens,
} from '../styleTokenProjection';
import { projectUseCaseToConversationalJson } from '@domain/useCaseGeneratorWizard/useCaseJsonProjection';

function ucWithStyle(): AIAgentUseCase {
  return ensureUseCasePhrases({
    id: 'uc-st',
    label: 'Prenotazione',
    parent_id: null,
    sort_order: 0,
    refinement_prompt: '',
    payoff: 'Prenota visita.',
    scenario: { descrittivo: 'Prenota visita.', llm: 'PRENOTAZIONE|visita' },
    dialogue: [
      {
        turn_id: 't1',
        role: 'assistant',
        content: '«Perfetto,» Vorrei prenotare il [ecografia] il [15 giugno]. «Va bene?»',
        editable: true,
      },
    ],
    notes: { behavior: '', tone: '' },
    bubble_notes: {},
    phrases: [
      {
        phraseId: 'ph-uc-st-0',
        naturalText:
          '«Perfetto,» Vorrei prenotare il [ecografia] il [15 giugno]. «Va bene?»',
        variants: [{ variantId: 'default' }],
        styleTokens: [
          {
            styleTokenId: 'st-perfetto',
            defaultSurface: 'Perfetto,',
            variants: ['Perfetto,', 'Va bene,', 'Certamente,'],
          },
          {
            styleTokenId: 'st-va-bene',
            defaultSurface: 'Va bene?',
            variants: ['Va bene?', 'Conferma?', 'Le sta bene?'],
          },
        ],
      },
    ],
  });
}

describe('styleTokenProjection', () => {
  it('detects style tokens from metadata or guillemets in dialogue', () => {
    expect(useCaseHasStyleTokens(ucWithStyle())).toBe(true);
    expect(useCaseHasStyleTokens({ ...ucWithStyle(), phrases: [] })).toBe(true);
    const plain = ensureUseCasePhrases({
      id: 'uc-plain-detect',
      label: 'X',
      parent_id: null,
      sort_order: 0,
      refinement_prompt: '',
      payoff: 'Solo slot.',
      dialogue: [
        { turn_id: 't', role: 'assistant', content: 'Ciao [Mario].', editable: true },
      ],
      notes: { behavior: '', tone: '' },
      bubble_notes: {},
    });
    expect(useCaseHasStyleTokens(plain)).toBe(false);
  });

  it('buildUseCaseStyleTokenJsonFields returns fixed style_rule and tokens_stile map', () => {
    const fields = buildUseCaseStyleTokenJsonFields(ucWithStyle());
    expect(fields?.style_rule.llm).toBe(STYLE_RULE_LLM_TEXT);
    expect(fields?.tokens_stile['st-perfetto']).toEqual([
      'Perfetto,',
      'Va bene,',
      'Certamente,',
    ]);
    expect(fields?.template).toContain('«Perfetto,»');
  });

  it('projectScenarioLlmText appends style rule to scenario llm', () => {
    const s = projectScenarioLlmText(ucWithStyle());
    expect(s).toContain('PRENOTAZIONE|visita');
    expect(s).toContain(STYLE_RULE_LLM_TEXT);
  });

  it('projectUseCaseToConversationalJson includes style fields when present', () => {
    const json = projectUseCaseToConversationalJson(ucWithStyle());
    expect(json?.tokens_stile?.['st-va-bene']).toHaveLength(3);
    expect(json?.style_rule?.llm).toBe(STYLE_RULE_LLM_TEXT);
    expect(json?.template).toContain('[ecografia]');
    expect(json?.scenario).toContain(STYLE_RULE_LLM_TEXT);
  });

  it('omits style fields when no style tokens', () => {
    const plain = ensureUseCasePhrases({
      id: 'uc-plain',
      label: 'X',
      parent_id: null,
      sort_order: 0,
      refinement_prompt: '',
      payoff: 'Solo slot.',
      dialogue: [
        { turn_id: 't', role: 'assistant', content: 'Ciao [Mario].', editable: true },
      ],
      notes: { behavior: '', tone: '' },
      bubble_notes: {},
    });
    const json = projectUseCaseToConversationalJson(plain);
    expect(json?.tokens_stile).toBeUndefined();
    expect(json?.style_rule).toBeUndefined();
    expect(json?.template).toBeUndefined();
  });
});

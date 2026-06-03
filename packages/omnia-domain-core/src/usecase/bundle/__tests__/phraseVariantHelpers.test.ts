/**
 * Test helper phrase/variant: sync dialogue.
 */

import { describe, expect, it } from 'vitest';
import type { AIAgentUseCase } from '@types/aiAgentUseCases';
import {
  patchPrimaryPhraseVariantTokenizedText,
  patchPrimaryPhraseSemanticSlotAssignment,
  syncPrimaryPhraseNaturalFromAssistantTurn,
} from '../phraseVariantHelpers';
import {
  buildSlotLexiconGlossaryPromptSection,
  mergeSlotDefinitionsIntoLexicon,
} from '../dynamicSlotRegistry';
import { emptyProjectSlotLexicon } from '../projectSlotLexicon';

function baseUseCase(): AIAgentUseCase {
  return {
    id: 'uc-1',
    label: 'Test',
    parent_id: null,
    sort_order: 0,
    refinement_prompt: '',
    payoff: '',
    dialogue: [
      {
        turn_id: 'turn-a',
        role: 'assistant',
        content: 'Canonico [slot]',
        editable: true,
      },
    ],
    notes: { behavior: '', tone: '' },
    bubble_notes: {},
    phrases: [
      {
        phraseId: 'ph-uc-1-0',
        naturalText: 'Canonico [slot]',
        variants: [{ variantId: 'default' }],
      },
    ],
  };
}

describe('syncPrimaryPhraseNaturalFromAssistantTurn', () => {
  it('updates phrases[0].naturalText and clears compiled snapshots', () => {
    const uc = baseUseCase();
    const withCompiled: AIAgentUseCase = {
      ...uc,
      phrases: [
        {
          ...uc.phrases![0],
          variants: [
            {
              variantId: 'default',
              compiled: {
                tokenizedText: 'x',
                tokens: [],
                mappings: [],
                status: 'fresh',
                compiledAt: 't',
              },
            },
          ],
        },
      ],
    };
    const out = syncPrimaryPhraseNaturalFromAssistantTurn(withCompiled, 'turn-a', 'Nuovo [testo]');
    expect(out.phrases?.[0].naturalText).toBe('Nuovo [testo]');
    expect(out.phrases?.[0].variants[0].compiled).toBeUndefined();
    expect(out.dialogue.find((t) => t.turn_id === 'turn-a')?.content).toBe('Canonico [slot]');
  });

  it('no-op when turn id unknown', () => {
    const uc = baseUseCase();
    const out = syncPrimaryPhraseNaturalFromAssistantTurn(uc, 'missing', 'x');
    expect(out).toBe(uc);
  });
});

describe('patchPrimaryPhraseVariantTokenizedText', () => {
  it('stores manual tokenized override on default variant as fresh', () => {
    const uc = baseUseCase();
    const out = patchPrimaryPhraseVariantTokenizedText(
      uc,
      'Il [medico] è [specialita].'
    );
    const compiled = out.phrases?.[0].variants[0].compiled;
    expect(compiled?.tokenizedText).toBe('Il [medico] è [specialita].');
    expect(compiled?.tokens).toEqual(['medico', 'specialita']);
    expect(compiled?.status).toBe('fresh');
  });
});

describe('patchPrimaryPhraseSemanticSlotAssignment', () => {
  it('replaces tokenized bracket and records local mapping from natural surface', () => {
    const uc = baseUseCase();
    const withNatural = syncPrimaryPhraseNaturalFromAssistantTurn(
      uc,
      'turn-a',
      'Il [Dott. Verdi] è un [Allergologo].'
    );
    const tokenized = 'Il [dott. verdi] è un [allergologo].';
    const out = patchPrimaryPhraseSemanticSlotAssignment(withNatural, {
      tokenizedText: tokenized,
      oldToken: 'dott. verdi',
      newSlotId: 'medico_richiesto',
    });
    const phrase = out.phrases?.[0];
    const compiled = phrase?.variants[0].compiled;
    expect(compiled?.tokenizedText).toContain('[medico_richiesto]');
    expect(compiled?.status).toBe('fresh');
    expect(phrase?.localMappings?.some((m) => m.slot_id === 'medico_richiesto')).toBe(true);
  });
});

describe('buildSlotLexiconGlossaryPromptSection', () => {
  it('emits glossary lines for slots with descriptions', () => {
    const lex = mergeSlotDefinitionsIntoLexicon(emptyProjectSlotLexicon(), [
      {
        slotId: 'specialita_richiesta',
        description: 'Specialità che il paziente desidera consultare',
      },
    ]);
    const section = buildSlotLexiconGlossaryPromptSection(lex);
    expect(section).toContain('specialita_richiesta');
    expect(section).toContain('paziente desidera consultare');
  });
});

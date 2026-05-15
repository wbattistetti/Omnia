/**
 * Test helper phrase/variant: sync dialogue, varianti strutturali.
 */

import { describe, expect, it } from 'vitest';
import type { AIAgentUseCase } from '@types/aiAgentUseCases';
import {
  addStructuralVariantToPrimaryPhrase,
  patchStructuralVariant,
  removeStructuralVariant,
  syncPrimaryPhraseNaturalFromAssistantTurn,
} from '../phraseVariantHelpers';

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

describe('structural variants', () => {
  it('addStructuralVariantToPrimaryPhrase appends structural_N', () => {
    let uc = baseUseCase();
    uc = addStructuralVariantToPrimaryPhrase(uc);
    expect(uc.phrases?.[0].variants.map((v) => v.variantId)).toEqual(['default', 'structural_1']);
    uc = addStructuralVariantToPrimaryPhrase(uc);
    expect(uc.phrases?.[0].variants.map((v) => v.variantId)).toEqual([
      'default',
      'structural_1',
      'structural_2',
    ]);
  });

  it('patchStructuralVariant updates fields and clears compiled', () => {
    let uc = baseUseCase();
    uc = addStructuralVariantToPrimaryPhrase(uc);
    uc = patchStructuralVariant(uc, 'structural_1', {
      naturalText: 'Altro [x]',
      when: 'prima visita',
    });
    const v = uc.phrases?.[0].variants.find((x) => x.variantId === 'structural_1');
    expect(v?.naturalText).toBe('Altro [x]');
    expect(v?.when).toBe('prima visita');
    expect(v?.compiled).toBeUndefined();
  });

  it('removeStructuralVariant drops non-default id', () => {
    let uc = baseUseCase();
    uc = addStructuralVariantToPrimaryPhrase(uc);
    uc = removeStructuralVariant(uc, 'structural_1');
    expect(uc.phrases?.[0].variants).toHaveLength(1);
    expect(uc.phrases?.[0].variants[0].variantId).toBe('default');
  });

  it('removeStructuralVariant ignores default', () => {
    const uc = baseUseCase();
    const out = removeStructuralVariant(uc, 'default');
    expect(out.phrases?.[0].variants).toHaveLength(1);
  });
});

/**
 * Test helper phrase/variant: sync dialogue.
 */

import { describe, expect, it } from 'vitest';
import type { AIAgentUseCase } from '@types/aiAgentUseCases';
import { syncPrimaryPhraseNaturalFromAssistantTurn } from '../phraseVariantHelpers';

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

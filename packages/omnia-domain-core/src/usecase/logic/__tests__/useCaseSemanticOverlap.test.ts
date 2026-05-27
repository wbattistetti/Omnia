import { describe, expect, it } from 'vitest';
import type { AIAgentUseCase } from '@types/aiAgentUseCases';
import {
  formatOverlapDesignerMessage,
  overlapClassificationLabel,
  parseOverlapHintField,
} from '../useCaseSemanticOverlap';

describe('useCaseSemanticOverlap', () => {
  it('parseOverlapHintField', () => {
    const hint = parseOverlapHintField({
      classification: 'variant',
      score: 0.87,
      related: [
        {
          useCaseId: 'uc-a',
          catalogNumber: 3,
          label: 'Prima visita',
          relation: 'variant_of',
          score: 0.87,
        },
      ],
      designerMessage: '',
    });
    expect(hint?.classification).toBe('variant');
    expect(hint?.related).toHaveLength(1);
  });

  it('formatOverlapDesignerMessage for variant', () => {
    const msg = formatOverlapDesignerMessage(
      {
        classification: 'variant',
        related: [
          {
            useCaseId: 'x',
            label: 'Scelta visita',
            relation: 'variant_of',
            score: 0.9,
            catalogNumber: 5,
          },
        ],
        designerMessage: '',
      },
      new Map([['x', 5]])
    );
    expect(msg).toContain('UC 5');
    expect(msg).toContain('variante');
  });

  it('overlapClassificationLabel', () => {
    expect(overlapClassificationLabel('duplicate')).toBe('Duplicato');
    expect(overlapClassificationLabel('new')).toBe('Nuovo');
  });
});

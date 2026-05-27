import { describe, expect, it } from 'vitest';
import type { AIAgentUseCase, AIAgentUseCaseCategory } from '@types/aiAgentUseCases';
import {
  formatCategorizationFailureBanner,
  validateCategorizationResult,
} from '../useCaseCategorizationRun';

const uc = (id: string, category_id?: string): AIAgentUseCase =>
  ({
    id,
    label: id,
    parent_id: null,
    sort_order: 0,
    refinement_prompt: '',
    dialogue: [],
    notes: { behavior: '', tone: '' },
    bubble_notes: {},
    ...(category_id ? { category_id } : {}),
  }) as AIAgentUseCase;

const cat = (id: string): AIAgentUseCaseCategory => ({
  id,
  label: id,
  sort_order: 0,
});

describe('validateCategorizationResult', () => {
  it('throws when categories empty', () => {
    expect(() => validateCategorizationResult([uc('a')], [])).toThrow(/Nessuna categoria/);
  });

  it('throws when no use case assigned', () => {
    expect(() =>
      validateCategorizationResult([uc('a'), uc('b')], [cat('cat_x')])
    ).toThrow(/Nessun use case assegnato/);
  });

  it('passes when at least one assigned', () => {
    expect(() =>
      validateCategorizationResult(
        [uc('a', 'cat_x'), uc('b')],
        [cat('cat_x')]
      )
    ).not.toThrow();
  });
});

describe('formatCategorizationFailureBanner', () => {
  it('includes count and error detail', () => {
    const msg = formatCategorizationFailureBanner(9, new Error('fetch failed'));
    expect(msg).toContain('9');
    expect(msg).toContain('fetch failed');
    expect(msg).toContain('Categorizzazione non applicata');
  });
});

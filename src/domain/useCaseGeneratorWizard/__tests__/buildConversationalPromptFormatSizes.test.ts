import { describe, expect, it } from 'vitest';
import { buildConversationalPrompt } from '../buildConversationalPrompt';
import { buildConversationalPromptFormatSizes } from '../buildConversationalPromptFormatSizes';
import type { AIAgentUseCase } from '@types/aiAgentUseCases';

function makeUseCase(overrides: Partial<AIAgentUseCase> = {}): AIAgentUseCase {
  return {
    id: 'uc-1',
    label: 'Use case A',
    parent_id: null,
    sort_order: 0,
    refinement_prompt: '',
    payoff: 'Scenario di esempio.',
    dialogue: [
      {
        turn_id: 'turn-1',
        role: 'assistant',
        content: 'Ciao [Mario], ti propongo il [12 giugno].',
        editable: true,
      },
    ],
    notes: { behavior: '', tone: '' },
    bubble_notes: {},
    ...overrides,
  };
}

describe('buildConversationalPromptFormatSizes', () => {
  it('returns catalog savings vs json-pretty for every format', () => {
    const sizes = buildConversationalPromptFormatSizes([makeUseCase()]);
    expect(sizes['json-pretty'].catalogTokenSavingsPercentVsPretty).toBe(0);
    expect(sizes['json-compact'].catalogTokenSavingsPercentVsPretty).toBeGreaterThan(0);
    expect(sizes['dsl-ultra'].catalogTokenSavingsPercentVsPretty).toBeGreaterThan(0);
  });

  it('compact catalog is smaller than pretty catalog', () => {
    const sizes = buildConversationalPromptFormatSizes([
      makeUseCase(),
      makeUseCase({ id: 'uc-2', sort_order: 1 }),
    ]);
    expect(sizes['json-compact'].catalog.estimatedTokens).toBeLessThan(
      sizes['json-pretty'].catalog.estimatedTokens
    );
    expect(sizes['dsl-ultra'].catalog.estimatedTokens).toBeLessThan(
      sizes['json-pretty'].catalog.estimatedTokens
    );
  });

  it('matches measurePromptText on full build per format', () => {
    const ucs = [makeUseCase()];
    const sizes = buildConversationalPromptFormatSizes(ucs);
    const prettyText = buildConversationalPrompt(ucs, { catalogFormat: 'json-pretty' });
    expect(sizes['json-pretty'].total.charCount).toBe(prettyText.length);
  });
});

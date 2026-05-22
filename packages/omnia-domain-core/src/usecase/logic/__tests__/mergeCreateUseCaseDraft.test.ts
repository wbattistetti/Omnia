/**
 * Tests backend merge helper for create_use_case (design-time draft → LLM polish).
 */
import { describe, it, expect } from 'vitest';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { mergeCreateUseCaseWithDraft } = require(
  '../../../../../../backend/services/mergeCreateUseCaseDraft.js'
) as {
  mergeCreateUseCaseWithDraft: (
    normalized: Record<string, unknown>,
    draft: Record<string, unknown>
  ) => Record<string, unknown>;
};

describe('mergeCreateUseCaseWithDraft', () => {
  it('uses model label and payoff when present', () => {
    const out = mergeCreateUseCaseWithDraft(
      { label: 'Short', payoff: 'Expanded scenario.', dialogue: [] },
      { label: 'Rough long draft...', notes: { behavior: 'Rough' } }
    );
    expect(out.label).toBe('Short');
    expect(out.payoff).toBe('Expanded scenario.');
  });

  it('falls back to draft label when model omits label', () => {
    const out = mergeCreateUseCaseWithDraft(
      { label: '', payoff: 'P', dialogue: [] },
      { label: 'Fallback title', notes: { behavior: 'b' } }
    );
    expect(out.label).toBe('Fallback title');
  });

  it('falls back to notes.behavior for payoff when model omits payoff', () => {
    const out = mergeCreateUseCaseWithDraft(
      { label: 'L', payoff: '', dialogue: [] },
      { label: 'x', notes: { behavior: 'Designer rough scenario text' } }
    );
    expect(out.payoff).toBe('Designer rough scenario text');
  });
});

import { describe, expect, it } from 'vitest';
import type { AIAgentUseCase } from '@types/aiAgentUseCases';
import {
  computeExamplePhraseStylePlan,
  normalizeExamplePhraseForDiff,
  snapshotAssistantContentByUseCaseId,
} from '../examplePhraseStyleDiff';

function uc(id: string, assistant: string): AIAgentUseCase {
  return {
    id,
    label: id,
    parent_id: null,
    sort_order: 0,
    refinement_prompt: '',
    payoff: '',
    dialogue: [{ turn_id: 't1', role: 'assistant', content: assistant }],
    notes: { behavior: '', tone: '' },
    bubble_notes: {},
  };
}

describe('normalizeExamplePhraseForDiff', () => {
  it('collapses whitespace', () => {
    expect(normalizeExamplePhraseForDiff('  a  b  \n c ')).toBe('a b c');
  });
});

describe('computeExamplePhraseStylePlan', () => {
  it('shows CTA when one edited and one untouched vs baseline', () => {
    const list = [uc('a', 'hello'), uc('b', 'world')];
    const baseline = snapshotAssistantContentByUseCaseId(list);
    const edited = list.map((u) => (u.id === 'a' ? { ...u, dialogue: [{ ...u.dialogue[0], content: 'hello!' }] } : u));
    const plan = computeExamplePhraseStylePlan(edited, baseline);
    expect(plan.modifiedIds).toEqual(['a']);
    expect(plan.targetIds).toEqual(['b']);
    expect(plan.showStyleCta).toBe(true);
  });

  it('hides CTA when all match baseline', () => {
    const list = [uc('a', 'x')];
    const baseline = snapshotAssistantContentByUseCaseId(list);
    const plan = computeExamplePhraseStylePlan(list, baseline);
    expect(plan.showStyleCta).toBe(false);
  });

  it('hides CTA when all modified (nothing to propagate)', () => {
    const base = snapshotAssistantContentByUseCaseId([uc('a', 'x'), uc('b', 'y')]);
    const list = [uc('a', 'x2'), uc('b', 'y2')];
    const plan = computeExamplePhraseStylePlan(list, base);
    expect(plan.showStyleCta).toBe(false);
  });
});

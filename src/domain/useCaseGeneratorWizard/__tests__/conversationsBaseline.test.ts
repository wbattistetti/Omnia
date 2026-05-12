import { describe, expect, it } from 'vitest';
import {
  computeConversationStylePlan,
  conversationAgentTurnKey,
  indexAgentTurnKeysByUseCaseId,
  snapshotConversationAgentTurns,
} from '../conversationsBaseline';
import type { UseCaseGeneratorWizardConversation } from '../types';

function makeConversation(
  conversationId: string,
  bubbles: Array<
    | { role: 'user'; turnId: string; text: string }
    | {
        role: 'agent';
        turnId: string;
        useCaseId: string;
        text: string;
        label?: string;
        suggestionStatus?: 'pending' | 'rejected' | 'promoted';
        proposedLabel?: string;
      }
  >,
  options?: { outcome?: 'positive' | 'negative'; allowsSuggested?: boolean }
): UseCaseGeneratorWizardConversation {
  return {
    conversationId,
    turns: bubbles.map((b) =>
      b.role === 'user'
        ? { turnId: b.turnId, role: 'user', text: b.text }
        : {
            turnId: b.turnId,
            role: 'agent',
            useCaseId: b.useCaseId,
            useCaseLabel: b.label ?? b.useCaseId,
            text: b.text,
            ...(b.suggestionStatus
              ? {
                  suggestion: {
                    status: b.suggestionStatus,
                    proposedLabel: b.proposedLabel ?? b.label ?? b.useCaseId,
                  },
                }
              : {}),
          }
    ),
    outcome: options?.outcome ?? 'positive',
    ...(options?.allowsSuggested ? { allowsSuggestedUseCases: true } : {}),
  };
}

describe('snapshotConversationAgentTurns', () => {
  it('only captures agent turns and keys them by conversationId::turnId', () => {
    const conv = makeConversation('c1', [
      { role: 'user', turnId: 't1', text: 'utente' },
      { role: 'agent', turnId: 't2', useCaseId: 'uc1', text: 'risposta 1' },
      { role: 'agent', turnId: 't3', useCaseId: 'uc2', text: 'risposta 2' },
    ]);
    const snap = snapshotConversationAgentTurns([conv]);
    expect(Object.keys(snap)).toEqual([
      conversationAgentTurnKey('c1', 't2'),
      conversationAgentTurnKey('c1', 't3'),
    ]);
    expect(snap[conversationAgentTurnKey('c1', 't2')]).toBe('risposta 1');
  });
});

describe('computeConversationStylePlan', () => {
  it('shows homogenize CTA when at least one agent bubble differs from baseline', () => {
    const conv = makeConversation('c1', [
      { role: 'agent', turnId: 't1', useCaseId: 'uc1', text: 'edited!' },
      { role: 'agent', turnId: 't2', useCaseId: 'uc2', text: 'untouched' },
    ]);
    const baseline = {
      [conversationAgentTurnKey('c1', 't1')]: 'original',
      [conversationAgentTurnKey('c1', 't2')]: 'untouched',
    };
    const plan = computeConversationStylePlan([conv], baseline);
    expect(plan.showHomogenizeCta).toBe(true);
    expect(plan.modifiedAgentTurnKeys).toEqual([conversationAgentTurnKey('c1', 't1')]);
    expect(plan.modifiedByConversation.c1).toEqual(['t1']);
    expect(plan.modifiedAgentTurns).toHaveLength(1);
    expect(plan.modifiedAgentTurns[0]).toMatchObject({
      conversationId: 'c1',
      turnId: 't1',
      useCaseId: 'uc1',
      currentText: 'edited!',
      baselineText: 'original',
    });
  });

  it('hides CTA when no agent bubble differs', () => {
    const conv = makeConversation('c1', [
      { role: 'agent', turnId: 't1', useCaseId: 'uc1', text: 'x' },
    ]);
    const baseline = { [conversationAgentTurnKey('c1', 't1')]: 'x' };
    const plan = computeConversationStylePlan([conv], baseline);
    expect(plan.showHomogenizeCta).toBe(false);
    expect(plan.modifiedAgentTurnKeys).toEqual([]);
  });

  it('ignores agent turns missing from baseline (treated as unmodified)', () => {
    const conv = makeConversation('c1', [
      { role: 'agent', turnId: 't1', useCaseId: 'uc1', text: 'fresh' },
    ]);
    const plan = computeConversationStylePlan([conv], {});
    expect(plan.showHomogenizeCta).toBe(false);
    expect(plan.modifiedAgentTurnKeys).toEqual([]);
  });

  it('does not flag user edits as modifications', () => {
    const conv = makeConversation('c1', [
      { role: 'user', turnId: 'u1', text: 'changed by designer' },
    ]);
    const baseline = {};
    const plan = computeConversationStylePlan([conv], baseline);
    expect(plan.showHomogenizeCta).toBe(false);
  });

  it('groups modifications by conversationId across multiple conversations', () => {
    const a = makeConversation('cA', [
      { role: 'agent', turnId: 'a1', useCaseId: 'uc1', text: 'edited A' },
    ]);
    const b = makeConversation('cB', [
      { role: 'agent', turnId: 'b1', useCaseId: 'uc2', text: 'edited B' },
    ]);
    const baseline = {
      [conversationAgentTurnKey('cA', 'a1')]: 'orig A',
      [conversationAgentTurnKey('cB', 'b1')]: 'orig B',
    };
    const plan = computeConversationStylePlan([a, b], baseline);
    expect(Object.keys(plan.modifiedByConversation).sort()).toEqual(['cA', 'cB']);
    expect(plan.modifiedAgentTurnKeys).toHaveLength(2);
  });

  it('normalizes whitespace-only differences as equal to baseline', () => {
    const conv = makeConversation('c1', [
      { role: 'agent', turnId: 't1', useCaseId: 'uc1', text: '  ciao   mondo  \n  ' },
    ]);
    const baseline = { [conversationAgentTurnKey('c1', 't1')]: 'ciao mondo' };
    const plan = computeConversationStylePlan([conv], baseline);
    expect(plan.showHomogenizeCta).toBe(false);
  });

  it('exposes showStyleCta only when at least one bubble is modified AND another is still at baseline in the same conversation', () => {
    const conv = makeConversation('c1', [
      { role: 'agent', turnId: 't1', useCaseId: 'uc1', text: 'edited!' },
      { role: 'agent', turnId: 't2', useCaseId: 'uc2', text: 'baseline' },
    ]);
    const baseline = {
      [conversationAgentTurnKey('c1', 't1')]: 'orig',
      [conversationAgentTurnKey('c1', 't2')]: 'baseline',
    };
    const plan = computeConversationStylePlan([conv], baseline);
    expect(plan.showProofreadCta).toBe(true);
    expect(plan.showStyleCta).toBe(true);
    expect(plan.unmodifiedByConversation.c1).toEqual(['t2']);
  });

  it('hides showStyleCta when ALL bubbles of a conversation are modified (no unmodified targets)', () => {
    const conv = makeConversation('c1', [
      { role: 'agent', turnId: 't1', useCaseId: 'uc1', text: 'edited 1' },
      { role: 'agent', turnId: 't2', useCaseId: 'uc2', text: 'edited 2' },
    ]);
    const baseline = {
      [conversationAgentTurnKey('c1', 't1')]: 'orig 1',
      [conversationAgentTurnKey('c1', 't2')]: 'orig 2',
    };
    const plan = computeConversationStylePlan([conv], baseline);
    expect(plan.showProofreadCta).toBe(true);
    expect(plan.showStyleCta).toBe(false);
  });

  it('excludes rejected suggested bubbles from diff and plans', () => {
    const conv = makeConversation('c1', [
      {
        role: 'agent',
        turnId: 'r1',
        useCaseId: 'suggested:abc',
        text: 'edited',
        suggestionStatus: 'rejected',
        proposedLabel: 'X',
      },
      { role: 'agent', turnId: 't1', useCaseId: 'uc1', text: 'baseline' },
    ]);
    const baseline = {
      [conversationAgentTurnKey('c1', 'r1')]: 'orig',
      [conversationAgentTurnKey('c1', 't1')]: 'baseline',
    };
    const plan = computeConversationStylePlan([conv], baseline);
    expect(plan.modifiedAgentTurnKeys).toEqual([]);
    expect(plan.showProofreadCta).toBe(false);
  });
});

describe('indexAgentTurnKeysByUseCaseId', () => {
  it('indexes only real use case ids (no suggested:* and no rejected suggestions)', () => {
    const a = makeConversation('cA', [
      { role: 'agent', turnId: 'a1', useCaseId: 'uc1', text: 'a' },
      { role: 'agent', turnId: 'a2', useCaseId: 'uc2', text: 'b' },
      {
        role: 'agent',
        turnId: 'a3',
        useCaseId: 'suggested:xyz',
        text: 'c',
        suggestionStatus: 'pending',
      },
    ]);
    const b = makeConversation('cB', [
      { role: 'agent', turnId: 'b1', useCaseId: 'uc1', text: 'd' },
      {
        role: 'agent',
        turnId: 'b2',
        useCaseId: 'uc3',
        text: 'e',
        suggestionStatus: 'rejected',
        proposedLabel: 'x',
      },
    ]);
    const idx = indexAgentTurnKeysByUseCaseId([a, b]);
    expect(idx).toEqual({
      uc1: [conversationAgentTurnKey('cA', 'a1'), conversationAgentTurnKey('cB', 'b1')],
      uc2: [conversationAgentTurnKey('cA', 'a2')],
    });
  });
});

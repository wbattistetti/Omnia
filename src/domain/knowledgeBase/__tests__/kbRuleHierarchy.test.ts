import { describe, expect, it } from 'vitest';
import type { KbInducedRule } from '../kbRuleTypes';
import {
  buildKbRuleForest,
  kbHierarchyAnalysisSummary,
  linkKbRuleHierarchy,
  pickNextReviewRuleIdHierarchical,
} from '../kbRuleHierarchy';

function rule(partial: Partial<KbInducedRule> & Pick<KbInducedRule, 'id'>): KbInducedRule {
  return {
    id: partial.id,
    title: partial.title ?? partial.id,
    field: '—',
    rule: partial.rule ?? 'test',
    evidence: '',
    note: '',
    trigger: '',
    action: '',
    fallback: '',
    status: partial.status ?? 'hypothesized',
    confidence: partial.confidence ?? 'high',
    relevanceToTask: 'high',
    included: true,
    validation: null,
    deleted: false,
    ruleKind: partial.ruleKind,
    parentRuleId: partial.parentRuleId,
  };
}

describe('linkKbRuleHierarchy', () => {
  it('links micro to existing macro and drops orphan parent', () => {
    const linked = linkKbRuleHierarchy([
      rule({ id: 'm1', ruleKind: 'macro', title: 'Pattern' }),
      rule({ id: 'x1', ruleKind: 'micro', parentRuleId: 'm1', title: 'Cardio' }),
      rule({ id: 'bad', ruleKind: 'micro', parentRuleId: 'missing' }),
    ]);
    expect(linked.find((r) => r.id === 'x1')?.parentRuleId).toBe('m1');
    expect(linked.find((r) => r.id === 'bad')?.ruleKind).toBe('atomic');
  });
});

describe('buildKbRuleForest', () => {
  it('nests micro rules under macro', () => {
    const forest = buildKbRuleForest([
      rule({ id: 'm1', ruleKind: 'macro' }),
      rule({ id: 'a', ruleKind: 'micro', parentRuleId: 'm1' }),
      rule({ id: 'b', ruleKind: 'micro', parentRuleId: 'm1' }),
    ]);
    expect(forest).toHaveLength(1);
    expect(forest[0]!.children).toHaveLength(2);
  });
});

describe('kbHierarchyAnalysisSummary', () => {
  it('mentions macro subsumption when macro+micro present', () => {
    const msg = kbHierarchyAnalysisSummary([
      rule({ id: 'm1', ruleKind: 'macro' }),
      rule({ id: 'a', ruleKind: 'micro', parentRuleId: 'm1' }),
      rule({ id: 'b', ruleKind: 'micro', parentRuleId: 'm1' }),
    ]);
    expect(msg).toMatch(/sussunte in 1 macro-regola/i);
    expect(msg).toMatch(/2 regole specifiche/i);
  });
});

describe('pickNextReviewRuleIdHierarchical', () => {
  it('prefers micro over macro', () => {
    const rules = [
      rule({ id: 'm1', ruleKind: 'macro', status: 'hypothesized' }),
      rule({ id: 'micro1', ruleKind: 'micro', parentRuleId: 'm1', status: 'hypothesized' }),
    ];
    expect(pickNextReviewRuleIdHierarchical(rules, null)).toBe('micro1');
  });
});

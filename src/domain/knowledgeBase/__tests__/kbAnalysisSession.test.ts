import { describe, expect, it } from 'vitest';
import {
  areAllKbRulesResolved,
  computeKbAnalysisComplete,
  confirmAllHighConfidenceRules,
  kbDocumentPatchOnSelect,
  pickNextReviewRuleId,
  skipAllOpenKbRules,
} from '../kbAnalysisSession';
import { emptyKbDocument, filesToKbStaged } from '../kbDocumentTypes';
import { KB_HYPOTHESIS_QUESTION } from '../kbChatInteractive';
import type { KbInducedRule } from '../kbRuleTypes';

function rule(partial: Partial<KbInducedRule> & Pick<KbInducedRule, 'id'>): KbInducedRule {
  return {
    title: 'T',
    field: 'f',
    rule: 'r',
    evidence: '',
    note: '',
    included: false,
    validation: null,
    status: 'hypothesized',
    confidence: 'medium',
    trigger: '',
    action: '',
    fallback: '',
    ...partial,
  };
}

describe('kbAnalysisSession', () => {
  it('pickNextReviewRuleId prefers open hypothesized rules', () => {
    const rules = [
      rule({ id: 'a', status: 'invalid' }),
      rule({ id: 'b', status: 'hypothesized' }),
      rule({ id: 'c', status: 'corrected' }),
    ];
    expect(pickNextReviewRuleId(rules, null)).toBe('b');
  });

  it('confirmAllHighConfidenceRules only touches high open rules', () => {
    const rules = [
      rule({ id: 'h', confidence: 'high', status: 'hypothesized' }),
      rule({ id: 'm', confidence: 'medium', status: 'hypothesized' }),
    ];
    const next = confirmAllHighConfidenceRules(rules);
    expect(next.find((r) => r.id === 'h')?.status).toBe('validated');
    expect(next.find((r) => r.id === 'm')?.status).toBe('hypothesized');
  });

  it('computeKbAnalysisComplete with sign-off even if rules still open', () => {
    expect(
      computeKbAnalysisComplete({
        rules: [rule({ id: 'x', status: 'hypothesized' })],
        promotedDraftCount: 0,
        designerSignOffNoUseCases: true,
      })
    ).toBe(true);
  });

  it('skipAllOpenKbRules marks open rules invalid', () => {
    const rules = [
      rule({ id: 'a', status: 'hypothesized' }),
      rule({ id: 'b', status: 'corrected' }),
      rule({ id: 'c', status: 'validated' }),
    ];
    const next = skipAllOpenKbRules(rules);
    expect(next.find((r) => r.id === 'a')?.status).toBe('invalid');
    expect(next.find((r) => r.id === 'b')?.status).toBe('invalid');
    expect(next.find((r) => r.id === 'c')?.status).toBe('validated');
  });

  it('areAllKbRulesResolved when all closed', () => {
    const rules = [
      rule({ id: 'a', status: 'validated' }),
      rule({ id: 'b', status: 'invalid' }),
    ];
    expect(areAllKbRulesResolved(rules)).toBe(true);
  });

  it('kbDocumentPatchOnSelect seeds hypothesis choice chat for ready idle doc', () => {
    const base = filesToKbStaged([new File(['# t'], 'note.md', { type: 'text/markdown' })])[0]!;
    const doc = {
      ...emptyKbDocument(base, 'ready', 'md'),
      repositoryDocumentId: 'repo-abc',
    };
    const patch = kbDocumentPatchOnSelect(doc);
    expect(patch?.analysisPhase).toBe('awaiting_hypothesis_choice');
    expect(patch?.chatStarted).toBe(true);
    expect(patch?.chatMessages?.length).toBe(1);
    expect(patch?.chatMessages?.[0]?.content).toBe(KB_HYPOTHESIS_QUESTION);
    expect(patch?.chatMessages?.[0]?.interactive?.kind).toBe('hypothesis_choice');
  });
});

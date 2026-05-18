import { describe, expect, it } from 'vitest';
import { kbRulesFoundSummary } from '../kbChatCopy';

describe('kbChatCopy', () => {
  it('summarizes rule count', () => {
    const text = kbRulesFoundSummary([
      {
        id: '1',
        title: 'Regola A',
        field: 'id',
        rule: 'univoco',
        evidence: 'x',
        note: '',
        included: true,
        validation: null,
      },
    ]);
    expect(text).toMatch(/1 regola/);
    expect(text).toMatch(/Regola A/);
  });
});

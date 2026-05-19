import { describe, expect, it } from 'vitest';
import {
  cycleKbRuleStatus,
  normalizeKbRuleStatusValue,
  KB_RULE_STATUS_CYCLE,
} from '../kbRuleStatus';

describe('kbRuleStatus', () => {
  it('cycles through all designer states', () => {
    let s = KB_RULE_STATUS_CYCLE[0]!;
    const seen = new Set<string>();
    for (let i = 0; i < KB_RULE_STATUS_CYCLE.length; i++) {
      seen.add(s);
      s = cycleKbRuleStatus(s);
    }
    expect(seen.size).toBe(KB_RULE_STATUS_CYCLE.length);
    expect(s).toBe(KB_RULE_STATUS_CYCLE[0]);
  });

  it('maps legacy status strings', () => {
    expect(normalizeKbRuleStatusValue('hypothesis', true)).toBe('hypothesized');
    expect(normalizeKbRuleStatusValue('confirmed', true)).toBe('validated');
    expect(normalizeKbRuleStatusValue('rejected', true)).toBe('invalid');
    expect(normalizeKbRuleStatusValue('unknown', false)).toBe('invalid');
  });
});

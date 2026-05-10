import { mergeStyleRuleIntoConstraintsCompact } from '../mergeStyleRuleIntoConstraintsCompact';

describe('mergeStyleRuleIntoConstraintsCompact', () => {
  it('creates compact when json missing', () => {
    const { nextJson, truncated } = mergeStyleRuleIntoConstraintsCompact(undefined, 'Use digits for dates.');
    expect(truncated).toBe(false);
    const o = JSON.parse(nextJson);
    expect(o.constraints_compact).toBe('Use digits for dates.');
    expect(o.behavior_compact).toBe('');
    expect(Array.isArray(o.examples_compact)).toBe(true);
  });

  it('appends to existing constraints_compact', () => {
    const prev = JSON.stringify({
      behavior_compact: 'x',
      constraints_compact: 'Keep replies short.',
      sequence_compact: '',
      corrections_compact: '',
      examples_compact: [],
    });
    const { nextJson } = mergeStyleRuleIntoConstraintsCompact(prev, 'No spelled-out numbers.');
    expect(JSON.parse(nextJson).constraints_compact).toBe(
      'Keep replies short.; No spelled-out numbers.'
    );
  });

  it('throws on empty rule', () => {
    expect(() => mergeStyleRuleIntoConstraintsCompact(undefined, '   ')).toThrow(/non-empty/);
  });

  it('throws on invalid json', () => {
    expect(() => mergeStyleRuleIntoConstraintsCompact('{', 'rule')).toThrow(/Invalid/);
  });
});

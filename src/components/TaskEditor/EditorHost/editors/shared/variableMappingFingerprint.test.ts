import { describe, expect, it } from 'vitest';
import { fingerprintVariableMapping } from './variableMappingFingerprint';

describe('fingerprintVariableMapping', () => {
  it('is empty for empty map', () => {
    expect(fingerprintVariableMapping(new Map())).toBe('');
  });

  it('changes when a value changes for the same key', () => {
    const a = new Map([['x', 'label1']]);
    const b = new Map([['x', 'label2']]);
    expect(fingerprintVariableMapping(a)).not.toBe(fingerprintVariableMapping(b));
  });

  it('is order-independent', () => {
    const m1 = new Map([
      ['a', '1'],
      ['b', '2'],
    ]);
    const m2 = new Map([
      ['b', '2'],
      ['a', '1'],
    ]);
    expect(fingerprintVariableMapping(m1)).toBe(fingerprintVariableMapping(m2));
  });
});

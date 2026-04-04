import { describe, it, expect } from 'vitest';
import {
  computeNewFlowVariableVarName,
  directChildSegments,
  lastSegment,
  parentPathKey,
} from '../flowVariableInsert';

describe('flowVariableInsert', () => {
  it('parentPathKey and lastSegment', () => {
    expect(parentPathKey('a.b.c')).toBe('a.b');
    expect(lastSegment('a.b.c')).toBe('c');
    expect(parentPathKey('solo')).toBe('');
    expect(lastSegment('solo')).toBe('solo');
  });

  it('directChildSegments at root', () => {
    const s = directChildSegments(['foo', 'foo.bar', 'baz'], '');
    expect([...s].sort()).toEqual(['baz', 'foo']);
  });

  it('computeNewFlowVariableVarName empty store', () => {
    const n = computeNewFlowVariableVarName([], { targetPathKey: '', placement: 'after' });
    expect(n.startsWith('dato_')).toBe(true);
  });

  it('computeNewFlowVariableVarName child under parent', () => {
    const n = computeNewFlowVariableVarName(['a.b'], {
      targetPathKey: 'a',
      placement: 'child',
    });
    expect(n.startsWith('a.nuovo_')).toBe(true);
  });
});

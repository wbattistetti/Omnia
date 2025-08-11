import { describe, it, expect } from 'vitest';
import { runConstraint, shouldPreConfirm } from '../constraintRunner';

describe('constraintRunner', () => {
  it('returns ok for non-violating script', () => {
    const res = runConstraint({ script: 'return { status: "ok", confidence: 0.9 }', vars: {} });
    expect(res.status).toBe('ok');
  });

  it('returns violation with confidence', () => {
    const res = runConstraint({ script: 'return { status: "violation", confidence: 0.8, message: "bad" }', vars: {} });
    expect(res.status).toBe('violation');
    // @ts-expect-error narrow at runtime
    expect(res.confidence).toBe(0.8);
  });

  it('returns error on script exception', () => {
    const res = runConstraint({ script: 'throw new Error("boom")', vars: {} });
    expect(res.status).toBe('error');
  });

  it('shouldPreConfirm obeys policy', () => {
    expect(shouldPreConfirm('never', 1)).toBe(false);
    expect(shouldPreConfirm('always', 0)).toBe(true);
    expect(shouldPreConfirm('threshold', 0.6, 0.7)).toBe(false);
    expect(shouldPreConfirm('threshold', 0.8, 0.7)).toBe(true);
  });
});



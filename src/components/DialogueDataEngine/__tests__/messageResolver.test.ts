import { describe, it, expect } from 'vitest';
import { resolveMessage, DEFAULT_FALLBACKS } from '../messageResolver';

describe('messageResolver', () => {
  it('uses translations by textKey when available', () => {
    const text = resolveMessage({ textKey: 'greet', translations: { greet: 'Hello {{name}}' }, vars: { name: 'Ada' } });
    expect(text).toBe('Hello Ada');
  });

  it('falls back to actionText when key missing', () => {
    const text = resolveMessage({ textKey: 'missing', translations: {}, actionText: 'Action Text' });
    expect(text).toBe('Action Text');
  });

  it('uses provided fallback when others missing', () => {
    const text = resolveMessage({ fallback: 'Fallback {{x}}', vars: { x: 42 } });
    expect(text).toBe('Fallback 42');
  });

  it('DEFAULT_FALLBACKS produce sensible strings', () => {
    expect(DEFAULT_FALLBACKS.ask('email')).toContain('email');
    expect(DEFAULT_FALLBACKS.confirm('email', 'a@b.c')).toContain('a@b.c');
    expect(DEFAULT_FALLBACKS.success('email')).toContain('email');
  });
});



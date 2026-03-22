import { describe, expect, it } from 'vitest';
import { normalizeEntityType, isKnownEntityType } from '../dataEntityTypes';

describe('normalizeEntityType', () => {
  it('returns canonical ids unchanged', () => {
    expect(normalizeEntityType('email')).toBe('email');
    expect(normalizeEntityType('DATE')).toBe('date');
  });

  it('maps aliases', () => {
    expect(normalizeEntityType('string')).toBe('text');
    expect(normalizeEntityType('int')).toBe('integer');
    expect(normalizeEntityType('tel')).toBe('phone');
  });

  it('defaults unknown to text', () => {
    expect(normalizeEntityType('foobar')).toBe('text');
    expect(normalizeEntityType('')).toBe('text');
  });
});

describe('isKnownEntityType', () => {
  it('recognizes canonical ids', () => {
    expect(isKnownEntityType('phone')).toBe(true);
    expect(isKnownEntityType('nope')).toBe(false);
  });
});

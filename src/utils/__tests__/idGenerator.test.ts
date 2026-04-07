import { describe, expect, it } from 'vitest';
import {
  generateSafeGuid,
  isSafeGuid,
  isValidId,
  SAFE_GUID_PATTERN,
} from '../idGenerator';

describe('generateSafeGuid', () => {
  it('returns g_ plus 32 hex chars', () => {
    const id = generateSafeGuid();
    expect(SAFE_GUID_PATTERN.test(id)).toBe(true);
    expect(id.startsWith('g_')).toBe(true);
    expect(id.length).toBe(2 + 32);
  });

  it('generates distinct values', () => {
    const a = generateSafeGuid();
    const b = generateSafeGuid();
    expect(a).not.toBe(b);
  });
});

describe('isValidId', () => {
  it('accepts RFC UUID and safe guid', () => {
    expect(isValidId('550e8400-e29b-41d4-a716-446655440000')).toBe(true);
    expect(isValidId('g_' + 'a'.repeat(32))).toBe(true);
    expect(isValidId('not-an-id')).toBe(false);
  });
});

describe('isSafeGuid', () => {
  it('matches only full g_ + 32 hex', () => {
    expect(isSafeGuid('g_' + '0'.repeat(32))).toBe(true);
    expect(isSafeGuid('g_' + 'f'.repeat(12))).toBe(false);
  });
});

import { describe, expect, it } from 'vitest';
import {
  isCanonicalTranslationKey,
  isUuidString,
  isValidTranslationStoreKey,
  looksLikeTechnicalTranslationOrId,
  makeTranslationKey,
  parseTranslationKey,
  translationKeyFromStoredValue,
} from '../translationKeys';

const SAMPLE = 'a0000000-0000-4000-8000-000000000001';

describe('translationKeys', () => {
  it('makeTranslationKey builds lowercase task:uuid', () => {
    expect(makeTranslationKey('task', SAMPLE)).toBe(`task:${SAMPLE}`);
  });

  it('parseTranslationKey accepts canonical keys', () => {
    expect(parseTranslationKey(`var:${SAMPLE}`)).toEqual({ kind: 'var', guid: SAMPLE });
    expect(parseTranslationKey('not-a-uuid')).toBeNull();
    expect(parseTranslationKey(SAMPLE)).toBeNull();
  });

  it('isUuidString rejects bare key without colon', () => {
    expect(isUuidString(SAMPLE)).toBe(true);
    expect(isUuidString(`task:${SAMPLE}`)).toBe(false);
  });

  it('translationKeyFromStoredValue', () => {
    expect(translationKeyFromStoredValue(`task:${SAMPLE}`)).toBe(`task:${SAMPLE}`);
    expect(translationKeyFromStoredValue('runtime.x.y')).toBe('runtime.x.y');
    expect(translationKeyFromStoredValue(SAMPLE)).toBeNull();
    expect(isCanonicalTranslationKey(`flow:${SAMPLE}`)).toBe(true);
  });

  it('isValidTranslationStoreKey', () => {
    expect(isValidTranslationStoreKey(`task:${SAMPLE}`)).toBe(true);
    expect(isValidTranslationStoreKey('runtime.slot.x')).toBe(true);
    expect(isValidTranslationStoreKey(SAMPLE)).toBe(true);
    expect(isValidTranslationStoreKey('g_' + 'a'.repeat(32))).toBe(true);
    expect(isValidTranslationStoreKey('hello')).toBe(false);
    expect(isValidTranslationStoreKey('')).toBe(false);
  });

  it('looksLikeTechnicalTranslationOrId', () => {
    expect(looksLikeTechnicalTranslationOrId(`task:${SAMPLE}`)).toBe(true);
    expect(looksLikeTechnicalTranslationOrId(SAMPLE)).toBe(true);
    expect(looksLikeTechnicalTranslationOrId('runtime.x')).toBe(true);
    expect(looksLikeTechnicalTranslationOrId('Hello')).toBe(false);
    expect(looksLikeTechnicalTranslationOrId('')).toBe(true);
  });
});

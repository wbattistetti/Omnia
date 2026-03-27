import { describe, expect, it } from 'vitest';
import {
  buildProxyVariableName,
  disambiguateProxyVarName,
  normalizeProxySegment,
  normalizeSemanticTaskLabel,
} from './variableProxyNaming';

describe('normalizeSemanticTaskLabel', () => {
  it('strips Italian conversational verbs and articles', () => {
    expect(normalizeSemanticTaskLabel('chiedi la data di nascita')).toBe('data di nascita');
    expect(normalizeSemanticTaskLabel('raccogli il codice fiscale')).toBe('codice fiscale');
  });

  it('strips English conversational verbs and articles', () => {
    expect(normalizeSemanticTaskLabel('ask for the phone number')).toBe('phone number');
    expect(normalizeSemanticTaskLabel('collect a reference code')).toBe('reference code');
  });

  it('falls back to trimmed original when strip would empty meaningful input', () => {
    expect(normalizeSemanticTaskLabel('la')).toBe('la');
  });

  it('returns empty for empty input', () => {
    expect(normalizeSemanticTaskLabel('')).toBe('');
  });
});

describe('normalizeProxySegment', () => {
  it('matches semantic task rules', () => {
    expect(normalizeProxySegment('dimmi il nome')).toBe('nome');
  });
});

describe('buildProxyVariableName', () => {
  it('joins semantic task and internal segment', () => {
    expect(buildProxyVariableName('chiedi email', 'conferma')).toBe('email.conferma');
  });

  it('throws when segments are unusable after normalization', () => {
    expect(() => buildProxyVariableName('   ', 'x')).toThrow(/empty semantic task/);
    expect(() => buildProxyVariableName('Subflow', '   ')).toThrow(/empty semantic task/);
  });
});

describe('disambiguateProxyVarName', () => {
  it('returns base when free', () => {
    expect(disambiguateProxyVarName('a.b', () => false)).toBe('a.b');
  });

  it('appends numeric suffix when taken', () => {
    const taken = new Set(['a.b', 'a.b_2']);
    expect(disambiguateProxyVarName('a.b', (n) => taken.has(n))).toBe('a.b_3');
  });
});

import { describe, expect, it } from 'vitest';
import {
  buildProxyVariableName,
  buildSubflowQualifiedDisplayLabel,
  buildSubflowParentProxyVariableName,
  disambiguateProxyVarName,
  localLabelForSubflowTaskVariable,
  normalizeProxySegment,
  normalizeSemanticTaskLabel,
  slugifyDataKeySegment,
} from './variableProxyNaming';

describe('normalizeSemanticTaskLabel', () => {
  it('strips Italian conversational verbs and articles', () => {
    expect(normalizeSemanticTaskLabel('chiedi la data di nascita')).toBe('data di nascita');
    expect(normalizeSemanticTaskLabel('raccogli il codice fiscale')).toBe('codice fiscale');
    expect(normalizeSemanticTaskLabel('Chiedi i dati personali')).toBe('dati personali');
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

describe('localLabelForSubflowTaskVariable', () => {
  it('strips FQ to last local segment', () => {
    expect(localLabelForSubflowTaskVariable('dati_personali.colore')).toBe('colore');
    expect(localLabelForSubflowTaskVariable('colore')).toBe('colore');
  });
});

describe('buildSubflowParentProxyVariableName', () => {
  it('produces slugified parent.colore and matches manual slug of normalized title', () => {
    expect(buildSubflowParentProxyVariableName('Chiedi i dati personali', 'colore')).toBe('dati_personali.colore');
    expect(
      slugifyDataKeySegment(normalizeSemanticTaskLabel('Chiedi i dati personali') || '')
    ).toBe('dati_personali');
  });

  it('uses last dotted segment for task var name', () => {
    expect(buildSubflowParentProxyVariableName('Chiedi i dati personali', 'foo.bar.colore')).toBe(
      'dati_personali.colore'
    );
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

describe('buildSubflowQualifiedDisplayLabel', () => {
  it('joins resolved subflow title and internal label without slugify', () => {
    expect(buildSubflowQualifiedDisplayLabel('Chiedi dati personali', 'colore')).toBe(
      'Chiedi dati personali.colore'
    );
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

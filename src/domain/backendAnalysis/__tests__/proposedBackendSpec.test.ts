import { describe, expect, it } from 'vitest';
import {
  inferProposedParameters,
  parseParametersFromSpecMarkdown,
  renderProposedBackendSpecMarkdown,
  syncProposedBackendRecord,
} from '../proposedBackendSpec';
import { buildProposedBackendRecord } from '../proposedBackendFromAnalysis';

describe('inferProposedParameters', () => {
  it('returns named SEND/RECEIVE params for searchKb', () => {
    const params = inferProposedParameters(
      'searchKb',
      'Ricerca prestazioni nella knowledge base.'
    );
    expect(params.map((p) => p.paramKey)).toEqual(
      expect.arrayContaining(['searchQuery', 'results'])
    );
    expect(params.find((p) => p.paramKey === 'searchQuery')?.direction).toBe('input');
    expect(params.find((p) => p.paramKey === 'results')?.direction).toBe('output');
    expect(params.find((p) => p.paramKey === 'searchQuery')?.dataType).toBe('string');
  });
});

describe('renderProposedBackendSpecMarkdown', () => {
  it('renders table with direction arrows', () => {
    const params = inferProposedParameters('searchKb', 'KB prestazioni');
    const md = renderProposedBackendSpecMarkdown('Serve ricerca KB.', params);
    expect(md).toContain('## Interfaccia proposta');
    expect(md).toContain('`searchQuery`');
    expect(md).toContain('→ input');
    expect(md).toContain('← output');
    expect(md).toContain('| Tipo dato |');
  });
});

describe('parseParametersFromSpecMarkdown', () => {
  it('round-trips table from rendered markdown', () => {
    const params = inferProposedParameters('searchKb', 'KB');
    const md = renderProposedBackendSpecMarkdown('Purpose', params);
    const parsed = parseParametersFromSpecMarkdown(md);
    expect(parsed.length).toBeGreaterThanOrEqual(2);
    expect(parsed.some((p) => p.paramKey === 'searchQuery')).toBe(true);
  });
});

describe('buildProposedBackendRecord', () => {
  it('builds structured record with parameters', () => {
    const rec = buildProposedBackendRecord(
      'searchKb',
      'Manca ricerca prestazioni nella knowledge base del progetto.'
    );
    expect(rec).not.toBeNull();
    expect(rec!.parameters.searchQuery).toBeDefined();
    expect(rec!.specMarkdown).toContain('Interfaccia proposta');
    expect(syncProposedBackendRecord(rec!).parameters.results).toBeDefined();
  });
});

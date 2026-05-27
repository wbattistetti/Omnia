import { describe, expect, it } from 'vitest';
import {
  buildProposedBackendRecord,
  buildProposedBackendSpecification,
  isPlaceholderProposedSpec,
  proposedBackendsFromAnalysisMissing,
  sanitizeSuggestedBackendName,
} from '../proposedBackendFromAnalysis';

describe('sanitizeSuggestedBackendName', () => {
  it('shortens markdown-heavy missing-backend labels', () => {
    const raw =
      'Backend/strumento di **ricerca nella Knowledge Base delle prestazioni** —';
    expect(sanitizeSuggestedBackendName(raw)).toBe('searchKb');
  });

  it('keeps valid camelCase identifiers', () => {
    expect(sanitizeSuggestedBackendName('bookfromagenda')).toBe('bookfromagenda');
  });
});

describe('buildProposedBackendRecord', () => {
  it('returns null for empty reason', () => {
    expect(buildProposedBackendRecord('foo', '')).toBeNull();
    expect(isPlaceholderProposedSpec('')).toBe(true);
  });

  it('builds spec with interface table', () => {
    const rec = buildProposedBackendRecord(
      'searchKb',
      'Serve ricerca prestazioni nella knowledge base del progetto.'
    );
    expect(rec).not.toBeNull();
    const spec = rec!.specMarkdown;
    expect(spec).toContain('## A cosa serve questo backend');
    expect(spec).toContain('knowledge base');
    expect(spec).toContain('## Interfaccia proposta');
    expect(spec).toContain('`searchQuery`');
    expect(spec).toContain('→ input');
    expect(spec).not.toMatch(/\(da definire\)/i);
    expect(isPlaceholderProposedSpec(spec)).toBe(false);
    expect(buildProposedBackendSpecification('searchKb', rec!.purposeMarkdown)).toBe(spec);
  });
});

describe('proposedBackendsFromAnalysisMissing', () => {
  it('skips entries without substantive reason', () => {
    expect(
      proposedBackendsFromAnalysisMissing([{ name: 'x', reason: '' }])
    ).toHaveLength(0);
  });

  it('maps missing backends with sanitized names', () => {
    const list = proposedBackendsFromAnalysisMissing([
      { name: 'searchKb', reason: 'Manca ricerca KB prestazioni.' },
    ]);
    expect(list).toHaveLength(1);
    expect(list[0]?.suggestedName).toBe('searchKb');
    expect(list[0]?.specMarkdown).toContain('Manca ricerca KB');
    expect(list[0]?.parameters.searchQuery?.direction).toBe('input');
  });
});

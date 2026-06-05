import { describe, expect, it } from 'vitest';
import {
  filterNonEmptyKbAnalysisSections,
  isKbAnalysisLegacySectionHeading,
  isKbAnalysisSectionBodyEmpty,
  kbAnalysisSectionDisplayBadge,
  kbAnalysisSectionHeadingToneClass,
  parseKbDocumentTypeFromAnalysisPreamble,
  prepareKbAnalysisSectionsForDisplay,
  sortKbAnalysisSectionsForDisplay,
} from '../kbDocumentAnalysisLite';
import { parseKbAnalysisSections } from '../kbDocumentAnalysisSections';

describe('kbDocumentAnalysisLite', () => {
  it('detects empty section bodies', () => {
    expect(isKbAnalysisSectionBodyEmpty('')).toBe(true);
    expect(isKbAnalysisSectionBodyEmpty('  ')).toBe(true);
    expect(isKbAnalysisSectionBodyEmpty('- n/a')).toBe(true);
    expect(isKbAnalysisSectionBodyEmpty('- prestazione X')).toBe(false);
  });

  it('filters and sorts lite sections before legacy', () => {
    const md = [
      '## Type: DATA',
      '',
      '### Sinonimi',
      '- trigger visita',
      '',
      '### Entities',
      '- branca',
      '',
      '### Regole operative per l\'agente',
      '- chiedi tipo visita',
      '',
      '### Schema mapping (pattern)',
      '',
    ].join('\n');
    const parsed = parseKbAnalysisSections(md);
    const visible = prepareKbAnalysisSectionsForDisplay(parsed.sections);
    expect(visible.map((s) => s.heading)).toEqual([
      'Entities',
      "Regole operative per l'agente",
      'Sinonimi',
    ]);
  });

  it('parse document type from preamble', () => {
    expect(parseKbDocumentTypeFromAnalysisPreamble('## Type: DATA')).toBe('DATA');
    expect(parseKbDocumentTypeFromAnalysisPreamble('foo')).toBe('UNKNOWN');
  });

  it('classifies legacy headings', () => {
    expect(isKbAnalysisLegacySectionHeading('Sinonimi')).toBe(true);
    expect(isKbAnalysisLegacySectionHeading('Regole operative per l\'agente')).toBe(false);
  });

  it('assigns tone and badge for lite vs legacy sections', () => {
    expect(kbAnalysisSectionHeadingToneClass('Entities')).toContain('cyan');
    expect(kbAnalysisSectionHeadingToneClass('Sinonimi')).toContain('amber');
    expect(kbAnalysisSectionDisplayBadge('Sinonimi')).toBe('Legacy');
    expect(kbAnalysisSectionDisplayBadge('Entities')).toBeUndefined();
  });

  it('filterNonEmptyKbAnalysisSections drops blanks only', () => {
    const sections = [
      { id: 'kbSection:a' as const, heading: 'A', body: '' },
      { id: 'kbSection:b' as const, heading: 'B', body: '- ok' },
    ];
    expect(filterNonEmptyKbAnalysisSections(sections)).toHaveLength(1);
    expect(sortKbAnalysisSectionsForDisplay(sections)).toHaveLength(2);
  });
});

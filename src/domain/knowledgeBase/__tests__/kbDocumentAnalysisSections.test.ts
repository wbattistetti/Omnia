import { describe, expect, it } from 'vitest';
import {
  composeKbAnalysisMarkdown,
  parseKbAnalysisSections,
  patchKbAnalysisSectionBody,
} from '../kbDocumentAnalysisSections';

describe('kbDocumentAnalysisSections', () => {
  it('round-trips ### sections', () => {
    const md = [
      '## Type: MIXED',
      '',
      '### Entities',
      '- foo',
      '',
      '### Sinonimi',
      '- bar',
    ].join('\n');
    const parsed = parseKbAnalysisSections(md);
    expect(parsed.sections).toHaveLength(2);
    expect(parsed.sections[0]?.heading).toBe('Entities');
    const patched = patchKbAnalysisSectionBody(md, parsed.sections[0]!.id, '- baz');
    expect(patched).toContain('baz');
    expect(patched).toContain('### Sinonimi');
    expect(composeKbAnalysisMarkdown(parsed)).toContain('## Type: MIXED');
  });
});

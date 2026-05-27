import { describe, expect, it } from 'vitest';
import {
  distillKbDocumentAnalysisForRuntime,
  kbDocumentHasUsableAnalysis,
} from '../kbAnalysisRuntimeSynthesis';

describe('kbDocumentHasUsableAnalysis', () => {
  it('is true when baseline and analysis exist', () => {
    expect(
      kbDocumentHasUsableAnalysis({
        documentAnalysisMarkdown: '## Type: MIXED\n\n### Entities\n- foo',
        agentAnalysisBaselineMarkdown: 'same',
      })
    ).toBe(true);
  });
});

describe('distillKbDocumentAnalysisForRuntime', () => {
  it('truncates large mapping tables', () => {
    const rows = Array.from({ length: 10 }, (_, i) => `| row${i} | a | b |`);
    const md = [
      '### Schema mapping (pattern)',
      '',
      '| h | h2 |',
      '| --- | --- |',
      ...rows,
      '',
      '### Domande di disambiguazione',
      '- domanda?',
    ].join('\n');
    const out = distillKbDocumentAnalysisForRuntime(md);
    expect(out).toContain('Domande di disambiguazione');
    expect(out).not.toContain('row9');
  });
});

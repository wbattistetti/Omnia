import { describe, expect, it } from 'vitest';
import { KB_ANALYSIS_SECTION_HEADINGS } from '../kbDocumentAnalysisTemplate';

describe('kbDocumentAnalysisTemplate', () => {
  it('defines canonical section headings for Monaco and prompts', () => {
    expect(KB_ANALYSIS_SECTION_HEADINGS.synonyms).toBe('### Sinonimi');
    expect(KB_ANALYSIS_SECTION_HEADINGS.dialogRules).toContain('Regole di dialogo');
    expect(KB_ANALYSIS_SECTION_HEADINGS.outputFlow).toContain('variabili task');
  });
});

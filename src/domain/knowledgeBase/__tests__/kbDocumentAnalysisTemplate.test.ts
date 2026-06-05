import { describe, expect, it } from 'vitest';
import {
  KB_ANALYSIS_LITE_HEADINGS,
  KB_ANALYSIS_SECTION_HEADINGS,
} from '../kbDocumentAnalysisTemplate';

describe('kbDocumentAnalysisTemplate', () => {
  it('defines lite section headings aligned with backend prompts', () => {
    expect(KB_ANALYSIS_LITE_HEADINGS.operationalRules).toContain('Regole operative');
    expect(KB_ANALYSIS_LITE_HEADINGS.clarificationQuestions).toContain('Domande di chiarimento');
    expect(KB_ANALYSIS_LITE_HEADINGS.outputFlow).toContain('variabili task');
  });

  it('keeps legacy headings for backward compatibility', () => {
    expect(KB_ANALYSIS_SECTION_HEADINGS.synonyms).toBe('### Sinonimi');
    expect(KB_ANALYSIS_SECTION_HEADINGS.dialogRules).toContain('Regole di dialogo');
  });
});

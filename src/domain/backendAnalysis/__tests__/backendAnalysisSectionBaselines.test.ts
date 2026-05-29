import { describe, expect, it } from 'vitest';
import {
  buildSectionBaselinesFromDocument,
  paramDetailSectionText,
} from '../backendAnalysisSectionBaselines';
import { createEmptyBackendAnalysisDocumentV2 } from '../backendAnalysisDocumentV2';
import { paramDetailSectionId } from '../backendAnalysisSectionIds';

describe('paramDetailSectionText', () => {
  it('prefers analysisDetailMarkdown then summary then descriptionShort', () => {
    expect(
      paramDetailSectionText({
        paramKey: 'x',
        direction: 'input',
        kind: 'required',
        role: '',
        descriptionShort: 'short',
        analysisSummary: 'sum',
        analysisDetailMarkdown: 'detail',
      })
    ).toBe('detail');
    expect(
      paramDetailSectionText({
        paramKey: 'x',
        direction: 'input',
        kind: 'required',
        role: '',
        descriptionShort: 'short',
        analysisSummary: 'sum',
        analysisDetailMarkdown: '',
      })
    ).toBe('sum');
    expect(
      paramDetailSectionText({
        paramKey: 'x',
        direction: 'input',
        kind: 'required',
        role: '',
        descriptionShort: 'solo tabella',
        analysisSummary: '',
        analysisDetailMarkdown: '',
      })
    ).toBe('solo tabella');
  });
});

describe('buildSectionBaselinesFromDocument', () => {
  it('uses paramDetailSectionText for param baselines', () => {
    const doc = createEmptyBackendAnalysisDocumentV2();
    doc.backends.b1 = {
      catalogEntryId: 'b1',
      displayLabel: 'B1',
      howToUseMarkdown: 'how',
      parameters: {
        constraints: {
          paramKey: 'constraints',
          direction: 'input',
          kind: 'required',
          role: '',
          descriptionShort: 'nota IA in tabella',
          analysisSummary: '',
          analysisDetailMarkdown: '',
        },
      },
    };
    const baselines = buildSectionBaselinesFromDocument(doc);
    expect(baselines[paramDetailSectionId('b1', 'constraints')]).toBe('nota IA in tabella');
  });
});

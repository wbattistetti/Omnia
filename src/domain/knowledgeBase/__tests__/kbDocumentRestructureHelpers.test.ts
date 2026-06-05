import { describe, expect, it } from 'vitest';
import {
  kbDocumentHasUsableRestructure,
  kbDocumentRestructureApprovedForRuntime,
  kbDocumentRestructureStarted,
  resolveKbRestructuredRuntimeText,
} from '../kbDocumentRestructureHelpers';
import type { StagedKbDocument } from '../kbDocumentTypes';

function minimalDoc(overrides: Partial<StagedKbDocument> = {}): StagedKbDocument {
  return {
    id: 'd1',
    name: 'test.csv',
    size: 1,
    mimeType: 'text/csv',
    addedAt: '',
    file: new File([], 'test.csv'),
    parseStatus: 'ready',
    variables: [],
    variableDictionary: {},
    howToUseText: '',
    markdownSnippet: '',
    documentAnalysisMarkdown: '',
    agentAnalysisBaselineMarkdown: '',
    documentRestructuredMarkdown: '',
    agentRestructuredBaselineMarkdown: '',
    documentRestructureNotesMarkdown: '',
    agentRestructureNotesBaselineMarkdown: '',
    ...overrides,
  };
}

describe('kbDocumentRestructureHelpers', () => {
  it('detects usable restructure text', () => {
    const long = 'x'.repeat(100);
    expect(kbDocumentHasUsableRestructure({ documentRestructuredMarkdown: long })).toBe(true);
    expect(kbDocumentHasUsableRestructure({ documentRestructuredMarkdown: 'short' })).toBe(false);
  });

  it('resolve runtime text only when approved', () => {
    const md = '## Dati normalizzati\n' + 'a'.repeat(100);
    expect(
      resolveKbRestructuredRuntimeText(
        minimalDoc({ documentRestructuredMarkdown: md, documentRestructuredApprovedForRuntime: false })
      )
    ).toBeNull();
    expect(
      resolveKbRestructuredRuntimeText(
        minimalDoc({ documentRestructuredMarkdown: md, documentRestructuredApprovedForRuntime: true })
      )
    ).toBe(md);
  });

  it('approved flag defaults false', () => {
    expect(kbDocumentRestructureApprovedForRuntime({})).toBe(false);
  });

  it('restructure started only after agent baseline exists', () => {
    expect(kbDocumentRestructureStarted({})).toBe(false);
    expect(kbDocumentRestructureStarted({ agentRestructuredBaselineMarkdown: '  ' })).toBe(false);
    expect(kbDocumentRestructureStarted({ agentRestructuredBaselineMarkdown: '## Dati\n| a |' })).toBe(
      true
    );
  });
});

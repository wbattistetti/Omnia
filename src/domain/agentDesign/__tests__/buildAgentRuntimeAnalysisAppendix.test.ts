import { describe, expect, it } from 'vitest';
import {
  buildAgentRuntimeAnalysisAppendix,
  mergeRuntimeAnalysisIntoContext,
} from '../buildAgentRuntimeAnalysisAppendix';

describe('buildAgentRuntimeAnalysisAppendix', () => {
  it('merges KB analysis into context once', () => {
    const appendix = buildAgentRuntimeAnalysisAppendix({
      documents: [
        {
          id: 'd1',
          name: 'KB.md',
          size: 1,
          mimeType: 'text/markdown',
          addedAt: '',
          file: new File([], 'x'),
          parseStatus: 'ready',
          repositoryDocumentId: 'r1',
          variables: [],
          variableDictionary: {},
          howToUseText: '',
          markdownSnippet: '',
          documentAnalysisMarkdown:
            '## Type: MIXED\n\n### Regole di dialogo\n- regola — Fonte: «test»',
          agentAnalysisBaselineMarkdown: 'baseline',
        },
      ],
    });
    expect(appendix).toContain('Knowledge base');
    const merged = mergeRuntimeAnalysisIntoContext('contesto designer', appendix);
    expect(merged).toContain('contesto designer');
    expect(merged).toContain('Riferimenti analisi');
    expect(mergeRuntimeAnalysisIntoContext(merged, appendix)).toBe(merged);
  });
});

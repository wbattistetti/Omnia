import { describe, expect, it } from 'vitest';
import { createEmptyBackendAnalysisDocumentV2 } from '../backendAnalysisDocumentV2';
import {
  defaultIncompleteAgentSystemPrompt,
  normalizeBackendAnalysisUxDocument,
} from '../backendAnalysisUxNormalize';

describe('normalizeBackendAnalysisUxDocument', () => {
  it('maps legacy missing backends to proposed accordions', () => {
    const doc = createEmptyBackendAnalysisDocumentV2();
    const raw = {
      ...doc,
      global: {
        ...doc.global,
        missingBackends: [{ name: 'searchKb', reason: 'Serve ricerca KB' }],
        systemPromptBullets: [],
      },
      backends: {},
    };
    const next = normalizeBackendAnalysisUxDocument(
      raw as Parameters<typeof normalizeBackendAnalysisUxDocument>[0],
      { sourceMarkdown: '' }
    );
    expect(next.global.proposedBackends).toHaveLength(1);
    expect(next.global.proposedBackends[0]?.suggestedName).toBe('searchKb');
    expect(next.global.proposedBackends[0]?.specMarkdown).not.toMatch(/\(da definire\)/i);
    expect(next.global.proposedBackends[0]?.parameters.searchQuery).toBeDefined();
    expect(next.global.agentSystemPromptMarkdown).toContain('non completabile');
  });

  it('does not create placeholder proposed backends without reason', () => {
    const doc = createEmptyBackendAnalysisDocumentV2();
    const raw = {
      ...doc,
      global: {
        ...doc.global,
        missingBackends: [{ name: 'Backend lungo **markdown**', reason: '' }],
      },
      backends: {},
    };
    const next = normalizeBackendAnalysisUxDocument(
      raw as Parameters<typeof normalizeBackendAnalysisUxDocument>[0]
    );
    expect(next.global.proposedBackends).toHaveLength(0);
  });

  it('defaultIncompleteAgentSystemPrompt lists names', () => {
    const text = defaultIncompleteAgentSystemPrompt([
      { id: 'a', suggestedName: 'foo', specMarkdown: '' },
    ]);
    expect(text).toContain('foo');
  });
});

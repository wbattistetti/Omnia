import { describe, expect, it } from 'vitest';
import {
  kbRepositoryKeyForDoc,
  normalizePersistedKbRepositoryLink,
} from '../kbRepositoryContract';
import type { PersistedKbDocument } from '../kbDocumentTypes';

function stubPersisted(overrides: Partial<PersistedKbDocument> = {}): PersistedKbDocument {
  return {
    id: 'doc-uuid',
    name: 'KB_PAROS_medici.md',
    size: 100,
    mimeType: 'text/markdown',
    addedAt: '2026-01-01',
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
    repositoryDocumentId: 'legacy-uuid',
    ...overrides,
  };
}

describe('kbRepositoryContract', () => {
  it('kbRepositoryKeyForDoc uses doc.id', () => {
    expect(
      kbRepositoryKeyForDoc({ id: 'doc-uuid', repositoryDocumentId: 'legacy-uuid' })
    ).toBe('doc-uuid');
  });

  it('normalizePersistedKbRepositoryLink aligns repositoryDocumentId to id', () => {
    const out = normalizePersistedKbRepositoryLink(stubPersisted());
    expect(out.repositoryDocumentId).toBe('doc-uuid');
  });
});

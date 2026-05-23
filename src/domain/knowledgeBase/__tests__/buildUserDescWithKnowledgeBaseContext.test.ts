import { describe, expect, it, vi, beforeEach } from 'vitest';
import {
  buildUserDescWithKnowledgeBaseContext,
  kbDocumentsEligibleForUseCaseContext,
} from '../buildUserDescWithKnowledgeBaseContext';
import type { StagedKbDocument } from '../kbDocumentTypes';

vi.mock('@services/kbDocumentRepositoryApi', () => ({
  fetchKbDocumentContent: vi.fn(),
}));

import { fetchKbDocumentContent } from '@services/kbDocumentRepositoryApi';

function stubDoc(overrides: Partial<StagedKbDocument> = {}): StagedKbDocument {
  return {
    id: 'd1',
    name: 'KB_test.md',
    size: 100,
    mimeType: 'text/markdown',
    addedAt: '2026-01-01',
    file: new File(['x'], 'KB_test.md'),
    parseStatus: 'ready',
    repositoryDocumentId: 'repo-1',
    variables: [],
    variableDictionary: {},
    howToUseText: '',
    markdownSnippet: '',
    documentAnalysisMarkdown: '',
    agentAnalysisBaselineMarkdown: '',
    ...overrides,
  };
}

describe('kbDocumentsEligibleForUseCaseContext', () => {
  it('includes only ready docs with repository id', () => {
    const docs = [
      stubDoc(),
      stubDoc({ id: 'd2', parseStatus: 'parsing', repositoryDocumentId: 'r2' }),
      stubDoc({ id: 'd3', repositoryDocumentId: '' }),
    ];
    expect(kbDocumentsEligibleForUseCaseContext(docs)).toHaveLength(1);
  });
});

describe('buildUserDescWithKnowledgeBaseContext', () => {
  beforeEach(() => {
    vi.mocked(fetchKbDocumentContent).mockReset();
  });

  it('appends KB section when content is fetched', async () => {
    vi.mocked(fetchKbDocumentContent).mockResolvedValue({
      success: true,
      meta: {} as never,
      text: '# Regole\n- item',
      truncated: false,
      totalChars: 20,
    });

    const { userDesc, kbDocCount } = await buildUserDescWithKnowledgeBaseContext({
      projectId: 'proj-1',
      baseUserDesc: 'Descrizione task lunga abbastanza per il test.',
      documents: [stubDoc()],
    });

    expect(kbDocCount).toBe(1);
    expect(userDesc).toContain('KNOWLEDGE BASE');
    expect(userDesc).toContain('KB_test.md');
    expect(userDesc).toContain('# Regole');
  });

  it('returns base only without projectId', async () => {
    const base = 'Solo descrizione senza progetto collegato.';
    const { userDesc, kbDocCount } = await buildUserDescWithKnowledgeBaseContext({
      projectId: undefined,
      baseUserDesc: base,
      documents: [stubDoc()],
    });
    expect(kbDocCount).toBe(0);
    expect(userDesc).toBe(base);
    expect(fetchKbDocumentContent).not.toHaveBeenCalled();
  });
});

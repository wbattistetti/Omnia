import { describe, expect, it, vi, beforeEach } from 'vitest';
import type { StagedKbDocument } from '@domain/knowledgeBase/kbDocumentTypes';
import {
  listKbDocumentsForConvaiUpload,
  resolveKbTextForConvaiUpload,
  resolveKbTextForConvaiUploadAsync,
} from '../resolveKbTextForConvaiUpload';

vi.mock('@services/kbDocumentRepositoryApi', () => ({
  fetchKbDocumentContent: vi.fn(),
}));

import { fetchKbDocumentContent } from '@services/kbDocumentRepositoryApi';

function stubDoc(overrides: Partial<StagedKbDocument> = {}): StagedKbDocument {
  return {
    id: 'd1',
    name: 'listino.pdf',
    size: 100,
    mimeType: 'application/pdf',
    addedAt: '2026-01-01',
    file: new File(['x'], 'listino.pdf'),
    parseStatus: 'ready',
    repositoryDocumentId: 'd1',
    variables: [],
    variableDictionary: {},
    howToUseText: '',
    markdownSnippet: '',
    documentAnalysisMarkdown: '',
    agentAnalysisBaselineMarkdown: '',
    ...overrides,
  };
}

describe('resolveKbTextForConvaiUpload', () => {
  it('uses markdownSnippet when analysis is empty', () => {
    const doc = stubDoc({
      markdownSnippet: '# Listino\n'.repeat(20),
    });
    const text = resolveKbTextForConvaiUpload(doc);
    expect(text).toContain('Listino');
  });

  it('lists eligible docs without requiring pre-resolved text', () => {
    const docs = [
      stubDoc({ markdownSnippet: '' }),
      stubDoc({ id: 'd2', parseStatus: 'parsing' }),
    ];
    expect(listKbDocumentsForConvaiUpload(docs)).toHaveLength(1);
  });
});

describe('resolveKbTextForConvaiUploadAsync', () => {
  beforeEach(() => {
    vi.mocked(fetchKbDocumentContent).mockReset();
  });

  it('fetches repository text when staged fields are empty', async () => {
    vi.mocked(fetchKbDocumentContent).mockResolvedValue({
      success: true,
      meta: {} as never,
      text: '# Contenuto repository completo',
      truncated: false,
      totalChars: 40,
    });
    const doc = stubDoc();
    const text = await resolveKbTextForConvaiUploadAsync(doc, 'proj-1');
    expect(text).toContain('repository');
    expect(fetchKbDocumentContent).toHaveBeenCalledWith('proj-1', 'd1', expect.any(Number));
  });
});

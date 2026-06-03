import { describe, expect, it, vi, beforeEach } from 'vitest';
import { syncConvaiKbDocuments } from '../syncConvaiKbDocuments';

vi.mock('@workspaces/elevenlabs/api/convaiKnowledgeBaseApi', () => ({
  createConvaiKbDocumentFromText: vi.fn(async ({ name }: { name: string }) => ({
    id: `new_${name}`,
    name,
  })),
  updateConvaiKbDocumentFromText: vi.fn(async () => undefined),
  deleteConvaiKbDocument: vi.fn(async () => undefined),
  listAllConvaiKbDocumentsBySearch: vi.fn(async () => []),
}));

import {
  createConvaiKbDocumentFromText,
  updateConvaiKbDocumentFromText,
  deleteConvaiKbDocument,
  listAllConvaiKbDocumentsBySearch,
} from '@workspaces/elevenlabs/api/convaiKnowledgeBaseApi';

const mockCreate = vi.mocked(createConvaiKbDocumentFromText);
const mockUpdate = vi.mocked(updateConvaiKbDocumentFromText);
const mockDelete = vi.mocked(deleteConvaiKbDocument);
const mockListBySearch = vi.mocked(listAllConvaiKbDocumentsBySearch);

const baseDoc = {
  id: 'omnia-1',
  name: 'PAROS medici.xlsx',
  size: 1,
  mimeType: 'application/vnd.ms-excel' as const,
  addedAt: '',
  file: new File([], 'x'),
  parseStatus: 'ready' as const,
  variables: [],
  variableDictionary: {},
  howToUseText: '',
  markdownSnippet: '',
  documentAnalysisMarkdown: 'body',
  agentAnalysisBaselineMarkdown: '',
};

describe('syncConvaiKbDocuments', () => {
  beforeEach(() => {
    mockCreate.mockClear();
    mockUpdate.mockClear();
    mockDelete.mockClear();
    mockListBySearch.mockClear();
    mockListBySearch.mockResolvedValue([]);
    mockUpdate.mockResolvedValue(undefined);
  });

  it('on agent update PATCHes mapped doc instead of create+delete mapped id', async () => {
    const out = await syncConvaiKbDocuments({
      docs: [{ doc: baseDoc, text: 'contenuto aggiornato' }],
      existingLink: {
        schemaVersion: 1,
        agentId: 'ag_1',
        kbRemoteByOmniaDocId: { 'omnia-1': 'old_kb_1' },
        lastKbRemoteIds: ['old_kb_1', 'old_kb_2'],
      },
      isAgentUpdate: true,
      remoteIdsOnAgent: ['old_kb_3'],
      omniaDocNames: ['PAROS medici.xlsx'],
    });

    expect(mockUpdate).toHaveBeenCalledWith('old_kb_1', {
      name: 'PAROS medici.xlsx',
      text: 'contenuto aggiornato',
    });
    expect(mockCreate).not.toHaveBeenCalled();
    expect(mockDelete).toHaveBeenCalledWith('old_kb_2', { force: true });
    expect(mockDelete).toHaveBeenCalledWith('old_kb_3', { force: true });
    expect(mockDelete).not.toHaveBeenCalledWith('old_kb_1', { force: true });
    expect(out.kbRemoteByOmniaDocId['omnia-1']).toBe('old_kb_1');
    expect(out.kbUpdatedCount).toBe(1);
    expect(out.kbCreatedCount).toBe(0);
  });

  it('on agent update deletes orphan docs with fuzzy matching truncated names', async () => {
    mockListBySearch.mockResolvedValue([
      {
        id: 'orphan_2',
        name: 'PAROS - visite prenotabili - prima e seconda tranche -...',
      },
      {
        id: 'orphan_3',
        name: 'PAROS - visite prenotabili - prima e seconda tranche - dettaglio.xlsx',
      },
    ]);

    const longNameDoc = {
      ...baseDoc,
      id: 'omnia-2',
      name: 'PAROS - visite prenotabili - prima e seconda tranche - dettaglio.xlsx',
    };

    await syncConvaiKbDocuments({
      docs: [{ doc: longNameDoc, text: 'contenuto' }],
      existingLink: {
        schemaVersion: 1,
        agentId: 'ag_1',
        kbRemoteByOmniaDocId: { 'omnia-2': 'kept_kb' },
        lastKbRemoteIds: ['kept_kb'],
      },
      isAgentUpdate: true,
      omniaDocNames: [longNameDoc.name],
    });

    expect(mockDelete).toHaveBeenCalledWith('orphan_2', { force: true });
    expect(mockDelete).toHaveBeenCalledWith('orphan_3', { force: true });
    expect(mockDelete).not.toHaveBeenCalledWith('kept_kb', { force: true });
  });

  it('creates when mapped id PATCH fails', async () => {
    mockUpdate.mockRejectedValue(new Error('HTTP 404'));

    const out = await syncConvaiKbDocuments({
      docs: [{ doc: baseDoc, text: 'nuovo testo' }],
      existingLink: {
        schemaVersion: 1,
        agentId: 'ag_1',
        kbRemoteByOmniaDocId: { 'omnia-1': 'stale_id' },
        lastKbRemoteIds: ['stale_id'],
      },
      isAgentUpdate: true,
      omniaDocNames: ['PAROS medici.xlsx'],
    });

    expect(mockCreate).toHaveBeenCalledTimes(1);
    expect(out.kbRemoteByOmniaDocId['omnia-1']).toBe('new_PAROS medici.xlsx');
    expect(mockDelete).toHaveBeenCalledWith('stale_id', { force: true });
  });

  it('throws when orphan purge fails with non-404 error', async () => {
    mockListBySearch.mockResolvedValue([{ id: 'orphan_1', name: 'PAROS medici.xlsx' }]);
    mockDelete.mockRejectedValue(new Error('HTTP 403'));

    await expect(
      syncConvaiKbDocuments({
        docs: [{ doc: baseDoc, text: 't' }],
        existingLink: null,
        isAgentUpdate: true,
        omniaDocNames: ['PAROS medici.xlsx'],
      })
    ).rejects.toThrow(/Purge KB ElevenLabs incompleta/);
  });

  it('on new agent creates without delete', async () => {
    await syncConvaiKbDocuments({
      docs: [{ doc: baseDoc, text: 't' }],
      existingLink: null,
      isAgentUpdate: false,
    });
    expect(mockDelete).not.toHaveBeenCalled();
    expect(mockUpdate).not.toHaveBeenCalled();
    expect(mockCreate).toHaveBeenCalledTimes(1);
  });
});

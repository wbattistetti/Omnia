import { describe, expect, it } from 'vitest';
import { buildUseOfBackendsBodyFromDocument } from '../buildUseOfBackendsPromptSection';
import { pruneBackendAnalysisDocumentToManualCatalog } from '../pruneBackendAnalysisToCatalog';
import type { BackendAnalysisDocumentV2 } from '../backendAnalysisDocumentV2';

function docWithBookAndNext(): BackendAnalysisDocumentV2 {
  return {
    schemaVersion: 2,
    global: {
      agentSystemPromptMarkdown:
        'Per slot chiama sempre il backend `bookfromagenda` con conversationId.',
      proposedBackends: [
        {
          suggestedName: 'prenotazione',
          purposeMarkdown: 'manca endpoint su bookfromagenda',
          specMarkdown: '',
          parameters: {},
        },
      ],
    },
    backends: {
      bk1: {
        catalogEntryId: 'bk1',
        displayLabel: 'bookfromagenda',
        howToUseMarkdown: 'Usa bookfromagenda sempre.',
        parameters: {
          conversationId: {
            paramKey: 'conversationId',
            direction: 'input',
            kind: 'required',
            role: 'id',
            descriptionShort: '',
            analysisSummary: '',
            analysisDetailMarkdown: '',
          },
        },
        suggestedFeatures: [],
      },
      bk2: {
        catalogEntryId: 'bk2',
        displayLabel: 'next-window',
        howToUseMarkdown: 'Usa next-window.',
        parameters: {
          windowDays: {
            paramKey: 'windowDays',
            direction: 'input',
            kind: 'required',
            role: 'giorni',
            descriptionShort: '',
            analysisSummary: '',
            analysisDetailMarkdown: '',
          },
        },
        suggestedFeatures: [],
      },
    },
  };
}

describe('pruneBackendAnalysisToCatalog', () => {
  it('removes backends not in manual catalog', () => {
    const pruned = pruneBackendAnalysisDocumentToManualCatalog(docWithBookAndNext(), [
      { id: 'bk2', label: 'next-window', method: 'POST', endpointUrl: 'https://x' },
    ]);
    expect(pruned.backends.bk1).toBeUndefined();
    expect(pruned.backends.bk2).toBeDefined();
  });

  it('drops global note when it cites removed backend', () => {
    const pruned = pruneBackendAnalysisDocumentToManualCatalog(docWithBookAndNext(), [
      { id: 'bk2', label: 'next-window', method: 'POST', endpointUrl: 'https://x' },
    ]);
    expect(pruned.global.agentSystemPromptMarkdown).toBe('');
  });

  it('buildUseOfBackendsBodyFromDocument filters by manual entries at render time', () => {
    const body = buildUseOfBackendsBodyFromDocument(docWithBookAndNext(), [
      { id: 'bk2', label: 'next-window', method: 'POST', endpointUrl: 'https://x' },
    ]);
    expect(body).toContain('next-window');
    expect(body).not.toContain('bookfromagenda');
    expect(body).not.toMatch(/Global:/);
  });
});

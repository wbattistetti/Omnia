import { describe, expect, it } from 'vitest';
import {
  parseBackendSnapshot,
  parseConversationSnapshot,
  parseKnowledgeBaseSnapshot,
} from '../reviewSnapshots';

describe('reviewSnapshots parse', () => {
  it('parses knowledge base documents', () => {
    const parsed = parseKnowledgeBaseSnapshot({
      documents: [
        {
          id: 'kb-1',
          name: 'policy.xlsx',
          size: 100,
          mimeType: 'application/vnd.ms-excel',
          addedAt: '2026-01-01T00:00:00.000Z',
          parseStatus: 'ready',
        },
      ],
    });
    expect(parsed?.documents).toHaveLength(1);
    expect(parsed?.documents[0]?.name).toBe('policy.xlsx');
  });

  it('parses backend catalog rows for task', () => {
    const parsed = parseBackendSnapshot({
      catalogRows: [
        {
          key: 'GET /api/foo',
          label: 'Foo',
          method: 'GET',
          pathnameDisplay: '/api/foo',
          sources: { graph: true, tools: false, manual: false },
          bindings: [
            {
              bindingId: 'b1',
              source: 'tools',
              method: 'GET',
              endpointUrl: 'https://x/api/foo',
            },
          ],
        },
      ],
      structuredPlaceholders: [{ id: 'ph1', definitionId: 'BookFromAgenda' }],
    });
    expect(parsed?.catalogRows).toHaveLength(1);
    expect(parsed?.structuredPlaceholders).toHaveLength(1);
  });

  it('parses conversation snapshot', () => {
    const parsed = parseConversationSnapshot({
      conversationalRules: [
        {
          id: 'r1',
          libraryRuleId: null,
          label: 'Fallback',
          scenario: 'User angry',
          exampleMessage: 'Mi dispiace',
          sort_order: 0,
        },
      ],
      styleAuto: true,
      styleSelections: {
        cortese: { checked: true, description: 'Polite', example: 'Ciao' },
      },
      globalStyleId: 'cortese',
      styleLearningNotes: 'Breve',
      deployStyleId: null,
    });
    expect(parsed?.conversationalRules).toHaveLength(1);
    expect(parsed?.styleAuto).toBe(true);
    expect(parsed?.styleSelections.cortese?.example).toBe('Ciao');
  });
});

import { describe, expect, it } from 'vitest';
import {
  parseAgentKnowledgeBaseDocumentsJson,
  serializeAgentKnowledgeBaseDocuments,
} from '../serializeKbDocuments';
import type { PersistedKbDocument } from '../kbDocumentTypes';

const sample: PersistedKbDocument[] = [
  {
    id: 'a',
    name: 'listino.txt',
    size: 100,
    mimeType: 'text/plain',
    addedAt: '2026-01-01T00:00:00.000Z',
    parseStatus: 'ready',
    format: 'txt',
    variables: [],
    variableDictionary: {},
    howToUseText: '',
    markdownSnippet: '',
    documentAnalysisMarkdown: '## Analisi\n- voce 1',
    agentAnalysisBaselineMarkdown: '',
  },
];

describe('serializeKbDocuments', () => {
  it('roundtrips persisted rows', () => {
    const json = serializeAgentKnowledgeBaseDocuments(sample);
    expect(parseAgentKnowledgeBaseDocumentsJson(json)).toEqual(sample);
  });

  it('returns empty array for invalid json', () => {
    expect(parseAgentKnowledgeBaseDocumentsJson('not-json')).toEqual([]);
  });

  it('migrates legacy rows without analysis fields to empty strings', () => {
    const legacy = [
      { ...sample[0], documentAnalysisMarkdown: undefined, agentAnalysisBaselineMarkdown: undefined },
    ] as unknown[];
    const parsed = parseAgentKnowledgeBaseDocumentsJson(JSON.stringify(legacy));
    expect(parsed[0]?.documentAnalysisMarkdown).toBe('');
    expect(parsed[0]?.agentAnalysisBaselineMarkdown).toBe('');
  });

  it('roundtrips section baselines', () => {
    const withSections: PersistedKbDocument[] = [
      {
        ...sample[0],
        documentAnalysisSectionBaselines: { 'kbSection:entities': '- foo' },
      },
    ];
    const json = serializeAgentKnowledgeBaseDocuments(withSections);
    expect(parseAgentKnowledgeBaseDocumentsJson(json)).toEqual(withSections);
  });
});

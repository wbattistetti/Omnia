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
    dataTypes: ['Medici', 'Prestazioni'],
    rules: [],
    chatStarted: false,
    semanticStatus: 'idle',
    chatMessages: [],
    analysisPhase: 'idle',
    consentGiven: false,
    currentRuleId: null,
    kbAnalysisComplete: false,
    noActionableRules: false,
    designerSignOffNoUseCases: false,
    promotionStatus: 'idle',
    promotedDrafts: [],
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
});

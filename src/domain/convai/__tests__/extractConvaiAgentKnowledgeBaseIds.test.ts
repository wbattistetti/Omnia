import { describe, expect, it } from 'vitest';
import { extractKnowledgeBaseDocumentIdsFromConvaiConfig } from '../extractConvaiAgentKnowledgeBaseIds';

describe('extractKnowledgeBaseDocumentIdsFromConvaiConfig', () => {
  it('reads ids from agent.prompt.knowledge_base', () => {
    const ids = extractKnowledgeBaseDocumentIdsFromConvaiConfig({
      agent: {
        prompt: {
          knowledge_base: [
            { type: 'text', id: 'kb_a', name: 'Doc A' },
            { type: 'text', id: 'kb_b', name: 'Doc B' },
          ],
        },
      },
    });
    expect(ids).toEqual(['kb_a', 'kb_b']);
  });

  it('returns empty when missing', () => {
    expect(extractKnowledgeBaseDocumentIdsFromConvaiConfig({})).toEqual([]);
    expect(extractKnowledgeBaseDocumentIdsFromConvaiConfig(null)).toEqual([]);
  });
});

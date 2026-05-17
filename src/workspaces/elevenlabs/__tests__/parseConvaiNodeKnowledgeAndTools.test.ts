import { describe, expect, it } from 'vitest';
import { parseNodeKnowledgeBase, parseNodeTools } from '../parseConvaiNodeKnowledgeAndTools';

describe('parseConvaiNodeKnowledgeAndTools', () => {
  it('parses inherit KB toggle and additional documents', () => {
    const kb = parseNodeKnowledgeBase({
      use_agent_knowledge_base: false,
      additional_knowledge_base: [{ id: 'doc_1', name: 'Listino visite' }],
    });
    expect(kb.inheritsAgentKnowledgeBase).toBe(false);
    expect(kb.additionalDocuments).toEqual([{ id: 'doc_1', name: 'Listino visite' }]);
  });

  it('parses built-in system tools and additional tool ids', () => {
    const tools = parseNodeTools({
      use_agent_tools: true,
      additional_tool_ids: ['tool_webhook_1'],
      conversation_config: {
        agent: {
          prompt: {
            tools: [
              { type: 'system', name: 'end_call' },
              { type: 'system', name: 'skip_turn', disabled: true },
            ],
          },
        },
      },
    });
    expect(tools.inheritsAgentTools).toBe(true);
    expect(tools.builtInTools.map((t) => t.label)).toEqual([
      'Termina conversazione',
      'Salta turno',
    ]);
    expect(tools.builtInTools[1]?.enabled).toBe(false);
    expect(tools.additionalTools).toEqual([{ id: 'tool_webhook_1', name: 'tool_webhook_1' }]);
  });
});
